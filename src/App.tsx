import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from '@/lib/supabase';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Roadmap from "./pages/Roadmap";
import NewClients from "./pages/submissions/NewClients";
import MonthlyTotals from "./pages/submissions/MonthlyTotals";
import Financials from "./pages/Financials";
import SettingsPage from "./pages/SettingsPage";
import ClientHealth from "./pages/ClientHealth";
import CashMenu from "./pages/CashMenu";
import WinsWall from "./pages/WinsWall";
import ModulePage from "./pages/ModulePage";
import ContentStudio from "./pages/ContentStudio";
import HotList from "./pages/HotList";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/roadmap" element={<ProtectedRoute><Roadmap /></ProtectedRoute>} />
          <Route path="/content-studio" element={<ProtectedRoute><ContentStudio /></ProtectedRoute>} />
          <Route path="/hot-list" element={<ProtectedRoute><HotList /></ProtectedRoute>} />
          <Route path="/financials" element={<ProtectedRoute><Financials /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/cash-menu" element={<ProtectedRoute><CashMenu /></ProtectedRoute>} />
          <Route path="/wins" element={<ProtectedRoute><WinsWall /></ProtectedRoute>} />
          <Route path="/module/:moduleId" element={<ProtectedRoute><ModulePage /></ProtectedRoute>} />
          <Route path="/submissions/clients" element={<AdminRoute><NewClients /></AdminRoute>} />
          <Route path="/submissions/monthly" element={<AdminRoute><MonthlyTotals /></AdminRoute>} />
          <Route path="/client-health" element={<AdminRoute><ClientHealth /></AdminRoute>} />
          <Route path="/admin/clients" element={<AdminRoute><ClientHealth /></AdminRoute>} />
          <Route path="/admin/health" element={<AdminRoute><ClientHealth /></AdminRoute>} />
          <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
