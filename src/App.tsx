import { Suspense, lazy, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from '@/lib/supabase';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import OwnerRoute from './components/OwnerRoute';
import Auth from "./pages/Auth";

// Routes load on demand, so the first paint does not carry the whole app.
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Roadmap = lazy(() => import("./pages/Roadmap"));
const NewClients = lazy(() => import("./pages/submissions/NewClients"));
const MonthlyTotals = lazy(() => import("./pages/submissions/MonthlyTotals"));
const Financials = lazy(() => import("./pages/Financials"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ClientHealth = lazy(() => import("./pages/ClientHealth"));
const ClientJourney = lazy(() => import("./pages/ClientJourney"));
const CashMenu = lazy(() => import("./pages/CashMenu"));
const WinsWall = lazy(() => import("./pages/WinsWall"));
const ModulePage = lazy(() => import("./pages/ModulePage"));
const ContentStudio = lazy(() => import("./pages/ContentStudio"));
const ContentGenerator = lazy(() => import("./pages/ContentGenerator"));
const HotList = lazy(() => import("./pages/HotList"));
const LaunchHQ = lazy(() => import("./pages/LaunchHQ"));
const Vault = lazy(() => import("./pages/Vault"));
const Calls = lazy(() => import("./pages/Calls"));
const AskDan = lazy(() => import("./pages/AskDan"));
const MyFinances = lazy(() => import("./pages/admin/MyFinances"));
const DanAI = lazy(() => import("./pages/admin/DanAI"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function AuthListener() {
  const navigate = useNavigate();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/auth', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthListener />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/roadmap" element={<ProtectedRoute><Roadmap /></ProtectedRoute>} />
          <Route path="/content-studio" element={<ProtectedRoute><ContentStudio /></ProtectedRoute>} />
          <Route path="/content-generator" element={<ProtectedRoute><ContentGenerator /></ProtectedRoute>} />
          <Route path="/hot-list" element={<ProtectedRoute><HotList /></ProtectedRoute>} />
          <Route path="/launch" element={<ProtectedRoute><LaunchHQ /></ProtectedRoute>} />
          <Route path="/financials" element={<ProtectedRoute><Financials /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/cash-menu" element={<ProtectedRoute><CashMenu /></ProtectedRoute>} />
          <Route path="/wins" element={<ProtectedRoute><WinsWall /></ProtectedRoute>} />
          <Route path="/vault" element={<ProtectedRoute><Vault /></ProtectedRoute>} />
          <Route path="/ask-dan" element={<AdminRoute><AskDan /></AdminRoute>} />
          <Route path="/calls" element={<ProtectedRoute><Calls /></ProtectedRoute>} />
          <Route path="/module/:moduleId" element={<ProtectedRoute><ModulePage /></ProtectedRoute>} />
          <Route path="/submissions/clients" element={<ProtectedRoute><NewClients /></ProtectedRoute>} />
          <Route path="/submissions/monthly" element={<ProtectedRoute><MonthlyTotals /></ProtectedRoute>} />
          <Route path="/client-health" element={<AdminRoute><ClientHealth /></AdminRoute>} />
          <Route path="/admin/clients" element={<AdminRoute><ClientHealth /></AdminRoute>} />
          <Route path="/admin/health" element={<AdminRoute><ClientHealth /></AdminRoute>} />
          <Route path="/client-journey" element={<AdminRoute><ClientJourney /></AdminRoute>} />
          <Route path="/admin/journey" element={<AdminRoute><ClientJourney /></AdminRoute>} />
          <Route path="/dan-ai" element={<AdminRoute><DanAI /></AdminRoute>} />
          <Route path="/admin/my-finances" element={<OwnerRoute><MyFinances /></OwnerRoute>} />
          <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
