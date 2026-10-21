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
import { useAuth } from '@/firebase';
import { initiatePasswordReset } from '@/firebase/non-blocking-login';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const recuperarSchema = z.object({
  email: z.string().email('Email inválido.'),
});

export default function RecuperarSenhaPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof recuperarSchema>>({
    resolver: zodResolver(recuperarSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: z.infer<typeof recuperarSchema>) {
    setIsSubmitting(true);
    try {
      await initiatePasswordReset(auth, values.email);
      toast({
        title: "E-mail Enviado",
        description: "Se o e-mail existir, você receberá instruções para resetar sua senha.",
      });
      form.reset();
    } catch (error: any) {
      let message = "Ocorreu um erro ao tentar enviar o e-mail.";
      if (error.code === 'auth/invalid-email') message = "O e-mail informado é inválido.";
      if (error.code === 'auth/user-not-found') message = "Não encontramos uma conta com este e-mail.";

      toast({
        variant: "destructive",
        title: "Erro ao enviar",
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Recuperar Senha</CardTitle>
          <CardDescription>Insira seu e-mail para receber o link de redefinição.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="seu@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                <span className="flex items-center justify-center gap-2">
                  {isSubmitting && <span><Loader2 className="h-4 w-4 animate-spin" /></span>}
                  <span>Enviar Link</span>
                </span>
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/login" className="text-sm text-primary hover:underline">
            Voltar para o login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
