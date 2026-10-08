/**
 * ORDIUM Platform Architecture Page
 */

import React from 'react';
import { Cpu, Zap, Activity, ShieldAlert, GitBranch, Layers } from 'lucide-react';
import { RiskCore3D } from '../3d/RiskCore3D';
import { PipelineSection } from '../marketing/PipelineSection';

export const PlatformPage: React.FC = () => {
  return (
    <div className="py-20 bg-[#080B12] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1320] border border-white/10 text-xs font-mono text-[#6C5CE7]">
            <span>ENGINEERING SPECIFICATION</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            The ORDIUM Risk Engine
          </h1>
          <p className="text-base text-[#94A3B8] leading-relaxed">
            Designed for merchant-scoped checkout risk evaluation. The platform persists risk signals, rule versions, identity relationships, and measured evaluation telemetry.
          </p>
        </div>

        {/* 3D Visualizer */}
        <div className="bg-[#0D1320] border border-white/10 rounded-2xl p-4 shadow-2xl mb-16">
          <div className="h-[460px] w-full rounded-xl overflow-hidden bg-[#080B12]">
            <RiskCore3D />
          </div>
          <div className="p-4 flex items-center justify-between text-xs font-mono text-[#94A3B8] border-t border-white/5">
            <span>CORE ARCHITECTURE: DISTRIBUTED DECISION GRAPH</span>
            <span className="text-[#22D3EE]">LATENCY: measured per evaluation</span>
          </div>
        </div>

        {/* Latency & Ingestion Benchmarks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <div className="p-6 rounded-2xl bg-[#0D1320] border border-white/10 text-center space-y-2">
            <div className="text-3xl font-mono font-extrabold text-white">Measured</div>
            <div className="text-xs font-bold text-[#22D3EE] font-mono">MEASURED EVALUATION TIME</div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              The dashboard reports measured evaluation time when persisted telemetry is available.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0D1320] border border-white/10 text-center space-y-2">
            <div className="text-3xl font-mono font-extrabold text-white">Merchant-scoped</div>
            <div className="text-xs font-bold text-[#10B981] font-mono">RATE LIMIT</div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Request limits are controlled by the active API environment and merchant configuration.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0D1320] border border-white/10 text-center space-y-2">
            <div className="text-3xl font-mono font-extrabold text-white">Inspectable</div>
            <div className="text-xs font-bold text-[#6C5CE7] font-mono">DECISION TRACEABILITY</div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Persisted assessments expose the risk events, rule version, profile version, and identity context available for review.
            </p>
          </div>
        </div>

        {/* Include Pipeline Detail */}
        <PipelineSection />

      </div>
    </div>
  );
};
