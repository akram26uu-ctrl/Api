/** Contains rendering errors so one failing section never blanks the whole application. */
import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Changing this value (e.g. the active dashboard tab) clears the error state. */
  resetKey?: unknown;
  variant?: 'section' | 'page';
}

interface ErrorBoundaryState { error: Error | null }

const Fallback: React.FC<{ variant: 'section' | 'page'; onRetry: () => void }> = ({ variant, onRetry }) => {
  const { t } = useLanguage();
  return (
    <div role="alert" className={`flex flex-col items-center justify-center gap-3 text-center ${variant === 'page' ? 'min-h-screen bg-[var(--ordium-canvas)] px-6' : 'dashboard-panel m-4 sm:m-6 p-8'}`}>
      <AlertTriangle aria-hidden="true" className="h-8 w-8 text-amber-300" />
      <h2 className="text-base font-semibold text-white">{t('ui.error_title', 'This section could not be displayed')}</h2>
      <p className="max-w-md text-sm leading-relaxed text-[var(--ordium-muted)]">{t('ui.error_desc', 'An unexpected error occurred. Your data is safe. Try again, and if it keeps happening, reload the page.')}</p>
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ordium-accent-fill)] px-4 text-sm font-semibold text-white hover:bg-[var(--ordium-accent-fill-hover)]">
          <RotateCcw aria-hidden="true" className="h-4 w-4" /> {t('common.retry', 'Retry')}
        </button>
        <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm text-white hover:bg-white/5">
          {t('ui.reload_page', 'Reload page')}
        </button>
      </div>
    </div>
  );
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Declared explicitly: the project builds without @types/react, so inherited members are untyped.
  declare props: Readonly<ErrorBoundaryProps>;
  declare setState: (state: ErrorBoundaryState) => void;
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ORDIUM UI error', error, info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (this.state.error) return <Fallback variant={this.props.variant ?? 'section'} onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
