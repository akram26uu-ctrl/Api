/** ORDIUM Web Platform Entry Point */
import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { authApi } from './lib/api/auth';
import { AuthSession } from './lib/api/types';
import { DataStreamCanvas } from './components/3d/DataStreamCanvas';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { HeroSection } from './components/marketing/HeroSection';
import { IdentitySection } from './components/marketing/IdentitySection';
import { PipelineSection } from './components/marketing/PipelineSection';
import { ExplainableCard } from './components/marketing/ExplainableCard';
import { FraudClusterSection } from './components/marketing/FraudClusterSection';
import { ManualConfirmationSection } from './components/marketing/ManualConfirmationSection';
import { DeveloperSection } from './components/marketing/DeveloperSection';
import { RoadmapSection } from './components/marketing/RoadmapSection';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';

declare const __ORDIUM_VERCEL_ANALYTICS__: boolean;
const VERCEL_ANALYTICS_ENABLED = typeof __ORDIUM_VERCEL_ANALYTICS__ !== 'undefined' && __ORDIUM_VERCEL_ANALYTICS__;

const PUBLIC_ROUTES = ['/', '/platform', '/intelligence', '/security', '/developers', '/pricing', '/docs', '/company'];

const PricingPage = lazy(() => import('./components/pages/PricingPage').then(m => ({ default: m.PricingPage })));
const DocsPage = lazy(() => import('./components/pages/DocsPage').then(m => ({ default: m.DocsPage })));
const SecurityPage = lazy(() => import('./components/pages/SecurityPage').then(m => ({ default: m.SecurityPage })));
const PlatformPage = lazy(() => import('./components/pages/PlatformPage').then(m => ({ default: m.PlatformPage })));
const CompanyPage = lazy(() => import('./components/pages/CompanyPage').then(m => ({ default: m.CompanyPage })));
const LoginPage = lazy(() => import('./components/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./components/pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const VerifyEmailPage = lazy(() => import('./components/pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const ErrorPage = lazy(() => import('./components/pages/ErrorPage').then(m => ({ default: m.ErrorPage })));
const DashboardLayout = lazy(() => import('./components/dashboard/DashboardLayout').then(m => ({ default: m.DashboardLayout })));

export function AppContent() {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = useState<'website' | 'dashboard'>(() => typeof window !== 'undefined' && window.location.pathname === '/dashboard' ? 'dashboard' : 'website');
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>(() => typeof window !== 'undefined' && window.location.pathname ? window.location.pathname : '/');

  useEffect(() => {
    if (viewMode !== 'dashboard') return;
    if (authSession) { setAuthChecking(false); return; }
    let active = true;
    setAuthChecking(true);
    authApi.me().then(session => { if (active) setAuthSession(session); }).catch(() => {
      if (active) { setAuthSession(null); setViewMode('website'); setCurrentPath('/login'); window.history.pushState(null, '', '/login'); }
    }).finally(() => { if (active) setAuthChecking(false); });
    return () => { active = false; };
  }, [viewMode, authSession]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname || '/';
      if (path === '/dashboard') setViewMode('dashboard');
      else { setViewMode('website'); setCurrentPath(path); }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (path === '/dashboard') setViewMode('dashboard');
    else {
      setViewMode('website'); setCurrentPath(path);
      try { window.history.pushState(null, '', path); } catch { /* Restricted environments. */ }
    }
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const handleLaunchDashboard = (verifiedSession?: AuthSession) => {
    if (verifiedSession) setAuthSession(verifiedSession);
    setViewMode('dashboard');
    try { window.history.pushState(null, '', '/dashboard'); } catch { /* Ignore. */ }
  };
  const handleExitToWebsite = () => {
    setViewMode('website'); setCurrentPath('/');
    try { window.history.pushState(null, '', '/'); } catch { /* Ignore. */ }
  };

  if (viewMode === 'dashboard') {
    if (authChecking) return <FullScreenStatus label={t('ui.authenticating', 'Restoring your ORDIUM session…')} />;
    if (!authSession) return <div className="min-h-screen bg-[#080B12] text-white flex items-center justify-center px-6"><div className="ordium-auth-card w-full max-w-md p-6 text-center"><h1 className="text-lg font-semibold">{t('ui.dashboard_title', 'ORDIUM Dashboard')}</h1><p className="mt-2 text-sm text-[#A1AEC1]">{t('ui.session_lost', 'Your session could not be restored. Please sign in again.')}</p><button type="button" className="mt-5 min-h-11 rounded-lg bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-[#061018] hover:bg-[#67E8F9]" onClick={() => { setViewMode('website'); setCurrentPath('/login'); window.history.replaceState(null, '', '/login'); }}>{t('nav.sign_in', 'Sign in')}</button></div></div>;
    return <DashboardLayout session={authSession} onLogout={() => { void authApi.logout(); setAuthSession(null); handleExitToWebsite(); }} />;
  }

  const errorRoutes: Record<string, number> = { '/403': 403, '/forbidden': 403, '/404': 404, '/not-found': 404, '/429': 429, '/500': 500, '/503': 503, '/service-unavailable': 503 };
  if (errorRoutes[currentPath]) return <ErrorPage statusCode={errorRoutes[currentPath]} onNavigate={navigateTo} />;
  if (currentPath === '/login') return <LoginPage onNavigate={navigateTo} onLaunchConsole={handleLaunchDashboard} onLoginSuccess={handleLaunchDashboard} />;
  if (currentPath === '/verify-email') {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    return <VerifyEmailPage token={token} onNavigate={navigateTo} onVerified={handleLaunchDashboard} />;
  }
  if (currentPath === '/register') return <RegisterPage onNavigate={navigateTo} onLaunchConsole={handleLaunchDashboard} />;

  return <div className="marketing-shell min-h-screen bg-[#080B12] text-[#F8FAFC] flex flex-col relative selection:bg-[#6C5CE7]/30 selection:text-white">
    <a href="#main-content" className="ordium-skip-link">{t('ui.skip_to_content', 'Skip to main content')}</a>
    <DataStreamCanvas />
    <Navbar currentPath={currentPath} onNavigate={navigateTo} onOpenDashboard={handleLaunchDashboard} />
    <main id="main-content" tabIndex={-1} className="flex-1 relative z-10 outline-none">
      {currentPath === '/' && <><HeroSection onStart={handleLaunchDashboard} onExploreApi={() => navigateTo('/docs')} /><IdentitySection /><PipelineSection /><ExplainableCard /><FraudClusterSection /><ManualConfirmationSection /><DeveloperSection onViewDocs={() => navigateTo('/docs')} /><RoadmapSection /></>}
      {currentPath === '/platform' && <PlatformPage />}
      {currentPath === '/intelligence' && <div className="py-8"><IdentitySection /><FraudClusterSection /></div>}
      {currentPath === '/security' && <SecurityPage />}
      {currentPath === '/developers' && <div className="py-8"><DeveloperSection onViewDocs={() => navigateTo('/docs')} /><DocsPage /></div>}
      {currentPath === '/pricing' && <PricingPage onSelectPlan={() => handleLaunchDashboard()} onOpenDashboard={handleLaunchDashboard} />}
      {currentPath === '/docs' && <DocsPage />}
      {currentPath === '/company' && <CompanyPage />}
      {!PUBLIC_ROUTES.includes(currentPath) && <ErrorPage statusCode={404} onNavigate={navigateTo} embedded />}
    </main>
    <Footer onNavigate={navigateTo} />
  </div>;
}

const FullScreenStatus: React.FC<{ label: string }> = ({ label }) => (
  <div className="min-h-screen bg-[#080B12] text-white flex flex-col items-center justify-center gap-4" role="status" aria-live="polite">
    <span aria-hidden="true" className="h-8 w-8 rounded-full border-2 border-white/10 border-t-[#52D9E8] animate-spin" />
    <span className="text-sm text-[#A5B1C3]">{label}</span>
  </div>
);

const AppLoading: React.FC = () => {
  const { t } = useLanguage();
  return <FullScreenStatus label={t('ui.loading_app', 'Loading ORDIUM…')} />;
};

export default function App() {
  return <LanguageProvider><Suspense fallback={<AppLoading />}><AppContent /></Suspense>{VERCEL_ANALYTICS_ENABLED && <Analytics />}</LanguageProvider>;
}
