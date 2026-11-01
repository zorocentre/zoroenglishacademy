import React, { useState } from 'react';
import { UserPlus, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sanitizePhone, validatePhone, SUBMIT_PHONE_ERROR } from '../utils/phoneValidator';
import PhoneInput from '../components/common/PhoneInput';
import Logo from '../components/common/Logo';

export default function RegisterPage({ setActiveScreen }) {
  const { registerStudent } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    ageGroup: '7-12 Years',
    password: '',
    confirmPassword: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validatePhone(formData.phone)) {
      setError(SUBMIT_PHONE_ERROR);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    registerStudent({
      ...formData,
      phone: sanitizePhone(formData.phone)
    });
    setSubmitted(true);
    setTimeout(() => {
      setActiveScreen('student-dash');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      
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
          Student Registration
        </h2>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Zoro English Academy
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-3xl border border-slate-200/80 space-y-6">
          
          {submitted ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto animate-bounce" />
              <h3 className="text-xl font-extrabold text-slate-900">Student Account Created!</h3>
              <p className="text-xs text-slate-500">Redirecting to your Student Dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="student@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile / WhatsApp Number (10 Digits) *</label>
                <PhoneInput
                  required
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    if (error) setError('');
                  }}
                  error={error === SUBMIT_PHONE_ERROR ? error : ''}
                  onErrorClear={() => {
                    if (error === SUBMIT_PHONE_ERROR) setError('');
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Age Group</label>
                <select
                  value={formData.ageGroup}
                  onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                >
                  <option value="5-7 Years">5-7 Years</option>
                  <option value="7-12 Years">7-12 Years</option>
                  <option value="12-16 Years">12-16 Years</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-transform transform active:scale-95 flex items-center justify-center space-x-2 text-sm mt-4"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register Student Account</span>
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-slate-100 text-center text-xs">
            <span className="text-slate-500">Already have an account? </span>
            <button
              onClick={() => setActiveScreen('public-login')}
              className="font-bold text-blue-600 hover:underline"
            >
              Sign In
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
