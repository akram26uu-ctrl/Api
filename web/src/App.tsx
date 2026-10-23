import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { authApi } from './lib/api/auth';
import { AuthSession } from './lib/api/types';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { HomePage } from './components/marketing/HomePage';
import { IdentitySection } from './components/marketing/IdentitySection';
import { FraudClusterSection } from './components/marketing/FraudClusterSection';
import { DeveloperSection } from './components/marketing/DeveloperSection';
import { LanguageProvider } from './i18n/LanguageContext';

const PricingPage = lazy(() => import('./components/pages/PricingPage').then((m) => ({ default: m.PricingPage })));
const DocsPage = lazy(() => import('./components/pages/DocsPage').then((m) => ({ default: m.DocsPage })));
const SecurityPage = lazy(() => import('./components/pages/SecurityPage').then((m) => ({ default: m.SecurityPage })));
const PlatformPage = lazy(() => import('./components/pages/PlatformPage').then((m) => ({ default: m.PlatformPage })));
const CompanyPage = lazy(() => import('./components/pages/CompanyPage').then((m) => ({ default: m.CompanyPage })));
const LoginPage = lazy(() => import('./components/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./components/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const VerifyEmailPage = lazy(() => import('./components/pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const ErrorPage = lazy(() => import('./components/pages/ErrorPage').then((m) => ({ default: m.ErrorPage })));
const DashboardLayout = lazy(() => import('./components/dashboard/DashboardLayout').then((m) => ({ default: m.DashboardLayout })));

export function AppContent() {
  const [viewMode, setViewMode] = useState<'website' | 'dashboard'>(() => window.location.pathname === '/dashboard' ? 'dashboard' : 'website');
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname || '/');

  useEffect(() => {
    if (viewMode !== 'dashboard') return;
    if (authSession) { setAuthChecking(false); return; }
    let active = true;
    setAuthChecking(true);
    authApi.me().then((session) => {
      if (active) setAuthSession(session);
    }).catch(() => {
      if (active) {
        setAuthSession(null);
        setViewMode('website');
        setCurrentPath('/login');
        window.history.pushState(null, '', '/login');
      }
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
      setViewMode('website');
      setCurrentPath(path);
      try { window.history.pushState(null, '', path); } catch { /* restricted browser */ }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLaunchDashboard = (verifiedSession?: AuthSession) => {
    if (verifiedSession) setAuthSession(verifiedSession);
    setViewMode('dashboard');
    try { window.history.pushState(null, '', '/dashboard'); } catch { /* restricted browser */ }
  };

  const handleExitToWebsite = () => {
    setViewMode('website');
    setCurrentPath('/');
    try { window.history.pushState(null, '', '/'); } catch { /* restricted browser */ }
  };

  if (viewMode === 'dashboard') {
    if (authChecking) return <div className="min-h-screen bg-[#080B12] text-white flex items-center justify-center font-mono" role="status">Authenticating ORDIUM session…</div>;
    if (!authSession) {
      return (
        <div className="min-h-screen bg-[#080B12] text-white flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1320] p-6 text-center shadow-2xl">
            <h1 className="text-base font-semibold">ORDIUM Dashboard</h1>
            <p className="mt-2 text-sm text-[#94A3B8]">Your session could not be restored. Please sign in again.</p>
            <button type="button" className="mt-5 rounded-lg bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-[#061018]" onClick={() => navigateTo('/login')}>Sign in</button>
          </div>
        </div>
      );
    }
    return <DashboardLayout session={authSession} onLogout={() => { void authApi.logout(); setAuthSession(null); handleExitToWebsite(); }} />;
  }

  const errorRoutes: Record<string, number> = {
    '/403': 403, '/forbidden': 403, '/404': 404, '/not-found': 404,
    '/429': 429, '/500': 500, '/503': 503, '/service-unavailable': 503,
  };
  if (errorRoutes[currentPath]) return <ErrorPage statusCode={errorRoutes[currentPath]} onNavigate={navigateTo} />;
  if (currentPath === '/login') return <LoginPage onNavigate={navigateTo} onLaunchConsole={handleLaunchDashboard} onLoginSuccess={handleLaunchDashboard} />;
  if (currentPath === '/verify-email') {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    return <VerifyEmailPage token={token} onNavigate={navigateTo} onVerified={handleLaunchDashboard} />;
  }
  if (currentPath === '/register') return <RegisterPage onNavigate={navigateTo} onLaunchConsole={handleLaunchDashboard} />;

  return (
    <div className="marketing-shell min-h-screen bg-[#0f1012] text-[#F8FAFC] flex flex-col relative selection:bg-[#ff5102] selection:text-white">
      <Navbar currentPath={currentPath} onNavigate={navigateTo} onOpenDashboard={handleLaunchDashboard} />
      <main id="main-content" className="flex-1 relative z-10">
        {currentPath === '/' && <HomePage onStart={handleLaunchDashboard} onExploreApi={() => navigateTo('/docs')} onNavigate={navigateTo} />}
        {currentPath === '/platform' && <PlatformPage />}
        {currentPath === '/intelligence' && <div className="py-8"><IdentitySection /><FraudClusterSection /></div>}
        {currentPath === '/security' && <SecurityPage />}
        {currentPath === '/developers' && <div className="py-8"><DeveloperSection onViewDocs={() => navigateTo('/docs')} /><DocsPage /></div>}
        {currentPath === '/pricing' && <PricingPage onSelectPlan={() => navigateTo('/register')} onOpenDashboard={handleLaunchDashboard} />}
        {currentPath === '/docs' && <DocsPage />}
        {currentPath === '/company' && <CompanyPage />}
      </main>
      {currentPath !== '/' && !['/platform', '/intelligence', '/security', '/developers', '/pricing', '/docs', '/company'].includes(currentPath) && <ErrorPage statusCode={404} onNavigate={navigateTo} />}
      <Footer onNavigate={navigateTo} />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <Suspense fallback={<div className="min-h-screen bg-[#0f1012] text-white flex items-center justify-center" role="status">جارٍ تحميل ORDIUM…</div>}>
        <AppContent />
      </Suspense>
      <Analytics />
    </LanguageProvider>
  );
}
