
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Settings, 
  Loader2, 
  History, 
  ArrowRightLeft,
  ShieldCheck,
  Building
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const settingsSchema = z.object({
  maxSpeakersOutPerWeek: z.coerce.number().min(1).max(5),
  monthsBefore: z.coerce.number().min(1).max(24),
});

export default function ConfiguracoesPage() {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const myCongQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'congregations'), where('authorizedUsers', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: myCongs, isLoading: isLoadingMyCong } = useCollection<any>(myCongQuery);
  const myCong = myCongs?.[0];

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: {
      maxSpeakersOutPerWeek: 1,
      monthsBefore: 6,
    },
  });

  useEffect(() => {
    if (myCong?.settings) {
      form.reset({
        maxSpeakersOutPerWeek: myCong.settings.maxSpeakersOutPerWeek || 1,
        monthsBefore: myCong.settings.monthsBefore || 6,
      });
    }
  }, [myCong, form]);

  const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
    if (!firestore || !myCong) return;
    setIsSaving(true);
    try {
      const docRef = doc(firestore, 'congregations', myCong.id);
      updateDocumentNonBlocking(docRef, { settings: values });
      toast({ title: "Configurações salvas!", description: "As novas regras já estão em vigor." });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Tente novamente mais tarde." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingMyCong) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  if (!myCong) return (
    <div className="p-20 text-center">
      <Building className="mx-auto h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-bold mt-4 font-headline">Configuração Necessária</h2>
      <Link href="/setup">
        <Button className="mt-4">Configurar Agora</Button>
      </Link>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Configurações do Workspace
        </h1>
        <p className="text-muted-foreground">Defina as regras e limites para a gestão de {myCong.name}.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-primary/5 border-b">
              <div className="flex items-center gap-2 text-primary font-bold">
                <ArrowRightLeft className="h-5 w-5" />
                Regras de Intercâmbio
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <FormField
                control={form.control}
                name="maxSpeakersOutPerWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Máximo de oradores ausentes por semana</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(num => (
                          <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Impede que mais de {field.value} oradores locais saiam para discursos na mesma semana.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-primary/5 border-b">
              <div className="flex items-center gap-2 text-primary font-bold">
                <History className="h-5 w-5" />
                Histórico de Compromissos
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <FormField
                control={form.control}
                name="monthsBefore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Meses passados a serem exibidos</FormLabel>
                    <div className="flex items-center gap-2">
                      <Select onValueChange={field.onChange} value={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Meses" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 12, 18, 24].map(m => (
                            <SelectItem key={m} value={m.toString()}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm font-medium text-muted-foreground">meses</span>
                    </div>
                    <FormDescription>Define o limite do histórico antigo no calendário. <br/><strong>Nota:</strong> A programação futura sempre será exibida na totalidade.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            className="w-full h-12 text-lg font-bold shadow-md" 
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <ShieldCheck className="h-5 w-5 mr-2" />}
            Salvar Configurações
          </Button>
        </form>
      </Form>
    </div>
  );
}
