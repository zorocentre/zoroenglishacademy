import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Monitor, Trophy, CheckCircle2, Tag, Download, Award } from 'lucide-react';
import { getCompetitions } from '../../api/competitionApi';
import { resolveFileUrl, getRulesDownloadUrl } from '../../api/fileApi';
import { formatDate } from '../../utils/dateFormatter';
import CompetitionRegisterModal from './CompetitionRegisterModal';
import PageLoader from '../common/PageLoader';

const formatDateTimeIST = (isoString) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST';
  } catch {
    return isoString;
  }
};

export default function CompetitionPage({ currentUser }) {
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompId, setSelectedCompId] = useState('');
  const [activeTab, setActiveTab] = useState('about');
  const [loading, setLoading] = useState(true);
  const [registeringComp, setRegisteringComp] = useState(null);
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [infoModal, setInfoModal] = useState({ isOpen: false, title: '', message: '' });

  const getLifecycleInfo = (comp) => {
    const state = (comp?.lifecycleState || '').toUpperCase();
    if (state === 'UPCOMING') {
      return {
        state: 'UPCOMING',
        badgeText: 'Upcoming Competition',
        badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200',
        btnText: 'Upcoming Competition',
        btnClass: 'bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer font-extrabold shadow-sm',
        onClick: () => {
          const openingTime = comp.regStartAt || comp.regStartDate;
          const msg = openingTime 
            ? `Registration has not opened yet. Please wait for our competition announcement. Registration opens on ${formatDateTimeIST(openingTime)}.`
            : 'Registration has not opened yet. Please wait for our competition announcement.';
          setInfoModal({ isOpen: true, title: 'Upcoming Competition', message: msg });
        }
      };
    }
    if (state === 'FINISHED') {
      return {
        state: 'FINISHED',
        badgeText: 'Competition Finished',
        badgeClass: 'bg-slate-200 text-slate-700 border border-slate-300',
        btnText: 'Competition Finished',
        btnClass: 'bg-slate-200 hover:bg-slate-300 text-slate-600 cursor-pointer font-extrabold shadow-sm',
        onClick: () => {
          setInfoModal({
            isOpen: true,
            title: 'Competition Finished',
            message: 'The competition registration has ended. Thank you for your interest.'
          });
        }
      };
    }
    return {
      state: 'ACTIVE',
      badgeText: 'Active',
      badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      btnText: 'Register Now',
      btnClass: 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer hover:-translate-y-0.5 shadow-lg',
      onClick: () => setRegisteringComp(comp)
    };
  };

  useEffect(() => {
    async function loadComps() {
      setLoading(true);
      try {
        const res = await getCompetitions();
        if (res.success && Array.isArray(res.data)) {
          setCompetitions(res.data);
          if (res.data.length > 0) {
            setSelectedCompId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load competitions:', err);
      } finally {
        setLoading(false);
      }
    }
    loadComps();
  }, []);

  const activeComp = competitions.find(c => c.id === selectedCompId) || competitions[0];
  const activeLifecycle = getLifecycleInfo(activeComp);

  if (loading) {
    return (
      <div className="bg-slate-50 min-h-screen py-20 flex items-center justify-center">
        <PageLoader text="Loading active competitions..." minHeight="min-h-[400px]" />
      </div>
    );
  }

  if (!activeComp) {
    return (
      <div className="bg-slate-50 min-h-screen py-20 text-center space-y-4">
        <Trophy className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">No Active Events Right Now</h2>
        <p className="text-xs text-slate-500">Check back soon for upcoming national championships and speed calculation contests!</p>
      </div>
    );
  }

  const instructionsList = activeComp.instructions 
    ? activeComp.instructions.split('\n').map(s => s.trim()).filter(Boolean)
    : [];

  const regFee = Number(activeComp.registrationFee || 0);
  const bannerSrc = activeComp.bannerUrl || activeComp.banner;
  const compTitle = activeComp.title || activeComp.name || 'Competition';
  const rulesUrl = activeComp.rulesPdfUrl || activeComp.rulesPdf?.url;
  const rulesDownloadUrl = getRulesDownloadUrl(rulesUrl);

  return (
    <div className="bg-slate-50 min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Selector Header if multiple active competitions exist */}
        {competitions.length > 1 && (
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-2 items-center">
            <span className="text-xs font-extrabold text-slate-500 px-3 uppercase tracking-wider">Active Events:</span>
            {competitions.map((comp) => {
              const itemTitle = comp.title || comp.name || 'Competition';
              return (
                <button
                  key={comp.id}
                  onClick={() => setSelectedCompId(comp.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    comp.id === activeComp.id
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {itemTitle}
                </button>
              );
            })}
          </div>
        )}

        {/* Header Title Banner */}
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <div className={`inline-block font-extrabold text-xs px-4 py-1.5 rounded-full uppercase tracking-wider ${activeLifecycle.badgeClass}`}>
            {activeLifecycle.badgeText}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            {compTitle}
          </h1>
          {activeComp.category && (
            <p className="text-lg font-bold text-emerald-600">
              {activeComp.category}
            </p>
          )}
        </div>

        {/* Media & Key Detail Card Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Visual Banner */}
          <div className="lg:col-span-8">
            <div className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-200 group bg-slate-950">
              {bannerSrc ? (
                <>
                  <img
                    src={resolveFileUrl(bannerSrc)}
                    alt={compTitle}
                    className="w-full h-80 sm:h-96 object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent flex flex-col justify-between p-8">
                    {activeComp.venue ? (
                      <div className="self-end bg-emerald-500 text-slate-950 px-4 py-1.5 rounded-full font-black text-xs uppercase shadow">
                        {activeComp.venue}
                      </div>
                    ) : <div />}
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-white">{compTitle}</h3>
                      {activeComp.description && (
                        <p className="text-slate-300 text-xs max-w-md line-clamp-2">{activeComp.description}</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full h-80 sm:h-96 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-between p-8 text-white">
                  {activeComp.venue ? (
                    <div className="self-end bg-emerald-500 text-slate-950 px-4 py-1.5 rounded-full font-black text-xs uppercase shadow">
                      {activeComp.venue}
                    </div>
                  ) : <div />}
                  <div className="space-y-2">
                    {activeComp.category && (
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">{activeComp.category}</span>
                    )}
                    <h3 className="text-3xl font-black text-white">{compTitle}</h3>
                    {activeComp.description && (
                      <p className="text-slate-300 text-xs max-w-md line-clamp-2">{activeComp.description}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Event Detail Info Card */}
          <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xl space-y-6">
            <h3 className="text-lg font-extrabold text-slate-900 border-b border-slate-100 pb-3">Event Details</h3>

            <div className="space-y-4">
              {/* Registration Dates */}
              {(activeComp.regStartAt || activeComp.regEndAt || activeComp.regStartDate || activeComp.regEndDate) && (
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Registration Period</div>
                    <div className="text-sm font-extrabold text-blue-900">
                      {activeComp.regStartAt || activeComp.regEndAt
                        ? `${formatDateTimeIST(activeComp.regStartAt)}${activeComp.regEndAt ? ` – ${formatDateTimeIST(activeComp.regEndAt)}` : ''}`
                        : `${formatDate(activeComp.regStartDate)}${activeComp.regEndDate ? ` – ${formatDate(activeComp.regEndDate)}` : ''}`}
                    </div>
                  </div>
                </div>
              )}

              {/* Competition Event Dates */}
              {(activeComp.startAt || activeComp.endAt || activeComp.startDate || activeComp.endDate) && (
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Competition Window</div>
                    <div className="text-sm font-extrabold text-slate-800">
                      {activeComp.startAt || activeComp.endAt
                        ? `${formatDateTimeIST(activeComp.startAt)}${activeComp.endAt ? ` – ${formatDateTimeIST(activeComp.endAt)}` : ''}`
                        : `${formatDate(activeComp.startDate)}${activeComp.endDate && activeComp.endDate !== activeComp.startDate ? ` – ${formatDate(activeComp.endDate)}` : ''}`}
                    </div>
                  </div>
                </div>
              )}

              {/* Final Assessment Unlock */}
              {activeComp.finalUnlockAt && (
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Final Assessment Unlock</div>
                    <div className="text-sm font-extrabold text-amber-900">
                      {formatDateTimeIST(activeComp.finalUnlockAt)}
                    </div>
                  </div>
                </div>
              )}

              {/* Timing */}
              {(activeComp.startTime || activeComp.endTime) && (
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Timing</div>
                    <div className="text-sm font-extrabold text-slate-800">
                      {activeComp.startTime}{activeComp.endTime ? ` – ${activeComp.endTime}` : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Registration Fee */}
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400">Registration Fee</div>
                  <div className="text-sm font-extrabold text-emerald-700">
                    {regFee > 0 ? `₹${regFee.toLocaleString('en-IN')}` : 'FREE (₹0)'}
                  </div>
                </div>
              </div>

              {/* Venue */}
              {activeComp.venue && (
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Venue / Platform</div>
                    <div className="text-sm font-extrabold text-slate-800">{activeComp.venue}</div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={activeLifecycle.onClick}
              className={`w-full font-black py-4 rounded-xl shadow-lg transition-transform text-center text-sm ${activeLifecycle.btnClass}`}
            >
              {activeLifecycle.btnText}
            </button>
          </div>

        </div>

        {/* Tabs Panel */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-6 sm:p-8 space-y-6">
          <div className="flex border-b border-slate-200 space-x-6 text-sm font-bold overflow-x-auto">
            {['about', 'instructions', 'contact & rules'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 transition-all capitalize border-b-2 whitespace-nowrap cursor-pointer ${
                  activeTab === tab
                    ? 'border-emerald-600 text-emerald-600 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'about' && (
            <div className="space-y-4">
              <h3 className="text-lg font-extrabold text-slate-900">About the Championship</h3>
              {activeComp.description ? (
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{activeComp.description}</p>
              ) : (
                <p className="text-slate-400 text-sm italic">No description provided for this competition.</p>
              )}
            </div>
          )}

          {activeTab === 'instructions' && (
            <div className="space-y-4">
              <h3 className="text-lg font-extrabold text-slate-900">Rules & Guidelines</h3>
              {instructionsList.length > 0 ? (
                <ul className="space-y-3">
                  {instructionsList.map((inst, i) => (
                    <li key={i} className="flex items-start space-x-3 text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{inst}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 text-sm italic">No specific instructions posted for this competition.</p>
              )}
            </div>
          )}

          {activeTab === 'contact & rules' && (
            <div className="space-y-4">
              <h3 className="text-lg font-extrabold text-slate-900">Contact & Details</h3>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-3">
                {activeComp.contactDetails ? (
                  <div><strong>Helpline Contact:</strong> {activeComp.contactDetails}</div>
                ) : (
                  <div className="text-slate-400 italic">No specific helpline contact listed.</div>
                )}

                {rulesDownloadUrl && (
                  <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                    <a
                      href={rulesDownloadUrl}
                      download
                      className="px-3 py-2 bg-amber-600 text-white font-bold rounded-xl flex items-center gap-1.5 hover:bg-amber-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Rules (PDF)</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* REGISTRATION DIALOG / MODAL */}
      <CompetitionRegisterModal
        competition={registeringComp}
        isOpen={Boolean(registeringComp)}
        currentUser={currentUser}
        onClose={() => setRegisteringComp(null)}
      />

      {/* LIFECYCLE INFO DIALOG / TOAST */}
      {infoModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl text-center space-y-4 border border-slate-200">
            <div className="w-14 h-14 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Trophy className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-slate-900">{infoModal.title}</h3>
              <p className="text-xs font-medium text-slate-600 leading-relaxed">{infoModal.message}</p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setInfoModal({ isOpen: false, title: '', message: '' })}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
