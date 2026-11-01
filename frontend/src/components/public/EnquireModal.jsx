import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { createEnquiry } from '../../api/enquiryApi';
import { getCourses } from '../../api/courseApi';
import { validatePhone, SUBMIT_PHONE_ERROR } from '../../utils/phoneValidator';
import PhoneInput from '../common/PhoneInput';

export default function EnquireModal({ isOpen, onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', courseId: '', course: '', message: '' });
  const [phoneError, setPhoneError] = useState('');
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [coursesError, setCoursesError] = useState(false);

  const loadActiveCourses = async () => {
    setLoadingCourses(true);
    setCoursesError(false);
    try {
      const res = await getCourses('student');
      if (res && res.success && Array.isArray(res.data)) {
        const active = res.data.filter(c => 
          (!c.status || c.status.toLowerCase() === 'active') &&
          (!c.audience || c.audience.toLowerCase() !== 'trainer')
        );
        setCourses(active);
      } else {
        setCoursesError(true);
      }
    } catch (err) {
      setCoursesError(true);
    } finally {
      setLoadingCourses(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadActiveCourses();
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCourseChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setFormData(prev => ({ ...prev, courseId: '', course: '' }));
    } else {
      const selected = courses.find(c => c.id === val);
      setFormData(prev => ({
        ...prev,
        courseId: val,
        course: selected ? selected.title : ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validatePhone(formData.phone)) {
      setPhoneError(SUBMIT_PHONE_ERROR);
      return;
    }
    setPhoneError('');
    await createEnquiry({
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: (formData.email || '').trim(),
      courseId: formData.courseId || null,
      courseInterest: formData.course || null,
      message: (formData.message || '').trim()
    });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2000);
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative border border-slate-100 max-h-[90dvh] overflow-y-auto">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto" />
            <h3 className="text-xl font-extrabold text-slate-900">Enquiry Submitted!</h3>
            <p className="text-xs text-slate-500">Our course counselor will get in touch with you shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Quick Inquiry</span>
              <h3 className="text-2xl font-black text-slate-900">Enquire Now</h3>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Student / Parent Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number (10 Digits) *</label>
                <PhoneInput
                  required
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    if (phoneError) setPhoneError('');
                  }}
                  error={phoneError}
                  onErrorClear={() => setPhoneError('')}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Course / Interest</label>
                {coursesError ? (
                  <div className="flex items-center justify-between p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs">
                    <span className="text-rose-700 font-bold">Failed to load courses</span>
                    <button
                      type="button"
                      onClick={loadActiveCourses}
                      className="flex items-center gap-1 font-extrabold text-blue-600 hover:underline text-[11px]"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  </div>
                ) : (
                  <select
                    value={formData.courseId || ''}
                    onChange={handleCourseChange}
                    disabled={loadingCourses || courses.length === 0}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                  >
                    <option value="" disabled>
                      {loadingCourses ? 'Loading courses...' : (courses.length === 0 ? 'No courses available yet' : 'Select a course')}
                    </option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Message / Questions (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Tell us about your child or inquiry..."
                  value={formData.message || ''}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 rounded-xl shadow-lg transition-transform transform active:scale-95 text-sm mt-4 cursor-pointer"
            >
              Submit Request
            </button>
          </form>
        )}

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : modalContent;
}
