import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, LogIn, Lock, Mail, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWebsiteSettings } from '../../context/WebsiteSettingsContext';
import { authenticateUser } from '../../api/userApi';
import ButtonSpinner from '../common/ButtonSpinner';

export default function LoginModal({ isOpen, onClose, onLoginSuccess, onOpenEnquire }) {
  const { login, authNotice, clearAuthNotice } = useAuth();
  const { academyName } = useWebsiteSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Lock body scroll while modal is open (Task 3)
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email address and password');
      return;
    }

    setLoading(true);
    setError('');
    clearAuthNotice();

    // Validate credentials against database
    const authResult = await authenticateUser(email, password);
    setLoading(false);

    if (!authResult.success) {
      setError(authResult.message || 'Authentication failed. Invalid email or password.');
      return;
    }

    const loggedUser = login(authResult.user);
    onClose();

    if (onLoginSuccess) {
      onLoginSuccess(loggedUser);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-slate-100">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="text-center space-y-2 mb-6">
          <img 
            src="/assets/logo.png" 
            alt={`${academyName} Logo`} 
            className="h-14 w-auto mx-auto object-contain" 
          />
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
            Sign In
          </h3>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            {academyName} Portal
          </p>
        </div>

        {authNotice && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between space-x-3 text-xs font-bold text-amber-900 animate-in fade-in">
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 font-extrabold uppercase text-[10px] tracking-wider text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {authNotice.code === 'ACCOUNT_REMOVED'
                    ? 'Account Removed'
                    : authNotice.code === 'ACCOUNT_DISABLED'
                    ? 'Account Deactivated'
                    : 'Session Expired'}
                </span>
              </div>
              <div>{authNotice.message}</div>
            </div>
            <button
              type="button"
              onClick={clearAuthNotice}
              className="text-amber-500 hover:text-amber-700 font-black p-1 text-sm cursor-pointer"
              title="Dismiss Notice"
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                placeholder="e.g. user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Role & portal access are authenticated from your user record.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors focus:outline-none cursor-pointer"
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <ButtonSpinner
            type="submit"
            loading={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl shadow-lg transition-transform transform active:scale-95 flex items-center justify-center space-x-2 text-sm mt-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In to Dashboard</span>
          </ButtonSpinner>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          If you are a new user, click{' '}
          <button
            type="button"
            onClick={() => {
              if (onOpenEnquire) {
                onOpenEnquire();
              }
            }}
            className="text-blue-600 font-bold hover:underline cursor-pointer"
          >
            Enquire Now
          </button>{' '}
          to get your login credentials.
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : modalContent;
}
