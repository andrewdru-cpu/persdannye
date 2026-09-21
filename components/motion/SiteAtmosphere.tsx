"use client";

import { useReducedMotion } from "framer-motion";

/** Soft aurora + noise for the whole site (CSS only, no 3D). */
export function SiteAtmosphere() {
  const reduce = useReducedMotion();

  return (
    <>
      <div className="luxury-vignette" aria-hidden />
      {!reduce && (
        <div className="aurora" aria-hidden>
          <div className="aurora-blob" />
          <div className="aurora-blob" />
          <div className="aurora-blob" />
          <div className="aurora-blob" />
          <div className="aurora-blob" />
        </div>
      )}
      <div className="noise-overlay" aria-hidden />
    </>
  );
}
