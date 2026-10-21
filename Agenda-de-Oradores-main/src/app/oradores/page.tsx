'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  PlusCircle, 
  Loader2, 
  Edit, 
  Trash2, 
  Phone, 
  BookOpen, 
  Search, 
  Check, 
  FileUp, 
  FileSpreadsheet, 
  Contact,
  Star
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { setDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { Speaker, Congregation } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { talkTopics } from '@/lib/talk-topics';
import { cn, formatPhoneNumber, cleanRawNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const speakerSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.'),
  phoneNumber: z.string().optional(),
  homeCongregationId: z.string().min(1, 'A congregação é obrigatória.'),
  availableTopics: z.array(z.string()).min(1, 'Selecione ao menos um tema.'),
  onlyLocal: z.boolean().default(false),
});

const HighlightedText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${highlight})`, "gi"));
  return (<span>{parts.map((part, i) => part.toLowerCase() === highlight.toLowerCase() ? (<mark key={i} className="bg-primary/20 text-primary font-bold rounded-sm px-0.5">{part}</mark>) : (part))}</span>);
};

export default function OradoresPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
  const [speakerToDelete, setSpeakerToDelete] = useState<Speaker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTopic, setSearchTopic] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<any[]>([]);

  const [contactChoice, setContactChoice] = useState<{ 
    name: string, 
    numbers: string[] 
  } | null>(null);

  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const myCongQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'congregations'), where('authorizedUsers', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: myCongs } = useCollection<Congregation>(myCongQuery);
  const myCong = myCongs?.[0];

  const speakersQuery = useMemoFirebase(() => {
    if (!firestore || !myCong?.id) return null;
    return collection(firestore, 'congregations', myCong.id, 'speakers');
  }, [firestore, myCong?.id]);

  const neighborsQuery = useMemoFirebase(() => {
    if (!firestore || !myCong?.id) return null;
    return collection(firestore, 'congregations', myCong.id, 'neighbors');
  }, [firestore, myCong?.id]);

  const { data: speakers, isLoading: isLoadingSpeakers } = useCollection<Speaker>(speakersQuery);
  const { data: neighbors } = useCollection<Congregation>(neighborsQuery);

  const form = useForm<z.infer<typeof speakerSchema>>({
    resolver: zodResolver(speakerSchema),
    defaultValues: { name: '', phoneNumber: '', homeCongregationId: '', availableTopics: [], onlyLocal: false }
  });

  const getCongName = (id?: string): string => {
    if (!id) return 'Desconhecida';
    if (id === myCong?.id) return myCong.name || 'Minha Congregação';
    const neighbor = neighbors?.find(n => n.id === id);
    return neighbor?.name || 'Desconhecida';
  };

  const filteredSpeakersList = useMemo(() => {
    if (!speakers) return [];
    const searchLower = globalSearch.toLowerCase();
    return speakers
      .filter(s => {
        const nameMatch = (s.name || '').toLowerCase().includes(searchLower);
        const congMatch = getCongName(s.homeCongregationId).toLowerCase().includes(searchLower);
        return nameMatch || congMatch;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  }, [speakers, globalSearch, neighbors, myCong]);

  const sortedNeighbors = useMemo(() => {
    if (!neighbors) return [];
    return [...neighbors].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [neighbors]);

  const handlePickContact = async () => {
    if (!('contacts' in navigator && 'select' in (navigator as any).contacts)) {
      toast({ title: "Recurso indisponível", description: "A seleção de contatos não é suportada neste navegador.", variant: "destructive" });
      return;
    }
    try {
      const props = ['name', 'tel']; const opts = { multiple: false };
      const contacts = await (navigator as any).contacts.select(props, opts);
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        const name = contact.name?.[0]?.trim() || '';
        const telephones = contact.tel || [];
        if (name && !form.getValues('name')) form.setValue('name', name);
        const applyContact = (phone: string) => {
          const cleaned = cleanRawNumber(phone);
          form.setValue('phoneNumber', formatPhoneNumber(cleaned));
        };
        if (telephones.length === 1) applyContact(telephones[0]);
        else if (telephones.length > 1) setContactChoice({ name, numbers: telephones });
      }
    } catch (err: any) {
      if (err.name === 'InvalidStateError') {
        toast({
          title: "Função Indisponível no Editor",
          description: "Para usar a agenda, abra o app em uma nova aba ou digite o contato manualmente.",
          variant: "destructive"
        });
      } else if (err.name !== 'AbortError') {
        console.error(err);
      }
    }
  };

  const onSubmit = (values: z.infer<typeof speakerSchema>) => {
    if (!firestore || !myCong) return;
    const trimmedName = values.name.trim();
    const isNameTaken = (speakers || []).some(s => s.id !== editingSpeaker?.id && s.name.toLowerCase() === trimmedName.toLowerCase());
    if (isNameTaken) {
      toast({ variant: "destructive", title: "Nome já existe", description: "Já existe um orador com este nome cadastrado." });
      return;
    }
    setIsLoading(true);
    const speakerData = { name: trimmedName, phoneNumber: (values.phoneNumber || '').trim(), homeCongregationId: values.homeCongregationId, availableTopics: values.availableTopics, onlyLocal: values.onlyLocal };
    if (editingSpeaker) setDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'speakers', editingSpeaker.id), speakerData, { merge: true });
    else addDocumentNonBlocking(collection(firestore, 'congregations', myCong.id, 'speakers'), speakerData);
    setIsLoading(false); setIsDialogOpen(false); setEditingSpeaker(null); form.reset(); toast({ title: 'Salvo!' });
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !firestore || !myCong) return;
    setIsLoading(true); const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parseCSV = (content: string) => {
          const results = []; let row: string[] = []; let current = ''; let inQuotes = false;
          for (let i = 0; i < content.length; i++) {
            const char = content[i]; const nextChar = content[i + 1];
            if (char === '"') { if (inQuotes && nextChar === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } }
            else if (char === ',' && !inQuotes) { row.push(current.trim()); current = ''; }
            else if ((char === '\r' || char === '\n') && !inQuotes) { if (current !== '' || row.length > 0) { row.push(current.trim()); results.push(row); row = []; current = ''; } if (char === '\r' && nextChar === '\n') i++; }
            else { current += char; }
          }
          if (current !== '' || row.length > 0) { row.push(current.trim()); results.push(row); }
          return results;
        };
        const rows = parseCSV(text); if (rows.length <= 1) { toast({ variant: "destructive", title: "Arquivo vazio" }); setIsLoading(false); return; }
        const dataRows = rows.slice(1); const preview: any[] = [];
        const existingNames = new Set((speakers || []).map(s => s.name.toLowerCase()));
        for (const row of dataRows) {
          const [nomeCong, fName, lName, , , phoneMobile, , temas] = row; 
          const fullName = `${fName || ''} ${lName || ''}`.trim();
          if (fullName && !existingNames.has(fullName.toLowerCase())) {
            const processedTopics: string[] = []; (temas || '').replace(/"/g, '').split(/[,;]/).map(t => t.trim()).forEach(t => { const num = parseInt(t); if (!isNaN(num)) { const topic = talkTopics.find(tp => tp.id === num); if (topic) processedTopics.push(`${topic.id}. ${topic.title}`); } });
            preview.push({ name: fullName, phoneNumber: formatPhoneNumber(phoneMobile || ''), homeCongregationName: (nomeCong || '').toLowerCase(), availableTopics: processedTopics, onlyLocal: false });
            existingNames.add(fullName.toLowerCase());
          }
        }
        setImportPreviewData(preview);
      } catch (err) { toast({ variant: "destructive", title: "Erro na leitura" }); } finally { setIsLoading(false); e.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!firestore || !myCong) return; setIsLoading(true);
    try {
      const congsMap = new Map<string, string>(); congsMap.set(myCong.name.toLowerCase(), myCong.id); (neighbors || []).forEach(n => congsMap.set(n.name.toLowerCase(), n.id));
      for (const speaker of importPreviewData) {
        const homeId = congsMap.get(speaker.homeCongregationName) || myCong.id;
        const { homeCongregationName, ...final } = speaker;
        addDocumentNonBlocking(collection(firestore, 'congregations', myCong.id, 'speakers'), { ...final, homeCongregationId: homeId });
      }
      toast({ title: "Importado!" }); setImportPreviewData([]); setIsImportDialogOpen(false);
    } catch (err) { toast({ variant: "destructive", title: "Erro ao salvar" }); } finally { setIsLoading(false); }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold md:text-2xl font-headline">Oradores</h1>
          {!isLoadingSpeakers && filteredSpeakersList && (
            <Badge variant="secondary" className="font-bold bg-primary/10 text-primary border-none shadow-none px-2 h-6">
              {filteredSpeakersList.length}
            </Badge>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-fit">
          <Button onClick={() => { setEditingSpeaker(null); form.reset({ name: '', phoneNumber: '', homeCongregationId: '', availableTopics: [], onlyLocal: false }); setIsDialogOpen(true); }} className="gap-2 flex-1 sm:flex-none h-11 bg-primary text-primary-foreground font-bold" type="button">
            <PlusCircle className="h-4 w-4" /> Adicionar Orador
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild><Button variant="outline" className="gap-2 h-11 border-dashed border-primary text-primary" type="button"><FileUp className="h-4 w-4" /> Importar CSV do NW</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[95vh] overflow-y-auto shadow-2xl border-none"><DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> Importar Oradores</DialogTitle><DialogDescription>Confirme os dados do arquivo do NW.</DialogDescription></DialogHeader>
              <div className="space-y-4 py-4">
                {importPreviewData.length === 0 ? (<><div className="bg-muted/50 p-4 rounded-lg text-[11px] font-mono break-all border">CongregationName, FirstName, LastName, Privilege, PhoneHome, PhoneMobile, Email, PublicTalksCanGive</div><div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 bg-muted/10"><label className="cursor-pointer flex flex-col items-center"><FileUp className="h-10 w-10 text-primary mb-2" /><span className="text-sm font-bold">Selecionar CSV</span><input type="file" accept=".csv" className="hidden" onChange={handleCsvFileChange} /></label></div><Button variant="outline" className="w-full" type="button" onClick={() => setIsImportDialogOpen(false)}>Fechar</Button></>) : (
                  <div className="space-y-4"><ScrollArea className="h-64 border rounded-lg p-2 bg-muted/5"><div className="space-y-2">{importPreviewData.map((s, idx) => (<div key={idx} className="p-2 bg-background border rounded flex justify-between items-center"><div className="flex flex-col"><span className="text-sm font-bold text-primary">{s.name}</span><span className="text-[10px] uppercase text-muted-foreground">{s.homeCongregationName}</span></div><Badge variant="outline" className="text-[9px]">{s.availableTopics.length} temas</Badge></div>))}</div></ScrollArea>
                    <div className="flex gap-2"><Button variant="outline" className="flex-1" type="button" onClick={() => setImportPreviewData([])}>Voltar</Button><Button className="flex-1 font-bold" onClick={handleConfirmImport} disabled={isLoading}>Confirmar</Button></div></div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative"><Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Pesquisar orador ou congregação..." className="pl-8 h-11" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} /></div>
        {isLoadingSpeakers ? <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSpeakersList.map(s => (
              <Card key={s.id} className="border-none shadow-sm relative hover:shadow-md transition-all group">
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 bg-background/50 backdrop-blur-sm border shadow-sm" 
                    type="button"
                    onClick={() => { setEditingSpeaker(s); form.reset({ name: s.name, phoneNumber: s.phoneNumber || '', homeCongregationId: s.homeCongregationId, availableTopics: s.availableTopics || [], onlyLocal: s.onlyLocal || false }); setIsDialogOpen(true); }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive bg-background/50 backdrop-blur-sm border shadow-sm" 
                    type="button"
                    onClick={() => setSpeakerToDelete(s)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardHeader className="pb-2"><CardTitle className="text-base font-headline font-bold">{s.name}</CardTitle><div className="text-[10px] uppercase font-bold text-muted-foreground">{getCongName(s.homeCongregationId)}</div></CardHeader>
                <CardContent className="pb-4 space-y-3">
                  {s.phoneNumber && (<div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span>{s.phoneNumber}</span></div>)}
                  {s.onlyLocal && <Badge variant="outline" className="text-[10px] uppercase font-bold bg-amber-50 text-amber-700 border-amber-200">Não faz discurso fora</Badge>}
                  <Popover><PopoverTrigger asChild><div className="flex items-center gap-2 text-xs font-bold text-primary cursor-pointer hover:underline w-fit"><BookOpen className="h-3.5 w-3.5" /><span>{s.availableTopics?.length || 0} Temas</span></div></PopoverTrigger>
                    <PopoverContent className="w-72 p-0 shadow-2xl border-none overflow-hidden" align="start">
                      <div className="bg-primary text-white p-2 text-xs font-bold flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> Temas do Orador</div>
                      <ScrollArea className="h-64 p-1">{(s.availableTopics || []).sort((a,b) => parseInt(a) - parseInt(b)).map(t => (<div key={t} className="p-2 text-[11px] border-b last:border-0 flex gap-2"><span className="font-bold text-primary">{t.split('. ')[0]}.</span><span className="flex-1">{t.split('. ').slice(1).join('. ')}</span></div>))}</ScrollArea>
                    </PopoverContent>
                  </Popover>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[95vh] overflow-y-auto shadow-2xl border-none"><DialogHeader><DialogTitle className="text-xl font-headline font-bold text-center w-full">{editingSpeaker ? 'Editar Orador' : 'Novo Orador'}</DialogTitle></DialogHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel className="font-bold">Nome Completo</FormLabel><FormControl><Input {...field} className="h-11" /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="homeCongregationId" render={({ field }) => (<FormItem><FormLabel className="font-bold">Origem</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11" type="button"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{myCong && <SelectItem value={myCong.id}>{myCong.name} (Minha)</SelectItem>}{sortedNeighbors.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}</SelectContent></Select></FormItem>)} />
            <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel className="font-bold">Telefone</FormLabel><div className="flex gap-2"><FormControl><Input {...field} onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))} className="h-11 flex-1" /></FormControl><Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={handlePickContact}><Contact className="h-5 w-5" /></Button></div></FormItem>)} />
            
            {form.watch('homeCongregationId') === myCong?.id && (
              <FormField control={form.control} name="onlyLocal" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 bg-muted/20">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-bold cursor-pointer">Não faz discurso fora</FormLabel>
                    <p className="text-[10px] text-muted-foreground">Se marcado, o orador não aparecerá para agendamentos em outras congregações.</p>
                  </div>
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="availableTopics" render={({ field }) => {
              const filteredTopics = talkTopics.filter(t => t.title.toLowerCase().includes(searchTopic.toLowerCase()) || t.id.toString().includes(searchTopic));
              const selected = filteredTopics.filter(t => field.value.includes(`${t.id}. ${t.title}`));
              const unselected = filteredTopics.filter(t => !field.value.includes(`${t.id}. ${t.title}`));
              return (
                <FormItem><FormLabel className="font-bold">Temas Disponíveis ({field.value.length})</FormLabel>
                  <div className="space-y-2"><div className="flex items-center gap-2 px-2 border rounded-md h-10"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Pesquisar..." value={searchTopic} onChange={(e) => setSearchTopic(e.target.value)} className="border-0 focus-visible:ring-0 h-9 w-full shadow-none bg-transparent" /></div>
                    <ScrollArea className="h-[250px] border rounded-md p-1 bg-muted/5">
                      {selected.length > 0 && (
                        <div className="mb-2">
                          <div className="px-2 py-1 text-[10px] font-bold text-primary uppercase bg-primary/5 rounded-sm mb-1 flex items-center gap-1">
                            <Star className="h-3 w-3 fill-primary" /> Repertório Atual
                          </div>
                          {selected.map(t => {
                            const tStr = `${t.id}. ${t.title}`;
                            return (<div key={t.id} onClick={() => field.onChange(field.value.filter(v => v !== tStr))} className={cn("flex items-start gap-2 p-1.5 rounded cursor-pointer hover:bg-muted text-sm bg-primary/10 text-primary font-bold")}><div className="h-4 w-4 shrink-0 border rounded-sm mt-0.5 flex items-center justify-center bg-primary border-primary text-white"><Check className="h-3.5 w-3.5" /></div><span className="font-bold min-w-[20px]">{t.id}.</span><span><HighlightedText text={t.title} highlight={searchTopic} /></span></div>);
                          })}
                          <Separator className="my-2" />
                        </div>
                      )}
                      {unselected.map(t => {
                        const tStr = `${t.id}. ${t.title}`;
                        return (<div key={t.id} onClick={() => field.onChange([...field.value, tStr])} className="flex items-start gap-2 p-1.5 rounded cursor-pointer hover:bg-muted text-sm"><div className="h-4 w-4 shrink-0 border rounded-sm mt-0.5 border-muted-foreground/30 flex items-center justify-center"></div><span className="font-bold min-w-[20px]">{t.id}.</span><span><HighlightedText text={t.title} highlight={searchTopic} /></span></div>);
                      })}
                    </ScrollArea></div></FormItem>
              );
            }} />
            <div className="flex gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 h-11">Cancelar</Button><Button type="submit" disabled={isLoading} className="flex-1 h-11 bg-primary text-primary-foreground font-bold">Salvar</Button></div>
          </form></Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contactChoice} onOpenChange={(o) => !o && setContactChoice(null)}><DialogContent className="sm:max-w-[425px] w-[95vw] shadow-2xl border-none"><DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-headline"><Phone className="h-5 w-5 text-primary" /> Escolher Telefone</DialogTitle><DialogDescription>O contato <strong>{contactChoice?.name}</strong> possui múltiplos números.</DialogDescription></DialogHeader>
        <div className="grid gap-2 py-4">{contactChoice?.numbers.map((num, i) => (<Button key={i} variant="outline" className="justify-start h-12 text-base font-semibold" type="button" onClick={() => { const cleaned = cleanRawNumber(num); form.setValue('phoneNumber', formatPhoneNumber(cleaned)); setContactChoice(null); }}><Phone className="mr-2 h-4 w-4 opacity-50" /> {formatPhoneNumber(cleanRawNumber(num))}</Button>))}</div>
        <div className="flex justify-end"><Button variant="ghost" type="button" onClick={() => setContactChoice(null)}>Cancelar</Button></div>
      </DialogContent></Dialog>

      <AlertDialog open={!!speakerToDelete} onOpenChange={(o) => !o && setSpeakerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Orador?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover "{speakerToDelete?.name}"? Esta ação não pode ser desfeita e removerá o histórico dele no sistema.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if(speakerToDelete && myCong) { deleteDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'speakers', speakerToDelete.id)); setSpeakerToDelete(null); } }} className="bg-destructive text-white hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
