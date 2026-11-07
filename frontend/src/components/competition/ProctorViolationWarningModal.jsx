import React from 'react';
import { AlertTriangle, ShieldAlert, Maximize2 } from 'lucide-react';
import ModalPortal from '../common/ModalPortal';

export default function ProctorViolationWarningModal({
  isOpen,
  violationCount = 1,
  maxViolations = 3,
  reason = 'Proctoring violation detected',
  onResume
}) {
  if (!isOpen) return null;

  const remaining = Math.max(0, maxViolations - violationCount);
  const isFinalWarning = remaining === 1;

  return (
    <ModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-[10002] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 text-slate-800 border-2 border-rose-500">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isFinalWarning ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
              <AlertTriangle className="w-7 h-7 animate-bounce" />
            </div>
            <div>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${isFinalWarning ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                Strike {violationCount} of {maxViolations}
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                {isFinalWarning ? 'Final Proctoring Warning!' : 'Proctoring Violation Warning'}
              </h2>
            </div>
          </div>

          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2 text-rose-900">
            <p className="font-bold">
              Infraction Reason: <span className="font-semibold text-rose-700">{reason}</span>
            </p>
            <p className="text-[11px] leading-relaxed">
              Exiting fullscreen, switching tabs, minimizing the window, or pressing restricted keys is logged as an exam integrity infraction.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-600">
            {remaining > 0 ? (
              <p>
                You have <strong className="text-rose-600 font-bold">{remaining} warning{remaining > 1 ? 's' : ''} remaining</strong> before your exam is <strong>automatically submitted</strong>.
              </p>
            ) : (
              <p className="text-rose-600 font-bold">
                Maximum violations exceeded. Your exam will be submitted automatically.
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Return to Fullscreen & Resume Exam</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
