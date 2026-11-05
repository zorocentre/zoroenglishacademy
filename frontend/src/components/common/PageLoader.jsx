import React from 'react';

export default function PageLoader({
  fullPage = false,
  message = 'Loading...',
  text,
  className = ''
}) {
  const displayMsg = text || message || 'Loading...';
  return (
    <div
      role="status"
      aria-busy="true"
      className={`flex flex-col items-center justify-center transition-opacity duration-200 ${
        fullPage ? 'min-h-[70vh] w-full p-8' : 'py-16 w-full'
      } ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-[#0F52BA] animate-spin" />
      </div>
      {displayMsg && (
        <p className="mt-4 text-xs font-bold text-slate-500 tracking-wide animate-pulse">
          {displayMsg}
        </p>
      )}
      <span className="sr-only">{displayMsg}</span>
    </div>
  );
}
