import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FirebaseClientProvider } from '@/firebase';
import { MainLayout } from '@/components/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { PWAInstallPrompt } from '@/components/pwa-install-prompt';

// Import all pages
import Home from '@/app/page';
import LoginPage from '@/app/login/page';
import CadastroPage from '@/app/cadastro/page';
import RecuperarSenhaPage from '@/app/recuperar-senha/page';
import SetupPage from '@/app/setup/page';
import AgendarPage from '@/app/agendar/page';
import AjudantesPage from '@/app/ajudantes/page';
import ConfiguracoesPage from '@/app/configuracoes/page';
import CongregacoesPage from '@/app/congregacoes/page';
import ConvitePage from '@/app/convite/page';
import EventosPage from '@/app/eventos/page';
import OradoresPage from '@/app/oradores/page';
import TemasPage from '@/app/temas/page';

export default function App() {
  return (
    <BrowserRouter>
      <FirebaseClientProvider>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<CadastroPage />} />
            <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/agendar" element={<AgendarPage />} />
            <Route path="/ajudantes" element={<AjudantesPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/congregacoes" element={<CongregacoesPage />} />
            <Route path="/convite" element={<ConvitePage />} />
            <Route path="/eventos" element={<EventosPage />} />
            <Route path="/oradores" element={<OradoresPage />} />
            <Route path="/temas" element={<TemasPage />} />
          </Routes>
        </MainLayout>
        <PWAInstallPrompt />
      </FirebaseClientProvider>
      <Toaster />
    </BrowserRouter>
  );
}
