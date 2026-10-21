'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Smartphone, Download } from 'lucide-react';

export function PWAInstallPrompt() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Impede o mini-infobar padrão do Chrome
      e.preventDefault();
      // Armazena o evento globalmente para o menu lateral
      (window as any).deferredPWAPrompt = e;
      
      // Notifica componentes interessados
      window.dispatchEvent(new Event('pwa-prompt-available'));

      // Verifica se já foi dispensado nesta sessão ou se já está instalado
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isDismissed = sessionStorage.getItem('pwa-prompt-dismissed') === 'true';

      if (!isStandalone && !isDismissed) {
        setIsOpen(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    
    // Verificação inicial caso o evento já tenha ocorrido
    if ((window as any).deferredPWAPrompt) {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isDismissed = sessionStorage.getItem('pwa-prompt-dismissed') === 'true';
      if (!isStandalone && !isDismissed) {
        setIsOpen(true);
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    const prompt = (window as any).deferredPWAPrompt;
    if (!prompt) return;

    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    
    if (outcome === 'accepted') {
      (window as any).deferredPWAPrompt = null;
      window.dispatchEvent(new Event('pwa-prompt-available'));
    }
    setIsOpen(false);
  };

  const handleDismiss = () => {
    setIsOpen(false);
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px] border-none shadow-2xl">
        <DialogHeader className="text-center flex flex-col items-center">
          <div className="bg-primary/10 p-4 rounded-full mb-2">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-headline font-bold">Instalar Aplicativo</DialogTitle>
          <DialogDescription className="text-base text-center">
            Instale a <strong>Agenda de Oradores</strong> na sua tela inicial para um acesso mais rápido e melhor experiência.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-2 text-center text-sm text-muted-foreground italic">
          O aplicativo ocupará pouco espaço e funcionará como um app nativo em tela cheia.
        </div>
        <DialogFooter className="gap-2 flex flex-col sm:flex-row w-full pt-4">
          <Button type="button" variant="ghost" onClick={handleDismiss} className="w-full sm:flex-1">
            Agora não
          </Button>
          <Button type="button" onClick={handleInstallClick} className="w-full sm:flex-1 gap-2 font-bold bg-primary text-white shadow-md">
            <Download className="h-4 w-4" />
            Instalar Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}