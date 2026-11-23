"use client";

import { useState } from "react";
import { Camera } from "lucide-react";

interface SafeCivicImageProps {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}

export function SafeCivicImage({
  src,
  alt,
  caption,
  className = "h-56 w-full",
}: SafeCivicImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-500 ${className}`}
      >
        <Camera size={24} aria-hidden="true" />
        <span className="px-4 text-center text-xs font-medium text-slate-600">
          {caption ?? alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
