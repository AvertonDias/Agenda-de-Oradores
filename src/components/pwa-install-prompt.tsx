'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Info, Share, PlusSquare } from 'lucide-react';

export function PWAInstallPrompt() {
  const [isInstalling, setIsInstalling] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
    const ios = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsStandalone(standalone);
    setIsIOS(ios);
    
    console.log('PWA: Checking installability. Standalone:', standalone);

    const handlePrompt = (e: any) => {
      console.log('PWA: beforeinstallprompt fired');
      e.preventDefault();
      (window as any).deferredPWAPrompt = e;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    
    // Check if prompt is already available
    if ((window as any).deferredPWAPrompt) {
      console.log('PWA: Prompt already available');
      setCanInstall(true);
    } else {
      console.log('PWA: Prompt not available yet');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    const prompt = (window as any).deferredPWAPrompt;
    if (prompt) {
      setIsInstalling(true);
      try {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          (window as any).deferredPWAPrompt = null;
          setCanInstall(false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsInstalling(false);
      }
    } else {
      setShowInstructions(true);
    }
  };

  if (isStandalone) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          onClick={handleInstallClick} 
          disabled={isInstalling}
          className="rounded-full gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg transition-all"
        >
          {isInstalling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Instalar App
        </Button>
      </div>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="sm:max-w-[440px] w-[92vw] rounded-3xl border-none shadow-2xl p-6">
          <DialogHeader className="text-center flex flex-col items-center">
            <div className="bg-emerald-100 p-4 rounded-full mb-3 shrink-0">
              <Download className="h-8 w-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-xl font-extrabold tracking-tight">
              Instalar o App
            </DialogTitle>
            <DialogDescription className="text-sm text-center mt-2 leading-relaxed text-muted-foreground">
              {isIOS ? (
                <>
                  Para instalar, toque no ícone de <strong>Compartilhar</strong> <Share className="inline h-4 w-4 mx-1 p-0.5 bg-muted rounded border align-middle text-muted-foreground" /> e selecione <strong>Adicionar à Tela de Início</strong> <PlusSquare className="inline h-4 w-4 mx-1 p-0.5 bg-muted rounded border align-middle text-muted-foreground" />.
                </>
              ) : (
                <>
                  No momento, o seu navegador não autorizou a instalação automática. Para instalar, toque no menu (três pontinhos) e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
