import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Calendar, Clock, User, Video, 
  Mic, MicOff, Camera, CameraOff, ExternalLink, CheckCircle2, AlertTriangle, CalendarX, Lock
} from 'lucide-react';
import { getStudentEnrolledCourses } from '../../api/enrollmentApi';
import { getSchedules, joinSchedule } from '../../api/scheduleApi';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import { getScheduleJoinState, syncServerTime, normalizeGoogleMeetUrl } from '../../utils/scheduleSortUtil';

export default function JoinSessionPage({ setActiveScreen }) {
  const { user } = useAuth();
  const { showError } = useDialog();
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [isRecordedOnly, setIsRecordedOnly] = useState(false);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const studentIdentifier = user?.email || user?.id || '';

  useEffect(() => {
    async function initPage() {
      setLoading(true);
      try {
        await syncServerTime();
        if (studentIdentifier) {
          const enrolled = await getStudentEnrolledCourses(studentIdentifier);
          if (enrolled && enrolled.length > 0 && enrolled.every(c => c.mode === 'Recorded')) {
            setIsRecordedOnly(true);
          }
        }

        const schRes = await getSchedules();
        const allSchedules = schRes?.data || [];
        // Find next active or upcoming schedule
        const upcoming = allSchedules.find(s => s.status !== 'Completed') || allSchedules[0] || null;
        if (upcoming) {
          setSession({
            id: upcoming.id,
            title: upcoming.title || upcoming.course,
            course: upcoming.course || upcoming.title,
            topic: upcoming.topic || upcoming.title || 'Live Interactive Class',
            date: upcoming.date,
            time: upcoming.time,
            trainer: upcoming.trainer || 'Trainer',
            platform: 'Google Meet',
            meetUrl: upcoming.meetLink || upcoming.googleMeetUrl || upcoming.meetUrl || ''
          });
        }
      } catch (err) {
        console.error('Error initializing JoinSessionPage:', err);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, [studentIdentifier]);

  const handleJoinClick = async () => {
    if (!session) return;
    const joinState = getScheduleJoinState(session);
    if (!joinState.enabled) return;
    try {
      const res = await joinSchedule(session.id);
      if (res && res.success) {
        setIsJoined(true);
        const rawUrl = res.data?.meetUrl || res.meetUrl || session.meetUrl;
        const url = normalizeGoogleMeetUrl(rawUrl);
        if (url) {
          window.open(url, '_blank');
        }
      } else {
        showError(res?.message || 'Failed to join session', 'Join Failed');
      }
    } catch (e) {
      console.error('Attendance recording error:', e);
      showError(e?.message || 'Error joining session', 'Join Error');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Breadcrumb Navigation */}
      <button 
        onClick={() => setActiveScreen('student-dash')}
        className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      <h1 className="text-3xl font-black text-slate-900 tracking-tight">Join Your Training Session</h1>

      {isRecordedOnly && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-bold flex items-center gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-extrabold text-sm text-amber-950">Not Applicable for Recorded-Only Courses</p>
            <p className="font-medium text-amber-800 mt-0.5">
              Live training sessions and Google Meet joins are not applicable for Recorded-only courses. Please visit your LMS page to watch video modules.
            </p>
          </div>
          <button
            onClick={() => setActiveScreen('student-course-learn')}
            className="ml-auto bg-amber-700 hover:bg-amber-800 text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shrink-0 cursor-pointer"
          >
            Go to LMS Modules
          </button>
        </div>
      )}

      {!loading && !session ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-lg mx-auto shadow-sm space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <CalendarX className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">No Upcoming Live Sessions</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              There are no live interactive sessions scheduled for you right now. Please check back later or review your LMS modules.
            </p>
          </div>
          <button
            onClick={() => setActiveScreen('student-course-learn')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer"
          >
            Go to Course Learning
          </button>
        </div>
      ) : session ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Session Details Card */}
          <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">Live Class</span>
              <h2 className="text-xl font-black text-slate-900 mt-2">{session.course}</h2>
              <p className="text-xs font-bold text-slate-500 mt-0.5">Topic: {session.topic}</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-slate-400 font-semibold">Date</div>
                  <div className="font-extrabold text-slate-800 text-sm">{session.date}</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-slate-400 font-semibold">Time</div>
                  <div className="font-extrabold text-slate-800 text-sm">{session.time}</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-slate-400 font-semibold">Trainer</div>
                  <div className="font-extrabold text-slate-800 text-sm">{session.trainer}</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                  <Video className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-slate-400 font-semibold">Platform</div>
                  <div className="font-extrabold text-slate-800 text-sm">{session.platform}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Live Google Meet Integration Card */}
          <div className="lg:col-span-8 bg-white p-8 sm:p-12 rounded-3xl border border-slate-200/80 shadow-md text-center space-y-6">
            
            {isJoined ? (
              <div className="bg-slate-900 rounded-2xl p-8 text-white space-y-6">
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-slate-950 mx-auto shadow-lg animate-bounce">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full uppercase border border-emerald-500/30">
                    Attendance Recorded: PRESENT
                  </span>
                  <h3 className="text-2xl font-black mt-3">Connected to Google Meet</h3>
                  <p className="text-xs text-slate-300 mt-1">Live training session in progress with {session.trainer}.</p>
                </div>
                <button
                  onClick={() => setIsJoined(false)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs"
                >
                  Leave Session
                </button>
              </div>
            ) : (
              <>
                {/* Google Meet Visual Badge */}
                <div className="w-24 h-24 bg-slate-50 rounded-3xl border border-slate-200 flex items-center justify-center mx-auto shadow-xs">
                  <div className="w-14 h-14 bg-gradient-to-tr from-green-500 via-blue-500 to-amber-400 rounded-2xl flex items-center justify-center text-white shadow-md">
                    <Video className="w-8 h-8" />
                  </div>
                </div>

                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-2xl font-black text-slate-900">You're all set!</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Click the button below to join the session. Your attendance will be recorded automatically in the database.
                  </p>
                </div>

                {/* Camera & Mic Controls */}
                <div className="flex items-center justify-center space-x-4 py-2">
                  <button 
                    onClick={() => setMicOn(!micOn)}
                    className={`p-3 rounded-full border transition-all ${
                      micOn ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-rose-100 text-rose-700 border-rose-200'
                    }`}
                  >
                    {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => setCameraOn(!cameraOn)}
                    className={`p-3 rounded-full border transition-all ${
                      cameraOn ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-rose-100 text-rose-700 border-rose-200'
                    }`}
                  >
                    {cameraOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
                  </button>
                </div>

                {/* Big Join Session Button */}
                {(() => {
                  const joinState = getScheduleJoinState(session);
                  if (!joinState.enabled) {
                    return (
                      <div>
                        <button
                          disabled
                          className="bg-slate-200 text-slate-400 font-black text-base px-10 py-4 rounded-xl shadow-none inline-flex items-center space-x-2 cursor-not-allowed border border-slate-300"
                        >
                          <Lock className="w-5 h-5 text-slate-400" />
                          <span>{joinState.label}</span>
                        </button>
                        <p className="text-[11px] text-slate-400 font-semibold mt-3">
                          {joinState.hasValidLink ? 'Session access opens during the scheduled class hours.' : 'Please ask your administrator to configure a Google Meet link for this session.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div>
                      <button
                        onClick={handleJoinClick}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-black text-base px-10 py-4 rounded-xl shadow-xl transition-transform transform hover:scale-105 inline-flex items-center space-x-2 cursor-pointer"
                      >
                        <span>{joinState.label}</span>
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <p className="text-[11px] text-slate-400 font-semibold mt-3">
                        Clicking Join Session automatically marks your attendance as PRESENT.
                      </p>
                    </div>
                  );
                })()}
              </>
            )}

          </div>

        </div>
      ) : null}

    </div>
  );
}
