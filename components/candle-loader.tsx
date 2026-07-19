"use client";

import { motion, useReducedMotion } from "framer-motion";

const widths = { sm: 92, md: 138, lg: 188 } as const;

// Kept under the existing export name so every loading surface can be upgraded
// in one place. The previous candlestick artwork has been removed completely.
export function CandleLoader({
  size = "md",
  label,
  className = "",
}: {
  size?: keyof typeof widths;
  label?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={`edge-loader ${className}`} role="status" aria-live="polite" style={{ "--edge-loader-width": `${widths[size]}px` } as React.CSSProperties}>
      <span className="edge-loader-mark" aria-hidden="true"><i /><i /><i /></span>
      <span className="edge-loader-track" aria-hidden="true">
        <motion.i
          initial={reduce ? false : { scaleX: 0.08, opacity: 0.35 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        />
      </span>
      {label && <span className="edge-loader-label">{label}</span>}
    </div>
  );
}

export function CandleLoaderScreen({ label = "Loading" }: { label?: string }) {
  return <div className="grid min-h-[60vh] place-items-center px-5"><CandleLoader size="lg" label={label} /></div>;
}
