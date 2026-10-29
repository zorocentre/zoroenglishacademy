import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Layers, CheckCircle2, Clock, Play, RotateCcw, AlertCircle, 
  HelpCircle, ChevronRight, ChevronLeft, Flag, Award, Eye, 
  Volume2, Video as VideoIcon, Mic, ArrowLeft, Send, Sparkles, Check, X, FileText
} from 'lucide-react';
import { 
  getStudentTestSeries, 
  startTestSeriesAttempt, 
  saveAssessmentAnswer, 
  submitTestSeriesAttempt, 
  getAssessmentResults 
} from '../../api/competitionApi';
import { resolveFileUrl } from '../../api/fileApi';
import InlineSpinner from '../common/InlineSpinner';
import PageLoader from '../common/PageLoader';
import SkeletonCard from '../common/SkeletonCard';
import SafeVideo from '../common/SafeVideo';
import SafeImage from '../common/SafeImage';
import AudioPromptPlayer from '../common/AudioPromptPlayer';
import QuestionMedia from '../common/QuestionMedia';
import VoiceAnswerRecorder from './VoiceAnswerRecorder';

export default function CompetitionTestSeriesPage() {
  const { currentCompetition } = useOutletContext();

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Test Taker state
  const [activeTest, setActiveTest] = useState(null);
  const [attemptData, setAttemptData] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Results View state
  const [resultsData, setResultsData] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const textSaveTimeoutRef = useRef(null);

  useEffect(() => {
    if (!currentCompetition?.id) return;
    loadTestSeries();
  }, [currentCompetition]);

  const loadTestSeries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentTestSeries(currentCompetition.id);
      if (res && res.success && res.data) {
        setTests(res.data.testSeries || []);
      } else {
        setError(res?.message || 'Failed to load test series.');
      }
    } catch (err) {
      console.error('Error loading test series:', err);
      setError(err.message || 'Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartOrResume = async (test) => {
    setLoading(true);
    setError(null);
    try {
      const res = await startTestSeriesAttempt(test.id);
      if (res && res.success && res.data) {
        setAttemptData(res.data);
        setActiveTest(test);
        setCurrentQuestionIndex(0);

        // Preload existing answers
        const rawAnswers = res.data.answers || {};
        const normalized = {};
        Object.keys(rawAnswers).forEach(qId => {
          normalized[qId] = {
            selectedOptionId: rawAnswers[qId].selectedOptionId || null,
            voiceFileId: rawAnswers[qId].voiceFileId || null,
            voiceDurationSec: rawAnswers[qId].voiceDurationSec || null
          };
        });
        setStudentAnswers(normalized);
        setResultsData(null);
      } else {
        setError(res?.message || 'Failed to start test.');
      }
    } catch (err) {
      console.error('Failed to start test:', err);
      setError(err.message || 'Failed to start test attempt.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = async (test) => {
    setLoadingResults(true);
    setError(null);
    try {
      const res = await getAssessmentResults(test.id);
      if (res && res.success && res.data) {
        setResultsData(res.data);
        setActiveTest(test);
      } else {
        setError(res?.message || 'Failed to load results.');
      }
    } catch (err) {
      console.error('Failed to load results:', err);
      setError(err.message || 'Failed to load assessment results.');
    } finally {
      setLoadingResults(false);
    }
  };

  // Autosave handler
  const handleAnswerSelect = async (questionId, optionId) => {
    const updated = {
      ...studentAnswers,
      [questionId]: {
        ...(studentAnswers[questionId] || {}),
        selectedOptionId: optionId
      }
    };
    setStudentAnswers(updated);
    setSaveStatus('saving');

    try {
      const res = await saveAssessmentAnswer(activeTest.id, {
        questionId,
        selectedOptionId: optionId
      });
      if (res && res.success) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      console.error('Autosave error:', e);
      setSaveStatus('error');
    }
  };

  const handleTextAnswerChange = (questionId, textVal) => {
    const updated = {
      ...studentAnswers,
      [questionId]: {
        ...(studentAnswers[questionId] || {}),
        textAnswer: textVal
      }
    };
    setStudentAnswers(updated);
    if (textSaveTimeoutRef.current) {
      clearTimeout(textSaveTimeoutRef.current);
    }
    setSaveStatus('saving');
    textSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await saveAssessmentAnswer(activeTest.id, {
          questionId,
          textAnswer: textVal
        });
        if (res && res.success) {
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
      } catch (err) {
        setSaveStatus('error');
      }
    }, 500);
  };

  const handleVoiceUploadComplete = async (questionId, { voiceFileId, durationSec }) => {
    const updated = {
      ...studentAnswers,
      [questionId]: {
        ...(studentAnswers[questionId] || {}),
        voiceFileId,
        voiceDurationSec: durationSec
      }
    };
    setStudentAnswers(updated);
    setSaveStatus('saving');

    try {
      const res = await saveAssessmentAnswer(activeTest.id, {
        questionId,
        voiceFileId,
        voiceDurationSec: durationSec
      });
      if (res && res.success) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      console.error('Autosave voice error:', e);
      setSaveStatus('error');
    }
  };

  const toggleFlagQuestion = (qId) => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  const handleSubmitAttempt = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await submitTestSeriesAttempt(activeTest.id);
      if (res && res.success) {
        setShowConfirmSubmit(false);
        // Automatically load results
        await handleViewResults(activeTest);
        // Also refresh the background test list
        loadTestSeries();
      } else {
        setSubmitError(res?.message || 'Failed to submit test.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      setSubmitError(err.message || 'Failed to submit answers.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToList = () => {
    setActiveTest(null);
    setAttemptData(null);
    setResultsData(null);
    loadTestSeries();
  };

  if (!currentCompetition) {
    return (
      <div className="p-8 text-center text-slate-500 font-semibold text-xs">
        No active competition selected.
      </div>
    );
  }

  // --- RENDER RESULTS VIEW ---
  if (resultsData && activeTest) {
    const { assessment, attempt, questions } = resultsData;
    const isMixedTest = assessment.sequenceNo > 30 || attempt?.status === 'EVALUATION_PENDING' || Boolean(resultsData.isPendingEvaluation);
    const isPending = attempt?.status === 'EVALUATION_PENDING' || Boolean(resultsData.isPendingEvaluation);

    // Task K8: Mixed answer types acknowledgement page
    if (isPending) {
      return (
        <div className="space-y-6 max-w-2xl mx-auto py-12 animate-in fade-in duration-200 text-center">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 shadow-sm space-y-6">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto border border-amber-200">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Submitted successfully - Evaluation pending
              </h1>
              <p className="text-sm font-bold text-slate-800">
                {assessment?.title || activeTest?.title || 'Test Series Assessment'}
              </p>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Submitted on {attempt?.submittedAt ? new Date(attempt.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Recently'} (IST)
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
              Your answers have been securely recorded. The result will be published after our evaluation team reviews your responses.
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleBackToList}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                Back to Test Series
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <button
            type="button"
            onClick={handleBackToList}
            className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Test Series</span>
          </button>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              {assessment.type === 'TEST_SERIES' ? `Test Series Slot ${assessment.sequenceNo}` : assessment.type}
            </span>
            <span className="text-sm font-black text-slate-900">{assessment.title}</span>
          </div>
        </div>

        {/* Scorecard Hero */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-xs font-bold mb-3">
                <Award className="w-3.5 h-3.5" />
                <span>Official Assessment Scorecard</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1">
                {attempt.status === 'COMPLETED' ? 'Assessment Completed' : 'Submitted (Evaluation Pending)'}
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm">
                Submitted on {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'Just now'}
              </p>
            </div>

            <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/10">
              <div className="text-center">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block mb-1">Total Score</span>
                <span className="text-3xl sm:text-4xl font-black text-amber-400">
                  {attempt.totalMarks || 0}
                  <span className="text-sm text-slate-400 font-semibold"> / {attempt.maxMarks || 20}</span>
                </span>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="text-center">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block mb-1">Accuracy</span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                  {attempt.maxMarks > 0 ? Math.round(((attempt.totalMarks || 0) / attempt.maxMarks) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Mixed Test Notice */}
          {isMixedTest && attempt.status === 'EVALUATION_PENDING' && (
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start space-x-3 text-amber-200 text-xs leading-relaxed">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-amber-300 mb-0.5">Subjective Answers Under Evaluation</span>
                <span>
                  Subjective answers under evaluation ({attempt.voiceEvaluatedCount || 0} of {attempt.voiceCount || 0} evaluated). 
                  Your objective score is {attempt.mcqMarks || 0} marks. Your final total score will update automatically once our evaluation team finishes evaluating your submitted responses.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Detailed Review Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <span>Question-by-Question Detailed Review</span>
              <span className="text-xs font-bold text-slate-500 px-2 py-0.5 bg-slate-100 rounded-md">
                {questions.length} questions
              </span>
            </h2>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => {
              const studentAns = q.studentAnswer;
              const isVoice = q.answerFormat === 'VOICE';
              const isCorrect = studentAns ? studentAns.isCorrect : false;

              return (
                <div 
                  key={q.id}
                  className={`bg-white border rounded-2xl p-5 sm:p-6 shadow-sm transition-all ${
                    isVoice 
                      ? 'border-slate-200' 
                      : isCorrect 
                        ? 'border-emerald-200 bg-emerald-50/20' 
                        : 'border-rose-200 bg-rose-50/20'
                  }`}
                >
                  {/* Question Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {q.questionFormat} Question
                      </span>
                      {isVoice ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[10px] font-bold">
                          Voice Answer
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold">
                          MCQ Options
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {!isVoice && (
                        isCorrect ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                            <Check className="w-3.5 h-3.5" />
                            <span>Correct (+{studentAns?.marksAwarded || q.marks} marks)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-bold">
                            <X className="w-3.5 h-3.5" />
                            <span>Incorrect (0 marks)</span>
                          </span>
                        )
                      )}
                      {isVoice && (
                        studentAns?.evaluationStatus === 'EVALUATED' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                            <Check className="w-3.5 h-3.5" />
                            <span>Evaluated (+{studentAns.marksAwarded || 0} marks)</span>
                          </span>
                        ) : (!studentAns?.voiceFileId || studentAns?.evaluationStatus === 'SKIPPED' || attempt?.evaluationMode === 'AUTO_EVALUATED') ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-bold">
                            <X className="w-3.5 h-3.5" />
                            <span>Not answered (0 marks)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pending Evaluation</span>
                          </span>
                        )
                      )}
                      <span className="text-xs font-black text-slate-700">
                        {q.marks || 1} {q.marks === 1 ? 'Mark' : 'Marks'}
                      </span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-4 leading-relaxed">
                    {q.questionText}
                  </h3>

                  {/* Options (for MCQ) */}
                  {!isVoice && q.options && (
                    <div className="space-y-2 mb-4">
                      {q.options.map((opt, oIdx) => {
                        const isStudentChoice = studentAns?.selectedOptionId === opt.id;
                        const isCorrectOption = Boolean(opt.isCorrect);

                        let optionStyle = 'border-slate-200 bg-white text-slate-700';
                        if (isCorrectOption) {
                          optionStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500';
                        } else if (isStudentChoice && !isCorrectOption) {
                          optionStyle = 'border-rose-500 bg-rose-50 text-rose-900 font-bold ring-1 ring-rose-500';
                        }

                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center justify-between p-3 rounded-xl border text-xs sm:text-sm ${optionStyle}`}
                          >
                            <div className="flex items-center space-x-3">
                              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs">
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span>{opt.text}</span>
                            </div>

                            <div className="flex items-center space-x-2">
                              {isStudentChoice && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  isCorrectOption ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
                                }`}>
                                  Your Choice
                                </span>
                              )}
                              {isCorrectOption && (
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-600 text-white rounded-md flex items-center space-x-1">
                                  <Check className="w-3 h-3" />
                                  <span>Correct Answer</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Voice Answer Review */}
                  {isVoice && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mb-4">
                      <span className="text-xs font-bold text-slate-700 block">Submitted Voice Recording:</span>
                      {studentAns?.voiceFileId ? (
                        <div className="flex items-center space-x-2 text-xs text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Voice recording captured and stored ({studentAns.voiceDurationSec || 0} seconds)</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Not answered (0 marks)</span>
                      )}
                      {studentAns?.feedback && (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                          <span className="font-bold block mb-1">Evaluation Feedback:</span>
                          <span>{studentAns.feedback}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation (shown strictly after submission) */}
                  {q.explanation && (
                    <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
                      <div className="flex items-center space-x-1.5 font-bold mb-1 text-blue-800">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Explanation & Solution:</span>
                      </div>
                      <p>{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER TEST TAKER VIEW ---
  if (activeTest && attemptData) {
    const questions = attemptData.questions || [];
    const currentQ = questions[currentQuestionIndex];
    const isVoice = currentQ?.answerFormat === 'VOICE';
    const totalQ = questions.length;
    const answeredCount = Object.keys(studentAnswers).filter(k => 
      studentAnswers[k]?.selectedOptionId || studentAnswers[k]?.voiceFileId || (studentAnswers[k]?.textAnswer && studentAnswers[k].textAnswer.trim())
    ).length;

    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
        {/* Top Active Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleBackToList}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
              title="Save & Return to list"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                  Slot {activeTest.sequenceNo}
                </span>
                <h1 className="text-base font-black text-slate-900">{activeTest.title}</h1>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {answeredCount} of {totalQ} questions answered
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            {/* Autosave Pill */}
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs font-semibold">
              {saveStatus === 'saving' ? (
                <>
                  <InlineSpinner />
                  <span className="text-slate-600">Saving answer...</span>
                </>
              ) : saveStatus === 'saved' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-slate-600">Saved</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-rose-600">Save failed - retrying</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmSubmit(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Test</span>
            </button>
          </div>
        </div>

        {/* Question Content & Question Palette Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Question Panel */}
          <div className="lg:col-span-3 space-y-4">
            {currentQ && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
                {/* Question Info Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black">
                      Question {currentQuestionIndex + 1} of {totalQ}
                    </span>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                      {currentQ.marks || 1} {currentQ.marks === 1 ? 'Mark' : 'Marks'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleFlagQuestion(currentQ.id)}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                      flaggedQuestions[currentQ.id]
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${flaggedQuestions[currentQ.id] ? 'fill-amber-600 text-amber-600' : ''}`} />
                    <span>{flaggedQuestions[currentQ.id] ? 'Flagged' : 'Flag'}</span>
                  </button>
                </div>

                {/* Shared Question Media Prompt */}
                {(currentQ.questionFormat === 'IMAGE' || currentQ.questionFormat === 'VIDEO' || currentQ.questionFormat === 'AUDIO' || currentQ.mediaRef || currentQ.imageUrl) && (
                  <div className="mb-5">
                    <QuestionMedia
                      questionFormat={currentQ.questionFormat || (currentQ.imageUrl ? 'IMAGE' : 'MCQ')}
                      mediaRef={currentQ.mediaRef || currentQ.imageUrl}
                      title="Question Media Prompt"
                    />
                  </div>
                )}

                {/* Question Statement */}
                <div className="text-base sm:text-lg font-bold text-slate-900 mb-6 leading-relaxed">
                  {currentQ.questionText}
                </div>

                {/* Guidance Text */}
                {currentQ.guidanceText && (
                  <div className="mb-6 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start space-x-2">
                    <HelpCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>{currentQ.guidanceText}</span>
                  </div>
                )}

                {/* Written Answer Area */}
                {currentQ.answerFormat === 'TEXT' && (
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                      <span className="flex items-center gap-1.5 text-blue-700">
                        <FileText className="w-4 h-4" /> Written Answer Required
                      </span>
                      <span>{(studentAnswers[currentQ.id]?.textAnswer || '').length} / 5000 characters</span>
                    </div>
                    <textarea
                      value={studentAnswers[currentQ.id]?.textAnswer || ''}
                      onChange={(e) => handleTextAnswerChange(currentQ.id, e.target.value)}
                      maxLength={5000}
                      rows={7}
                      placeholder="Type your response here (up to 5,000 characters)..."
                      className="w-full p-4 rounded-2xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 resize-y font-sans leading-relaxed"
                    />
                  </div>
                )}

                {/* MCQ Options Selector */}
                {currentQ.answerFormat !== 'VOICE' && currentQ.answerFormat !== 'TEXT' && currentQ.options && (
                  <div className="space-y-3 mb-6">
                    {currentQ.options.map((opt, oIdx) => {
                      const isSelected = studentAnswers[currentQ.id]?.selectedOptionId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleAnswerSelect(currentQ.id, opt.id)}
                          className={`w-full text-left p-4 rounded-2xl border text-sm transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold ring-2 ring-blue-600/30'
                              : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50/60'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span>{opt.text}</span>
                          </div>

                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Voice Recording Answer */}
                {isVoice && (
                  <div className="mb-6">
                    <span className="text-xs font-bold text-slate-700 block mb-2">Record Spoken Answer:</span>
                    <VoiceAnswerRecorder
                      key={currentQ.id}
                      questionId={currentQ.id}
                      savedVoiceFileId={studentAnswers[currentQ.id]?.voiceFileId}
                      savedDurationSec={studentAnswers[currentQ.id]?.voiceDurationSec}
                      maxDurationSeconds={currentQ.maxDurationSeconds || 90}
                      onUploadComplete={(data) => handleVoiceUploadComplete(currentQ.id, data)}
                    />
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex(i => i - 1)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  {currentQuestionIndex < totalQ - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentQuestionIndex(i => i + 1)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 shadow-sm transition-colors"
                    >
                      <span>Next Question</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowConfirmSubmit(true)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 shadow-sm transition-colors"
                    >
                      <span>Finish & Submit</span>
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Question Palette */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Question Palette ({totalQ})
              </h3>

              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAns = !!(studentAnswers[q.id]?.selectedOptionId || studentAnswers[q.id]?.voiceFileId || (studentAnswers[q.id]?.textAnswer && studentAnswers[q.id].textAnswer.trim().length > 0));
                  const isCurrent = currentQuestionIndex === idx;
                  const isFlag = flaggedQuestions[q.id];

                  let btnStyle = 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200';
                  if (isCurrent) {
                    btnStyle = 'bg-blue-600 text-white font-black ring-2 ring-blue-500/40 border-blue-600';
                  } else if (isFlag) {
                    btnStyle = 'bg-amber-100 text-amber-800 font-bold border-amber-300';
                  } else if (isAns) {
                    btnStyle = 'bg-emerald-100 text-emerald-800 font-bold border-emerald-300';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`h-9 rounded-xl border flex items-center justify-center text-xs transition-all ${btnStyle}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Palette Legend */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600 font-medium">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded-md inline-block" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 bg-amber-100 border border-amber-300 rounded-md inline-block" />
                  <span>Flagged for Review</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 bg-slate-100 border border-slate-200 rounded-md inline-block" />
                  <span>Unanswered</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Confirmation Modal */}
        {showConfirmSubmit && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <Send className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-black text-slate-900">Submit Your Test Answers?</h3>
                <p className="text-xs text-slate-500">
                  Once submitted, the server will evaluate your answers. You cannot change your answers after submission.
                </p>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Questions:</span>
                  <span className="font-bold text-slate-800">{totalQ}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Answered Questions:</span>
                  <span className="font-bold text-emerald-600">{answeredCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Unanswered Questions:</span>
                  <span className="font-bold text-rose-600">{totalQ - answeredCount}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmSubmit(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel & Review
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAttempt}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors inline-flex items-center justify-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <InlineSpinner size="w-4 h-4" />
                      <span>Evaluating...</span>
                    </>
                  ) : (
                    <span>Yes, Submit Now</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- RENDER 35 TEST SERIES GRID ---
  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>Practice & Diagnostic Modules</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Competition Test Series (35 Slots)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Always unlocked chapter-wise and module tests. Attempt at your own pace with instant automated scoring.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-3 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block mb-0.5">Test Series Error</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : tests.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl text-slate-500 space-y-2">
          <Layers className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-sm">No test series available yet.</p>
          <p className="text-xs">Assessments will appear here once published by the academy administrator.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tests.map((test) => {
            const isUnpublished = test.attemptStatus === 'UNPUBLISHED';
            const isCompleted = test.attemptStatus === 'COMPLETED';
            const isPending = test.attemptStatus === 'EVALUATION_PENDING';
            const isInProgress = test.attemptStatus === 'IN_PROGRESS';
            const isNotStarted = test.attemptStatus === 'NOT_STARTED';
            const isMixed = test.sequenceNo > 30;

            return (
              <div
                key={test.id}
                data-testid={`test-card-${test.sequenceNo}`}
                className={`bg-white border rounded-3xl p-5 sm:p-6 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                  isUnpublished ? 'opacity-70 bg-slate-50/60 border-slate-200' : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-black">
                      Slot {test.sequenceNo}
                    </span>
                  </div>

                  {/* Title & Stats */}
                  <h3 className="text-base font-black text-slate-900 mb-1">{test.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mb-4">
                    <span className="font-bold text-slate-700">{test.totalMarks ?? 0} Marks</span>
                    <span>•</span>
                    <span className="font-bold text-indigo-600">
                      Total Questions: {test.questionCount ?? 0}
                    </span>
                  </div>

                  {/* Status Badges */}
                  <div className="mb-4">
                    {isUnpublished && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
                        <span>Coming soon</span>
                      </span>
                    )}

                    {isNotStarted && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Not Started</span>
                      </span>
                    )}

                    {isInProgress && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                        <span>In Progress ({test.answeredCount || 0} answered)</span>
                      </span>
                    )}

                    {isPending && (
                      <div className="space-y-1">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Evaluation Pending</span>
                        </span>
                        <p className="text-[11px] text-amber-700 font-medium">
                          Voice answers under evaluation ({test.voiceEvaluatedCount || 0} of {test.voiceQuestionsCount || 0} evaluated)
                        </p>
                      </div>
                    )}

                    {isCompleted && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Score: {test.totalMarksAwarded || 0} / {test.totalMarks} Marks</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="pt-3 border-t border-slate-100">
                  {isUnpublished ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold cursor-not-allowed text-center"
                    >
                      Coming Soon
                    </button>
                  ) : isNotStarted ? (
                    <button
                      type="button"
                      onClick={() => handleStartOrResume(test)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center space-x-1.5 shadow-sm transition-all"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Test</span>
                    </button>
                  ) : isInProgress ? (
                    <button
                      type="button"
                      onClick={() => handleStartOrResume(test)}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center space-x-1.5 shadow-sm transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Resume Test</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleViewResults(test)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center space-x-1.5 shadow-sm transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isPending ? 'Review Answers' : 'View Results & Solutions'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
