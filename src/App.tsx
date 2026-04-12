import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PinSizeConfirmProvider } from "@/contexts/PinSizeConfirmContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import DocumentDetailPage from "./pages/DocumentDetail";
import DocumentEdit from "./pages/DocumentEdit";
import Departments from "./pages/Departments";
import Upload from "./pages/Upload";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Clients from "./pages/Clients";
import OrganizationDetail from "./pages/OrganizationDetail";
import Activity from "./pages/Activity";
import Analytics from "./pages/Analytics";
import AuditLogs from "./pages/AuditLogs";
import AdminPulse from "./pages/AdminPulse";
import SharedWithMe from "./pages/SharedWithMe";
import MyAuthorization from "./pages/MyAuthorization";
import MyDocuments from "./pages/MyDocuments";
import MyFavorites from "./pages/MyFavorites";
import NotificationsPage from "./pages/Notifications";

import ModuleSetup from "./pages/ModuleSetup";
import Guide from "./pages/Guide";
import Offline from "./pages/Offline";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <LanguageProvider>
          <PinSizeConfirmProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/setup" element={<ModuleSetup />} />
              {/* Root redirect handled by AppLayout based on role */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Protected routes with layout */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/documents/:id" element={<DocumentDetailPage />} />
                <Route path="/documents/:id/edit" element={<DocumentEdit />} />
                <Route path="/departments" element={<Departments />} />
                <Route path="/shared-with-me" element={<SharedWithMe />} />
                <Route path="/my-authorization" element={<MyAuthorization />} />
                <Route path="/my-documents" element={<MyDocuments />} />
                <Route path="/my-favorites" element={<MyFavorites />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/users" element={<Users />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/:id" element={<OrganizationDetail />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/admin-pulse" element={<AdminPulse />} />
                <Route path="/guide" element={<Guide />} />
                <Route path="/offline" element={<Offline />} />
              </Route>
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </PinSizeConfirmProvider>
        </LanguageProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;