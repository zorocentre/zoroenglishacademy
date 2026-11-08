import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { 
  Award, Layers, CheckCircle2, Clock, Play, AlertCircle, 
  HelpCircle, ChevronRight, ChevronLeft, Flag, Eye, 
  Volume2, Mic, ArrowLeft, Send, Sparkles, Check, X, Lock, Flame, ShieldAlert, UserCheck, FileText
} from 'lucide-react';
import { 
  getStudentFinalAssessment, 
  startFinalAssessmentAttempt, 
  saveFinalAssessmentAnswer, 
  submitFinalAssessmentAttempt, 
  getFinalAssessmentResults 
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

const SET_STYLES = {
  A: {
    cardBg: 'bg-white border-2 border-indigo-200 shadow-md',
    badge: 'bg-indigo-600 text-white',
    pill: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    title: 'text-indigo-950',
    trainerBox: 'bg-indigo-50/60 border-indigo-100'
  },
  B: {
    cardBg: 'bg-white border-2 border-emerald-200 shadow-md',
    badge: 'bg-emerald-600 text-white',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    title: 'text-emerald-950',
    trainerBox: 'bg-emerald-50/60 border-emerald-100'
  },
  C: {
    cardBg: 'bg-white border-2 border-amber-200 shadow-md',
    badge: 'bg-amber-600 text-white',
    pill: 'bg-amber-50 text-amber-700 border-amber-200',
    title: 'text-amber-950',
    trainerBox: 'bg-amber-50/60 border-amber-100'
  },
  D: {
    cardBg: 'bg-white border-2 border-rose-200 shadow-md',
    badge: 'bg-rose-600 text-white',
    pill: 'bg-rose-50 text-rose-700 border-rose-200',
    title: 'text-rose-950',
    trainerBox: 'bg-rose-50/60 border-rose-100'
  }
};

export default function CompetitionFinalAssessmentPage() {
  const navigate = useNavigate();
  const { currentCompetition, isExamActive, setIsExamActive } = useOutletContext();

  const [assessmentData, setAssessmentData] = useState(null);
  const [assignedSet, setAssignedSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Test Taker state
  const [isTestActive, setIsTestActive] = useState(false);
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

  // Remaining Seconds countdown during test
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const timerRef = useRef(null);
  const textSaveTimeoutRef = useRef(null);

  // Results View state
  const [resultsData, setResultsData] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);

  // Task K6: Sync exam active state with portal layout
  useEffect(() => {
    const active = Boolean(isTestActive && !resultsData);
    setIsExamActive?.(active);
    return () => {
      setIsExamActive?.(false);
    };
  }, [isTestActive, resultsData, setIsExamActive]);

  // Live countdown ticker for upcoming/live list view
  const [nowTick, setNowTick] = useState(Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  useEffect(() => {
    const ticker = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  const handleProctorAutoSubmit = useCallback(async (reason) => {
    if (isSubmitting || !assessmentData?.id) return;
    setIsSubmitting(true);
    try {
      await proctor.exitFullscreen();
      const res = await submitFinalAssessmentAttempt(assessmentData.id);
      if (res && res.success && res.data) {
        setAttemptData(null);
        setIsTestActive(false);
        loadFinalAssessment();
      }
    } catch (err) {
      console.error('Proctor auto submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, assessmentData]);

  const proctor = useSecureExamProctor({
    attemptId: attemptData?.attemptId || attemptData?.attempt?.id || attemptData?.id,
    isActive: Boolean(isTestActive && !resultsData),
    initialViolationCount: attemptData?.proctorViolationCount || attemptData?.attempt?.proctorViolationCount || 0,
    maxViolations: 3,
    onAutoSubmit: handleProctorAutoSubmit
  });

  const requestExamStart = () => {
    setConsentModalOpen(true);
  };

  const handleConfirmConsent = async () => {
    setConsentModalOpen(false);
    await proctor.enterFullscreen();
    await handleStartOrResume();
  };

  useEffect(() => {
    if (!currentCompetition?.id) return;
    loadFinalAssessment();
  }, [currentCompetition]);

  const loadFinalAssessment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentFinalAssessment(currentCompetition.id);
      if (res && res.success && res.data) {
        if (res.data.serverNow) {
          const sNowMs = new Date(res.data.serverNow).getTime();
          if (!isNaN(sNowMs)) {
            setServerOffsetMs(sNowMs - Date.now());
          }
        }
        setAssessmentData(res.data.finalAssessment || null);
        setAssignedSet(res.data.assignedSet || null);
      } else {
        setError(res?.message || 'Failed to load final assessment.');
      }
    } catch (err) {
      console.error('Error loading final assessment:', err);
      setError(err.message || 'Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartOrResume = async () => {
    if (!assessmentData?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await startFinalAssessmentAttempt(assessmentData.id);
      if (res && res.success && res.data) {
        setAttemptData(res.data);
        setIsTestActive(true);
        setCurrentQuestionIndex(0);
        const durationSec = (res.data.durationMinutes || assessmentData.durationMinutes || 60) * 60;
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
        setError(res?.message || 'Unable to start examination.');
      }
    } catch (err) {
      console.error('Error starting final assessment:', err);
      setError(err.message || 'Failed to start examination.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = async () => {
    if (!assessmentData?.id) return;
    setLoadingResults(true);
    try {
      const res = await getFinalAssessmentResults(assessmentData.id);
      if (res && res.success && res.data) {
        setResultsData(res.data);
      } else {
        setError(res?.message || 'Failed to load examination results.');
      }
    } catch (err) {
      console.error('Error fetching results:', err);
      setError(err.message || 'Failed to load results.');
    } finally {
      setLoadingResults(false);
    }
  };

  // Synchronized countdown timer during active test
  useEffect(() => {
    if (!isTestActive || remainingSeconds == null) return;

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
  }, [isTestActive]);

  const handleAutoSubmit = useCallback(async () => {
    if (isSubmitting || !assessmentData?.id) return;
    setIsSubmitting(true);
    try {
      await proctor.exitFullscreen();
      const res = await submitFinalAssessmentAttempt(assessmentData.id);
      if (res && res.success && res.data) {
        setAttemptData(null);
        setIsTestActive(false);
        loadFinalAssessment();
      }
    } catch (err) {
      console.error('Auto submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, assessmentData]);

  // Answer selection for MCQ
  const handleSelectOption = async (questionId, optionId) => {
    const updated = {
      ...studentAnswers,
      [questionId]: {
        ...(studentAnswers[questionId] || {}),
        selectedOptionId: optionId
      }
    };
    setStudentAnswers(updated);
    await triggerAutoSave(questionId, { selectedOptionId: optionId });
  };

  // Voice recording upload complete
  const handleVoiceAnswerComplete = async (questionId, voiceFileId, durationSec) => {
    const updated = {
      ...studentAnswers,
      [questionId]: {
        ...(studentAnswers[questionId] || {}),
        voiceFileId,
        voiceDurationSec: durationSec
      }
    };
    setStudentAnswers(updated);
    await triggerAutoSave(questionId, {
      voiceFileId,
      voiceDurationSec: durationSec
    });
  };

  // Text answer change with autosave
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
    textSaveTimeoutRef.current = setTimeout(() => {
      triggerAutoSave(questionId, { textAnswer: textVal });
    }, 500);
  };

  // Trigger autosave to server
  const triggerAutoSave = async (questionId, payload) => {
    if (!assessmentData?.id) return;
    setSaveStatus('saving');
    try {
      const res = await saveFinalAssessmentAnswer(assessmentData.id, {
        questionId,
        ...payload
      });
      if (res && res.success) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Auto save error:', err);
      setSaveStatus('error');
    }
  };

  // Manual submit test
  const handleManualSubmit = async () => {
    if (!assessmentData?.id) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await proctor.exitFullscreen();
      const res = await submitFinalAssessmentAttempt(assessmentData.id);
      if (res && res.success && res.data) {
        setShowConfirmSubmit(false);
        setAttemptData(null);
        setIsTestActive(false);
        loadFinalAssessment();
      } else {
        setSubmitError(res?.message || 'Failed to submit examination.');
      }
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitError(err.message || 'Failed to submit examination.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFlagQuestion = (qId) => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  // Format countdown string
  const formatCountdown = (totalSec) => {
    if (totalSec == null || totalSec < 0) return '00:00';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatTimerClock = (totalSec) => {
    if (totalSec == null || totalSec < 0) return '00:00';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading && !isTestActive && !resultsData) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <SkeletonCard height="h-28" />
        <SkeletonCard height="h-64" />
      </div>
    );
  }

  // ==========================================
  // VIEW 1: RESULTS VIEW (Final Assessment Submitted Card)
  // Under Task F4, candidate view never displays scorecards or answer reviews.
  // ==========================================
  if (resultsData) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-fadeIn">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" /> Assessment Status
          </div>
          <h3 className="text-xl font-bold text-slate-900">
            Final Assessment Submitted Successfully
          </h3>
          <div className="space-y-2 text-sm text-slate-600">
            <p>Thank you for completing the Final Assessment.</p>
            <p>Your examination has been successfully submitted. The evaluation results and final rankings will be published on the Competition Leaderboard.</p>
            <p>Please visit the Leaderboard to view your results once they are officially announced.</p>
            <p className="font-semibold text-slate-800">Thank you for participating!</p>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => {
                setResultsData(null);
                loadFinalAssessment();
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate('/competition/leaderboard')}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Award className="w-4 h-4" />
              Go to Leaderboard
            </button>
          </div>
        </div>
      </div>
    );
  }


  // ==========================================
  // VIEW 2: ACTIVE TEST TAKER (Immersive Exam Mode)
  // ==========================================
  if (isTestActive && attemptData) {
    const questions = attemptData.questions || [];
    const currentQuestion = questions[currentQuestionIndex];
    const totalQuestions = questions.length;
    const currentAnswer = currentQuestion ? studentAnswers[currentQuestion.id] : null;
    const currentQType = (currentQuestion?.answerFormat || currentQuestion?.type || currentQuestion?.questionFormat || '').toUpperCase();
    const isCurrentVoice = currentQType === 'VOICE' || currentQType === 'VOICE_RECORDING';
    const isCurrentWritten = currentQType === 'TEXT' || currentQType === 'WRITTEN';
    const isFlagged = currentQuestion ? !!flaggedQuestions[currentQuestion.id] : false;
    const assignedSetCode = assignedSet?.code || attemptData.assignedSet?.code || 'A';
    const setStyle = SET_STYLES[assignedSetCode] || SET_STYLES.A;

    const answeredCount = Object.values(studentAnswers).filter(a => a?.selectedOptionId || a?.voiceFileId || (a?.textAnswer && a.textAnswer.trim())).length;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col -m-6 md:-m-8">
        <ProctorViolationWarningModal
          isOpen={proctor.warningModalOpen}
          violationCount={proctor.violationCount}
          maxViolations={3}
          reason={proctor.currentViolationReason}
          onResume={proctor.enterFullscreen}
        />

        {/* Test Taker Header */}
        <header className="sticky top-0 z-30 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-4 md:px-8 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-sm md:text-base font-bold text-white truncate max-w-xs md:max-w-md">
                  {assessmentData?.title || 'Championship Final Assessment'}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
                  <span>•</span>
                  <span>{answeredCount} Answered</span>
                </div>
              </div>
            </div>

            {/* Timer and Autosave Status */}
            <div className="flex items-center gap-4">
              {/* Proctoring Status Pill */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-semibold border border-slate-700 shadow-xs">
                <span className={`w-2 h-2 rounded-full ${proctor.violationCount > 0 ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                <span>Proctored ({proctor.violationCount}/3)</span>
              </span>
              <div className="hidden sm:flex items-center gap-2 text-xs">
                {saveStatus === 'saving' && (
                  <span className="text-amber-400 flex items-center gap-1 font-medium">
                    <InlineSpinner className="w-3.5 h-3.5" /> Saving...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-emerald-400 flex items-center gap-1 font-medium">
                    <Check className="w-3.5 h-3.5" /> Autosaved
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-rose-400 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> Sync error
                  </span>
                )}
              </div>

              {/* Synchronized Countdown Clock */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-sm font-black border ${
                remainingSeconds !== null && remainingSeconds <= 300 && remainingSeconds > 0 
                  ? 'bg-rose-950/60 text-rose-400 border-rose-500/50 animate-pulse' 
                  : 'bg-slate-800/80 text-white border-slate-700'
              }`}>
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>{formatTimerClock(remainingSeconds)}</span>
              </div>

              {/* Submit Final Paper Button */}
              <button
                onClick={() => setShowConfirmSubmit(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Submit Paper
              </button>
            </div>
          </div>
        </header>

        {/* Test Taker Body: Question Navigator + Main Area */}
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Question Panel (3 cols) */}
          <div className="lg:col-span-3 flex flex-col justify-between space-y-6">
            {currentQuestion ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 relative shadow-xl">
                {/* Question Metadata Row */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">
                      Q{currentQuestionIndex + 1}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      isCurrentVoice 
                        ? 'bg-purple-500/20 text-purple-300' 
                        : isCurrentWritten 
                          ? 'bg-blue-500/20 text-blue-300' 
                          : 'bg-slate-800 text-slate-300'
                    }`}>
                      {isCurrentVoice ? 'VOICE' : isCurrentWritten ? 'WRITTEN' : 'MCQ'}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      {currentQuestion.marks || 1} {currentQuestion.marks === 1 ? 'Mark' : 'Marks'}
                    </span>
                  </div>

                  <button
                    onClick={() => toggleFlagQuestion(currentQuestion.id)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                      isFlagged
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <Flag className={`w-3.5 h-3.5 ${isFlagged ? 'fill-amber-400 text-amber-400' : ''}`} />
                    {isFlagged ? 'Flagged for Review' : 'Flag Question'}
                  </button>
                </div>

                {/* Prompt */}
                <div className="mt-6">
                  <h3 className="text-lg md:text-xl font-medium text-white leading-relaxed">
                    {currentQuestion.prompt || currentQuestion.questionText}
                  </h3>

                  {/* Shared Question Media Prompt (Audio, Video, Image) */}
                  {(currentQuestion.questionFormat === 'IMAGE' || currentQuestion.questionFormat === 'VIDEO' || currentQuestion.questionFormat === 'AUDIO' || currentQuestion.mediaRef || currentQuestion.audioUrl || currentQuestion.videoUrl || currentQuestion.imageUrl) && (
                    <div className="mt-4">
                      <QuestionMedia
                        questionFormat={currentQuestion.questionFormat || (currentQuestion.audioUrl ? 'AUDIO' : currentQuestion.videoUrl ? 'VIDEO' : currentQuestion.imageUrl ? 'IMAGE' : 'MCQ')}
                        mediaRef={currentQuestion.mediaRef || currentQuestion.audioUrl || currentQuestion.videoUrl || currentQuestion.imageUrl}
                        title="Question Media Attachment"
                      />
                    </div>
                  )}
                </div>

                {/* Question Response Mode */}
                <div className="mt-8">
                  {isCurrentVoice ? (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5">
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider mb-3">
                        <Mic className="w-4 h-4 text-indigo-400" />
                        Voice Response Required
                      </div>
                      <p className="text-xs text-slate-400 mb-4">
                        Record your spoken response clearly. You may re-record before submitting your final paper.
                      </p>
                      <VoiceAnswerRecorder
                        key={currentQuestion.id}
                        questionId={currentQuestion.id}
                        savedVoiceFileId={currentAnswer?.voiceFileId}
                        savedDurationSec={currentAnswer?.voiceDurationSec}
                        onUploadComplete={(data) => handleVoiceAnswerComplete(currentQuestion.id, data?.voiceFileId || data?.id, data?.durationSec || data?.duration)}
                        onRecordingComplete={(fileId, dur) => handleVoiceAnswerComplete(currentQuestion.id, fileId, dur)}
                      />
                    </div>
                  ) : currentQuestion.answerFormat === 'TEXT' ? (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                          <FileText className="w-4 h-4 text-indigo-400" />
                          Written Response Required
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          {(currentAnswer?.textAnswer || '').length} / 5000 characters
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Type your complete answer in the text area below. Your progress is saved automatically.
                      </p>
                      <textarea
                        value={currentAnswer?.textAnswer || ''}
                        onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
                        maxLength={5000}
                        rows={8}
                        placeholder="Type your answer here (up to 5,000 characters)..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white caret-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 resize-y font-sans leading-relaxed"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(currentQuestion.options || []).map((opt, optIdx) => {
                        const isSelected = currentAnswer?.selectedOptionId === opt.id;
                        const optionLetter = String.fromCharCode(65 + optIdx);

                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                            className={`w-full text-left p-4 rounded-xl border flex items-center gap-4 transition-all ${
                              isSelected
                                ? 'bg-indigo-600/15 border-indigo-500 ring-2 ring-indigo-500/30 text-white'
                                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                            }`}
                          >
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {optionLetter}
                            </span>
                            <span className="text-sm md:text-base font-normal flex-1">
                              {opt.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Bottom Navigation Toolbar */}
            <div className="flex items-center justify-between pt-2">
              <button
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs md:text-sm font-semibold transition-all"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <div className="text-xs text-slate-500 font-medium">
                {currentQuestionIndex + 1} / {totalQuestions}
              </div>

              {currentQuestionIndex < totalQuestions - 1 ? (
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs md:text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowConfirmSubmit(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs md:text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all"
                >
                  Submit Final Paper <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Question Palette Sidebar (1 col) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>Question Palette</span>
                <span className="text-[10px] text-indigo-400 font-bold">{totalQuestions} Questions</span>
              </h4>

              {/* Palette Grid */}
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const ans = studentAnswers[q.id];
                  const hasAnswered = !!(ans?.selectedOptionId || ans?.voiceFileId || (ans?.textAnswer && ans.textAnswer.trim().length > 0));
                  const isFlag = !!flaggedQuestions[q.id];
                  const isCurrent = idx === currentQuestionIndex;

                  let btnStyle = 'bg-slate-800/80 border-slate-700 text-slate-400';
                  if (hasAnswered) {
                    btnStyle = 'bg-emerald-600/30 border-emerald-500/60 text-emerald-300 font-bold';
                  }
                  if (isFlag) {
                    btnStyle = 'bg-amber-500/30 border-amber-500/60 text-amber-300 font-bold';
                  }
                  if (isCurrent) {
                    btnStyle += ' ring-2 ring-indigo-500 border-white text-white';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`h-9 rounded-lg border text-xs font-semibold flex items-center justify-center transition-all ${btnStyle}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Palette Legend */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-emerald-600/40 border border-emerald-500" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-amber-500/40 border border-amber-500" />
                  <span>Flagged for Review</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700" />
                  <span>Unanswered</span>
                </div>
              </div>
            </div>

            {/* Single Attempt Warning Box */}
            <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-300">
              <div className="flex items-center gap-2 font-bold mb-1">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Strict Single Attempt</span>
              </div>
              <p className="text-rose-300/80 leading-relaxed text-[11px]">
                You cannot pause or restart this examination. Ensure all answers are selected before final submission.
              </p>
            </div>
          </div>
        </div>

        {/* Submit Confirmation Modal */}
        {showConfirmSubmit && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-white text-center">
                Submit Final Assessment Paper?
              </h3>
              <p className="text-xs text-slate-400 text-center mt-2">
                This is the official championship examination. Submission is <strong className="text-rose-400">FINAL and IRREVERSIBLE</strong>. You cannot re-enter or modify answers.
              </p>

              {/* Summary Stats */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 my-5 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-slate-400">Total</div>
                  <div className="text-base font-bold text-white mt-0.5">{totalQuestions}</div>
                </div>
                <div>
                  <div className="text-xs text-emerald-400">Answered</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">{answeredCount}</div>
                </div>
                <div>
                  <div className="text-xs text-amber-400">Remaining</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5">{totalQuestions - answeredCount}</div>
                </div>
              </div>

              {submitError && (
                <div className="mb-4 bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs p-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  disabled={isSubmitting}
                  onClick={() => setShowConfirmSubmit(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
                >
                  Cancel & Review
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={handleManualSubmit}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <InlineSpinner className="w-4 h-4" /> Submitting...
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
  // VIEW 3: LANDING / DASHBOARD VIEW (Light Portal Theme)
  // ==========================================
  const nowMs = nowTick + serverOffsetMs;
  const startAtMs = (assessmentData?.opensAt || assessmentData?.startAt) ? new Date(assessmentData?.opensAt || assessmentData.startAt).getTime() : null;
  const endAtMs = (assessmentData?.closesAt || assessmentData?.endAt) ? new Date(assessmentData?.closesAt || assessmentData.endAt).getTime() : null;

  let windowStatus = assessmentData?.windowStatus || assessmentData?.status || 'UNANNOUNCED';
  if (!startAtMs) {
    windowStatus = 'UNANNOUNCED';
  } else if (nowMs < startAtMs) {
    windowStatus = 'UPCOMING';
  } else if (endAtMs && nowMs > endAtMs) {
    windowStatus = 'EXPIRED';
  } else {
    windowStatus = 'LIVE';
  }

  const isLive = windowStatus === 'LIVE';
  const isUpcoming = windowStatus === 'UPCOMING';
  const isExpired = windowStatus === 'EXPIRED';
  const isUnannounced = windowStatus === 'UNANNOUNCED';
  const attemptStatus = assessmentData?.attemptStatus || null;
  const isAttemptCompleted = attemptStatus === 'COMPLETED' || attemptStatus === 'EVALUATION_PENDING';
  const assignedSetCode = assignedSet?.code || 'A';
  const setStyle = SET_STYLES[assignedSetCode] || SET_STYLES.A;

  // Real-time countdown calculation for hero banner
  let heroCountdown = '';
  if (isLive && endAtMs) {
    const diffSec = Math.max(0, Math.floor((endAtMs - nowMs) / 1000));
    heroCountdown = formatCountdown(diffSec);
  } else if (isUpcoming && startAtMs) {
    const diffSec = Math.max(0, Math.floor((startAtMs - nowMs) / 1000));
    heroCountdown = formatCountdown(diffSec);
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-fadeIn">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-1">
          <Award className="w-4 h-4" /> Championship Final Assessment
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
          Official Final Examination
        </h1>
        <p className="text-slate-600 text-sm mt-1 max-w-2xl">
          The decisive championship paper. Every student receives a deterministic, set-randomized paper with audio/video questions and voice recording tasks.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Synchronized Hero Window Countdown Banner */}
      <div className={`rounded-2xl p-6 md:p-8 border relative overflow-hidden shadow-xl transition-all ${
        isLive 
          ? 'bg-gradient-to-r from-emerald-950/90 via-slate-900 to-emerald-950/80 border-emerald-500/40 text-white' 
          : isUpcoming
            ? 'bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-950/80 border-indigo-500/40 text-white'
            : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              {isLive ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                  <Flame className="w-3.5 h-3.5 text-emerald-400" /> Examination Window Live Now
                </span>
              ) : isUpcoming ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  <Clock className="w-3.5 h-3.5" /> Upcoming Scheduled Examination
                </span>
              ) : isUnannounced ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  <Clock className="w-3.5 h-3.5" /> Final Assessment Opening Soon
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
                  <Lock className="w-3.5 h-3.5" /> Examination Window Concluded
                </span>
              )}
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-white">
              {assessmentData?.title || 'Championship Final Assessment'}
            </h2>

            <p className="text-xs md:text-sm text-slate-300">
              {isLive 
                ? `Window is currently open! Submit before the window closes.`
                : isUpcoming 
                  ? `Final Assessment will be opened on ${new Date(startAtMs).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST`
                  : isUnannounced
                    ? `Final Assessment will be opened soon.`
                    : `Window Closed`
              }
            </p>
          </div>

          {/* Countdown Clock or CTA */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {(isLive || isUpcoming) && heroCountdown && (
              <div className="bg-black/40 border border-white/10 rounded-xl px-5 py-3 text-center">
                <div className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">
                  {isLive ? 'Window Closes In' : 'Opens In'}
                </div>
                <div className={`font-mono text-2xl font-black mt-0.5 ${
                  isLive ? 'text-emerald-400' : 'text-indigo-400'
                }`}>
                  {heroCountdown}
                </div>
              </div>
            )}

            {isAttemptCompleted ? null : isLive ? (
              <button
                onClick={requestExamStart}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 animate-bounce hover:animate-none"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{attemptStatus === 'IN_PROGRESS' ? 'Resume Exam' : 'Start Exam'}</span>
                <span className="sr-only">Start Examination Now</span>
              </button>
            ) : isUpcoming || isUnannounced ? (
              <button
                disabled
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-800 text-slate-500 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2 border border-slate-700"
              >
                <Lock className="w-4 h-4" /> {isUpcoming ? 'Examination Locked' : 'Will Be Opened Soon'}
              </button>
            ) : (
              <div className="text-xs font-semibold text-rose-400 bg-rose-950/30 border border-rose-500/30 px-4 py-2.5 rounded-xl">
                Window Closed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Examination Policies OR Submitted Card */}
      <div className="w-full">
        {isAttemptCompleted ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" /> Assessment Status
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Final Assessment Submitted Successfully
            </h3>
            <div className="space-y-2 text-sm text-slate-600">
              <p>Thank you for completing the Final Assessment.</p>
              <p>Your examination has been successfully submitted. The evaluation results and final rankings will be published on the Competition Leaderboard.</p>
              <p>Please visit the Leaderboard to view your results once they are officially announced.</p>
              <p className="font-semibold text-slate-800">Thank you for participating!</p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => navigate('/competition/leaderboard')}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Award className="w-4 h-4" />
                Go to Leaderboard
              </button>
            </div>
          </div>
        ) : (
          /* Card: Exam Policies & Strict Single-Attempt Rule */
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-rose-600 text-xs font-bold uppercase tracking-wider mb-2">
                <ShieldAlert className="w-4 h-4" /> Examination Rules & Instructions
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Strict Single Attempt Policy
              </h3>
              
              <ul className="mt-4 space-y-2.5 text-xs text-slate-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong className="text-slate-800">Single Attempt Only:</strong> The exam cannot be paused, reset, or retaken once submitted or timed out.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong className="text-slate-800">Synchronized Timer:</strong> Exam automatically submits when the countdown reaches 00:00.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong className="text-slate-800">Autosave Enabled:</strong> All answers and audio recordings are saved to the server continuously.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong className="text-slate-800">Voice Tasks:</strong> Ensure microphone permissions are granted before starting.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Duration: <strong className="text-slate-800">{assessmentData?.durationMinutes || 60} Minutes</strong></span>
              <span>Total Marks: <strong className="text-slate-800">{assessmentData?.totalMarks ?? 0} Marks</strong></span>
              <span className="text-indigo-700 bg-indigo-50/70 px-2.5 py-1 rounded-xl">
                Total Questions: <strong className="font-mono text-indigo-900">{assessmentData?.questionCount ?? 0}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      <SecureExamConsentModal
        isOpen={consentModalOpen}
        title={assessmentData?.title || 'Final Assessment'}
        onConfirm={handleConfirmConsent}
        onCancel={() => setConsentModalOpen(false)}
      />
    </div>
  );
}
