import React, { useState, useEffect } from 'react';
import { Layers, Search, Edit, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getBatches, createBatch, updateBatch, deleteBatch } from '../../api/batchApi';
import { getCourses } from '../../api/courseApi';
import { getTrainers } from '../../api/userApi';
import ConfirmModal from '../common/ConfirmModal';
import PageLoader from '../common/PageLoader';
import { useDialog } from '../../context/DialogContext';

export default function AdminBatchManagementPage() {
  const { showSuccess, showError } = useDialog();
  const [batches, setBatches] = useState([]);
  const [coursesList, setCoursesList] = useState([]);
  const [trainersList, setTrainersList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [editingBatch, setEditingBatch] = useState(null);
  const [deleteBatchData, setDeleteBatchData] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    courseId: '',
    courseName: '',
    trainerIds: [],
    status: 'Active'
  });

  const loadData = async () => {
    setLoading(true);
    const bRes = await getBatches();
    setBatches(bRes.data || []);
    
    const cRes = await getCourses();
    const courses = cRes.data || [];
    setCoursesList(courses);

    const tRes = await getTrainers();
    const trainers = tRes.data || [];
    setTrainersList(trainers);
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      courseId: '',
      courseName: '',
      trainerIds: [],
      status: 'Active'
    });
    setEditingBatch(null);
  };

  const handleToggleTrainer = (trainerId) => {
    const current = formData.trainerIds || [];
    let updated;
    if (current.includes(trainerId)) {
      updated = current.filter(id => id !== trainerId);
    } else {
      updated = [...current, trainerId];
    }
    setFormData({ ...formData, trainerIds: updated });
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (!formData.courseId && !formData.courseName) {
      await showError('Please select a course for this batch.', 'Validation Error');
      return;
    }

    const matchedCourse = coursesList.find(c => c.id === formData.courseId || c.title?.toLowerCase().trim() === formData.courseName?.toLowerCase().trim());
    const selectedTrainerObjs = trainersList.filter(t => (formData.trainerIds || []).includes(t.id));
    const primaryTrainer = selectedTrainerObjs[0];
    const trainerNamesStr = selectedTrainerObjs.map(t => t.name).join(', ');

    const payload = {
      name: formData.name.trim(),
      courseId: formData.courseId || matchedCourse?.id || '',
      courseName: formData.courseName || matchedCourse?.title || '',
      trainerId: primaryTrainer?.id || '',
      trainerName: trainerNamesStr,
      trainerIds: formData.trainerIds || [],
      status: formData.status
    };

    try {
      let res;
      if (editingBatch) {
        res = await updateBatch(editingBatch.id, payload);
      } else {
        res = await createBatch(payload);
      }
      if (res && res.success) {
        await showSuccess(res.message || (editingBatch ? 'Batch updated successfully' : 'Batch created successfully'), editingBatch ? 'Batch Updated' : 'Batch Created');
        resetForm();
        loadData();
      } else {
        await showError(res?.message || (editingBatch ? 'Failed to update batch' : 'Failed to create batch'), 'Save Failed');
      }
    } catch (err) {
      await showError(err?.message || 'Failed to save batch', 'Save Failed');
    }
  };

  const handleToggleStatus = async (batch) => {
    try {
      const newStatus = batch.status === 'Active' ? 'Inactive' : 'Active';
      const res = await updateBatch(batch.id, { status: newStatus });
      if (res && res.success) {
        await showSuccess(`Batch marked as ${newStatus}`, 'Status Updated');
        loadData();
      } else {
        await showError(res?.message || 'Failed to update status', 'Update Failed');
      }
    } catch (err) {
      await showError(err?.message || 'Failed to update status', 'Update Failed');
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteBatchData) {
      try {
        const res = await deleteBatch(deleteBatchData.id);
        setDeleteBatchData(null);
        if (res && res.success) {
          await showSuccess(res.message || 'Batch deleted successfully', 'Batch Deleted');
          loadData();
        } else {
          await showError(res?.message || 'Failed to delete batch', 'Delete Failed');
        }
      } catch (err) {
        setDeleteBatchData(null);
        await showError(err?.message || 'Failed to delete batch', 'Delete Failed');
      }
    }
  };

  const openEditModal = (batch) => {
    setEditingBatch(batch);

    const matchedCourse = coursesList.find(c => c.id === batch.courseId || (batch.courseName && c.title?.toLowerCase().trim() === batch.courseName?.toLowerCase().trim()));

    // Extract assigned trainer IDs
    let assignedTrainerIds = [];
    if (Array.isArray(batch.trainerIds) && batch.trainerIds.length > 0) {
      assignedTrainerIds = batch.trainerIds;
    } else if (Array.isArray(batch.trainers) && batch.trainers.length > 0) {
      assignedTrainerIds = batch.trainers.map(t => t.id);
    } else if (batch.trainerId) {
      assignedTrainerIds = batch.trainerId.split(',').map(s => s.trim()).filter(Boolean);
    } else if (batch.trainerName) {
      const names = batch.trainerName.split(',').map(s => s.trim().toLowerCase());
      assignedTrainerIds = trainersList.filter(t => names.includes(t.name?.toLowerCase().trim())).map(t => t.id);
    }

    setFormData({
      name: batch.name || '',
      courseId: batch.courseId || matchedCourse?.id || '',
      courseName: batch.courseName || matchedCourse?.title || '',
      trainerIds: assignedTrainerIds,
      status: batch.status || 'Active'
    });
  };

  const filteredBatches = batches.filter(b => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    const trainerNames = Array.isArray(b.trainers)
      ? b.trainers.map(t => t.name).join(' ')
      : (b.trainerName || '');
    return (
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.courseName && b.courseName.toLowerCase().includes(q)) ||
      trainerNames.toLowerCase().includes(q) ||
      (b.status && b.status.toLowerCase().includes(q))
    );
  });

  const eligibleCourses = (coursesList || []).filter(c => {
    const mode = (c.mode || '').toLowerCase();
    const isOnlineOrHybrid = mode === 'online' || mode === 'hybrid';
    const isStudentAudience = !c.audience || c.audience.toLowerCase() === 'student';
    return isOnlineOrHybrid && isStudentAudience;
  });

  if (loading) {
    return <PageLoader fullPage message="Loading batches..." />;
  }

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Batch Management</h1>
          <p className="text-xs text-slate-500 font-medium">Create course batches, assign trainers, and manage active status.</p>
        </div>
      </div>

      {/* Add / Edit Batch Form Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md">
        <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>{editingBatch ? `Edit Batch: ${editingBatch.name}` : 'Create New Batch'}</span>
        </h3>

        <form onSubmit={handleCreateOrUpdate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Batch Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Batch Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Java Morning Batch"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Course Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Course *</label>
              <select
                value={formData.courseId || ''}
                onChange={(e) => {
                  const selId = e.target.value;
                  const matched = eligibleCourses.find(c => c.id === selId);
                  setFormData({
                    ...formData,
                    courseId: selId,
                    courseName: matched?.title || ''
                  });
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none"
              >
                <option value="">{eligibleCourses.length === 0 ? "No courses available" : "-- Select Course --"}</option>
                {eligibleCourses.map(c => (
                  <option key={c.id} value={c.id}>{c.title} ({c.mode || 'Online'})</option>
                ))}
              </select>
            </div>

          </div>

          {/* Multiple Trainers Selection (Phase 3 Multi-Trainer Support) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-800">
                Assigned Trainers (Multi-Trainer Support)
              </label>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                (formData.trainerIds || []).length > 0 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {(formData.trainerIds || []).length} assigned
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Assign one or more trainers to this batch. Batches can be created with 0 trainers, but at least one trainer must be assigned before scheduling live sessions.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {trainersList.map((t) => {
                const isSelected = (formData.trainerIds || []).includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleToggleTrainer(t.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs scale-105'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-400'
                    }`}
                  >
                    <span>{t.name}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
            {(formData.trainerIds || []).length === 0 && (
              <p className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mt-1 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>No trainer assigned yet. You can save this batch and assign trainers later, but live class sessions cannot be scheduled for this batch until a trainer is assigned.</span>
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {editingBatch && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-md cursor-pointer"
            >
              {editingBatch ? 'Update Batch' : 'Save Batch'}
            </button>
          </div>
        </form>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="🔍 Search batches by name, course, trainer, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold">
                <th className="py-3 px-4">Batch Name</th>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Assigned Trainers</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {filteredBatches.length > 0 ? (
                filteredBatches.map((batch) => {
                  const isActive = batch.status === 'Active';

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-black text-slate-900">{batch.name}</td>
                      <td className="py-4 px-4 text-blue-900 font-bold">{batch.courseName}</td>
                      <td className="py-4 px-4 text-slate-800 font-bold">
                        {(() => {
                          const list = Array.isArray(batch.trainers) && batch.trainers.length > 0
                            ? batch.trainers
                            : (batch.trainerName
                                ? batch.trainerName.split(',').map(n => ({ id: n.trim(), name: n.trim() }))
                                : []);
                          if (list.length === 0) {
                            return (
                              <span className="inline-flex items-center text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[10px]">
                                No trainer assigned
                              </span>
                            );
                          }
                          return (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {list.map((t, idx) => (
                                <span key={idx} className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleToggleStatus(batch)}
                          className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                          title="Click to toggle status"
                        >
                          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                          <span>{isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                        </button>
                      </td>
                      <td className="py-4 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(batch)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                          title="Edit Batch"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteBatchData(batch)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete Batch"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500 font-bold text-xs">
                    No batches found matching search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteBatchData)}
        title="Delete Batch"
        message={`Are you sure you want to delete batch "${deleteBatchData?.name}" (${deleteBatchData?.courseName})?`}
        confirmText="Delete Batch"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteBatchData(null)}
      />

    </div>
  );
}
