'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  FileUp, 
  FileSpreadsheet, 
  Building, 
  Users, 
  MapPin, 
  CalendarDays, 
  Check, 
  BookOpen,
  Contact,
  Phone
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { talkTopics } from '@/lib/talk-topics';
import { Badge } from '@/components/ui/badge';

const setupSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.'),
  address: z.string().min(1, 'O endereço é obrigatório.'),
  coordinates: z.string().optional(),
  coordinators: z.array(z.object({
    name: z.string().optional(),
    phone: z.string().optional().or(z.string().length(0)),
  })).min(1, 'Adicione pelo menos um coordenador.'),
  meetingDay: z.string().min(1, 'O dia da reunião é obrigatório.'),
  meetingTime: z.string().min(1, 'O horário é obrigatório.').regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:mm)."),
});

const formatPhoneNumber = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const cleanRawNumber = (raw: string) => {
  let numbers = raw.replace(/\D/g, '');
  if ((numbers.length === 12 || numbers.length === 13) && numbers.startsWith('55')) {
    numbers = numbers.slice(2);
  }
  return numbers;
};

const translateDay = (day: string) => {
  const d = day.toLowerCase();
  if (d.includes('sat') || d.includes('sáb')) return 'Sábado';
  if (d.includes('sun') || d.includes('dom')) return 'Domingo';
  if (d.includes('fri') || d.includes('sex')) return 'Sexta';
  if (d.includes('mon') || d.includes('seg')) return 'Segunda';
  if (d.includes('tue') || d.includes('ter')) return 'Terça';
  if (d.includes('wed') || d.includes('qua')) return 'Quarta';
  if (d.includes('thu') || d.includes('qui')) return 'Quinta';
  return day;
};

export default function SetupPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = useState(false);
  
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importStage, setImportStage] = useState<'upload_congs' | 'preview_congs' | 'upload_speakers' | 'preview_speakers'>('upload_congs');
  const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
  const [localCongIndex, setLocalCongIndex] = useState<number | null>(null);
  const [createdCongId, setCreatedCongId] = useState<string | null>(null);
  const [createdNeighborsMap, setCreatedNeighborsMap] = useState<Map<string, string>>(new Map());

  const [contactChoice, setContactChoice] = useState<{ 
    name: string, 
    numbers: string[],
    index: number
  } | null>(null);

  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const myCongregationsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'congregations'), where('authorizedUsers', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: myCongregations, isLoading: isLoadingMyCong } = useCollection(myCongregationsQuery);

  const form = useForm<z.infer<typeof setupSchema>>({
    resolver: zodResolver(setupSchema),
    defaultValues: { name: '', address: '', coordinates: '', coordinators: [{ name: '', phone: '' }], meetingDay: '', meetingTime: '' }
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "coordinators" });

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    } else if (!isUserLoading && !isLoadingMyCong && user && myCongregations && myCongregations.length > 0) {
      router.push('/');
    }
  }, [user, isUserLoading, myCongregations, isLoadingMyCong, router]);

  const handlePickCoordinatorContact = async (index: number) => {
    if (!('contacts' in navigator && 'select' in (navigator as any).contacts)) {
      toast({ title: "Recurso indisponível", description: "A seleção de contatos não é suportada.", variant: "destructive" });
      return;
    }
    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };
      const contacts = await (navigator as any).contacts.select(props, opts);
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        const name = contact.name?.[0]?.trim() || '';
        const telephones = contact.tel || [];
        if (name && !form.getValues(`coordinators.${index}.name`)) form.setValue(`coordinators.${index}.name`, name);
        
        const applyContact = (phone: string) => {
          const cleaned = cleanRawNumber(phone);
          form.setValue(`coordinators.${index}.phone`, formatPhoneNumber(cleaned));
        };

        if (telephones.length === 1) {
          applyContact(telephones[0]);
        } else if (telephones.length > 1) {
          setContactChoice({ name, numbers: telephones, index });
        }
      }
    } catch (err: any) {
      if (err.name === 'InvalidStateError') {
        toast({
          title: "Função Indisponível no Editor",
          description: "Para usar a agenda, abra o aplicativo em uma nova aba ou digite o contato manualmente.",
          variant: "destructive"
        });
      } else if (err.name !== 'AbortError') {
        console.error(err);
      }
    }
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore) return;
    setIsSubmitting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parseCSV = (content: string) => {
          const results = [];
          let row: string[] = [];
          let current = '';
          let inQuotes = false;
          const delimiter = content.includes(';') ? ';' : ',';
          for (let i = 0; i < content.length; i++) {
            const char = content[i]; const nextChar = content[i + 1];
            if (char === '"') { if (inQuotes && nextChar === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } }
            else if (char === delimiter && !inQuotes) { row.push(current.trim()); current = ''; }
            else if ((char === '\r' || char === '\n') && !inQuotes) {
              if (current !== '' || row.length > 0) { row.push(current.trim()); results.push(row); row = []; current = ''; }
              if (char === '\r' && nextChar === '\n') i++;
            } else { current += char; }
          }
          if (current !== '' || row.length > 0) { row.push(current.trim()); results.push(row); }
          return results;
        };
        const rows = parseCSV(text);
        if (rows.length <= 1) { toast({ variant: "destructive", title: "Arquivo vazio ou inválido" }); setIsSubmitting(false); return; }
        const headerRow = rows[0].join(',').toLowerCase();
        const dataRows = rows.slice(1);
        const preview: any[] = [];
        if (importStage === 'upload_congs') {
          const isSpecialFormat = headerRow.includes('kingdomhalladdress');
          for (const row of dataRows) {
            let name = '', address = '', day = '', time = '', phone = '', coordName = 'Coordenador';
            if (isSpecialFormat) {
              name = row[0]; address = row[2]; day = translateDay(row[3]); time = row[4];
              coordName = `${row[5] || ''} ${row[6] || ''}`.trim() || 'Coordenador'; phone = row[7];
            } else { [name, phone, address, , day, time] = row; }
            if (name) preview.push({ name, address: address || '', coordinates: '', coordinators: [{ name: coordName, phone: formatPhoneNumber(phone || '') }], meetingSchedule: `${day || 'Sábado'}, ${time || '19:00'}` });
          }
          setImportPreviewData(preview); setImportStage('preview_congs');
        } else if (importStage === 'upload_speakers') {
          for (const row of dataRows) {
            const [nomeCong, fName, lName, , , phoneMobile, , temas] = row;
            const fullName = `${fName || ''} ${lName || ''}`.trim();
            if (fullName) {
              const processedTopics: string[] = [];
              (temas || '').replace(/"/g, '').split(/[,;]/).map(t => t.trim()).forEach(t => {
                const num = parseInt(t);
                if (!isNaN(num)) { const topic = talkTopics.find(tp => tp.id === num); if (topic) processedTopics.push(`${topic.id}. ${topic.title}`); }
              });
              preview.push({ name: fullName, phoneNumber: formatPhoneNumber(phoneMobile || ''), homeCongregationName: (nomeCong || '').toLowerCase(), availableTopics: processedTopics.length > 0 ? processedTopics : [] });
            }
          }
          setImportPreviewData(preview); setImportStage('preview_speakers');
        }
      } catch (err) { console.error(err); toast({ variant: "destructive", title: "Erro no processamento" }); } 
      finally { setIsSubmitting(false); e.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const handleConfirmFinalImport = async () => {
    if (!firestore || !user) return;
    setIsSubmitting(true);
    try {
      if (importStage === 'preview_congs') {
        if (localCongIndex === null) { toast({ variant: "destructive", title: "Selecione sua congregação" }); setIsSubmitting(false); return; }
        const myCongData = importPreviewData[localCongIndex];
        const rootData = { ...myCongData, adminUid: user.uid, authorizedUsers: [user.uid] };
        const docRef = await addDocumentNonBlocking(collection(firestore, 'congregations'), rootData);
        if (docRef) {
          const rootId = docRef.id; setCreatedCongId(rootId);
          const neighborsMap = new Map<string, string>(); neighborsMap.set(myCongData.name.toLowerCase(), rootId);
          for (let i = 0; i < importPreviewData.length; i++) {
            if (i !== localCongIndex) {
              const nData = importPreviewData[i];
              addDocumentNonBlocking(collection(firestore, 'congregations', rootId, 'neighbors'), nData).then(nRef => { if (nRef) neighborsMap.set(nData.name.toLowerCase(), nRef.id); });
            }
          }
          setCreatedNeighborsMap(neighborsMap); setImportStage('upload_speakers'); setImportPreviewData([]);
        }
      } else if (importStage === 'preview_speakers') {
        if (!createdCongId) return;
        for (const speaker of importPreviewData) {
          const homeCongId = createdNeighborsMap.get(speaker.homeCongregationName) || createdCongId;
          const { homeCongregationName, ...finalSpeakerData } = speaker;
          addDocumentNonBlocking(collection(firestore, 'congregations', createdCongId, 'speakers'), { ...finalSpeakerData, homeCongregationId: homeCongId });
        }
        toast({ title: "Importação concluída!" }); setTimeout(() => router.push('/'), 1000);
      }
    } catch (err) { console.error(err); toast({ variant: "destructive", title: "Erro ao salvar dados" }); }
    finally { setIsSubmitting(false); }
  };

  async function onSubmit(values: z.infer<typeof setupSchema>) {
    if (!firestore || !user) return;
    setIsSubmitting(true);
    const trimmedName = values.name.trim();
    const q = query(collection(firestore, 'congregations'), where('name', '==', trimmedName));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) { setIsDuplicateAlertOpen(true); setIsSubmitting(false); return; }
    const newCongregation = { name: trimmedName, address: values.address.trim(), coordinates: values.coordinates?.trim() || '', coordinators: values.coordinators.map(c => ({ name: (c.name || '').trim(), phone: (c.phone || '').trim() })), meetingSchedule: `${values.meetingDay}, ${values.meetingTime}`, adminUid: user.uid, authorizedUsers: [user.uid] };
    addDocumentNonBlocking(collection(firestore, 'congregations'), newCongregation);
    toast({ title: 'Configuração concluída!' });
    setTimeout(() => { setIsSubmitting(false); router.push('/'); }, 1500);
  }

  if (isUserLoading || isLoadingMyCong) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 gap-6">
      <Card className="w-full max-w-2xl shadow-lg border-none">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">Bem-vindo!</CardTitle>
          <CardDescription>Cadastre as informações da sua congregação local ou importe um arquivo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <Dialog open={isImportDialogOpen} onOpenChange={(open) => { setIsImportDialogOpen(open); if (!open) { setImportStage('upload_congs'); setImportPreviewData([]); setLocalCongIndex(null); } }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 h-11 border-dashed border-primary text-primary w-full sm:auto" type="button">
                  <FileUp className="h-4 w-4" /> Importar CSV do NW
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] w-[95vw] border-none shadow-2xl overflow-hidden">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> {importStage.includes('congs') ? 'Importar Congregações (Passo 1)' : 'Importar Oradores (Passo 2)'}</DialogTitle>
                  <DialogDescription asChild><div className="text-sm">Siga os passos para automatizar sua configuração.</div></DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {(importStage === 'upload_congs' || importStage === 'upload_speakers') && (
                    <>
                      <div className="bg-muted/50 p-4 rounded-lg border text-[11px] space-y-2">
                        <p className="font-bold">Colunas esperadas:</p>
                        {importStage === 'upload_congs' ? (<p className="text-primary font-mono leading-relaxed">Name, Circuit, KingdomHallAddress, WeekendMeetingDay, WeekendMeetingTime, COBEFirstName, COBELastName, COBEPhone</p>) : (<p className="text-primary font-mono leading-relaxed">CongregationName, FirstName, LastName, Privilege, PhoneHome, PhoneMobile, Email, PublicTalksCanGive</p>)}
                      </div>
                      <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 bg-muted/10 hover:bg-muted/20 transition-colors">
                        {isSubmitting ? <Loader2 className="animate-spin h-8 w-8 text-primary" /> : (
                          <label className="flex flex-col items-center gap-2 cursor-pointer w-full">
                            <div className="p-4 bg-primary/10 rounded-full mb-2"><FileUp className="h-10 w-10 text-primary" /></div>
                            <span className="text-sm font-bold text-center">Clique para selecionar o arquivo .csv</span>
                            <span className="text-xs text-muted-foreground">{importStage === 'upload_congs' ? 'Arquivo de Congregações' : 'Arquivo de Oradores'}</span>
                            <input type="file" accept=".csv" className="hidden" onChange={handleCsvFileChange} />
                          </label>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {importStage === 'upload_speakers' && (<Button variant="ghost" className="w-full text-xs" type="button" onClick={() => router.push('/')}>Pular oradores e finalizar</Button>)}
                        <Button variant="outline" className="w-full" type="button" onClick={() => setIsImportDialogOpen(false)}>Fechar</Button>
                      </div>
                    </>
                  )}
                  {(importStage === 'preview_congs' || importStage === 'preview_speakers') && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1"><h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">{importStage === 'preview_congs' ? <Building className="h-4 w-4" /> : <Users className="h-4 w-4" />} {importPreviewData.length} {importStage === 'preview_congs' ? 'Congregações' : 'Oradores'}</h3></div>
                      <ScrollArea className="h-[280px] border rounded-xl bg-muted/5 p-2">
                        <div className="space-y-2">
                          {importPreviewData.map((item, idx) => (
                            <div key={idx} className={cn("p-3 bg-background border rounded-lg shadow-sm flex flex-col gap-1 transition-all", idx === localCongIndex && "ring-2 ring-primary border-primary bg-primary/5")}>
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-0.5"><span className="font-bold text-sm text-primary">{item.name}</span>{idx === localCongIndex && <Badge className="w-fit text-[9px] h-4 bg-primary text-white">Minha Congregação</Badge>}</div>
                                {importStage === 'preview_congs' && (<Button variant={idx === localCongIndex ? "default" : "outline"} size="sm" className="h-7 text-[10px] px-2 font-bold" type="button" onClick={() => setLocalCongIndex(localCongIndex === idx ? null : idx)}>{idx === localCongIndex ? "Esta é a minha" : "Marcar como minha"}</Button>)}
                                {importStage === 'preview_speakers' && (<Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary uppercase">{item.homeCongregationName}</Badge>)}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{importStage === 'preview_congs' ? (<><MapPin className="h-3.5 w-3.5 mt-0.5" /> <span className="truncate">{item.address}</span></>) : (<><BookOpen className="h-3.5 w-3.5" /> {item.availableTopics.length} temas</>)}</div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <div className="flex gap-2"><Button variant="outline" className="flex-1 h-11" type="button" onClick={() => setImportStage(importStage === 'preview_congs' ? 'upload_congs' : 'upload_speakers')}>Voltar</Button><Button className="flex-1 font-bold h-11 bg-primary text-primary-foreground" onClick={handleConfirmFinalImport} disabled={isSubmitting}>{isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {importStage === 'preview_congs' ? 'Confirmar e Prosseguir' : 'Confirmar e Finalizar'}</Button></div>
                      <Button variant="ghost" className="w-full" type="button" onClick={() => setIsImportDialogOpen(false)}>Fechar</Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Ou cadastre manualmente</span></div></div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel className="font-bold">Nome da Congregação</FormLabel><FormControl><Input placeholder="Ex: Central" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel className="font-bold">Endereço</FormLabel><FormControl><Input placeholder="Rua, Número, Cidade" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                <div className="flex items-center justify-between"><FormLabel className="font-bold">Coordenadores</FormLabel><Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', phone: '' })} className="gap-1"><Plus className="h-3.5 w-3.5" /> Adicionar</Button></div>
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-background rounded-md border relative">
                    {index > 0 && (<Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>)}
                    <FormField control={form.control} name={`coordinators.${index}.name`} render={({ field }) => (<FormItem><FormLabel className="text-xs font-bold">Nome</FormLabel><FormControl><Input placeholder="Nome" {...field} className="h-8 text-sm" /></FormControl></FormItem>)} />
                    <FormField control={form.control} name={`coordinators.${index}.phone`} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold">Telefone (Opcional)</FormLabel>
                        <div className="flex gap-1.5">
                          <FormControl><Input placeholder="(00) 00000-0000" {...field} onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))} className="h-8 text-sm flex-1" /></FormControl>
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => handlePickCoordinatorContact(index)}><Contact className="h-3.5 w-3.5" /></Button>
                        </div>
                      </FormItem>
                    )} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg border">
                <FormField control={form.control} name="meetingDay" render={({ field }) => (<FormItem><FormLabel className="font-bold">Dia da Reunião</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger type="button"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Sábado">Sábado</SelectItem><SelectItem value="Domingo">Domingo</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="meetingTime" render={({ field }) => (<FormItem><FormLabel className="font-bold">Horário</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <Button type="submit" className="w-full h-12 text-lg bg-accent text-accent-foreground font-bold" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Concluir Configuração</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Dialog open={!!contactChoice} onOpenChange={(o) => !o && setContactChoice(null)}>
        <DialogContent className="sm:max-w-[425px] w-[95vw] px-4 py-6 shadow-2xl border-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-headline"><Phone className="h-5 w-5 text-primary" /> Escolher Telefone</DialogTitle>
            <DialogDescription asChild><div className="text-sm">O contato <strong>{contactChoice?.name}</strong> possui múltiplos números. Qual deles deseja usar?</div></DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            {contactChoice?.numbers.map((num, i) => (
              <Button key={i} variant="outline" className="justify-start h-12 text-base font-semibold" type="button" onClick={() => { 
                const cleaned = cleanRawNumber(num);
                form.setValue(`coordinators.${contactChoice.index}.phone`, formatPhoneNumber(cleaned)); 
                setContactChoice(null); 
              }}>
                <Phone className="mr-2 h-4 w-4 opacity-50" /> {formatPhoneNumber(cleanRawNumber(num))}
              </Button>
            ))}
          </div>
          <div className="flex justify-end pt-2"><Button variant="ghost" type="button" onClick={() => setContactChoice(null)}>Cancelar</Button></div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDuplicateAlertOpen} onOpenChange={setIsDuplicateAlertOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Congregação já cadastrada</AlertDialogTitle><AlertDialogDescription asChild><div className="text-sm">Verifique se alguém já fez o cadastro e peça um convite.</div></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction onClick={() => setIsDuplicateAlertOpen(false)}>OK</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
