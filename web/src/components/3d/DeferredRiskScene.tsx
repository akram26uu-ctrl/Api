import React, { Component, lazy, Suspense, useEffect, useState } from 'react';

const RiskScene = lazy(() => import('./RiskScene'));

class SceneBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export function DeferredRiskScene() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const handle = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(() => setReady(true), { timeout: 1400 })
      : window.setTimeout(() => setReady(true), 450);
    return () => {
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  if (!ready) return null;
  return (
    <SceneBoundary>
      <Suspense fallback={null}><RiskScene /></Suspense>
    </SceneBoundary>
  );
}
