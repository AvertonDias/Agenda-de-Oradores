'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { doc, query, collection, where } from 'firebase/firestore';
import { updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Building, 
  UserPlus, 
  CheckCircle2, 
  LogIn, 
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

function ConviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showSwitchWarning, setShowSwitchWarning] = useState(false);

  const congregationId = searchParams.get('id');
  const inviteToken = searchParams.get('token');

  const congregationRef = useMemoFirebase(() => {
    if (!firestore || !congregationId) return null;
    return doc(firestore, 'congregations', congregationId);
  }, [firestore, congregationId]);

  const inviteRef = useMemoFirebase(() => {
    if (!firestore || !congregationId || !inviteToken) return null;
    return doc(firestore, 'congregations', congregationId, 'invites', inviteToken);
  }, [firestore, congregationId, inviteToken]);

  const { data: congregation, isLoading: isLoadingCong } = useDoc<any>(congregationRef);
  const { data: invite, isLoading: isLoadingInvite } = useDoc<any>(inviteRef);

  const existingCongQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'congregations'), where('authorizedUsers', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: existingCongs } = useCollection(existingCongQuery);
  const hasExistingCong = existingCongs && existingCongs.length > 0;

  useEffect(() => {
    if (congregation && user && congregation.authorizedUsers?.includes(user.uid)) {
      setIsSuccess(true);
    }
  }, [congregation, user]);

  const processAccept = () => {
    if (!firestore || !user || !congregationId || !congregation || !invite) return;
    
    setIsProcessing(true);

    // Sincroniza o perfil do usuário incluindo a foto
    const userRef = doc(firestore, 'users', user.uid);
    setDocumentNonBlocking(userRef, { 
      displayName: user.displayName || user.email?.split('@')[0] || 'Usuário',
      email: user.email,
      photoURL: user.photoURL || null
    }, { merge: true });

    const currentHelpers = congregation.authorizedUsers || [];
    
    if (currentHelpers.includes(user.uid)) {
      setIsSuccess(true);
      setIsProcessing(false);
      return;
    }

    const updatedHelpers = [...currentHelpers, user.uid];
    const docRef = doc(firestore, 'congregations', congregationId);
    
    // Adiciona o usuário aos autorizados
    updateDocumentNonBlocking(docRef, { authorizedUsers: updatedHelpers });
    
    // Exclui o token de convite para garantir o uso único
    if (inviteRef) {
      deleteDocumentNonBlocking(inviteRef);
    }
    
    toast({ 
      title: "Convite Aceito!", 
      description: `Agora você é um ajudante na congregação ${congregation.name}.` 
    });
    
    setIsSuccess(true);
    setIsProcessing(false);
  };

  const handleAcceptInvite = () => {
    const isAlreadyInThisOne = congregation?.authorizedUsers?.includes(user?.uid);
    if (hasExistingCong && !isAlreadyInThisOne) {
      setShowSwitchWarning(true);
    } else {
      processAccept();
    }
  };

  if (!congregationId || !inviteToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <Building className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold font-headline">Link Inválido</h1>
        <p className="text-muted-foreground">Este link de convite parece estar quebrado ou incompleto.</p>
        <Link href="/"><Button className="mt-6">Voltar para o Início</Button></Link>
      </div>
    );
  }

  if (isLoadingCong || isUserLoading || isLoadingInvite) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!congregation || !invite) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <Building className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold font-headline">Convite Indisponível</h1>
        <p className="text-muted-foreground">Este link já foi utilizado por outra pessoa ou expirou.</p>
        <Link href="/"><Button className="mt-6">Voltar para o Início</Button></Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <Card className="w-full max-w-md border-none shadow-xl text-center">
          <CardHeader>
            <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-headline">Tudo Pronto!</CardTitle>
            <CardDescription>
              Você já tem acesso à agenda da congregação <strong>{congregation.name}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Agora você pode ajudar a agendar discursos e gerenciar oradores.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/" className="w-full">
              <Button className="w-full h-12 text-lg bg-primary text-primary-foreground gap-2">
                <span className="flex items-center justify-center gap-2">
                  <span>Ir para o Painel</span>
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const redirectUrl = encodeURIComponent(`/convite?id=${congregationId}&token=${inviteToken}`);

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline">Convite de Acesso Único</CardTitle>
          <CardDescription>
            Você foi convidado para ser um ajudante na congregação:
          </CardDescription>
          <div className="mt-4 p-4 bg-muted rounded-lg border">
            <h3 className="text-lg font-bold text-primary font-headline">{congregation.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{congregation.address}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex gap-3">
                <LogIn className="h-5 w-5 shrink-0" />
                <p>Você precisa ter uma conta e estar conectado para aceitar este convite.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Link href={`/login?redirect=${redirectUrl}`}>
                  <Button variant="outline" className="w-full">Entrar</Button>
                </Link>
                <Link href={`/cadastro?redirect=${redirectUrl}`}>
                  <Button className="w-full bg-primary">Criar Conta</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Ao aceitar, este link será invalidado e você poderá gerenciar esta congregação.
              </p>
              <Button 
                onClick={handleAcceptInvite} 
                className="w-full h-12 text-lg bg-primary text-primary-foreground"
                disabled={isProcessing}
              >
                <span className="flex items-center justify-center gap-2">
                  {isProcessing && <span><Loader2 className="h-5 w-5 animate-spin" /></span>}
                  <span>Aceitar e Ajudar</span>
                </span>
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t pt-4">
           <Link href="/" className="text-xs text-muted-foreground hover:underline">
             Ignorar convite e ir para o início
           </Link>
        </CardFooter>
      </Card>

      <AlertDialog open={showSwitchWarning} onOpenChange={setShowSwitchWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Já possui congregação
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-3">
                <p>Detectamos que você já gerencia ou ajuda na congregação <strong>{existingCongs?.[0]?.name}</strong>.</p>
                <p>Ao aceitar este convite, você também passará a gerenciar a congregação <strong>{congregation.name}</strong>.</p>
                <p className="font-semibold text-foreground italic">Deseja continuar?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={processAccept} className="bg-primary text-primary-foreground">
              Sim, aceitar convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ConvitePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ConviteContent />
    </Suspense>
  );
}
