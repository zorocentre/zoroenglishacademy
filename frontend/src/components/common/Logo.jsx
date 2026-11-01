import React from 'react';

const SIZE_MAP = {
  xs: 'w-7 h-7',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
  '2xl': 'w-20 h-20'
};

export default function Logo({ 
  size = 'md', 
  className = '', 
  imgClassName = '',
  alt = 'Zoro English Academy Logo',
  src = '/assets/logo.png',
  showText = false,
  textClassName = '',
  academyName = 'Zoro English Academy',
  tagline = ''
}) {
  const sizeClasses = SIZE_MAP[size] || (typeof size === 'string' && (size.includes('w-') || size.includes('h-')) ? size : 'w-10 h-10');

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div className={`rounded-full overflow-hidden shrink-0 bg-transparent flex items-center justify-center ${sizeClasses}`}>
        <img 
          src={src} 
          alt={alt} 
          className={`w-full h-full object-cover rounded-full ${imgClassName}`}
          loading="lazy"
        />
      </div>
      {showText && (
        <div className={textClassName}>
          <div className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-none">
            {academyName}
          </div>
          {tagline && (
            <div className="text-[9px] sm:text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-0.5">
              {tagline}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
