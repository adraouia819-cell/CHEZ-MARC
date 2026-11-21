import { useState } from 'react';

interface StudioImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function StudioImage({ src, alt, className = '' }: StudioImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F2ECE3] via-[#EAE1D3] to-[#DFD3C1] text-[#5A554E] p-6 text-center ${className}`}
      >
        <span className="font-display text-2xl tracking-[0.18em] text-[#111111]">CASA STYLE</span>
        <span className="mt-2 text-xs tracking-wide text-[#5A554E] max-w-[20ch] truncate">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
