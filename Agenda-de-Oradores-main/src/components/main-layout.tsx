'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  Users,
  Building2,
  PlusCircle,
  Menu,
  LogOut,
  LogIn,
  UserPlus,
  History,
  Loader2,
  Edit2,
  Download,
  ExternalLink,
  MessageCircle,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import React, { useState, useEffect } from 'react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { signOut, updateProfile } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { doc } from 'firebase/firestore';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { HouseRoofIcon } from '@/components/icons';

const profileSchema = z.object({
  displayName: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.'),
});

const navItems = [
  { href: '/', label: 'Calendário', icon: CalendarDays },
  { href: '/agendar', label: 'Agendar Discurso', icon: PlusCircle },
  { href: '/temas', label: 'Histórico de Temas', icon: History },
  { href: '/eventos', label: 'Eventos', icon: Building2 },
  { href: '/oradores', label: 'Oradores', icon: Users },
  { href: '/congregacoes', label: 'Congregações', icon: HouseRoofIcon },
  { href: '/ajudantes', label: 'Ajudantes', icon: UserPlus },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: '' }
  });

  useEffect(() => {
    setMounted(true);
    
    const checkPrompt = () => {
      setCanInstall(!!(window as any).deferredPWAPrompt);
    };
    
    window.addEventListener('pwa-prompt-available', checkPrompt);
    checkPrompt();
    
    return () => window.removeEventListener('pwa-prompt-available', checkPrompt);
  }, []);

  useEffect(() => {
    if (user?.displayName) {
      form.reset({ displayName: user.displayName });
    }
  }, [user, form]);

  const handleLogout = () => {
    signOut(auth);
  };

  const handleSidebarInstall = async () => {
    const prompt = (window as any).deferredPWAPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        (window as any).deferredPWAPrompt = null;
        setCanInstall(false);
      }
    }
  };

  const onUpdateProfile = async (values: z.infer<typeof profileSchema>) => {
    if (!user || !firestore) return;
    setIsUpdating(true);
    try {
      await updateProfile(user, { displayName: values.displayName });
      const userRef = doc(firestore, 'users', user.uid);
      setDocumentNonBlocking(userRef, { 
        displayName: values.displayName,
        email: user.email,
        photoURL: user.photoURL || null
      }, { merge: true });
      toast({ title: "Perfil atualizado!" });
      setIsEditProfileOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: "Tente novamente mais tarde." });
    } finally {
      setIsUpdating(false);
    }
  };

  const footer = (
    <footer className="py-4 border-t text-center bg-background w-full flex items-center justify-center gap-4 flex-wrap">
      <a
        href="https://aplicativos-ton.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] md:text-xs text-muted-foreground hover:text-primary transition-colors font-medium underline underline-offset-4 flex items-center gap-1"
      >
        Conheça meus aplicativos <ExternalLink className="h-3 w-3" />
      </a>
      <a
        href="https://api.whatsapp.com/send?phone=5535991210466&text=Olá! Preciso de suporte com o aplicativo Agenda de Oradores."
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] md:text-xs text-muted-foreground hover:text-primary transition-colors font-medium underline underline-offset-4 flex items-center gap-1.5"
      >
        Suporte <MessageCircle className="h-3.5 w-3.5 text-green-500 fill-green-500/20" />
      </a>
    </footer>
  );

  const navLinks = (
    <nav className="flex flex-col gap-2">
      {navItems.map((item) => {
        const isActive = mounted && pathname === item.href;
        return (
          <Link key={item.label} href={item.href} onClick={() => setIsSheetOpen(false)}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2 text-base transition-all",
                isActive 
                  ? "bg-accent/15 text-accent-foreground hover:bg-accent/25 font-bold border-l-4 border-accent rounded-l-none" 
                  : "hover:bg-muted"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-accent-foreground")} />
              {item.label}
            </Button>
          </Link>
        );
      })}
    </nav>
  );

  const authSection = (
    <div className="mt-auto border-t p-4 flex flex-col gap-4">
      {canInstall && (
        <Button 
          variant="outline" 
          className="w-full gap-2 border-primary text-primary hover:bg-primary/5 font-bold shadow-sm"
          onClick={handleSidebarInstall}
        >
          <Download className="h-4 w-4" />
          Instalar Aplicativo
        </Button>
      )}
      
      {user ? (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border">
            <AvatarImage src={user.photoURL || ''} alt={user.displayName || ''} />
            <AvatarFallback>{(user.displayName || user.email || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden">
            <button 
              onClick={() => setIsEditProfileOpen(true)}
              className="text-left group flex items-center gap-1 w-full"
            >
              <span className="truncate text-sm font-bold leading-tight group-hover:text-primary transition-colors">
                {user.displayName || 'Usuário'}
              </span>
              <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
            </button>
            <span className={cn(
              "truncate text-muted-foreground",
              user.displayName ? "text-[10px] leading-none mb-1" : "text-sm font-medium"
            )}>
              {user.email}
            </span>
            <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-0.5">
              <LogOut className="h-3 w-3" />
              Sair
            </button>
          </div>
        </div>
      ) : (
        <Link href="/login" onClick={() => setIsSheetOpen(false)}>
          <Button variant="outline" className="w-full gap-2">
            <LogIn className="h-4 w-4" />
            Entrar
          </Button>
        </Link>
      )}
    </div>
  );

  const isAuthPage = ['/login', '/cadastro', '/recuperar-senha', '/convite'].includes(pathname);

  if (isAuthPage) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1">{children}</main>
        {mounted && footer}
      </div>
    );
  }

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block sticky top-0 h-screen">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold font-headline">
              <Image 
                src="/Ico.jpeg" 
                alt="Logo" 
                width={24} 
                height={24} 
                className="rounded-sm"
              />
              <span className="tracking-tight">Agenda de Oradores</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="px-2 py-4 lg:px-4">{navLinks}</div>
          </div>
          {authSection}
        </div>
      </div>
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-background/80 backdrop-blur-md px-4 lg:h-[60px] lg:px-6">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0">
              <SheetHeader className="flex flex-row items-center h-14 border-b px-4 space-y-0 lg:h-[60px] lg:px-6">
                <SheetTitle asChild>
                  <Link href="/" onClick={() => setIsSheetOpen(false)} className="flex items-center gap-2 font-semibold font-headline">
                    <Image 
                      src="/Ico.jpeg" 
                      alt="Logo" 
                      width={24} 
                      height={24} 
                      className="rounded-sm"
                    />
                    <span className="sr-only">Agenda de Oradores</span>
                  </Link>
                </SheetTitle>
                <SheetDescription className="sr-only">Menu de navegação para acesso rápido às funcionalidades.</SheetDescription>
              </SheetHeader>
              <div className="flex-1 p-4 overflow-y-auto">{navLinks}</div>
              {authSection}
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
        </header>
        <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background animate-fade-in">
          {children}
        </main>
        {mounted && footer}
      </div>

      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
            <DialogDescription>
              Atualize seu nome de exibição no sistema.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUpdateProfile)} className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome de Exibição</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditProfileOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
