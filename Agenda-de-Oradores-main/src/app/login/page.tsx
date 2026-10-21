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
import { initiateEmailSignIn, initiateGoogleSignIn } from '@/firebase/non-blocking-login';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email('Email inválido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
});

function LoginForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirect = searchParams.get('redirect');

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (user && !isUserLoading) {
      if (user.displayName || user.email) {
        const userRef = doc(firestore, 'users', user.uid);
        setDocumentNonBlocking(userRef, { 
          displayName: user.displayName || user.email?.split('@')[0] || 'Usuário',
          email: user.email,
          photoURL: user.photoURL || null
        }, { merge: true });
      }
      router.push(redirect || '/');
    }
  }, [user, isUserLoading, router, firestore, redirect]);

  const handleAuthError = (error: any) => {
    let message = "Ocorreu um erro ao tentar entrar.";
    
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        message = "E-mail ou senha incorretos.";
        break;
      case 'auth/invalid-email':
        message = "O e-mail informado é inválido.";
        break;
      case 'auth/user-disabled':
        message = "Este usuário foi desativado.";
        break;
      case 'auth/too-many-requests':
        message = "Muitas tentativas. Tente novamente mais tarde.";
        break;
      case 'auth/popup-closed-by-user':
        return;
      case 'auth/account-exists-with-different-credential':
        message = "Você já tem uma conta com este e-mail usando outro método (ex: Google). Tente entrar com seu método original.";
        break;
    }

    toast({
      variant: "destructive",
      title: "Erro ao entrar",
      description: message,
    });
  };

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsSubmitting(true);
    try {
      await initiateEmailSignIn(auth, values.email, values.password);
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      await initiateGoogleSignIn(auth);
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
          className="rounded-2xl shadow-lg border-none"
        />
        <h1 className="text-2xl font-bold text-primary font-headline">Agenda de Oradores</h1>
      </div>
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary border-none">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Acesse sua conta para gerenciar discursos e congregações.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full h-11" onClick={handleGoogleSignIn} disabled={isUserLoading || isSubmitting}>
            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
              <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
            </svg>
            <span>Entrar com Google</span>
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
              <div className="flex justify-end">
                <Link href="/recuperar-senha" className="text-sm text-primary hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <Button type="submit" className="w-full h-11 text-lg font-semibold bg-primary text-primary-foreground" disabled={isUserLoading || isSubmitting}>
                <span className="flex items-center justify-center gap-2">
                  {isSubmitting && <span><Loader2 className="h-4 w-4 animate-spin" /></span>}
                  <span>Entrar</span>
                </span>
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center border-t py-4 bg-muted/10">
          <p className="text-sm text-muted-foreground">
            Não tem uma conta?{' '}
            <Link href={redirect ? `/cadastro?redirect=${encodeURIComponent(redirect)}` : "/cadastro"} className="text-primary font-bold hover:underline">
              Cadastre-se
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <LoginForm />
    </Suspense>
  );
}