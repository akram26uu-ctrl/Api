/**
 * ORDIUM Risk Score Gauge
 * Precise visual gauge representing risk score (0-100) with category classification.
 */

import React from 'react';

interface RiskScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const RiskScoreGauge: React.FC<RiskScoreGaugeProps> = ({
  score,
  size = 'md',
  showLabel = true
}) => {
  const normalized = Math.min(100, Math.max(0, score));

  // Color logic
  let color = '#10B981'; // Green
  let label = 'Low Risk';
  if (normalized >= 75) {
    color = '#EF4444'; // Red
    label = 'Critical Risk';
  } else if (normalized >= 35) {
    color = '#F59E0B'; // Amber
    label = 'Elevated Risk';
  }

  const radius = 38;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (normalized / 100) * circumference;

  const sizeDimensions = {
    sm: 'w-12 h-12 text-xs',
    md: 'w-24 h-24 text-xl',
    lg: 'w-32 h-32 text-3xl'
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className={`relative flex items-center justify-center ${sizeDimensions[size]}`}>
        <svg height="100%" width="100%" viewBox="0 0 76 76" className="rotate-[-90deg]">
          {/* Background Track */}
          <circle
            stroke="rgba(255, 255, 255, 0.08)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx="38"
            cy="38"
          />
          {/* Active Fill */}
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.6s ease' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx="38"
            cy="38"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold text-white tracking-tighter">{normalized}</span>
          {size !== 'sm' && <span className="text-[9px] font-mono text-[#94A3B8]">/ 100</span>}
        </div>
      </div>
      {showLabel && size !== 'sm' && (
        <span
          className="text-xs font-mono font-medium mt-1.5"
          style={{ color }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
