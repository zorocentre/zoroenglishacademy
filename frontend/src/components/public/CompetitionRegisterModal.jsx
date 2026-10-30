import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trophy, CheckCircle2, AlertCircle, CreditCard, ShieldCheck, User, Mail, Building2, MapPin, ArrowRight } from 'lucide-react';
import { createRazorpayOrder, verifyRazorpayPayment } from '../../api/paymentApi';
import { initiateRazorpayPayment } from '../../utils/razorpay';
import { createNotification } from '../../api/notificationApi';
import { formatDate } from '../../utils/dateFormatter';
import { validatePhone, SUBMIT_PHONE_ERROR } from '../../utils/phoneValidator';
import PhoneInput from '../common/PhoneInput';
import ButtonSpinner from '../common/ButtonSpinner';

export default function CompetitionRegisterModal({ competition, isOpen, onClose, currentUser, onSuccess }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successDialog, setSuccessDialog] = useState(null); // { competitionTitle, data }
  const [failureDialog, setFailureDialog] = useState(null); // string reason

  const [formData, setFormData] = useState({
    studentName: currentUser?.name || currentUser?.studentName || '',
    studentEmail: currentUser?.email || '',
    studentPhone: currentUser?.phone || currentUser?.mobile || '',
    studentId: currentUser?.studentId || currentUser?.id || null,
    age: '',
    school: '',
    city: ''
  });

  useEffect(() => {
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        studentName: currentUser.name || currentUser.studentName || '',
        studentEmail: currentUser.email || '',
        studentPhone: currentUser.phone || currentUser.mobile || '',
        studentId: currentUser.studentId || currentUser.id || null
      }));
    }
  }, [currentUser, competition]);

  // Window Focus Failsafe: If user returns to tab while payment is processing, reset loading if payment didn't resolve
  useEffect(() => {
    if (!loading) return;

    const handleWindowFocus = () => {
      setTimeout(() => {
        setLoading(false);
      }, 1200);
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [loading]);

  if (!isOpen || !competition) return null;

  const regFee = Number(competition.registrationFee || competition.fee || 0);

  const resetForm = () => {
    setFormData({
      studentName: currentUser?.name || currentUser?.studentName || '',
      studentEmail: currentUser?.email || '',
      studentPhone: currentUser?.phone || currentUser?.mobile || '',
      studentId: currentUser?.studentId || currentUser?.id || null,
      age: '',
      school: '',
      city: ''
    });
    setErrorMsg('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Field 1: Participant Full Name
    const cleanName = formData.studentName.trim();
    if (!cleanName) {
      setErrorMsg('Please enter participant full name.');
      return;
    }

    // Field 2: Email (Gmail)
    const cleanEmail = formData.studentEmail.trim();
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!cleanEmail || !gmailRegex.test(cleanEmail)) {
      setErrorMsg('Please enter a valid Gmail address (e.g. name@gmail.com).');
      return;
    }

    // Field 3: Mobile Phone (10 digits)
    const cleanPhone = formData.studentPhone.trim();
    if (!cleanPhone || !validatePhone(cleanPhone)) {
      setErrorMsg(SUBMIT_PHONE_ERROR);
      return;
    }

    // Field 4: Age (Number)
    const ageNum = Number(formData.age);
    if (!formData.age || isNaN(ageNum) || ageNum < 5 || ageNum > 100) {
      setErrorMsg('Please enter a valid age between 5 and 100.');
      return;
    }

    // Field 5: School / Institution
    const cleanSchool = formData.school.trim();
    if (!cleanSchool) {
      setErrorMsg('Please enter your school or institution name.');
      return;
    }

    // Field 6: City
    const cleanCity = formData.city.trim();
    if (!cleanCity) {
      setErrorMsg('Please enter your city.');
      return;
    }

    // Open Pre-Payment Confirmation Modal without creating order yet
    setShowConfirmModal(true);
  };

  const handleConfirmAndProceed = async () => {
    setShowConfirmModal(false);
    setLoading(true);

    const cleanName = formData.studentName.trim();
    const cleanEmail = formData.studentEmail.trim();
    const cleanPhone = formData.studentPhone.trim();
    const ageNum = Number(formData.age);
    const cleanSchool = formData.school.trim();
    const cleanCity = formData.city.trim();

    try {
      // 1. Server-driven order creation / registration check
      const orderPayload = {
        competitionId: competition.id,
        studentName: cleanName,
        studentEmail: cleanEmail,
        studentPhone: cleanPhone,
        studentId: formData.studentId || null,
        age: ageNum,
        school: cleanSchool,
        city: cleanCity
      };

      const orderRes = await createRazorpayOrder(orderPayload);
      if (!orderRes.success || !orderRes.data) {
        setFailureDialog(orderRes.message || 'Failed to initialize competition registration.');
        setLoading(false);
        return;
      }

      const orderData = orderRes.data;

      // Free competition -> Confirmed directly by server
      if (orderData.free) {
        if (cleanEmail) {
          await createNotification({
            trainerName: '',
            title: `Registration Confirmed: ${competition.name || competition.title}`,
            desc: `Your registration for ${competition.name || competition.title} is confirmed.${(competition.startDate || competition.date) ? ` Date: ${formatDate(competition.startDate || competition.date)}.` : ''}${competition.venue ? ` Venue: ${competition.venue}` : ''}`,
            studentEmail: cleanEmail,
            type: 'competition_reg'
          }).catch(err => console.warn('Notification error:', err));
        }

        setLoading(false);
        setSuccessDialog({
          competitionTitle: competition.name || competition.title,
          data: orderData
        });
        return;
      }

      // 2. Paid competition -> Launch Razorpay Checkout
      const rzpOptions = {
        key: orderData.keyId,
        keyId: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Zoro English Academy',
        description: `Competition Registration: ${competition.name || competition.title}`,
        order_id: orderData.orderId,
        orderId: orderData.orderId,
        prefill: {
          name: cleanName,
          email: cleanEmail,
          contact: cleanPhone
        },
        theme: {
          color: '#0F52BA'
        }
      };

      await initiateRazorpayPayment(
        rzpOptions,
        async (paymentResponse) => {
          try {
            const verifyPayload = {
              orderId: paymentResponse.razorpay_order_id || paymentResponse.razorpayOrderId || orderData.orderId,
              paymentId: paymentResponse.razorpay_payment_id || paymentResponse.razorpayPaymentId,
              signature: paymentResponse.razorpay_signature || paymentResponse.razorpaySignature,
              razorpayOrderId: paymentResponse.razorpay_order_id || paymentResponse.razorpayOrderId || orderData.orderId,
              razorpayPaymentId: paymentResponse.razorpay_payment_id || paymentResponse.razorpayPaymentId,
              razorpaySignature: paymentResponse.razorpay_signature || paymentResponse.razorpaySignature,
              razorpay_order_id: paymentResponse.razorpay_order_id || paymentResponse.razorpayOrderId || orderData.orderId,
              razorpay_payment_id: paymentResponse.razorpay_payment_id || paymentResponse.razorpayPaymentId,
              razorpay_signature: paymentResponse.razorpay_signature || paymentResponse.razorpaySignature,
              competitionId: competition.id,
              studentEmail: cleanEmail,
              registrationId: orderData.registrationId
            };

            const verifyRes = await verifyRazorpayPayment(verifyPayload);

            if (verifyRes.success) {
              if (cleanEmail) {
                await createNotification({
                  trainerName: '',
                  title: `Payment & Registration Confirmed: ${competition.name || competition.title}`,
                  desc: `Your registration for ${competition.name || competition.title} has been confirmed. Payment ID: ${paymentResponse.razorpayPaymentId || paymentResponse.razorpay_payment_id}.`,
                  studentEmail: cleanEmail,
                  type: 'competition_reg'
                }).catch(err => console.warn('Notification error:', err));
              }

              setLoading(false);
              setSuccessDialog({
                competitionTitle: competition.name || competition.title,
                data: {
                  ...orderData,
                  ...(verifyRes.data || {}),
                  existingStudentName: verifyRes.data?.existingStudentName || orderData?.existingStudentName
                }
              });
            } else {
              setLoading(false);
              setFailureDialog('Payment could not be verified. If money was deducted it will be refunded or confirmed shortly.');
            }
          } catch (verErr) {
            setLoading(false);
            console.error('Payment verification failed:', verErr);
            setFailureDialog('Payment could not be verified. If money was deducted it will be refunded or confirmed shortly.');
          }
        },
        (errorDismissal) => {
          setLoading(false);
          console.warn('Payment dismissed/failed:', errorDismissal);
          let reasonMsg = 'Payment could not be started. Please try again.';
          if (errorDismissal?.message?.includes('cancelled')) {
            reasonMsg = 'Payment was cancelled.';
          }
          setFailureDialog(reasonMsg);
        }
      );
    } catch (err) {
      setLoading(false);
      console.error('Registration/Payment error:', err);
      let userMsg = 'Payment could not be started. Please try again.';
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || err?.message || '';

      if (status === 503 || serverMsg.includes('not configured')) {
        userMsg = 'Payment is temporarily unavailable. Please try again later.';
      } else if (status === 409 || serverMsg.includes('closed')) {
        userMsg = 'Registration for this competition is closed.';
      } else if (serverMsg.includes('cancelled')) {
        userMsg = 'Payment was cancelled.';
      } else if (serverMsg.includes('verified') || serverMsg.includes('deducted')) {
        userMsg = 'Payment could not be verified. If money was deducted it will be refunded or confirmed shortly.';
      }
      setFailureDialog(userMsg);
    }
  };

  // Render Pre-Payment Confirmation Modal
  if (showConfirmModal) {
    const cleanName = formData.studentName.trim();
    const cleanEmail = formData.studentEmail.trim();
    const cleanPhone = formData.studentPhone.trim();
    const cleanSchool = formData.school.trim();
    const cleanCity = formData.city.trim();

    return (
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center space-x-3 text-blue-600">
            <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">Confirm Your Details</h3>
              <p className="text-slate-500 text-xs font-semibold">Please review your registration details before proceeding</p>
            </div>
          </div>

          {/* Important Warning Notice */}
          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="font-semibold leading-relaxed">
              Please verify your details carefully, especially your email address. Credentials will be delivered to this email.
            </p>
          </div>

          {/* Details Summary Table/Grid */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Competition</span>
              <span className="text-slate-900 font-bold text-right">{competition.name || competition.title}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Participant Name</span>
              <span className="text-slate-900 font-bold">{cleanName}</span>
            </div>
            <div className="flex flex-col py-1 border-b border-slate-200/60 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Registered Email</span>
                <span className="text-blue-700 font-bold">{cleanEmail}</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold text-right">
                Your exam credentials and updates will be sent here
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Mobile Number</span>
              <span className="text-slate-900 font-bold">{cleanPhone}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Age</span>
              <span className="text-slate-900 font-bold">{formData.age} years</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">School / Institution</span>
              <span className="text-slate-900 font-bold text-right">{cleanSchool}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">City</span>
              <span className="text-slate-900 font-bold">{cleanCity}</span>
            </div>
            <div className="flex justify-between pt-1 font-bold text-sm">
              <span className="text-slate-700">Registration Fee</span>
              <span className={regFee > 0 ? 'text-blue-700 font-black' : 'text-emerald-700 font-black'}>
                {regFee > 0 ? `₹${regFee.toLocaleString('en-IN')}` : 'FREE'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer text-xs flex-1 text-center"
            >
              Edit Details
            </button>
            <button
              type="button"
              onClick={() => {
                setShowConfirmModal(false);
                resetForm();
                onClose();
              }}
              className="py-3 px-4 rounded-xl border border-rose-200 text-rose-700 font-bold hover:bg-rose-50 transition cursor-pointer text-xs flex-1 text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAndProceed}
              className="py-3 px-5 rounded-xl bg-[#0F52BA] hover:bg-blue-700 text-white font-black shadow-md transition cursor-pointer text-xs flex-2 flex items-center justify-center space-x-1.5"
            >
              <span>{regFee > 0 ? `Confirm & Proceed to Payment (₹${regFee})` : 'Confirm Registration'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Success App Dialog
  if (successDialog) {
    const existingStudentName = successDialog.data?.existingStudentName || successDialog.data?.existing_student_name;

    return (
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Important Enrolled Course Student Notice (Requirement D1) */}
          {existingStudentName && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-500 rounded-2xl text-left space-y-1">
              <p className="text-xs font-black text-rose-700 leading-relaxed">
                This email is already enrolled in the course with the name {existingStudentName}. If this is not you, please use another email to register for this competition, because the certificate will be issued in the name of {existingStudentName}. Please check carefully.
              </p>
            </div>
          )}

          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900">Registration Confirmed!</h3>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{successDialog.competitionTitle}</p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-left text-xs space-y-2 text-emerald-950">
            <p className="font-bold">
              🎉 Congratulations! Your registration has been confirmed.
            </p>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Login credentials and portal instructions have been sent to <strong>{formData.studentEmail}</strong>. If you are already an enrolled academy student, use your existing password to log in.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                const data = successDialog.data;
                setSuccessDialog(null);
                if (onSuccess) onSuccess(data);
                onClose();
              }}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer text-xs"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                const data = successDialog.data;
                setSuccessDialog(null);
                if (onSuccess) onSuccess(data);
                onClose();
                navigate(currentUser ? '/competition' : '/login');
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-[#0F52BA] hover:bg-blue-700 text-white font-bold transition flex items-center justify-center space-x-1 cursor-pointer text-xs shadow-md"
            >
              <span>Go to portal</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Failure App Dialog
  if (failureDialog) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-9 h-9" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900">Registration Failed</h3>
            <p className="text-sm font-semibold text-slate-600 leading-relaxed px-2">
              {failureDialog}
            </p>
          </div>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setFailureDialog(null)}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition cursor-pointer text-xs shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto text-xs animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer transition"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 text-amber-600">
          <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900">Register for Competition</h3>
            <p className="text-slate-500 text-xs font-semibold">{competition.name || competition.title}</p>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-slate-700 font-semibold">
          {(competition.startDate || competition.date) && (
            <div className="flex justify-between">
              <span className="text-slate-500">Date & Time:</span>
              <span className="text-slate-900 font-bold">
                {formatDate(competition.startDate || competition.date)}{competition.startTime ? ` (${competition.startTime})` : ''}
              </span>
            </div>
          )}
          {competition.venue && (
            <div className="flex justify-between">
              <span className="text-slate-500">Venue:</span>
              <span className="text-slate-900 font-bold">{competition.venue}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
            <span className="text-slate-800 font-black">Registration Fee:</span>
            <span className="text-emerald-700 font-black">
              {regFee > 0 ? `₹${regFee.toLocaleString('en-IN')}` : 'FREE (₹0)'}
            </span>
          </div>
        </div>

        {/* Form Validation Feedback */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-2xl flex items-center space-x-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Field 1: Participant Full Name */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Participant Name *</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                placeholder="Participant Full Name"
                value={formData.studentName}
                onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Field 2: Email (Gmail) */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Email (Gmail) *</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com"
                  value={formData.studentEmail}
                  onChange={(e) => setFormData({ ...formData, studentEmail: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Field 3: Mobile Phone (10 digits) */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mobile Phone (10 Digits) *</label>
              <PhoneInput
                showIcon={true}
                required
                value={formData.studentPhone}
                onChange={(e) => {
                  setFormData({ ...formData, studentPhone: e.target.value });
                  if (errorMsg === SUBMIT_PHONE_ERROR) setErrorMsg('');
                }}
                error={errorMsg === SUBMIT_PHONE_ERROR ? errorMsg : ''}
                onErrorClear={() => {
                  if (errorMsg === SUBMIT_PHONE_ERROR) setErrorMsg('');
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Field 4: Age */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Age *</label>
              <input
                type="number"
                required
                min="5"
                max="100"
                placeholder="e.g. 14"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Field 5: School / Institution */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">School / Institution *</label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="School Name"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Field 6: City */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">City *</label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          <ButtonSpinner
            type="submit"
            loading={loading}
            disabled={loading}
            className="w-full text-white font-black py-4 rounded-xl shadow-lg transition-transform transform active:scale-95 flex items-center justify-center space-x-2 text-xs cursor-pointer mt-2 bg-[#0F52BA] hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {regFee > 0 ? <CreditCard className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            <span>
              {regFee > 0 
                ? `Proceed to Razorpay Payment (₹${regFee})` 
                : 'Confirm Free Registration'}
            </span>
          </ButtonSpinner>
        </form>

      </div>
    </div>
  );
}
