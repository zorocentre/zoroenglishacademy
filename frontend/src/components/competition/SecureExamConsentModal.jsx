import React, { useState } from 'react';
import { ShieldAlert, Maximize2, CheckSquare, Square, AlertTriangle, Lock, Eye, Ban } from 'lucide-react';
import ModalPortal from '../common/ModalPortal';

export default function SecureExamConsentModal({
  isOpen,
  title = 'Assessment',
  onConfirm,
  onCancel,
}) {
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  return (
    <ModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 text-slate-800">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Secure Lockdown Required
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">
              Proctored Exam Rules & Consent
            </h2>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          You are about to start <span className="font-bold text-slate-900">{title}</span>. To ensure complete integrity, this assessment runs in a strictly monitored, full-screen proctored environment.
        </p>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5 text-xs">
          <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider text-slate-500">
            <Lock className="w-3.5 h-3.5" />
            <span>Strict Anti-Cheating Policies:</span>
          </div>

          <div className="flex items-start space-x-2 text-slate-700">
            <Maximize2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span><strong>Mandatory Fullscreen:</strong> The exam must stay in fullscreen throughout. Exiting fullscreen triggers a violation.</span>
          </div>

          <div className="flex items-start space-x-2 text-slate-700">
            <Eye className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span><strong>Focus Monitoring:</strong> Tab switching, window minimization, or switching to external applications (Alt+Tab) is logged.</span>
          </div>

          <div className="flex items-start space-x-2 text-slate-700">
            <Ban className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span><strong>Restricted Input:</strong> Right-click context menus, copy/paste, developer tools (F12), and print shortcuts are blocked.</span>
          </div>

          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] leading-relaxed">
            <strong>3-Strike Rule:</strong> 1st infraction shows a warning. 2nd infraction shows a final warning. <strong>The 3rd infraction will immediately auto-submit your exam</strong> with zero score for any unattempted questions.
          </div>
        </div>

        <div
          onClick={() => setAgreed(!agreed)}
          className="flex items-start space-x-3 p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl cursor-pointer hover:bg-indigo-50 transition select-none"
        >
          <div className="mt-0.5 text-indigo-600 shrink-0">
            {agreed ? <CheckSquare className="w-5 h-5 fill-indigo-600 text-white" /> : <Square className="w-5 h-5" />}
          </div>
          <span className="text-xs font-bold text-indigo-950 leading-tight">
            I understand and accept the exam rules. I agree to enter fullscreen and abide by the proctoring regulations.
          </span>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            disabled={!agreed}
            onClick={onConfirm}
            className="px-6 py-2.5 bg-[#0F52BA] hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs shadow-md transition-all inline-flex items-center space-x-2 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Enter Fullscreen & Begin Exam</span>
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
