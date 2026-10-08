/**
 * ORDIUM Code Block Component
 * High-precision developer code viewer with language tabs and one-click copy.
 */

import React, { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';

interface TabItem {
  label: string;
  code: string;
  language?: string;
}

interface CodeBlockProps {
  tabs?: TabItem[];
  code?: string;
  language?: string;
  title?: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  tabs,
  code: singleCode = '',
  language = 'json',
  title,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const activeCode = tabs ? tabs[activeTab]?.code || '' : singleCode;
  const activeLang = tabs ? tabs[activeTab]?.language || language : language;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className={`bg-[#080B12] border border-white/10 rounded-xl overflow-hidden shadow-2xl font-mono text-xs ${className}`}>
      {/* Header / Tabs */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0D1320] border-b border-white/5">
        <div className="flex items-center gap-2">
          {title ? (
            <span className="text-[#94A3B8] font-medium flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#22D3EE]" />
              {title}
            </span>
          ) : (
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
            </div>
          )}

          {tabs && (
            <div className="flex gap-1 ml-4">
              {tabs.map((tab, idx) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveTab(idx)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    activeTab === idx
                      ? 'bg-[#6C5CE7]/20 text-[#22D3EE] font-semibold border border-[#6C5CE7]/40'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-[#10B981]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Area */}
      <div className="p-4 overflow-x-auto text-[#F8FAFC] leading-relaxed max-h-[420px]">
        <pre className="selection:bg-[#6C5CE7]/40">
          <code>{activeCode}</code>
        </pre>
      </div>
    </div>
  );
};
