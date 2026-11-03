/**
 * Lazily loaded 3D scenes. three.js is large, so scenes load in their own chunks
 * and the surrounding text renders immediately behind a quiet placeholder.
 */
import React, { lazy, Suspense } from 'react';

const placeholder = <div aria-hidden="true" className="h-full w-full animate-pulse bg-[radial-gradient(ellipse_at_center,rgba(82,217,232,0.08),transparent_70%)]" />;

function withSuspense<P extends object>(loader: () => Promise<{ default: React.ComponentType<P> }>) {
  const Component = lazy(loader);
  const Wrapped: React.FC<P> = props => <Suspense fallback={placeholder}><Component {...props} /></Suspense>;
  return Wrapped;
}

export const LazyFraudNetwork3D = withSuspense(() => import('./FraudNetwork3D').then(m => ({ default: m.FraudNetwork3D })));
export const LazySecurityShield3D = withSuspense(() => import('./SecurityShield3D').then(m => ({ default: m.SecurityShield3D })));
export const LazyRiskScanner3D = withSuspense(() => import('./RiskScanner3D').then(m => ({ default: m.RiskScanner3D })));
export const LazyRiskCore3D = withSuspense(() => import('./RiskCore3D').then(m => ({ default: m.RiskCore3D })));
export const LazyIdentityGraph3D = withSuspense(() => import('./IdentityGraph3D').then(m => ({ default: m.IdentityGraph3D })));
