
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  Calendar as CalendarIcon, 
  Trash2, 
  Loader2, 
  Edit,
  CalendarDays,
  X
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, startOfDay, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { Calendar as UICalendar, type CalendarDayState } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { EditEventDialog } from '@/components/edit-event-dialog';
import { HotelIcon, StadiumIcon, BriefcaseIcon, WineIcon } from '@/components/icons';

const eventSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  date: z.date({ required_error: 'A data é obrigatória.' }),
  endDate: z.date().optional(),
  type: z.enum(["Assembleia", "Congresso", "Visita do Superintendente", "Celebração", "Outro"], { required_error: "Selecione o tipo de evento.", }),
  isSingleDay: z.boolean().default(true),
}).refine(data => { if (!data.isSingleDay && data.endDate) { return data.endDate >= data.date; } return true; }, { message: "A data de término não pode ser anterior à data de início.", path: ["endDate"] });

const EVENT_CONFIG: Record<string, { bg: string, border: string, text: string, accent: string, icon: React.ReactNode }> = {
  "Assembleia": { bg: "bg-purple-100", border: "border-purple-200", text: "text-purple-700", accent: "bg-purple-500", icon: <HotelIcon className="h-4 w-4" /> },
  "Congresso": { bg: "bg-indigo-100", border: "border-indigo-200", text: "text-indigo-700", accent: "bg-indigo-500", icon: <StadiumIcon className="h-4 w-4" /> },
  "Visita do Superintendente": { bg: "bg-teal-100", border: "border-teal-200", text: "text-teal-700", accent: "bg-teal-500", icon: <BriefcaseIcon className="h-4 w-4" /> },
  "Celebração": { bg: "bg-rose-100", border: "border-rose-200", text: "text-rose-700", accent: "bg-rose-500", icon: <WineIcon className="h-4 w-4" /> },
  "Outro": { bg: "bg-amber-100", border: "border-amber-200", text: "text-amber-700", accent: "bg-amber-500", icon: <CalendarIcon className="h-4 w-4" /> },
};

export default function EventosPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [eventToDelete, setEventToDelete] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastClick, setLastClick] = useState<{ date: Date, time: number } | null>(null);
  const [activeDate, setActiveDate] = useState<Date | undefined>(undefined);
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);

  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  useEffect(() => {
    setActiveDate(new Date());
  }, []);

  const myCongQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'congregations'), where('authorizedUsers', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: myCongs, isLoading: isLoadingMyCong } = useCollection<any>(myCongQuery);
  const myCong = myCongs?.[0];

  const eventsQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'events'); }, [firestore, myCong?.id]);
  const talksQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'scheduledTalks'); }, [firestore, myCong?.id]);
  const speakersQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'speakers'); }, [firestore, myCong?.id]);

  const { data: events, isLoading: isLoadingEvents } = useCollection<any>(eventsQuery);
  const { data: talks } = useCollection<any>(talksQuery);
  const { data: speakers } = useCollection<any>(speakersQuery);

  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: '', description: '', date: undefined, endDate: undefined, type: 'Outro', isSingleDay: true },
  });

  const isSingleDay = form.watch('isSingleDay');
  const eventType = form.watch('type');
  const eventDate = form.watch('date');

  useEffect(() => {
    if (eventType === 'Visita do Superintendente' && eventDate) {
      const day = getDay(eventDate); 
      const sunday = new Date(eventDate); 
      const diffToSunday = day === 0 ? 0 : 7 - day;
      sunday.setDate(sunday.getDate() + diffToSunday); 
      const sundayAtStartOfDay = startOfDay(sunday);
      const tuesday = new Date(sundayAtStartOfDay); 
      tuesday.setDate(tuesday.getDate() - 5); 
      const finalTuesday = startOfDay(tuesday);
      
      const currentValues = form.getValues();
      if (!isSameDay(currentValues.date || new Date(0), finalTuesday)) {
        form.setValue('date', finalTuesday, { shouldDirty: true });
      }
      if (!isSameDay(currentValues.endDate || new Date(0), sundayAtStartOfDay)) {
        form.setValue('endDate', sundayAtStartOfDay, { shouldDirty: true });
      }
      if (currentValues.isSingleDay !== false) {
        form.setValue('isSingleDay', false, { shouldDirty: true });
      }
    }
  }, [eventType, eventDate, form]);

  const richDayInfo = useCallback((date: Date): CalendarDayState | undefined => {
    const d = startOfDay(date); 
    const talk = (talks || []).find((t: any) => isSameDay(startOfDay(new Date(t.dateTime)), d));
    if (talk) {
      const s = speakers?.find((sp: any) => sp.id === talk.speakerId);
      const isLocal = talk.congregationId === myCong?.id && s?.homeCongregationId === myCong?.id;
      const isReceiving = talk.congregationId === myCong?.id && !isLocal;
      const prefix = isLocal ? "Local" : isReceiving ? "Recebendo" : "Saindo";
      return { label: `${prefix}: ${s?.name || '---'} - ${talk.topic}`, isBlocked: true, type: isLocal ? 'local' : isReceiving ? 'receiving' : 'outgoing' };
    }
    const existing = (events || []).find((e: any) => { if (editingEvent && e.id === editingEvent.id) return false; const start = startOfDay(new Date(e.date)); const end = e.endDate ? startOfDay(new Date(e.endDate)) : start; return d >= start && d <= end; });
    if (existing) return { label: `Evento: ${existing.title || existing.type}`, isBlocked: true, type: existing.type.toLowerCase().includes('visita') ? 'visita' : existing.type.toLowerCase().includes('assembleia') ? 'assembleia' : 'outro' };
    return undefined;
  }, [events, talks, editingEvent, speakers, myCong]);

  const calendarFooter = useMemo(() => {
    const dateToShow = activeDate || new Date();
    const info = richDayInfo(dateToShow);

    return (
      <div className="p-3 border-t w-full animate-fade-in bg-muted/20">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5" />
            {format(dateToShow, "dd 'de' MMMM", { locale: ptBR })}
          </div>
          {!info && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">LIVRE</span>}
        </div>
        {!info ? (
          <div className="text-xs text-muted-foreground italic break-words whitespace-normal">Data livre.</div>
        ) : (
          <div className="space-y-1.5">
            {info.label.split(' | ').map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs leading-tight p-2 bg-background rounded-md border border-border/50 shadow-sm">
                <div className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0", (item.toLowerCase().includes('local') || item.toLowerCase().includes('recebendo') || item.toLowerCase().includes('saindo')) ? "bg-blue-500" : "bg-orange-500")} />
                <span className="font-medium break-words whitespace-normal flex-1 min-w-0">{item}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [activeDate, richDayInfo]);

  async function onAddSubmit(values: z.infer<typeof eventSchema>) {
    if (!firestore || !myCong) return; setIsLoading(true);
    const start = startOfDay(values.date); const end = values.isSingleDay ? start : startOfDay(values.endDate || values.date);
    const overlap = (events || []).some((e: any) => { const eS = startOfDay(new Date(e.date)); const eE = e.endDate ? startOfDay(new Date(e.endDate)) : eS; return start <= eE && end >= eS; });
    if (overlap) { toast({ variant: "destructive", title: "Conflito", description: "Já existe um evento cadastrado." }); setIsLoading(false); return; }
    const talkConf = (talks || []).some((t: any) => { const tD = startOfDay(new Date(t.dateTime)); return tD >= start && tD <= end; });
    if (talkConf) { toast({ variant: "destructive", title: "Conflito", description: "Existem discursos agendados. Remova-os primeiro." }); setIsLoading(false); return; }
    addDocumentNonBlocking(collection(firestore, 'congregations', myCong.id, 'events'), { title: values.title?.trim() || values.type, description: values.description || '', type: values.type, date: values.date.toISOString(), endDate: (!values.isSingleDay && values.endDate) ? values.endDate.toISOString() : null });
    toast({ title: 'Sucesso!' }); form.reset(); setIsAddDialogOpen(false); setIsLoading(false);
  }

  const handleUpdateEvent = async (values: any) => {
    if (!firestore || !myCong || !editingEvent) return;
    updateDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'events', editingEvent.id), { title: (values.title || values.type).trim(), description: values.description?.trim() || '', type: values.type, date: values.date.toISOString(), endDate: (!values.isSingleDay && values.endDate) ? values.endDate.toISOString() : null });
    toast({ title: "Sucesso!" }); setEditingEvent(null);
  };

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  if (isLoadingMyCong) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  if (!myCong) return <div className="p-20 text-center"><CalendarIcon className="mx-auto h-12 w-12 text-muted-foreground" /><h2 className="text-xl font-bold mt-4 font-headline">Configuração Necessária</h2><Link href="/setup"><Button type="button" className="mt-4 bg-primary text-primary-foreground">Configurar Agora</Button></Link></div>;

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl font-headline flex items-center gap-2"><CalendarDays className="h-6 w-6 text-primary" /> Eventos da Congregação</h1>
          <p className="text-muted-foreground text-sm">Gerencie compromissos especiais.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) form.reset(); }}>
          <DialogTrigger asChild><Button type="button" className="gap-2 bg-primary text-primary-foreground w-full md:w-fit h-11 font-bold"><PlusCircle className="h-4 w-4" /> Novo Evento</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[425px] w-[95vw] px-4 py-6 gap-4 max-h-[95vh] overflow-y-auto shadow-2xl border-none">
            <DialogHeader className="text-center">
              <DialogTitle className="text-2xl font-bold">Agendar Evento</DialogTitle>
              <DialogDescription>Cadastre eventos que bloqueiam o calendário.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-5 px-1">
                <FormField control={form.control} name="type" render={({ field }) => (<FormItem className="space-y-1.5"><FormLabel className="text-sm font-bold">Tipo</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-12 text-sm" type="button"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Assembleia">Assembleia</SelectItem><SelectItem value="Congresso">Congresso</SelectItem><SelectItem value="Visita do Superintendente">Visita do Superintendente</SelectItem><SelectItem value="Celebração">Celebração</SelectItem><SelectItem value="Outro">Outro</SelectItem></SelectContent></Select></FormItem>)} />
                <FormField control={form.control} name="title" render={({ field }) => (<FormItem className="space-y-1.5"><FormLabel className="text-sm font-bold">Título (Opcional)</FormLabel><FormControl><Input placeholder="Ex: Reunião especial" {...field} className="h-12 text-sm" /></FormControl></FormItem>)} />
                <FormField control={form.control} name="isSingleDay" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-4 bg-muted/5"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={eventType === 'Visita do Superintendente'} /></FormControl><div className="leading-none"><FormLabel className="text-sm font-bold cursor-pointer">Apenas um dia</FormLabel></div></FormItem>)} />
                
                <div className={cn("grid gap-4", !isSingleDay && "grid-cols-2")}>
                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem className="flex flex-col space-y-1.5">
                      <FormLabel className="text-sm font-bold">{isSingleDay ? "Data" : "Início"}</FormLabel>
                      <Dialog open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                        <Button 
                          type="button" 
                          variant="outline" 
                          className={cn("w-full pl-3 text-left font-normal h-12 text-sm", !field.value && "text-muted-foreground")} 
                          onClick={() => {
                            setActiveDate(field.value || new Date());
                            setIsStartDateOpen(true);
                          }}
                        >
                          {field.value ? format(field.value, "dd/MM/yyyy") : <span>Escolha</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                        <DialogContent className="sm:max-w-[425px] w-[95vw] p-0 border-none shadow-2xl overflow-hidden">
                          <DialogHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                            <DialogTitle className="text-sm font-bold">Selecionar Data</DialogTitle>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsStartDateOpen(false)}><X className="h-4 w-4" /></Button>
                          </DialogHeader>
                          <div className="flex flex-col items-center">
                            <UICalendar mode="single" selected={activeDate} onSelect={(d) => { if(d) { setActiveDate(d); if(lastClick && isSameDay(lastClick.date, d) && (Date.now()-lastClick.time) < 300) { if(!richDayInfo(d)?.isBlocked) field.onChange(d); setIsStartDateOpen(false); } setLastClick({date:d, time:Date.now()}); } }} initialFocus locale={ptBR} getDayInfo={richDayInfo} />
                            {calendarFooter}
                            <div className="p-3 pt-0 w-full bg-muted/20">
                              <Button 
                                type="button" 
                                className="w-full h-11 font-bold bg-primary text-white" 
                                disabled={!activeDate}
                                onClick={() => {
                                  if (activeDate) {
                                    if (!richDayInfo(activeDate)?.isBlocked) {
                                      field.onChange(activeDate);
                                      setIsStartDateOpen(false);
                                    } else {
                                      toast({ variant: "destructive", title: "Conflito", description: "Esta data já está ocupada." });
                                    }
                                  }
                                }}
                              >
                                Definir Data
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </FormItem>
                  )} />
                  {!isSingleDay && (
                    <FormField control={form.control} name="endDate" render={({ field }) => (
                      <FormItem className="flex flex-col space-y-1.5">
                        <FormLabel className="text-sm font-bold">Término</FormLabel>
                        <Dialog open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                          <Button 
                            type="button" 
                            variant="outline" 
                            className={cn("w-full pl-3 text-left font-normal h-12 text-sm", eventType === 'Visita do Superintendente' && "opacity-70")} 
                            disabled={eventType === 'Visita do Superintendente'} 
                            onClick={() => {
                              setActiveDate(field.value || new Date());
                              setIsEndDateOpen(true);
                            }}
                          >
                            {field.value ? format(field.value, "dd/MM/yyyy") : <span>Escolha</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                          <DialogContent className="sm:max-w-[425px] w-[95vw] p-0 border-none shadow-2xl overflow-hidden">
                            <DialogHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                              <DialogTitle className="text-sm font-bold">Selecionar Data de Término</DialogTitle>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEndDateOpen(false)}><X className="h-4 w-4" /></Button>
                            </DialogHeader>
                            <div className="flex flex-col items-center">
                              <UICalendar mode="single" selected={activeDate} onSelect={(d) => { if(d) { setActiveDate(d); if(lastClick && isSameDay(lastClick.date, d) && (Date.now()-lastClick.time) < 300) { if(!richDayInfo(d)?.isBlocked) field.onChange(d); setIsEndDateOpen(false); } setLastClick({date:d, time:Date.now()}); } }} initialFocus locale={ptBR} getDayInfo={richDayInfo} />
                              {calendarFooter}
                              <div className="p-3 pt-0 w-full bg-muted/20">
                                <Button 
                                  type="button" 
                                  className="w-full h-11 font-bold bg-primary text-white" 
                                  disabled={!activeDate}
                                  onClick={() => {
                                    if (activeDate) {
                                      if (!richDayInfo(activeDate)?.isBlocked) {
                                        field.onChange(activeDate);
                                        setIsEndDateOpen(false);
                                      } else {
                                        toast({ variant: "destructive", title: "Conflito", description: "Esta data já está ocupada." });
                                      }
                                    }
                                  }}
                                >
                                  Definir Data
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </FormItem>
                    )} />
                  )}
                </div>
                <div className="flex gap-3 pt-4"><Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1 h-12 font-bold">Cancelar</Button><Button type="submit" className="flex-1 bg-primary text-primary-foreground h-12 font-bold" disabled={isLoading}>{isLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : 'Salvar'}</Button></div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-4">{isLoadingEvents ? (<div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event: any) => {
              const config = EVENT_CONFIG[event.type] || EVENT_CONFIG["Outro"];
              return (<Card key={event.id} className="border-none shadow-sm relative overflow-hidden group"><div className={cn("absolute left-0 top-0 w-1.5 h-full", config.accent)} /><div className="absolute bottom-2 right-2 flex gap-1 z-10"><Button type="button" variant="ghost" size="icon" className="h-8 w-8 bg-background/50 backdrop-blur-sm border shadow-sm" onClick={() => setEditingEvent({ ...event, dateObj: new Date(event.date), endDateObj: event.endDate ? new Date(event.endDate) : null })}><Edit className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive bg-background/50 backdrop-blur-sm border shadow-sm" onClick={() => setEventToDelete(event)}><Trash2 className="h-4 w-4" /></Button></div>
                  <CardHeader className="pb-2 pr-20"><div className="flex items-center gap-2 mb-1"><Badge variant="outline" className={cn("text-[10px] uppercase font-bold gap-1.5", config.text, "border-current bg-white/50")}>{config.icon}{event.type}</Badge></div><CardTitle className="text-base font-headline pt-1">{event.title}</CardTitle></CardHeader>
                  <CardContent className="pb-4 text-sm space-y-2"><div className="flex items-center gap-1.5 text-xs font-semibold text-primary"><CalendarDays className="h-3.5 w-3.5" /><span>{event.endDate && !isSameDay(new Date(event.date), new Date(event.endDate)) ? `${format(new Date(event.date), "dd/MM")} - ${format(new Date(event.endDate), "dd/MM/yyyy")}` : format(new Date(event.date), "dd/MM/yyyy")}</span></div>{event.description && (<p className="text-muted-foreground line-clamp-2 text-xs italic">{event.description}</p>)}</CardContent></Card>);
            })}
          </div>
        )}
      </div>
      <EditEventDialog open={!!editingEvent} onOpenChange={(o) => !o && setEditingEvent(null)} event={editingEvent} getDayInfo={richDayInfo} onSave={handleUpdateEvent} talks={talks} events={events} speakers={speakers} />
      <AlertDialog open={!!eventToDelete} onOpenChange={(o) => !o && setEventToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Evento?</AlertDialogTitle><AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setEventToDelete(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (!firestore || !myCong || !eventToDelete) return; deleteDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'events', eventToDelete.id)); setEventToDelete(null); }} className="bg-destructive text-white hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
