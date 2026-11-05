import { formatIstTime } from '../../utils/dateFormatter';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { getAttendanceRecords } from '../../api/attendanceApi';

export default function TrainerAttendancePage({ setActiveScreen }) {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    getAttendanceRecords().then(res => setRecords(res.data));
  }, []);

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50 min-h-screen">
      <button 
        onClick={() => setActiveScreen('trainer-dash')}
        className="inline-flex items-center space-x-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Trainer Dashboard</span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Trainer Attendance Oversight</h1>
          <p className="text-xs text-slate-500 font-medium">Session attendance logs for your students.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Topic</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Joined Time</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4 font-black text-slate-900">{rec.studentName}</td>
                  <td className="py-4 px-4 font-bold text-blue-900">{rec.course}</td>
                  <td className="py-4 px-4 text-slate-600">{rec.topic}</td>
                  <td className="py-4 px-4 text-slate-500">{rec.date}</td>
                  <td className="py-4 px-4 font-bold text-slate-800">{formatIstTime(rec.joinedAt) || rec.joinedAt}</td>
                  <td className="py-4 px-4">
                    <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border border-emerald-200">
                      {rec.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
