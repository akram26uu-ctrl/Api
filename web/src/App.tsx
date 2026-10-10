/**
 * ORDIUM Web Platform Entry Point
 * Seamlessly pairs the high-end marketing website, professional authentication,
 * and authenticated SaaS dashboard with full i18n & RTL support.
 */

import React, { useState, useEffect } from 'react';
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
import { PricingPage } from './components/pages/PricingPage';
import { DocsPage } from './components/pages/DocsPage';
import { SecurityPage } from './components/pages/SecurityPage';
import { PlatformPage } from './components/pages/PlatformPage';
import { CompanyPage } from './components/pages/CompanyPage';
import { LoginPage } from './components/pages/LoginPage';
import { RegisterPage } from './components/pages/RegisterPage';
import { VerifyEmailPage } from './components/pages/VerifyEmailPage';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { LanguageProvider } from './i18n/LanguageContext';

export function AppContent() {
  const [viewMode, setViewMode] = useState<'website' | 'dashboard'>(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/dashboard') return 'dashboard';
    return 'website';
  });
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.pathname) {
      const p = window.location.pathname;
      if (['/platform', '/intelligence', '/security', '/developers', '/pricing', '/docs', '/company', '/login', '/register', '/dashboard', '/verify-email'].includes(p)) {
        return p;
      }
    }
    return '/';
  });

  useEffect(() => {
    if (viewMode !== 'dashboard') return;
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
    }).finally(() => {
      if (active) setAuthChecking(false);
    });
    return () => { active = false; };
  }, [viewMode]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname || '/';
      if (p === '/dashboard') {
        setViewMode('dashboard');
      } else {
        setViewMode('website');
        setCurrentPath(p);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Scroll to top on navigation & update browser history
  const navigateTo = (path: string) => {
    if (path === '/dashboard') {
      setViewMode('dashboard');
    } else {
      setViewMode('website');
      setCurrentPath(path);
      try {
        window.history.pushState(null, '', path);
      } catch {
        // Safe fallback in restricted environments
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLaunchDashboard = () => {
    setViewMode('dashboard');
    try {
      window.history.pushState(null, '', '/dashboard');
    } catch {
      // Ignore
    }
  };

  const handleExitToWebsite = () => {
    setViewMode('website');
    setCurrentPath('/');
    try {
      window.history.pushState(null, '', '/');
    } catch {
      // Ignore
    }
  };

  // If in Authenticated Dashboard Mode
  if (viewMode === 'dashboard') {
    if (authChecking) {
      return <div className="min-h-screen bg-[#080B12] text-white flex items-center justify-center font-mono">Authenticating ORDIUM session…</div>;
    }
    if (!authSession) {
      return (
        <div className="min-h-screen bg-[#080B12] text-white flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1320] p-6 text-center shadow-2xl">
            <h1 className="text-base font-semibold">ORDIUM Dashboard</h1>
            <p className="mt-2 text-sm text-[#94A3B8]">Your session could not be restored. Please sign in again.</p>
            <button type="button" className="mt-5 rounded-lg bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-[#061018]" onClick={() => { setViewMode('website'); setCurrentPath('/login'); window.history.replaceState(null, '', '/login'); }}>
              Sign in
            </button>
          </div>
        </div>
      );
    }
    return <DashboardLayout
      session={authSession}
      onLogout={() => { void authApi.logout(); setAuthSession(null); handleExitToWebsite(); }}
    />;
  }

  // Dedicated Authentication Pages
  if (currentPath === '/login') {
    return (
      <LoginPage
        onNavigate={navigateTo}
        onLaunchConsole={handleLaunchDashboard}
        onLoginSuccess={handleLaunchDashboard}
      />
    );
  }

  if (currentPath === '/verify-email') {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    return <VerifyEmailPage token={token} onNavigate={navigateTo} onVerified={handleLaunchDashboard} />;
  }

  if (currentPath === '/register') {
    return (
      <RegisterPage
        onNavigate={navigateTo}
        onLaunchConsole={handleLaunchDashboard}
      />
    );
  }

  // Public Marketing & Developer Platform
  return (
    <div className="min-h-screen bg-[#080B12] text-[#F8FAFC] flex flex-col relative selection:bg-[#6C5CE7]/30 selection:text-white">
      {/* Subtle 3D particle and signal line backdrop */}
      <DataStreamCanvas />

      {/* Global Navbar */}
      <Navbar
        currentPath={currentPath}
        onNavigate={navigateTo}
        onOpenDashboard={handleLaunchDashboard}
      />

      {/* Main Content Router */}
      <main className="flex-1 relative z-10">
        {currentPath === '/' && (
          <>
            <HeroSection
              onStart={handleLaunchDashboard}
              onExploreApi={() => navigateTo('/docs')}
            />
            <IdentitySection />
            <PipelineSection />
            <ExplainableCard />
            <FraudClusterSection />
            <ManualConfirmationSection />
            <DeveloperSection onViewDocs={() => navigateTo('/docs')} />
            <RoadmapSection />
          </>
        )}

        {currentPath === '/platform' && <PlatformPage />}
        {currentPath === '/intelligence' && (
          <div className="py-8">
            <IdentitySection />
            <FraudClusterSection />
          </div>
        )}
        {currentPath === '/security' && <SecurityPage />}
        {currentPath === '/developers' && (
          <div className="py-8">
            <DeveloperSection onViewDocs={() => navigateTo('/docs')} />
            <DocsPage />
          </div>
        )}
        {currentPath === '/pricing' && (
          <PricingPage
            onSelectPlan={() => {}}
            onOpenDashboard={handleLaunchDashboard}
          />
        )}
        {currentPath === '/docs' && <DocsPage />}
        {currentPath === '/company' && <CompanyPage />}
      </main>

      {/* Global Brand Footer */}
      <Footer onNavigate={navigateTo} />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

