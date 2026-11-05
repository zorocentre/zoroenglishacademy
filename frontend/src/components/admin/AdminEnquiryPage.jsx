import React, { useState, useEffect } from 'react';
import { MessageSquare, Search, Trash2, Eye, Calendar, Phone, Mail, BookOpen, Clock, CheckCircle2, XCircle, X, UserCheck } from 'lucide-react';
import { getEnquiries, deleteEnquiry } from '../../api/enquiryApi';
import { getTrainerCourseRequests, updateTrainerCourseRequestStatus, deleteTrainerCourseRequest } from '../../api/courseApi';
import ConfirmModal from '../common/ConfirmModal';
import PageLoader from '../common/PageLoader';

export default function AdminEnquiryPage() {
  const [activeTab, setActiveTab] = useState('public'); // 'public' | 'trainer'
  const [enquiries, setEnquiries] = useState([]);
  const [trainerRequests, setTrainerRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingEnquiry, setViewingEnquiry] = useState(null);
  const [deleteModalData, setDeleteModalData] = useState(null);

  const loadAllEnquiries = async () => {
    setLoading(true);
    try {
      const [pubRes, trRes] = await Promise.all([
        getEnquiries(),
        getTrainerCourseRequests()
      ]);
      setEnquiries(pubRes.data || []);
      setTrainerRequests(trRes.data || []);
    } catch (err) {
      console.error('Failed to load enquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllEnquiries();
  }, []);

  const handleConfirmDelete = async () => {
    if (deleteModalData) {
      if (deleteModalData.type === 'trainer') {
        await deleteTrainerCourseRequest(deleteModalData.id);
      } else {
        await deleteEnquiry(deleteModalData.id);
      }
      setDeleteModalData(null);
      loadAllEnquiries();
    }
  };

  const handleUpdateRequestStatus = async (reqId, newStatus) => {
    await updateTrainerCourseRequestStatus(reqId, newStatus);
    loadAllEnquiries();
  };

  const filteredEnquiries = enquiries.filter(e => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (e.name && e.name.toLowerCase().includes(q)) ||
      (e.phone && e.phone.toLowerCase().includes(q)) ||
      (e.email && e.email.toLowerCase().includes(q)) ||
      (e.course && e.course.toLowerCase().includes(q)) ||
      (e.message && e.message.toLowerCase().includes(q))
    );
  });

  const filteredTrainerRequests = trainerRequests.filter(r => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (r.trainerName && r.trainerName.toLowerCase().includes(q)) ||
      (r.trainerEmail && r.trainerEmail.toLowerCase().includes(q)) ||
      (r.courseTitle && r.courseTitle.toLowerCase().includes(q)) ||
      (r.status && r.status.toLowerCase().includes(q))
    );
  });

  const pendingTrainerCount = trainerRequests.filter(r => r.status === 'Pending').length;

  if (loading) {
    return <PageLoader fullPage message="Loading enquiries..." />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-800 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Central Enquiries Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Enquiry Details
          </h1>
          <p className="text-xs text-slate-500 font-semibold">
            Manage Landing Page leads from public visitors and course access enquiries from trainers.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-xs font-bold text-blue-700 bg-blue-50 px-4 py-2 rounded-xl border border-blue-200/60">
            {enquiries.length} Public Leads
          </div>
          <div className="text-xs font-bold text-purple-700 bg-purple-50 px-4 py-2 rounded-xl border border-purple-200/60">
            {trainerRequests.length} Trainer Enquiries
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs">
        <button
          onClick={() => setActiveTab('public')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'public'
              ? 'bg-[#0F52BA] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Landing Page Leads ({enquiries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('trainer')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer relative ${
            activeTab === 'trainer'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Trainer Enquiries ({trainerRequests.length})</span>
          {pendingTrainerCount > 0 && (
            <span className="ml-1 bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
              {pendingTrainerCount} Pending
            </span>
          )}
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'public'
                ? "Search public enquiries by name, phone, email, course, or message..."
                : "Search trainer enquiries by trainer name, email, or requested course..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>
      </div>

      {/* TAB 1: PUBLIC VISITOR ENQUIRIES */}
      {activeTab === 'public' && (
        <>
          {loading ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-xs font-bold text-slate-400">
              Loading enquiries...
            </div>
          ) : filteredEnquiries.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-black text-slate-800">No Enquiries Found</h3>
              <p className="text-xs text-slate-500 font-medium">
                {searchTerm ? `No enquiries match your search "${searchTerm}".` : 'No visitor enquiries submitted yet.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[750px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-4 px-6">Visitor / Student Name</th>
                      <th className="py-4 px-6">Contact Number</th>
                      <th className="py-4 px-6">Interested Course</th>
                      <th className="py-4 px-6">Date / Time</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                    {filteredEnquiries.map((enq) => (
                      <tr key={enq.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-900">
                          <div>{enq.name}</div>
                          {enq.email && <div className="text-[11px] font-medium text-slate-400">{enq.email}</div>}
                        </td>
                        <td className="py-4 px-6 text-slate-700 font-extrabold">
                          <div className="flex items-center space-x-1.5">
                            <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{enq.phone}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-blue-900 font-extrabold">
                          <span className="bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60 inline-block">
                            {enq.course}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-500 font-medium">
                          <div className="flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{enq.submittedAt || 'Recent'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          <button
                            onClick={() => setViewingEnquiry(enq)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                            title="View Enquiry Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteModalData(enq)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Delete Enquiry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: TRAINER ENQUIRIES (COURSE ACCESS REQUESTS) */}
      {activeTab === 'trainer' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-6 space-y-4">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 bg-purple-50 text-purple-700 rounded-xl flex items-center justify-center font-black">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Trainer Course Access Enquiries</h2>
              <p className="text-xs text-slate-500 font-semibold">Review and approve course access inquiries submitted by trainers.</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-xs font-bold text-slate-400">Loading trainer enquiries...</div>
          ) : filteredTrainerRequests.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 font-medium">
              {searchTerm ? `No trainer enquiries match "${searchTerm}".` : 'No trainer course access enquiries submitted yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Trainer Name & Email</th>
                    <th className="py-3.5 px-4">Requested Course</th>
                    <th className="py-3.5 px-4">Request Date</th>
                    <th className="py-3.5 px-4">Current Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {filteredTrainerRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-black text-slate-900">
                        <div>{req.trainerName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{req.trainerEmail}</div>
                      </td>
                      <td className="py-4 px-4 font-bold text-purple-900">{req.courseTitle}</td>
                      <td className="py-4 px-4 text-slate-500">{req.requestedAt}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          req.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : req.status === 'Rejected'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right space-x-2">
                        {req.status === 'Pending' ? (
                          <>
                            <button
                              onClick={() => handleUpdateRequestStatus(req.id, 'Approved')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-[11px] shadow-xs cursor-pointer inline-flex items-center space-x-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleUpdateRequestStatus(req.id, 'Rejected')}
                              className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-extrabold px-3 py-1.5 rounded-lg text-[11px] cursor-pointer inline-flex items-center space-x-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleUpdateRequestStatus(req.id, 'Pending')}
                            className="text-slate-400 hover:text-slate-600 font-bold text-[11px] underline cursor-pointer"
                          >
                            Reset Status
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteModalData({ id: req.id, type: 'trainer', title: `trainer request from "${req.trainerName}"` })}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer inline-flex items-center ml-2"
                          title="Delete Request"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* View Public Enquiry Details Modal */}
      {viewingEnquiry && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-100 relative">
            <button
              onClick={() => setViewingEnquiry(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Enquiry Details</span>
              <h3 className="text-xl font-black text-slate-900">{viewingEnquiry.name}</h3>
              <p className="text-xs text-slate-400 font-medium">Submitted on {viewingEnquiry.submittedAt}</p>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-slate-700">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <span>Phone: <strong className="text-slate-900">{viewingEnquiry.phone}</strong></span>
                </div>
                {viewingEnquiry.email && (
                  <div className="flex items-center space-x-2 font-bold text-slate-700">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span>Email: <strong className="text-slate-900">{viewingEnquiry.email}</strong></span>
                  </div>
                )}
                <div className="flex items-center space-x-2 font-bold text-slate-700">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Course / Topic: <strong className="text-blue-700">{viewingEnquiry.course || 'None'}</strong></span>
                </div>
                {viewingEnquiry.courseId && (
                  <div className="text-[11px] font-mono text-slate-500 pl-6">
                    Course ID: {viewingEnquiry.courseId}
                  </div>
                )}
              </div>

              {viewingEnquiry.message && (
                <div className="space-y-1">
                  <div className="font-extrabold text-slate-600">Visitor Notes / Message:</div>
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200/60 text-slate-800 leading-relaxed font-medium">
                    "{viewingEnquiry.message}"
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewingEnquiry(null)}
                className="bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalData && (
        <ConfirmModal
          isOpen={!!deleteModalData}
          title="Delete Enquiry"
          message={`Are you sure you want to delete the enquiry from "${deleteModalData.name}"? This action cannot be undone.`}
          confirmLabel="Delete Enquiry"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteModalData(null)}
          isDanger={true}
        />
      )}

    </div>
  );
}
