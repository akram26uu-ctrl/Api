import React from 'react';

export const BrandMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <path d="M18 3 31 10.5v15L18 33 5 25.5v-15L18 3Z" stroke="currentColor" strokeWidth="1.4" />
    <path d="m18 9 7.8 4.5v9L18 27l-7.8-4.5v-9L18 9Z" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="18" cy="18" r="2.7" fill="currentColor" />
    <path d="M18 3v6m13 1.5-5.2 3M31 25.5 25.8 22.5M18 33v-6M5 25.5l5.2-3M5 10.5l5.2 3" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);
