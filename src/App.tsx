import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Roadmap from "./pages/Roadmap";
import ContentTracker from "./pages/ContentTracker";
import WeeklyWins from "./pages/submissions/WeeklyWins";
import NewClients from "./pages/submissions/NewClients";
import MonthlyTotals from "./pages/submissions/MonthlyTotals";
import Checklist from "./pages/submissions/Checklist";
import Financials from "./pages/Financials";
import AIToolkit from "./pages/AIToolkit";
import SettingsPage from "./pages/SettingsPage";
import ClientHealth from "./pages/ClientHealth";
import Resources from "./pages/Resources";
import CashMenu from "./pages/CashMenu";
import WinsWall from "./pages/WinsWall";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/content" element={<ContentTracker />} />
          <Route path="/submissions" element={<Navigate to="/submissions/wins" replace />} />
          <Route path="/submissions/wins" element={<WeeklyWins />} />
          <Route path="/submissions/clients" element={<NewClients />} />
          <Route path="/submissions/monthly" element={<MonthlyTotals />} />
          <Route path="/submissions/checklist" element={<Checklist />} />
          <Route path="/financials" element={<Financials />} />
          <Route path="/ai-tools" element={<AIToolkit />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/cash-menu" element={<CashMenu />} />
          <Route path="/admin/clients" element={<ClientHealth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
