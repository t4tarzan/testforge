import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ui/States';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Pipeline from '@/pages/Pipeline';
import Integrator from '@/pages/Integrator';
import Testing from '@/pages/Testing';
import PrdGenerator from '@/pages/PrdGenerator';
import Dashboard from '@/pages/Dashboard';
import Pricing from '@/pages/Pricing';
import Auth from '@/pages/Auth';
import Account from '@/pages/Account';
import TestReport from '@/pages/TestReport';
import McpIntegration from '@/pages/McpIntegration';
import Docs from '@/pages/Docs';
import TestRunner from '@/pages/TestRunner';
import ManagedTesting from '@/pages/Managed';
import PressKit from '@/pages/Press';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';
import InTheWild from '@/pages/InTheWild';
import InTheWildReport from '@/pages/InTheWildReport';
import InTheWildReportFull from '@/pages/InTheWildReportFull';
import OnboardingModal from '@/components/OnboardingModal';

// Simple auth guard
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F7F7FB]">
        <div className="w-8 h-8 border-3 border-[#574a7d] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Wrapper for pages that should NOT show the main Layout (Navbar/Footer)
function NoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
    <OnboardingModal />
    <AuthProvider>
      <Toaster position="bottom-right" richColors />
      <Routes>
        {/* Auth page — no layout */}
        <Route path="/auth" element={<NoLayout><Auth /></NoLayout>} />

        {/* Account page — no layout (has its own sidebar) */}
        <Route
          path="/account"
          element={
            <NoLayout>
              <AuthGuard>
                <Account />
              </AuthGuard>
            </NoLayout>
          }
        />

        {/* Test Report page — no layout */}
        <Route path="/report/:id" element={<NoLayout><TestReport /></NoLayout>} />

        {/* Stub pages — no layout */}
        <Route
          path="/run-test"
          element={
            <NoLayout>
              <AuthGuard>
                <TestRunner />
              </AuthGuard>
            </NoLayout>
          }
        />
        <Route path="/mcp" element={<Layout><McpIntegration /></Layout>} />
        <Route path="/managed" element={<Layout><ManagedTesting /></Layout>} />
        <Route path="/press" element={<NoLayout><PressKit /></NoLayout>} />
        <Route path="/docs" element={<NoLayout><Docs /></NoLayout>} />

        {/* In-the-Wild full report — no layout, standalone whitepaper-style doc */}
        <Route path="/in-the-wild/:slug/full" element={<NoLayout><InTheWildReportFull /></NoLayout>} />

        {/* All other pages — with standard layout (Navbar + Footer) */}
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/integrator" element={<Integrator />} />
                <Route path="/testing-dimensions" element={<Testing />} />
                <Route path="/prd-generator" element={<PrdGenerator />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/in-the-wild" element={<InTheWild />} />
                <Route path="/in-the-wild/:slug" element={<InTheWildReport />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </AuthProvider>
    </ErrorBoundary>
  );
}
