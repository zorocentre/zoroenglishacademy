import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileText, Play, Video, Sparkles, BookOpen, AlertCircle, Eye, X } from 'lucide-react';
import { getCompetitionSyllabus, getCompetitionGuidanceVideos } from '../../api/competitionApi';
import SafeVideo from '../common/SafeVideo';
import InlineSpinner from '../common/InlineSpinner';
import SkeletonCard from '../common/SkeletonCard';
import UniversalFileViewerModal from '../common/UniversalFileViewerModal';

export default function CompetitionSyllabusPage() {
  const { currentCompetition } = useOutletContext();
  const [syllabus, setSyllabus] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showPdfModal, setShowPdfModal] = useState(false);

  useEffect(() => {
    if (!currentCompetition?.id) return;
    loadContent();
  }, [currentCompetition?.id]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const [sylRes, vidRes] = await Promise.all([
        getCompetitionSyllabus(currentCompetition.id),
        getCompetitionGuidanceVideos(currentCompetition.id)
      ]);
      setSyllabus(sylRes?.data || null);
      const vids = vidRes?.data || [];
      // Deduplicate by bunnyVideoId / id and preserve order
      const seen = new Set();
      const uniqueVids = [];
      for (const v of vids) {
        const key = v.bunnyVideoId || v.id;
        if (key && !seen.has(key)) {
          seen.add(key);
          uniqueVids.push(v);
        } else if (!key) {
          uniqueVids.push(v);
        }
      }
      uniqueVids.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      setVideos(uniqueVids);
      if (uniqueVids.length > 0) {
        setSelectedVideo((prev) => (prev && uniqueVids.some((v) => v.id === prev.id) ? prev : uniqueVids[0]));
      }
    } catch (err) {
      console.error('Failed to load syllabus/videos:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!currentCompetition) {
    return (
      <div className="p-8 text-center text-slate-500 font-semibold text-xs">
        No registered competition selected.
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold mb-2">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Academic Curriculum</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Syllabus & Guidance Videos
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official curriculum guidelines and mentor preparation walkthroughs for <span className="font-bold text-slate-800">{currentCompetition.title || currentCompetition.name}</span>.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Syllabus Section */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    {syllabus?.title || 'Official Competition Syllabus'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Review the official topic breakdown, exam pattern, and marking criteria.
                  </p>
                </div>
              </div>

              {syllabus?.viewUrl ? (
                <button
                  type="button"
                  onClick={() => setShowPdfModal(true)}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#0F52BA] hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Syllabus</span>
                </button>
              ) : (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                  Syllabus will be published shortly
                </span>
              )}
            </div>

            {syllabus?.viewUrl && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>File: {syllabus.fileName || 'Syllabus.pdf'}</span>
              </div>
            )}
          </div>

          {/* Guidance Videos Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Video className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-black text-slate-900">Mentor Guidance & Preparation Videos</h2>
            </div>

            {videos.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center text-slate-500 space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-bold text-xs">No guidance videos published yet.</p>
                <p className="text-xs text-slate-400">Mentor briefing videos will appear here once uploaded by the academy.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Player Card */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-xs space-y-4">
                  {selectedVideo?.bunnyVideoId ? (
                    <div className="rounded-2xl overflow-hidden aspect-video bg-slate-950 shadow-inner">
                      <SafeVideo
                        bunnyVideoId={selectedVideo.bunnyVideoId}
                        embedUrl={selectedVideo.embedUrl}
                        title={selectedVideo.title}
                        className="w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl aspect-video bg-slate-100 flex items-center justify-center text-slate-400 font-semibold text-xs">
                      Select a video from the list to watch
                    </div>
                  )}

                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {selectedVideo?.caption || selectedVideo?.title || 'Guidance Video'}
                    </h3>
                    {selectedVideo?.duration && (
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Duration: {Math.round(selectedVideo.duration / 60)} minutes
                      </p>
                    )}
                  </div>
                </div>

                {/* Video Playlist Sidebar */}
                <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-xs space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    Playlist ({videos.length})
                  </h4>
                  <div className="space-y-2 max-h-[480px] overflow-y-auto">
                    {videos.map((vid, idx) => {
                      const isCurrent = selectedVideo?.id === vid.id;
                      return (
                        <div
                          key={vid.id || idx}
                          onClick={() => setSelectedVideo(vid)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center space-x-3 ${
                            isCurrent
                              ? 'bg-purple-50/80 border-purple-200 text-purple-900 shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/60 text-slate-700'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isCurrent ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate leading-tight">{vid.caption || vid.title}</p>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                              {vid.duration ? `${Math.round(vid.duration / 60)} min` : 'Guidance clip'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* View-Only Syllabus Signed-Link Viewer Modal (Task K10) */}
      <UniversalFileViewerModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        file={syllabus ? {
          id: syllabus.storedFileId || syllabus.id,
          url: syllabus.viewUrl,
          name: syllabus.fileName || syllabus.title,
          title: syllabus.title,
          type: syllabus.fileType
        } : null}
        hideDownload={true}
      />
    </div>
  );
}
