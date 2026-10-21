'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, startOfDay, addDays, isSameDay, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Loader2, 
  Trash2, 
  Edit, 
  Clock, 
  CalendarCheck,
  Search,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Filter,
  History as HistoryIcon,
  User,
  List,
  Calendar as CalendarIcon
} from 'lucide-react';

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Congregation, Speaker, EnrichedSpeech, EnrichedEvent } from '@/lib/data';
import { EditTalkDialog } from '@/components/edit-talk-dialog';
import { EditEventDialog } from '@/components/edit-event-dialog';
import { Calendar as UICalendar, type CalendarDayState } from '@/components/ui/calendar';
import { HouseRoofIcon, HotelIcon, StadiumIcon, BriefcaseIcon, WineIcon } from '@/components/icons';

const EVENT_CONFIG: Record<string, { bg: string, border: string, text: string, accent: string, icon: React.ReactNode }> = {
  "Assembleia": { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", accent: "bg-purple-500", icon: <HotelIcon className="h-4 w-4" /> },
  "Congresso": { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", accent: "bg-indigo-500", icon: <StadiumIcon className="h-4 w-4" /> },
  "Visita do Superintendente": { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", accent: "bg-teal-500", icon: <BriefcaseIcon className="h-4 w-4" /> },
  "Celebração": { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", accent: "bg-rose-500", icon: <WineIcon className="h-4 w-4" /> },
  "Outro": { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", accent: "bg-amber-500", icon: <CalendarIcon className="h-4 w-4" /> },
};

function getMeetingTime(schedule: string): { h: number, m: number } {
  try {
    const timePart = schedule.split(',')[1]?.trim();
    if (!timePart) return { h: 0, m: 0 };
    const [h, m] = timePart.split(':').map(Number);
    return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
  } catch { return { h: 0, m: 0 }; }
}

function TalkCard({ item, onEdit, onDelete, onNotify }: { 
  item: EnrichedSpeech, 
  onEdit: (s: EnrichedSpeech) => void, 
  onDelete: (s: EnrichedSpeech) => void,
  onNotify: (s: EnrichedSpeech) => void
}) {
  const isPast = startOfDay(item.dateObj) < startOfDay(new Date());
  
  return (
    <Card className={cn("relative flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-all border-none", isPast && "opacity-60")}>
      <div className={cn("absolute left-0 top-0 w-1.5 h-full", item.isReceiving ? "bg-blue-600" : item.isLocal ? "bg-indigo-700" : "bg-orange-500")} />
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/50 backdrop-blur-sm border shadow-sm" onClick={() => onEdit(item)}><Edit className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive bg-background/50 backdrop-blur-sm border shadow-sm" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <CardHeader className="pb-2 space-y-2 pr-20">
        <div className="flex justify-between items-center mb-1">
          {item.isLocal ? (<Badge className="bg-indigo-700 hover:bg-indigo-800 gap-1.5 uppercase font-bold text-[10px]"><ArrowDown className="h-3.5 w-3.5" /> LOCAL</Badge>) : (<Badge variant={item.isReceiving ? "default" : "outline"} className={cn("gap-1.5 font-bold text-[10px]", item.isReceiving ? "bg-blue-600" : "border-orange-500 text-orange-600")}>{item.isReceiving ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}{item.isReceiving ? "RECEBENDO" : "SAINDO"}</Badge>)}
        </div>
        <CardDescription className="font-bold text-[10px] uppercase text-muted-foreground">{format(item.dateObj, "EEEE, dd 'de' MMMM", { locale: ptBR })}</CardDescription>
        <CardTitle className="text-base leading-tight font-headline font-bold break-words whitespace-normal">{item.topic}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 text-sm space-y-2 pt-2 border-t mt-2">
        <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> <span className="font-bold text-foreground">{format(item.dateObj, 'HH:mm')}</span></div>
        <div className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" /> <span>{item.speaker?.name || 'Não definido'}</span></div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <HouseRoofIcon className="h-4 w-4 text-primary" /> 
          <span className="font-medium truncate">{item.isReceiving ? (item.originName || 'Vindo de fora') : (item.congregation?.name || '---')}</span>
        </div>
      </CardContent>
      <CardFooter className="pt-2 border-t bg-muted/5 p-4"><Button variant="outline" size="sm" className="w-full gap-2 h-9 text-xs font-bold bg-accent text-accent-foreground border-none hover:bg-accent/80" onClick={() => onNotify(item)}><MessageSquare className="h-3.5 w-3.5" /> Notificar Orador</Button></CardFooter>
    </Card>
  );
}

function EventCard({ item, onEdit, onDelete }: { item: EnrichedEvent, onEdit: (e: EnrichedEvent) => void, onDelete: (e: EnrichedEvent) => void }) {
  const config = EVENT_CONFIG[item.type] || EVENT_CONFIG["Outro"];
  const isPast = startOfDay(item.endDateObj || item.dateObj) < startOfDay(new Date());
  return (
    <Card className={cn("relative overflow-hidden shadow-sm border-none transition-opacity", config.bg, isPast && "opacity-60")}>
      <div className={cn("absolute left-0 top-0 w-1.5 h-full", config.accent)} />
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/50 backdrop-blur-sm border shadow-sm" onClick={() => onEdit(item)}><Edit className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive bg-white/50 backdrop-blur-sm border shadow-sm" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <CardHeader className="pb-2 space-y-2 pr-20">
        <div className="flex items-center gap-2"><Badge variant="secondary" className={cn("font-bold uppercase tracking-tight w-fit text-[10px] gap-1.5", config.text, "bg-white/50 border-current")}>{config.icon}{item.type}</Badge></div>
        <CardDescription className="font-bold text-[10px] uppercase text-muted-foreground">{item.endDateObj && !isSameDay(item.dateObj, item.endDateObj) ? `${format(item.dateObj, "dd/MM")} - ${format(item.endDateObj, "dd/MM/yyyy")}` : format(item.dateObj, "EEEE, dd/MM/yyyy", { locale: ptBR })}</CardDescription>
        <CardTitle className={cn("text-lg font-headline font-bold", config.text)}>{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm pt-0">{item.description && <p className="text-muted-foreground line-clamp-2 italic">{item.description}</p>}</CardContent>
    </Card>
  );
}

export default function Home() {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showPast, setShowPast] = useState(false);
  const [editingSpeech, setEditingSpeech] = useState<EnrichedSpeech | null>(null);
  const [talkToDelete, setTalkToDelete] = useState<EnrichedSpeech | null>(null);
  const [editingEventItem, setEditingEventItem] = useState<EnrichedEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<EnrichedEvent | null>(null);
  
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(undefined);
  const [activeDate, setActiveDate] = useState<Date | undefined>(undefined);

  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => { if (!isUserLoading && !user) router.push('/login'); }, [user, isUserLoading, router]);

  useEffect(() => {
    setSelectedCalendarDate(new Date());
    setActiveDate(new Date());
  }, []);

  const myCongQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'congregations'), where('authorizedUsers', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: myCongs, isLoading: isLoadingMyCong } = useCollection<Congregation>(myCongQuery);
  const myCong = myCongs?.[0];

  const neighborsQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'neighbors'); }, [firestore, myCong?.id]);
  const talksQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'scheduledTalks'); }, [firestore, myCong?.id]);
  const eventsQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'events'); }, [firestore, myCong?.id]);
  const speakersQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'speakers'); }, [firestore, myCong?.id]);

  const { data: speakersData } = useCollection<Speaker>(speakersQuery);
  const { data: neighborsData } = useCollection<Congregation>(neighborsQuery);
  const { data: talksData, isLoading: isLoadingTalks } = useCollection<any>(talksQuery);
  const { data: eventsData } = useCollection<any>(eventsQuery);

  const neighborsMap = useMemo(() => {
    const map: Record<string, Congregation> = {};
    (neighborsData || []).forEach(n => { map[n.id] = n; });
    if (myCong) map[myCong.id] = myCong;
    return map;
  }, [neighborsData, myCong]);

  const speakersMap = useMemo(() => {
    const map: Record<string, Speaker> = {};
    (speakersData || []).forEach(s => { map[s.id] = s; });
    return map;
  }, [speakersData]);

  const combinedItems = useMemo(() => {
    if (!talksData || !myCong) return [];
    const enrichedTalks: EnrichedSpeech[] = (talksData || []).map((talk: any) => {
      const dateObj = new Date(talk.dateTime);
      const speaker = speakersMap[talk.speakerId];
      const isLocal = talk.congregationId === myCong.id && speaker?.homeCongregationId === myCong.id;
      const isReceiving = talk.congregationId === myCong.id && !isLocal;
      const congregation = (talk.congregationId === myCong.id) ? myCong : neighborsMap[talk.congregationId];
      let originName = ''; if (isReceiving && speaker?.homeCongregationId) originName = neighborsMap[speaker.homeCongregationId]?.name || 'Congregação Vizinha';
      return { ...talk, itemType: 'talk' as const, speaker, congregation, dateObj, isReceiving, isLocal, originName };
    });
    const enrichedEvents: EnrichedEvent[] = (eventsData || []).map((event: any) => ({ ...event, itemType: 'event' as const, dateObj: new Date(event.date), endDateObj: event.endDate ? new Date(event.endDate) : null }));
    return [...enrichedTalks, ...enrichedEvents].sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [talksData, eventsData, speakersMap, neighborsMap, myCong]);

  const filteredItems = useMemo(() => {
    const queryStr = searchQuery.trim().toLowerCase();
    const today = startOfDay(new Date());
    
    const monthsBefore = myCong?.settings?.monthsBefore || 6;
    const limitBefore = subMonths(today, monthsBefore);

    return (combinedItems || []).filter(item => {
      const itemEndDate = item.itemType === 'event' ? (item.endDateObj || item.dateObj) : item.dateObj;
      const itemDateOnly = startOfDay(itemEndDate);
      
      if (!showPast) { 
        if (itemDateOnly < today) return false; 
      } else { 
        if (itemDateOnly >= today || itemDateOnly < limitBefore) return false; 
      }

      const matchesFilter = filterType === 'all' || (item.itemType === 'event' && filterType === 'events') || (item.itemType === 'talk' && ((filterType === 'receiving' && item.isReceiving) || (filterType === 'outgoing' && !item.isReceiving && !item.isLocal) || (filterType === 'local' && item.isLocal)));
      const matchesSearch = !queryStr || (item.itemType === 'talk' ? ((item.speaker?.name.toLowerCase() || '').includes(queryStr) || item.topic.toLowerCase().includes(queryStr)) : (item.title.toLowerCase().includes(queryStr) || (item.type || '').toLowerCase().includes(queryStr)));
      return matchesFilter && matchesSearch;
    });
  }, [combinedItems, searchQuery, filterType, showPast, myCong]);

  const calendarDayMap = useMemo(() => {
    const dayMap = new Map<string, CalendarDayState>();
    if (!myCong) return dayMap;
    (talksData || []).forEach((t: any) => {
      const d = startOfDay(new Date(t.dateTime)); const key = format(d, 'yyyy-MM-dd');
      const speaker = speakersMap[t.speakerId]; const isLocal = t.congregationId === myCong.id && speaker?.homeCongregationId === myCong.id;
      const isReceiving = t.congregationId === myCong.id && !isLocal;
      const labelPrefix = isLocal ? "Local" : isReceiving ? "Recebendo" : "Saindo";
      const info: CalendarDayState = { label: `${labelPrefix}: ${speaker?.name || '---'} - ${t.topic}`, type: isLocal ? 'local' : isReceiving ? 'receiving' : 'outgoing', isBlocked: true };
      const existing = dayMap.get(key); if (existing) dayMap.set(key, { ...existing, label: `${existing.label} | ${info.label}` }); else dayMap.set(key, info);
    });
    (eventsData || []).forEach((e: any) => {
      const start = startOfDay(new Date(e.date)); const end = e.endDate ? startOfDay(new Date(e.endDate)) : start;
      let curr = start; while (curr <= end) {
        const key = format(curr, 'yyyy-MM-dd'); const info: CalendarDayState = { label: `Evento: ${e.title || e.type}`, type: e.type === 'Assembleia' ? 'assembleia' : e.type === 'Congresso' ? 'congresso' : e.type === 'Visita do Superintendente' ? 'visita' : e.type === 'Celebração' ? 'celebracao' : 'outro', isBlocked: true };
        const existing = dayMap.get(key); if (existing) dayMap.set(key, { ...existing, label: `${existing.label} | ${info.label}` }); else dayMap.set(key, info);
        curr = addDays(curr, 1);
      }
    });
    return dayMap;
  }, [talksData, eventsData, speakersMap, myCong]);

  const getDayInfo = useCallback((date: Date): CalendarDayState | undefined => calendarDayMap.get(format(startOfDay(date), 'yyyy-MM-dd')), [calendarDayMap]);

  const handleNotifySpeaker = (speech: EnrichedSpeech) => {
    const dateFormatted = format(speech.dateObj, "dd/MM/yyyy"); const weekDay = format(speech.dateObj, "eeee", { locale: ptBR }).toLowerCase(); const timeFormatted = format(speech.dateObj, "HH:mm");
    const msg = `Olá, irmão *${speech.speaker?.name || 'Orador'}*!\n\nConfirmando seu discurso público:\n\n📅 *Data*: ${dateFormatted} (${weekDay})\n⏰ *Horário*: ${timeFormatted}\n👤 *Orador*: ${speech.speaker?.name || 'Orador'}\n📚 *Tema*: ${speech.topic}\n🏛️ *Congregação*: ${speech.congregation?.name || '---'}\n📍 *Endereço*: ${speech.congregation?.address || '---'}${speech.congregation?.coordinates ? `\n🗺️ *Localização*: https://www.google.com/maps/search/?api=1&query=${speech.congregation.coordinates.trim().replace(/\s+/g, ',')}` : `\n🗺️ *Localização*: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(speech.congregation?.address || '')}`}`;
    let phone = (speech.speaker?.phoneNumber || '').replace(/\D/g, ''); if (phone.length >= 10 && !phone.startsWith('55')) phone = `55${phone}`;
    window.open(phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleUpdateTalk = async (topic: string, date: Date, congregationId: string) => {
    if (!firestore || !myCong || !editingSpeech) return; const targetCong = neighborsMap[congregationId]; const { h, m } = getMeetingTime(targetCong?.meetingSchedule || ''); const newDate = new Date(date); newDate.setHours(h, m);
    updateDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'scheduledTalks', editingSpeech.id), { topic: topic.trim(), dateTime: newDate.toISOString(), congregationId });
    toast({ title: "Atualizado!" }); setEditingSpeech(null);
  };

  const handleUpdateEvent = async (values: any) => {
    if (!firestore || !myCong || !editingEventItem) return; updateDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'events', editingEventItem.id), { title: (values.title || values.type).trim(), description: values.description?.trim() || '', type: values.type, date: values.date.toISOString(), endDate: (!values.isSingleDay && values.endDate) ? values.endDate.toISOString() : null });
    toast({ title: "Atualizado!" }); setEditingEventItem(null);
  };

  const calendarFooter = useMemo(() => {
    const dateToShow = activeDate || selectedCalendarDate || new Date();
    const info = getDayInfo(dateToShow);
    const today = startOfDay(new Date());
    const isDateToday = isSameDay(dateToShow, today);

    return (
      <div className="p-3 border-t w-full animate-fade-in bg-muted/20 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5" />
            {format(dateToShow, "dd 'de' MMMM", { locale: ptBR })}
            {isDateToday && <span className="text-primary ml-1">(HOJE)</span>}
          </div>
          {!info && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">LIVRE</span>}
        </div>
        {!info ? (
          <p className="text-xs text-muted-foreground italic break-words whitespace-normal">Data livre.</p>
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
  }, [activeDate, selectedCalendarDate, getDayInfo]);

  if (isUserLoading || !user || isLoadingMyCong) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!myCong) return <div className="p-20 text-center"><HistoryIcon className="mx-auto h-12 w-12 text-muted-foreground" /><h2 className="text-xl font-bold mt-4 font-headline">Configuração Necessária</h2><Link href="/setup"><Button className="mt-4 bg-primary text-primary-foreground">Configurar Agora</Button></Link></div>;

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto w-full">
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 font-headline">
            <CalendarCheck className="h-6 w-6 text-primary" /> Calendário Geral
          </h1>
          <TabsList className="grid grid-cols-2 w-full md:w-[240px] h-10">
            <TabsTrigger value="list" className="gap-2"><List className="h-4 w-4" /> Lista</TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2"><CalendarIcon className="h-4 w-4" /> Calendário</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="list" className="mt-0 space-y-6">
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input type="search" placeholder="Pesquisar..." className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-10 w-40">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Tipo" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="receiving">Recebendo</SelectItem>
                  <SelectItem value="outgoing">Saindo</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="events">Eventos</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center space-x-2 bg-muted/50 px-3 py-2 rounded-md border h-10">
                <Checkbox id="show-past" checked={showPast} onCheckedChange={(v) => setShowPast(!!v)} />
                <Label htmlFor="show-past" className="text-[10px] font-bold uppercase cursor-pointer flex items-center gap-1">
                  <HistoryIcon className="h-3.5 w-3.5" /> Passados ({myCong?.settings?.monthsBefore || 6} meses)
                </Label>
              </div>
            </div>
          </div>
          {(isLoadingTalks) ? (<div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>) : (<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filteredItems.map(item => (item.itemType === 'event' ? <EventCard key={item.id} item={item as EnrichedEvent} onEdit={setEditingEventItem} onDelete={setEventToDelete} /> : <TalkCard key={item.id} item={item as EnrichedSpeech} onEdit={setEditingSpeech} onDelete={setTalkToDelete} onNotify={handleNotifySpeaker} />))}{filteredItems.length === 0 && (<div className="col-span-full py-20 text-center border-2 border-dashed rounded-lg text-muted-foreground">Nenhum registro encontrado.</div>)}</div>)}
        </TabsContent>
        <TabsContent value="calendar" className="mt-0 space-y-4">
          <Card className="p-4 border shadow-sm bg-card overflow-hidden">
            <div className="flex flex-col items-center">
              <UICalendar 
                mode="single" 
                selected={selectedCalendarDate} 
                onSelect={(d) => { setSelectedCalendarDate(d); if(d) setActiveDate(d); }} 
                className="w-full flex justify-center" 
                locale={ptBR} 
                getDayInfo={getDayInfo} 
                defaultMonth={selectedCalendarDate || new Date()} 
              />
            </div>
          </Card>
          {calendarFooter}
        </TabsContent>
      </Tabs>
      {myCong && (<>
        <EditTalkDialog 
          open={!!editingSpeech} 
          onOpenChange={(o) => !o && setEditingSpeech(null)} 
          speech={editingSpeech} 
          neighborsMap={neighborsMap} 
          getDayInfo={getDayInfo} 
          onSave={handleUpdateTalk} 
          talks={talksData} 
          events={eventsData} 
          myCongId={myCong.id}
          myCongSettings={myCong.settings}
          allSpeakers={speakersData}
        />
        <EditEventDialog open={!!editingEventItem} onOpenChange={(o) => !o && setEditingEventItem(null)} event={editingEventItem} getDayInfo={getDayInfo} onSave={handleUpdateEvent} talks={talksData} events={eventsData} />
      </>)}
      <AlertDialog open={!!talkToDelete} onOpenChange={(o) => !o && setTalkToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover Agendamento?</AlertDialogTitle><AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setTalkToDelete(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (talkToDelete && myCong) { deleteDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'scheduledTalks', talkToDelete.id)); setTalkToDelete(null); } }} className="bg-destructive text-white hover:bg-destructive/90">Remover</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!eventToDelete} onOpenChange={(o) => !o && setEventToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Evento?</AlertDialogTitle><AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita. O calendário voltará a ficar livre nestas datas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setEventToDelete(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (eventToDelete && myCong) { deleteDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'events', eventToDelete.id)); setEventToDelete(null); } }} className="bg-destructive text-white hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
