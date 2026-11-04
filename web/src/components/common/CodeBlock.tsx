/**
 * ORDIUM Code Block Component
 * High-precision developer code viewer with language tabs and one-click copy.
 */

import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
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
  const { t } = useLanguage();
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
    <div className={`bg-[var(--ordium-canvas)] border border-white/10 rounded-xl overflow-hidden shadow-2xl font-mono text-xs ${className}`}>
      {/* Header / Tabs */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--ordium-surface)] border-b border-white/5">
        <div className="flex items-center gap-2">
          {title ? (
            <span className="text-[var(--ordium-muted)] font-medium flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[var(--ordium-signal)]" />
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
            <div className="flex gap-1 ms-4" dir="ltr">
              {tabs.map((tab, idx) => (
                <button
                  key={tab.label}
                  type="button"
                  aria-pressed={activeTab === idx}
                  onClick={() => setActiveTab(idx)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    activeTab === idx
                      ? 'bg-[var(--ordium-accent)]/20 text-[var(--ordium-signal)] font-semibold border border-[var(--ordium-accent)]/40'
                      : 'text-[var(--ordium-muted)] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[var(--ordium-muted)] hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
          title={t('ui.copy_code', 'Copy code')}
          aria-label={copied ? t('ui.copied', 'Copied') : t('ui.copy_code', 'Copy code')}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[var(--ordium-success)]" />
              <span className="text-[var(--ordium-success)]" role="status">{t('ui.copied', 'Copied')}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>{t('ui.copy', 'Copy')}</span>
            </>
          )}
        </button>
      </div>

      {/* Code Area */}
      {/* Code is always left-to-right, even inside Arabic pages; long lines scroll inside the block. */}
      <div dir="ltr" className="p-4 overflow-auto text-[#F8FAFC] leading-relaxed max-h-[420px] text-left">
        <pre dir="ltr" className="m-0 w-max min-w-full text-left whitespace-pre [unicode-bidi:isolate] selection:bg-[var(--ordium-accent)]/40">
          <code dir="ltr" className="[unicode-bidi:isolate]">{activeCode}</code>
        </pre>
      </div>
    </div>
  );
};
