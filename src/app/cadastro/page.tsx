
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { initiateEmailSignUp, initiateGoogleSignIn } from '@/firebase/non-blocking-login';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const cadastroSchema = z.object({
  name: z.string().min(2, 'Informe seu nome completo.'),
  email: z.string().email('Email inválido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
  confirmPassword: z.string().min(6, 'Confirmação inválida.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

function CadastroForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const redirect = searchParams.get('redirect');

  useEffect(() => {
    if (user && !isUserLoading && !isRedirecting) {
      setIsRedirecting(true);
      // Se houver um redirect (ex: convite), vai para lá. Senão, vai para o setup.
      router.push(redirect || '/setup');
    }
  }, [user, isUserLoading, router, isRedirecting, redirect]);

  const form = useForm<z.infer<typeof cadastroSchema>>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const handleAuthError = (error: any) => {
    let message = "Ocorreu um erro ao tentar criar sua conta.";
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        message = "Este e-mail já está sendo utilizado por outra conta.";
        break;
      case 'auth/invalid-email':
        message = "O e-mail informado é inválido.";
        break;
      case 'auth/weak-password':
        message = "A senha escolhida é muito fraca.";
        break;
      case 'auth/popup-closed-by-user':
        return;
      case 'auth/account-exists-with-different-credential':
        message = "Você já tem uma conta com este e-mail usando outro método (ex: Google). Tente entrar com seu método original.";
        break;
    }

    toast({
      variant: "destructive",
      title: "Erro no cadastro",
      description: message,
    });
  };

  async function onSubmit(values: z.infer<typeof cadastroSchema>) {
    setIsSubmitting(true);
    try {
      const cred = await initiateEmailSignUp(auth, values.email, values.password);
      if (cred.user) {
        const userRef = doc(firestore, 'users', cred.user.uid);
        setDocumentNonBlocking(userRef, { 
          displayName: values.name, 
          email: values.email,
          photoURL: cred.user.photoURL || null
        });
      }
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      const cred = await initiateGoogleSignIn(auth);
      if (cred.user) {
        const userRef = doc(firestore, 'users', cred.user.uid);
        setDocumentNonBlocking(userRef, { 
          displayName: cred.user.displayName || cred.user.email?.split('@')[0] || 'Usuário', 
          email: cred.user.email,
          photoURL: cred.user.photoURL || null
        }, { merge: true });
      }
    } catch (error: any) {
      handleAuthError(error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8">
      <div className="mb-8 flex flex-col items-center gap-4">
        <Image 
          src="/Ico.jpeg" 
          alt="Logo Agenda de Oradores" 
          width={80} 
          height={80} 
          className="rounded-2xl shadow-lg border-none object-cover"
        />
        <h1 className="text-2xl font-bold text-primary font-headline">Agenda de Oradores</h1>
      </div>
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary border-none">
        <CardHeader>
          <CardTitle>Criar Conta</CardTitle>
          <CardDescription>Cadastre-se para começar a gerenciar sua agenda de discursos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full h-11" onClick={handleGoogleSignUp} disabled={isUserLoading || isRedirecting || isSubmitting}>
            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
              <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
            </svg>
            <span>Cadastrar com Google</span>
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Ou use seu e-mail</span>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome" {...field} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="seu@email.com" {...field} className="h-11" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="******" {...field} className="h-11" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showConfirmPassword ? "text" : "password"} placeholder="******" {...field} className="h-11" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-11 text-lg font-semibold bg-primary text-primary-foreground" disabled={isUserLoading || isRedirecting || isSubmitting}>
                <span className="flex items-center justify-center gap-2">
                  {isSubmitting && <span><Loader2 className="h-4 w-4 animate-spin" /></span>}
                  <span>{isRedirecting ? 'Redirecionando...' : 'Cadastrar'}</span>
                </span>
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center border-t py-4 bg-muted/10">
          <p className="text-sm text-muted-foreground">
            Já tem uma conta?{' '}
            <Link href={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login"} className="text-primary font-bold hover:underline">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <CadastroForm />
    </Suspense>
  );
}
