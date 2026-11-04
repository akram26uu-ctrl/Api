import React from 'react';

/** Frame for a decorative 3D illustration. The model is lazy-loaded (see ../3d/lazy),
 *  hidden from assistive tech, and the caption says what it illustrates. */
export const Model3DPanel: React.FC<{ caption: string; className?: string; children: React.ReactNode }> = ({ caption, className = '', children }) => (
  <figure className={`rounded-2xl border border-white/10 bg-[var(--ordium-surface)]/60 p-2 ${className}`}>
    <div aria-hidden="true" className="h-[260px] sm:h-[360px] w-full overflow-hidden rounded-xl bg-[var(--ordium-canvas)]/80">
      {children}
    </div>
    <figcaption className="px-3 pt-2.5 pb-1 text-sm text-[var(--ordium-subtle)] text-start">{caption}</figcaption>
  </figure>
);
