import React, { useState } from 'react';
import { LogIn, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authenticateUser } from '../api/userApi';
import ButtonSpinner from '../components/common/ButtonSpinner';
import Logo from '../components/common/Logo';

export default function LoginPage({ setActiveScreen, onLoginSuccess }) {
  const { login, authNotice, clearAuthNotice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('ADMIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    setLoading(true);
    setError('');
    clearAuthNotice();

    const authResult = await authenticateUser(email, password);
    setLoading(false);

    if (!authResult.success) {
      setError(authResult.message || 'Authentication failed. Invalid email or password.');
      return;
    }

    const loggedUser = login(authResult.user);
    const userRole = (loggedUser.role || selectedRole).toUpperCase();
    if (onLoginSuccess) {
      onLoginSuccess(loggedUser);
    } else {
      if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
        setActiveScreen('admin-dash');
      } else if (userRole === 'TRAINER') {
        setActiveScreen('trainer-dash');
      } else {
        setActiveScreen('student-dash');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      
      {/* Top Back Navigation */}
      <div className="max-w-md w-full mx-auto px-4 mb-4">
        <button
          onClick={() => setActiveScreen('public-home')}
          className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <Logo 
          size="w-16 h-16" 
          alt="Zoro English Academy Logo" 
          className="mx-auto"
        />
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          Zoro English Academy
        </h2>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Sign in to your account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-3xl border border-slate-200/80 space-y-6">
          
          {/* Role Selector Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Select Account Type</label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-[10px] font-extrabold text-slate-600">
              {[
                { id: 'STUDENT', label: 'Student' },
                { id: 'TRAINER', label: 'Trainer' },
                { id: 'ADMIN', label: 'Admin' },
                { id: 'SUPER_ADMIN', label: 'Super Admin' }
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r.id)}
                  className={`py-2 rounded-lg transition-all ${
                    selectedRole === r.id ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {authNotice && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between space-x-3 text-xs font-bold text-amber-900 animate-in fade-in">
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@zoroenglish.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end text-xs">
              <a href="#" className="font-bold text-blue-600 hover:text-blue-800">Forgot password?</a>
            </div>

            <ButtonSpinner
              type="submit"
              loading={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-transform transform active:scale-95 flex items-center justify-center space-x-2 text-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Login as {selectedRole.replace('_', ' ')}</span>
            </ButtonSpinner>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center text-xs">
            <span className="text-slate-500">Don't have an account? </span>
            <button
              onClick={() => setActiveScreen('public-register')}
              className="font-bold text-blue-600 hover:underline"
            >
              Register as Student
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
