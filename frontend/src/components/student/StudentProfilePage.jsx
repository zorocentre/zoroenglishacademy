import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, BookOpen, Check, Edit3, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getStudentEnrolledCourses } from '../../api/enrollmentApi';
import { updateStudentProfile } from '../../api/userApi';
import { uploadFile, resolveFileUrl } from '../../api/fileApi';
import { sanitizePhone, validatePhone, formatPhone, SUBMIT_PHONE_ERROR } from '../../utils/phoneValidator';
import { useDialog } from '../../context/DialogContext';
import PhoneInput from '../common/PhoneInput';
import PageLoader from '../common/PageLoader';

export default function StudentProfilePage() {
  const { user, updateUserInContext } = useAuth();
  const { showError, showWarning } = useDialog();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    joinedOn: user?.joinedOn || '',
    avatar: user?.avatar || ''
  });

  const [selectedPhoto, setSelectedPhoto] = useState(user?.avatar || '');
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user?.email || user?.id) {
      setLoading(true);
      getStudentEnrolledCourses(user.id || user.email)
        .then(courses => {
          setEnrolledCourses(courses || []);
        })
        .finally(() => {
          setLoading(false);
        });
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        joinedOn: user.joinedOn || '',
        avatar: user.avatar || ''
      });
      setSelectedPhoto(user.avatar || '');
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return <PageLoader fullPage message="Loading student profile..." />;
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase()) && !file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
      showWarning('Please upload a valid image file (JPG, JPEG, PNG, or WEBP).', 'Invalid Image Type');
      return;
    }

    try {
      const res = await uploadFile(file, 'avatar');
      setSelectedPhoto(res.url);
      setProfileData(prev => ({ ...prev, avatar: res.url }));
    } catch (err) {
      showError(err.message || 'Avatar upload failed', 'Upload Error');
    }
  };

  const handleSaveProfile = async () => {
    if (profileData.phone && !validatePhone(profileData.phone)) {
      setMsg({ type: 'error', text: SUBMIT_PHONE_ERROR });
      setTimeout(() => setMsg({ type: '', text: '' }), 4000);
      return;
    }
    if (user?.id || user?.email) {
      const payload = {
        ...profileData,
        phone: sanitizePhone(profileData.phone),
        avatar: selectedPhoto || profileData.avatar
      };
      const res = await updateStudentProfile(user.id || user.email, payload);
      if (!res.success) {
        setMsg({ type: 'error', text: res.message || 'Failed to update profile.' });
        return;
      }
      updateUserInContext(payload);
    }
    setIsEditing(false);
    setMsg({ type: 'success', text: 'Profile and photo updated successfully!' });
    setTimeout(() => setMsg({ type: '', text: '' }), 3500);
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Student Profile</h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1">View personal information, enrolled programs, and update account avatar photo.</p>
      </div>

      {msg.text && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 max-w-2xl shadow-sm ${
          msg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          <Check className="w-4 h-4 shrink-0" />
          <span>{msg.text}</span>
        </div>
      )}

      {/* Profile Details (Requirement 11 & 12: Password Tab Removed) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-md space-y-6 max-w-2xl">
        {/* Avatar & Photo Upload (Requirement 11) */}
        <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-slate-100 pb-6">
          <div className="relative group">
            {selectedPhoto ? (
              <img
                src={resolveFileUrl(selectedPhoto)}
                alt={profileData.name}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-blue-500/20 shadow-md"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-3xl shadow-md uppercase">
                {(profileData.name || 'S').charAt(0)}
              </div>
            )}

            {isEditing && (
              <label className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg cursor-pointer transition-transform transform hover:scale-105" aria-label="Upload Profile Photo">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="text-center sm:text-left space-y-1">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{profileData.name}</h2>
            <span className="inline-block bg-blue-50 text-blue-700 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider border border-blue-200">
              Active Student
            </span>
            <p className="text-xs font-mono text-slate-400 mt-1">{profileData.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
          <div>
            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">Full Name</label>
            {isEditing ? (
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
              />
            ) : (
              <p className="font-extrabold text-slate-900 text-sm">{profileData.name}</p>
            )}
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">Email Address</label>
            <p className="font-bold text-blue-900">{profileData.email}</p>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">Phone Number</label>
            {isEditing ? (
              <PhoneInput
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                error={msg?.type === 'error' && msg.text === SUBMIT_PHONE_ERROR ? msg.text : ''}
                onErrorClear={() => {
                  if (msg?.text === SUBMIT_PHONE_ERROR) setMsg({ type: '', text: '' });
                }}
              />
            ) : (
              <p className="font-extrabold text-slate-800">{formatPhone(profileData.phone) || 'Not set'}</p>
            )}
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">Joined Date</label>
            <p className="font-bold text-slate-800">{profileData.joinedOn}</p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[10px]">Residential Address</label>
            {isEditing ? (
              <input
                type="text"
                value={profileData.address}
                onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white"
              />
            ) : (
              <p className="font-bold text-slate-800">{profileData.address}</p>
            )}
          </div>
        </div>

        {/* Enrolled Courses Card Section */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Enrolled Skill Programs</span>
          </h3>

          {enrolledCourses.length > 0 ? (
            <div className="space-y-2">
              {enrolledCourses.map(c => (
                <div key={c.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex justify-between items-center text-xs">
                  <div>
                    <h4 className="font-extrabold text-slate-900">{c.title}</h4>
                    <p className="text-[10px] text-slate-500 font-medium">{c.duration} • {c.mode}</p>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    ACTIVE
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No courses currently enrolled.</p>
          )}
        </div>

        <div className="pt-2">
          <button
            onClick={isEditing ? handleSaveProfile : () => setIsEditing(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black px-5 py-2.5 rounded-xl shadow-md text-xs inline-flex items-center space-x-2 cursor-pointer transition-colors"
          >
            {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            <span>{isEditing ? 'Save Changes' : 'Edit Profile Information'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
