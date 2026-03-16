import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { HubAuthProvider, useHubAuth } from "@/contexts/HubAuthContext";
import { AppProvider } from "@/contexts/AppContext";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import AccountDetail from "@/pages/AccountDetail";
import Pipeline from "@/pages/Pipeline";
import Intelligence from "@/pages/Intelligence";
import Investimentos from "@/pages/Investimentos";
import Configuracoes from "@/pages/Configuracoes";
import SetupMensagens from "@/pages/SetupMensagens";
import Chamadas from "@/pages/Chamadas";
import Auth from "@/pages/Auth";
import HubLogin from "@/pages/hub/HubLogin";
import HubDashboard from "@/pages/hub/HubDashboard";
import HubCourses from "@/pages/hub/HubCourses";
import HubCourseDetail from "@/pages/hub/HubCourseDetail";
import HubProfile from "@/pages/hub/HubProfile";
import HubLayout from "@/components/hub/HubLayout";
import HubAdminLayout from "@/components/hub/HubAdminLayout";
import HubAdminMetrics from "@/pages/hub/HubAdminMetrics";
import HubAdminMembers from "@/pages/hub/HubAdminMembers";
import HubAdminContent from "@/pages/hub/HubAdminContent";
import HubAdminRoles from "@/pages/hub/HubAdminRoles";
import HubAdminAlerts from "@/pages/hub/HubAdminAlerts";
import NotFound from "./pages/NotFound";
import Agenda from "./pages/Agenda";
import Forecast from "./pages/Forecast";
import Vendas from "./pages/Vendas";
import ExportCsv from "./pages/ExportCsv";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return (
    <AppProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads" element={<Clientes />} />
          <Route path="/leads/:accountId" element={<AccountDetail />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/inteligencia" element={<Intelligence />} />
          <Route path="/investimentos" element={<Investimentos />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/chamadas" element={<Chamadas />} />
          <Route path="/setup-mensagens" element={<SetupMensagens />} />
          <Route path="/export-csv" element={<ExportCsv />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppProvider>
  );
}

function AuthRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <Auth />;
}

function HubAuthRoute() {
  const { session, loading, isHubUser } = useHubAuth();
  if (loading) return null;
  if (session && isHubUser) return <Navigate to="/plataforma/dashboard" replace />;
  return <HubLogin />;
}

function HubProtectedRoutes() {
  const { session, loading, isHubUser, isHubAdmin } = useHubAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111111' }}>
        <div className="animate-pulse text-sm" style={{ color: '#666' }}>Carregando...</div>
      </div>
    );
  }
  if (!session || !isHubUser) return <Navigate to="/plataforma" replace />;
  return (
    <Routes>
      {/* Admin area — separate layout */}
      {isHubAdmin && (
        <Route path="/admin" element={<HubAdminLayout />}>
          <Route index element={<HubAdminMetrics />} />
          <Route path="membros" element={<HubAdminMembers />} />
          <Route path="conteudo" element={<HubAdminContent />} />
          <Route path="roles" element={<HubAdminRoles />} />
          <Route path="alertas" element={<HubAdminAlerts />} />
        </Route>
      )}
      {/* Student area */}
      <Route element={<HubLayout />}>
        <Route path="/dashboard" element={<HubDashboard />} />
        <Route path="/cursos" element={<HubCourses />} />
        <Route path="/cursos/:courseId" element={<HubCourseDetail />} />
        <Route path="/perfil" element={<HubProfile />} />
        <Route path="*" element={<Navigate to="/plataforma/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <HubAuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/plataforma" element={<HubAuthRoute />} />
              <Route path="/plataforma/*" element={<HubProtectedRoutes />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </HubAuthProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
