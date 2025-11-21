import React, { useMemo } from 'react';
import * as GeoPattern from 'geopattern';

const DefaultCover = ({ title }: { title: string }) => {
  const patternUrl = useMemo(() => {
    try {
      const pattern = GeoPattern.generate(title);
      return pattern.toDataUrl();
    } catch (e) {
      return '';
    }
  }, [title]);

  return (
    <div 
      className="w-full h-full flex items-center justify-center p-4 text-white text-xl font-bold text-center relative overflow-hidden"
      style={{ 
        backgroundImage: patternUrl,
        backgroundSize: 'cover', // or 'auto' depending on pattern
        textShadow: '0 2px 4px rgba(0,0,0,0.5)'
      }}
    >
      <span className="relative z-10 drop-shadow-md break-words w-full">
        {title}
      </span>
    </div>
  );
};

export default DefaultCover;
