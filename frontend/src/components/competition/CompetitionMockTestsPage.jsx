import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Layers, CheckCircle2, Clock, Play, AlertCircle, 
  HelpCircle, ChevronRight, ChevronLeft, Flag, Award, Eye, 
  Volume2, Mic, ArrowLeft, Send, Sparkles, Check, X, Lock, Flame, FileText
} from 'lucide-react';
import { 
  getStudentMockTests, 
  startMockTestAttempt, 
  saveMockAssessmentAnswer, 
  submitMockTestAttempt, 
  getMockAssessmentResults 
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
import SecureExamConsentModal from './SecureExamConsentModal';
import ProctorViolationWarningModal from './ProctorViolationWarningModal';
import { useSecureExamProctor } from './useSecureExamProctor';
import { getServerNow } from '../../utils/scheduleSortUtil';

export default function CompetitionMockTestsPage() {
  const { currentCompetition, isExamActive, setIsExamActive } = useOutletContext();

  const [mockTests, setMockTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Mock Test Taker state
  const [activeTest, setActiveTest] = useState(null);
  const [attemptData, setAttemptData] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Proctor & Consent state
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [pendingTestForConsent, setPendingTestForConsent] = useState(null);

  // Remaining Seconds countdown during test
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const timerRef = useRef(null);
  const textSaveTimeoutRef = useRef(null);

  // Results View state
  const [resultsData, setResultsData] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);

  // Task K6: Sync exam active state with portal layout
  useEffect(() => {
    const active = Boolean(activeTest && !resultsData);
    setIsExamActive?.(active);
    return () => {
      setIsExamActive?.(false);
    };
  }, [activeTest, resultsData, setIsExamActive]);

  // Live countdown ticker for upcoming/live tests in list view
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const ticker = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  const handleProctorAutoSubmit = useCallback(async (reason) => {
    if (!activeTest || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await submitMockTestAttempt(activeTest.id);
      if (res && res.success) {
        const resultsRes = await getMockAssessmentResults(activeTest.id);
        if (resultsRes && resultsRes.success) {
          setResultsData(resultsRes.data);
        } else {
          loadMockTests();
          setActiveTest(null);
        }
      }
    } catch (err) {
      console.error('Proctor auto-submit error:', err);
      loadMockTests();
      setActiveTest(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeTest, isSubmitting]);

  const proctor = useSecureExamProctor({
    attemptId: attemptData?.attemptId || attemptData?.attempt?.id || attemptData?.id,
    isActive: Boolean(activeTest && !resultsData),
    initialViolationCount: attemptData?.proctorViolationCount || attemptData?.attempt?.proctorViolationCount || 0,
    maxViolations: 3,
    onAutoSubmit: handleProctorAutoSubmit
  });

  const requestExamStart = (test) => {
    setPendingTestForConsent(test);
    setConsentModalOpen(true);
  };

  const handleConfirmConsent = async () => {
    const test = pendingTestForConsent;
    setConsentModalOpen(false);
    setPendingTestForConsent(null);
    if (!test) return;
    await proctor.enterFullscreen();
    await handleStartOrResume(test);
  };

  useEffect(() => {
    if (!currentCompetition?.id) return;
    loadMockTests();
  }, [currentCompetition]);

  const loadMockTests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentMockTests(currentCompetition.id);
      if (res && res.success && res.data) {
        setMockTests(res.data.mockTests || []);
      } else {
        setError(res?.message || 'Failed to load mock tests.');
      }
    } catch (err) {
      console.error('Error loading mock tests:', err);
      setError(err.message || 'Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartOrResume = async (test) => {
    setLoading(true);
    setError(null);
    try {
      const res = await startMockTestAttempt(test.id);
      if (res && res.success && res.data) {
        setAttemptData(res.data);
        setActiveTest(test);
        setCurrentQuestionIndex(0);
        const durationSec = (res.data.durationMinutes || test.durationMinutes || 45) * 60;
        let initialRemaining = res.data.remainingSeconds != null ? res.data.remainingSeconds : durationSec;
        if (res.data.endsAt) {
          const endsAtMs = new Date(res.data.endsAt).getTime();
          const serverNowMs = getServerNow().getTime();
          initialRemaining = Math.max(0, Math.floor((endsAtMs - serverNowMs) / 1000));
        }
        setRemainingSeconds(initialRemaining);

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
        setError(res?.message || 'Failed to start mock test.');
      }
    } catch (err) {
      console.error('Failed to start mock test:', err);
      setError(err.message || 'Failed to start mock test attempt.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = async (test) => {
    setLoadingResults(true);
    setError(null);
    try {
      const res = await getMockAssessmentResults(test.id);
      if (res && res.success && res.data) {
        setResultsData(res.data);
        setActiveTest(test);
      } else {
        setError(res?.message || 'Failed to fetch test results.');
      }
    } catch (err) {
      console.error('Failed to get test results:', err);
      setError(err.message || 'Failed to retrieve results.');
    } finally {
      setLoadingResults(false);
    }
  };

  // Timer countdown hook for test taker
  useEffect(() => {
    if (activeTest && !resultsData && remainingSeconds !== null && remainingSeconds > 0) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [activeTest, resultsData, remainingSeconds]);

  const handleAutoSubmit = useCallback(async () => {
    if (!activeTest || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await proctor.exitFullscreen();
      const res = await submitMockTestAttempt(activeTest.id);
      if (res && res.success) {
        const resultsRes = await getMockAssessmentResults(activeTest.id);
        if (resultsRes && resultsRes.success) {
          setResultsData(resultsRes.data);
        } else {
          loadMockTests();
          setActiveTest(null);
        }
      }
    } catch (err) {
      console.error('Auto submit error:', err);
      loadMockTests();
      setActiveTest(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeTest, isSubmitting, proctor]);

  // Autosave option for MCQ
  const handleSelectOption = async (questionId, optionId) => {
    if (!activeTest) return;

    setStudentAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        selectedOptionId: optionId
      }
    }));

    setSaveStatus('saving');
    try {
      const res = await saveMockAssessmentAnswer(activeTest.id, {
        questionId,
        selectedOptionId: optionId
      });
      if (res && res.success) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Error saving MCQ answer:', err);
      setSaveStatus('error');
    }
  };

  // Autosave text answer
  const handleTextAnswerChange = (questionId, textVal) => {
    if (!activeTest) return;
    setStudentAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        textAnswer: textVal
      }
    }));
    if (textSaveTimeoutRef.current) {
      clearTimeout(textSaveTimeoutRef.current);
    }
    setSaveStatus('saving');
    textSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await saveMockAssessmentAnswer(activeTest.id, {
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

  // Autosave voice recording
  const handleVoiceUploadComplete = async (questionId, fileIdOrObj, durationSec) => {
    if (!activeTest) return;

    const actualFileId = (typeof fileIdOrObj === 'object' && fileIdOrObj !== null)
      ? (fileIdOrObj.voiceFileId || fileIdOrObj.id || fileIdOrObj.fileId)
      : fileIdOrObj;
    const actualDuration = (typeof fileIdOrObj === 'object' && fileIdOrObj !== null)
      ? (fileIdOrObj.durationSec ?? fileIdOrObj.duration ?? durationSec)
      : durationSec;

    setStudentAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        voiceFileId: actualFileId,
        voiceDurationSec: actualDuration
      }
    }));

    setSaveStatus('saving');
    try {
      const res = await saveMockAssessmentAnswer(activeTest.id, {
        questionId,
        voiceFileId: actualFileId,
        voiceDurationSec: actualDuration
      });
      if (res && res.success) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Error saving voice answer:', err);
      setSaveStatus('error');
    }
  };

  const handleManualSubmit = async () => {
    if (!activeTest) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await proctor.exitFullscreen();
      const res = await submitMockTestAttempt(activeTest.id);
      if (res && res.success) {
        setShowConfirmSubmit(false);
        const resultsRes = await getMockAssessmentResults(activeTest.id);
        if (resultsRes && resultsRes.success) {
          setResultsData(resultsRes.data);
        } else {
          loadMockTests();
          setActiveTest(null);
        }
      } else {
        setSubmitError(res?.message || 'Failed to submit mock test.');
      }
    } catch (err) {
      console.error('Error submitting test:', err);
      setSubmitError(err.message || 'Failed to submit mock test.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimer = (seconds) => {
    if (seconds == null || isNaN(seconds)) return '00:00';
    const totalSec = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatWindowDate = (isoStr) => {
    if (!isoStr) return 'TBA';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  const formatRemainingCountdown = (seconds) => {
    if (!seconds || seconds <= 0) return '00m 00s';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // Find next live or upcoming mock test for countdown hero
  const liveMock = mockTests.find(m => m.windowStatus === 'LIVE' && m.status === 'PUBLISHED');
  const upcomingMock = mockTests.find(m => m.windowStatus === 'UPCOMING' && m.status === 'PUBLISHED');

  // ==========================================
  // VIEW: SCORECARD / DETAILED REVIEW
  // ==========================================
  if (resultsData) {
    const { assessment, attempt, questions } = resultsData;
    const isPendingEvaluation = attempt?.status === 'EVALUATION_PENDING' || Boolean(resultsData?.isPendingEvaluation);
    const totalAwarded = attempt?.totalMarks || 0;
    const maxMarks = attempt?.maxMarks || assessment?.totalMarks || 1;
    const accuracy = maxMarks > 0 ? Math.round((totalAwarded / maxMarks) * 100) : 0;

    // Task K8: Mixed answer types acknowledgement page
    if (isPendingEvaluation) {
      return (
        <div className="max-w-2xl mx-auto py-12 space-y-6 text-center animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 shadow-sm space-y-6">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto border border-amber-200">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Submitted successfully - Evaluation pending
              </h1>
              <p className="text-sm font-bold text-slate-800">
                {assessment?.title || activeTest?.title || 'Mock Test Assessment'}
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
                onClick={() => {
                  setResultsData(null);
                  setActiveTest(null);
                  loadMockTests();
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                Back to Mock Tests
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back Button */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setResultsData(null);
              setActiveTest(null);
              loadMockTests();
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Mock Tests
          </button>
          <span className="text-xs px-2.5 py-1 font-semibold rounded-full bg-slate-100 text-slate-700">
            Mock Test #{assessment?.sequenceNo} Review
          </span>
        </div>

        {/* Proctoring Violation Alert if auto-submitted */}
        {(attempt?.autoSubmitted || resultsData?.autoSubmitted) && (
          <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl flex items-center gap-3 text-rose-900 shadow-sm">
            <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">Exam Terminated: Excessive Proctoring Violations</p>
              <p className="text-xs text-rose-700">
                This assessment was automatically submitted because the proctoring integrity threshold was reached ({attempt?.proctorViolationCount || resultsData?.proctorViolationCount || 3} infractions detected).
              </p>
            </div>
          </div>
        )}

        {/* Scorecard Hero Banner */}
        <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full text-xs font-semibold uppercase tracking-wider text-indigo-200">
                <Award className="w-3.5 h-3.5" />
                Performance Report
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {assessment?.title || 'Mock Test Results'}
              </h1>
              <p className="text-sm text-indigo-100 max-w-xl">
                {isPendingEvaluation
                  ? 'Your objective section has been automatically evaluated. Your subjective responses have been queued for evaluation review.'
                  : 'Congratulations on completing this mock test simulation! Review detailed solutions and rationales below.'}
              </p>
            </div>

            {/* Scorecard Metric Pill */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 text-center min-w-[200px]">
              <div className="text-xs font-medium text-indigo-200 uppercase tracking-wide">
                {isPendingEvaluation ? 'Provisional Score' : 'Final Score'}
              </div>
              <div className="text-4xl font-extrabold mt-1">
                {totalAwarded} <span className="text-xl font-normal text-indigo-200">/ {maxMarks}</span>
              </div>
              <div className="text-xs font-medium text-indigo-200 mt-1">
                Accuracy: {accuracy}%
              </div>
              {isPendingEvaluation && (
                <div className="mt-2 text-[11px] bg-amber-400/20 text-amber-200 border border-amber-300/30 rounded px-2 py-0.5">
                  Evaluation Review Pending
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 text-center">
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xs text-indigo-200">MCQ Marks</div>
              <div className="text-lg font-bold mt-0.5">{attempt?.mcqMarks || 0}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xs text-indigo-200">Voice Marks</div>
              <div className="text-lg font-bold mt-0.5">
                {isPendingEvaluation ? 'Pending' : (attempt?.voiceMarks || 0)}
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xs text-indigo-200">Correct MCQs</div>
              <div className="text-lg font-bold mt-0.5 text-emerald-300">{attempt?.correctCount || 0}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xs text-indigo-200">Incorrect MCQs</div>
              <div className="text-lg font-bold mt-0.5 text-rose-300">{attempt?.incorrectCount || 0}</div>
            </div>
          </div>
        </div>

        {/* Questions Review List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-600" />
            Question-by-Question Detailed Solutions
          </h2>

          {(questions || []).map((q, idx) => {
            const isMcq = q.answerFormat === 'MCQ_OPTIONS';
            const isVoice = q.answerFormat === 'VOICE';
            const ans = q.studentAnswer;
            const isCorrect = ans?.isCorrect === true;

            return (
              <div
                key={q.id || idx}
                className={`bg-white border rounded-2xl p-5 sm:p-6 shadow-sm transition-all ${
                  isMcq 
                    ? isCorrect 
                      ? 'border-emerald-200 bg-emerald-50/10' 
                      : ans?.selectedOptionId 
                        ? 'border-rose-200 bg-rose-50/10' 
                        : 'border-slate-200'
                    : 'border-indigo-200 bg-indigo-50/10'
                }`}
              >
                {/* Question Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">
                      {isMcq ? 'Multiple Choice' : 'Voice Speaking'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {q.marks || 1} {q.marks === 1 ? 'Mark' : 'Marks'}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isMcq ? (
                      isCorrect ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <Check className="w-3.5 h-3.5" /> Correct (+{q.marks || 1})
                        </span>
                      ) : ans?.selectedOptionId ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                          <X className="w-3.5 h-3.5" /> Incorrect (0)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                          Skipped
                        </span>
                      )
                    ) : (
                      ans?.evaluationStatus === 'EVALUATED' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <Check className="w-3.5 h-3.5" /> Evaluated (+{ans?.marksAwarded || 0})
                        </span>
                      ) : (!ans?.voiceFileId || ans?.evaluationStatus === 'SKIPPED' || attempt?.evaluationMode === 'AUTO_EVALUATED') ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                          <X className="w-3.5 h-3.5" /> Not answered (0 marks)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                          <Mic className="w-3.5 h-3.5" /> Pending Evaluation
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <p className="mt-3 text-base font-semibold text-slate-900 leading-relaxed">
                  {q.questionText}
                </p>

                {/* Options List (for MCQ) */}
                {isMcq && (
                  <div className="mt-4 space-y-2">
                    {(q.options || []).map(opt => {
                      const isSelected = ans?.selectedOptionId === opt.id;
                      const isOptionCorrect = opt.isCorrect === true;

                      let optClasses = 'border-slate-200 bg-white text-slate-700';
                      if (isOptionCorrect) {
                        optClasses = 'border-emerald-500 bg-emerald-50/80 text-emerald-900 font-medium ring-1 ring-emerald-500';
                      } else if (isSelected && !isOptionCorrect) {
                        optClasses = 'border-rose-400 bg-rose-50/80 text-rose-900 line-through';
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center justify-between p-3.5 rounded-xl border text-sm transition-colors ${optClasses}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold bg-white/60">
                              {opt.sortOrder != null ? String.fromCharCode(65 + opt.sortOrder) : ''}
                            </span>
                            <span>{opt.text}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                                Your Choice
                              </span>
                            )}
                            {isOptionCorrect && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Correct Answer
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Voice Answer Playback (for Voice Questions) */}
                {isVoice && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs font-medium text-slate-500 mb-2">Student Recorded Voice:</div>
                    {ans?.voiceFileId ? (
                      <AudioPromptPlayer src={ans.voiceFileId} label="Student Recorded Voice" />
                    ) : (
                      <p className="text-sm text-slate-500 italic">Not answered (0 marks)</p>
                    )}
                  </div>
                )}

                {/* Explanation Box */}
                {q.explanation && (
                  <div className="mt-4 p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 text-sm">
                    <div className="flex items-center gap-1.5 font-semibold text-indigo-900 mb-1">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Detailed Explanation & Rationale
                    </div>
                    <p className="text-indigo-950/80 leading-relaxed">{q.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: ACTIVE MOCK TEST TAKER
  // ==========================================
  if (activeTest && attemptData) {
    const questions = attemptData.questions || [];
    const currentQ = questions[currentQuestionIndex];
    const isVoice = currentQ?.answerFormat === 'VOICE';
    const isText = currentQ?.answerFormat === 'TEXT';
    const isMcq = currentQ?.answerFormat === 'MCQ_OPTIONS' || (!isVoice && !isText);
    const currentAns = currentQ ? studentAnswers[currentQ.id] : null;

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <ProctorViolationWarningModal
          isOpen={proctor.warningModalOpen}
          violationCount={proctor.violationCount}
          maxViolations={3}
          reason={proctor.currentViolationReason}
          onResume={proctor.enterFullscreen}
        />

        {/* Test Taker Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-4 z-20">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                Mock Test #{activeTest.sequenceNo}
              </span>
              <span className="text-xs text-slate-500">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-1 truncate max-w-md">
              {activeTest.title}
            </h1>
          </div>

          {/* Right Header Status: Timer & Submit */}
          <div className="flex items-center gap-4">
            {/* Proctoring Status Pill */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xs">
              <span className={`w-2 h-2 rounded-full ${proctor.violationCount > 0 ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
              <span>Proctored ({proctor.violationCount}/3)</span>
            </span>

            {/* Live Countdown Timer */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-sm font-bold border transition-colors ${
              remainingSeconds !== null && remainingSeconds <= 300 && remainingSeconds > 0 
                ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                : 'bg-slate-50 text-slate-800 border-slate-200'
            }`}>
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>

            {/* Autosave Status Indicator */}
            <div className="hidden sm:flex items-center text-xs text-slate-500 font-medium">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1.5 text-indigo-600">
                  <InlineSpinner /> Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5" /> Save failed
                </span>
              )}
            </div>

            {/* Finish Test CTA */}
            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow transition-colors"
            >
              <Send className="w-4 h-4" />
              Submit Exam
            </button>
          </div>
        </div>

        {/* Question Palette Drawer / Strip */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Question Navigator</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Answered</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Flagged</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block" /> Not Visited</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {questions.map((q, idx) => {
              const isAnswered = !!(studentAnswers[q.id]?.selectedOptionId || studentAnswers[q.id]?.voiceFileId || (studentAnswers[q.id]?.textAnswer && studentAnswers[q.id].textAnswer.trim().length > 0));
              const isFlagged = flaggedQuestions[q.id];
              const isCurrent = idx === currentQuestionIndex;

              let btnClass = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
              if (isCurrent) {
                btnClass = 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-300';
              } else if (isFlagged) {
                btnClass = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
              } else if (isAnswered) {
                btnClass = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
              }

              return (
                <button
                  key={q.id || idx}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-9 h-9 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all ${btnClass}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Question View */}
        {currentQ ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-700 uppercase">
                  Question {currentQuestionIndex + 1}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {isMcq ? 'Multiple Choice (Select One)' : isText ? 'Written Response Required' : 'Voice Speaking Task'}
                </span>
              </div>
              <button
                onClick={() => setFlaggedQuestions(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg border transition-colors ${
                  flaggedQuestions[currentQ.id]
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                {flaggedQuestions[currentQ.id] ? 'Flagged for Review' : 'Flag Question'}
              </button>
            </div>

            {/* Shared Question Media Prompt */}
            {(currentQ.questionFormat === 'IMAGE' || currentQ.questionFormat === 'VIDEO' || currentQ.questionFormat === 'AUDIO' || currentQ.mediaRef || currentQ.imageUrl || currentQ.audioUrl) && (
              <div className="mb-4">
                <QuestionMedia
                  questionFormat={currentQ.questionFormat || (currentQ.imageUrl ? 'IMAGE' : currentQ.audioUrl ? 'AUDIO' : 'MCQ')}
                  mediaRef={currentQ.mediaRef || currentQ.imageUrl || currentQ.audioUrl}
                  title="Question Media Prompt"
                />
              </div>
            )}

            {/* Question Text */}
            <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
              {currentQ.questionText}
            </div>

            {/* Text Answer Area */}
            {isText && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span className="flex items-center gap-1.5 text-indigo-700">
                    <FileText className="w-4 h-4" /> Written Answer
                  </span>
                  <span>{(currentAns?.textAnswer || '').length} / 5000 characters</span>
                </div>
                <textarea
                  value={currentAns?.textAnswer || ''}
                  onChange={(e) => handleTextAnswerChange(currentQ.id, e.target.value)}
                  maxLength={5000}
                  rows={7}
                  placeholder="Type your response here (up to 5,000 characters)..."
                  className="w-full p-4 rounded-xl border border-slate-300 bg-white text-slate-900 caret-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 resize-y font-sans leading-relaxed"
                />
              </div>
            )}

            {/* MCQ Options */}
            {isMcq && (
              <div className="space-y-3 pt-2">
                {(currentQ.options || []).map(opt => {
                  const isSelected = currentAns?.selectedOptionId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectOption(currentQ.id, opt.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500 text-indigo-950 font-medium'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                          isSelected 
                            ? 'bg-indigo-600 text-white border-indigo-600' 
                            : 'border-slate-300 bg-slate-50 text-slate-600 group-hover:border-slate-400'
                        }`}>
                          {opt.sortOrder != null ? String.fromCharCode(65 + opt.sortOrder) : ''}
                        </span>
                        <span className="text-sm sm:text-base">{opt.text}</span>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-indigo-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Voice Question Recorder */}
            {isVoice && (
              <div className="space-y-4 pt-2">
                {currentQ.guidanceText && (
                  <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-100 text-xs text-purple-900 flex items-start gap-2">
                    <Volume2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Instructions:</strong> {currentQ.guidanceText}</span>
                  </div>
                )}
                <VoiceAnswerRecorder
                  key={currentQ.id}
                  questionId={currentQ.id}
                  maxDurationSeconds={currentQ.maxDurationSeconds || 120}
                  savedVoiceFileId={currentAns?.voiceFileId}
                  savedDurationSec={currentAns?.voiceDurationSec}
                  existingVoiceFileId={currentAns?.voiceFileId}
                  onUploadComplete={(data) => handleVoiceUploadComplete(currentQ.id, data)}
                />
              </div>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-6">
              <button
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Question
              </button>
              <button
                disabled={currentQuestionIndex === questions.length - 1}
                onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                Next Question
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border">
            No questions found in this mock test.
          </div>
        )}

        {/* Confirm Submit Modal */}
        {showConfirmSubmit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center gap-3 text-amber-600">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold text-slate-900">Submit Mock Test?</h3>
              </div>
              <p className="text-sm text-slate-600">
                Are you ready to submit your exam? Once submitted, your MCQ answers will be scored immediately and your solutions unlocked.
              </p>

              {/* Status summary */}
              <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span>Total Questions:</span>
                  <span className="font-bold">{questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Answered Questions:</span>
                  <span className="font-bold text-emerald-600">
                    {Object.values(studentAnswers).filter(a => a?.selectedOptionId || a?.voiceFileId || (a?.textAnswer && a.textAnswer.trim().length > 0)).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Flagged for Review:</span>
                  <span className="font-bold text-amber-600">
                    {Object.values(flaggedQuestions).filter(Boolean).length}
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {submitError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowConfirmSubmit(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Return to Test
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleManualSubmit}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <InlineSpinner /> Submitting...
                    </>
                  ) : (
                    'Confirm & Submit'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: 4 MOCK TESTS LIST (DEFAULT)
  // ==========================================
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-xs font-semibold text-indigo-700 mb-2">
          <Layers className="w-3.5 h-3.5" />
          Scheduled Full-Length Simulations
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Mock Tests (4 Scheduled Windows)
        </h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1 max-w-2xl">
          Complete high-stakes full-length mock exams within strict scheduled time windows to experience authentic competition test conditions.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Unable to load mock tests</p>
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {/* Live Countdown Banner (Hero Banner) */}
      {liveMock ? (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-bold tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping inline-block" />
                Live Examination In Progress
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {liveMock.title} is LIVE NOW!
              </h2>
              <p className="text-sm text-emerald-100 max-w-xl">
                The scheduled examination window is open. Window ends at <strong>{formatWindowDate(liveMock.endAt)}</strong>.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-5 py-3 text-center">
                <div className="text-xs font-medium text-emerald-200 uppercase tracking-wide">Window Closes In</div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono mt-0.5">
                  {formatRemainingCountdown(liveMock.secondsToEnd)}
                </div>
              </div>
              <button
                onClick={() => requestExamStart(liveMock)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-emerald-800 font-bold rounded-2xl shadow-lg hover:bg-emerald-50 transition-transform active:scale-95 text-sm"
              >
                <Play className="w-4 h-4 fill-emerald-800" />
                {liveMock.attemptStatus === 'IN_PROGRESS' ? 'Resume Examination' : 'Enter Exam Hall'}
              </button>
            </div>
          </div>
        </div>
      ) : upcomingMock ? (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full text-xs font-bold tracking-wider uppercase text-indigo-300">
                <Clock className="w-3.5 h-3.5" />
                Next Scheduled Exam
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {upcomingMock.title} Opens Soon
              </h2>
              <p className="text-sm text-indigo-200 max-w-xl">
                Opens on <strong>{formatWindowDate(upcomingMock.startAt)}</strong>. Ensure high-speed internet and prepare your microphone.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-6 py-4 text-center">
              <div className="text-xs font-medium text-indigo-200 uppercase tracking-wide">Exam Window Opens In</div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono mt-1 text-amber-300">
                {formatRemainingCountdown(upcomingMock.secondsToStart)}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 4 Mock Tests Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mockTests.map((test) => {
            const isLive = test.windowStatus === 'LIVE';
            const isUpcoming = test.windowStatus === 'UPCOMING';
            const isExpired = test.windowStatus === 'EXPIRED';
            const isCompleted = test.attemptStatus === 'COMPLETED';
            const isPendingEval = test.attemptStatus === 'EVALUATION_PENDING';
            const isInProgress = test.attemptStatus === 'IN_PROGRESS';
            const isMissed = test.attemptStatus === 'MISSED';
            const isUnpublished = test.status !== 'PUBLISHED';

            return (
              <div
                key={test.id}
                data-testid={`mock-card-${test.sequenceNo}`}
                className={`bg-white border rounded-3xl p-6 sm:p-7 shadow-sm transition-all flex flex-col justify-between ${
                  isLive 
                    ? 'border-emerald-300 ring-2 ring-emerald-500/20' 
                    : isCompleted || isPendingEval
                      ? 'border-indigo-200 bg-indigo-50/10'
                      : 'border-slate-200'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Bar: Sequence badge & Status badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-extrabold text-base flex items-center justify-center border border-indigo-100">
                      #{test.sequenceNo}
                    </span>

                    {/* Window Status Badge */}
                    <div>
                      {isUnpublished ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                          Coming Soon
                        </span>
                      ) : isCompleted ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Completed ({test.totalMarksAwarded}/{test.totalMarks})
                        </span>
                      ) : isPendingEval ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 flex items-center gap-1.5">
                          <Mic className="w-3.5 h-3.5" /> Evaluation Pending
                        </span>
                      ) : isLive ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white flex items-center gap-1.5 animate-pulse">
                          <Flame className="w-3.5 h-3.5" /> LIVE NOW
                        </span>
                      ) : isUpcoming ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Opens in {formatRemainingCountdown(test.secondsToStart)}
                        </span>
                      ) : isMissed ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" /> Missed Window
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                          Not Started
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Test Title & Description */}
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {test.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Full-length comprehensive simulation covering Listening, Speaking, Reading & Grammar.
                    </p>
                  </div>

                  {/* Schedule Window Box */}
                  <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Exam Window:</span>
                      <span className="font-semibold text-slate-800">
                        {formatWindowDate(test.startAt)} — {formatWindowDate(test.endAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Duration:</span>
                      <span className="font-semibold text-slate-800">{test.durationMinutes || 45} Minutes</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total Marks:</span>
                      <span className="font-semibold text-slate-800">{test.totalMarks ?? 0} Marks</span>
                    </div>
                    <div className="flex items-center justify-between text-indigo-700 bg-indigo-50/70 px-2.5 py-1 rounded-xl">
                      <span className="font-bold">Total Questions:</span>
                      <span className="font-black font-mono">
                        {test.questionCount ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Format:</span>
                      <span className="font-semibold text-slate-800">MCQ & Voice Speaking</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-6 mt-6 border-t border-slate-100">
                  {isCompleted || isPendingEval ? (
                    <button
                      onClick={() => handleViewResults(test)}
                      className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-sm rounded-2xl transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Review Solutions & Scorecard
                    </button>
                  ) : isLive ? (
                    <button
                      onClick={() => requestExamStart(test)}
                      className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow transition-colors"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      {isInProgress ? 'Resume Mock Test' : 'Take Mock Test'}
                    </button>
                  ) : isUpcoming ? (
                    <button
                      disabled
                      className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 text-slate-400 font-medium text-sm rounded-2xl cursor-not-allowed"
                    >
                      <Lock className="w-4 h-4" />
                      Locked Until Scheduled Window
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 text-slate-400 font-medium text-sm rounded-2xl cursor-not-allowed"
                    >
                      <AlertCircle className="w-4 h-4" />
                      Window Closed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SecureExamConsentModal
        isOpen={consentModalOpen}
        title={pendingTestForConsent?.title || 'Mock Test'}
        onConfirm={handleConfirmConsent}
        onCancel={() => {
          setConsentModalOpen(false);
          setPendingTestForConsent(null);
        }}
      />
    </div>
  );
}
