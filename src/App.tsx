import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/submissions/clients" element={<NewClients />} />
          <Route path="/submissions/monthly" element={<MonthlyTotals />} />
          <Route path="/financials" element={<Financials />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/cash-menu" element={<CashMenu />} />
          <Route path="/wins" element={<WinsWall />} />
          <Route path="/client-health" element={<ClientHealth />} />
          <Route path="/admin/clients" element={<ClientHealth />} />
          <Route path="/admin/health" element={<ClientHealth />} />
          <Route path="/module/:moduleId" element={<ModulePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
