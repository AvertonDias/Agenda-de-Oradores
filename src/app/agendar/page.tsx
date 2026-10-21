'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  AlertDialogCancel,
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar as UICalendar, type CalendarDayState } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  ArrowRight, 
  CalendarIcon, 
  ChevronsUpDown,
  Search,
  Star,
  AlertTriangle,
  Loader2,
  Check,
  Info,
  UserPlus,
  Contact,
  X,
  Phone,
  ShieldAlert,
  Building2,
  Lock,
  Unlock
} from 'lucide-react';
import { cn, formatPhoneNumber, cleanRawNumber } from '@/lib/utils';
import { HouseRoofIcon } from '@/components/icons';
import { format, startOfDay, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Congregation, Speaker, ScheduledTalk } from '@/lib/data';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import Link from 'next/link';
import { talkTopics } from '@/lib/talk-topics';

const formSchema = z.object({
  hostCongregationId: z.string().min(1, 'Selecione a congregação onde será o discurso.'),
  originCongregationId: z.string().min(1, 'Selecione a congregação de origem do orador.'),
  speakerId: z.string().min(1, 'Selecione o orador.'),
  topic: z.string().min(1, 'Selecione ou digite o tema do discurso.'),
  date: z.date(),
  time: z.string().min(1, 'O horário é obrigatório.'),
});

const speakerFormSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.'),
  phone: z.string().optional(),
});

const HighlightedText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const safeHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safeHighlight})`, "gi"));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() 
          ? (<mark key={i} className="bg-primary/20 text-primary font-bold rounded-sm px-0.5">{part}</mark>) 
          : (part)
      )}
    </span>
  );
};

const isMeetingDay = (date: Date, cong: Congregation | null) => {
  if (!cong || !cong.meetingSchedule) return true;
  const schedule = cong.meetingSchedule.toLowerCase();
  const day = date.getDay();
  const dayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const hasAccentlessSabado = day === 6 && (schedule.includes('sabado') || schedule.includes('sábado'));
  return schedule.includes(dayNames[day]) || hasAccentlessSabado;
};

const SearchableCongregationSelect = ({
  value,
  onChange,
  label,
  congregations,
  isLocked,
  onToggleLock,
  myCongId,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  congregations: Congregation[];
  isLocked: boolean;
  onToggleLock: () => void;
  myCongId?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCong = congregations.find(c => c.id === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!q) return congregations;
    return congregations.filter(c => {
      const name = (c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const schedule = (c.meetingSchedule || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const addr = (c.address || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return name.includes(q) || schedule.includes(q) || addr.includes(q);
    });
  }, [congregations, search]);

  return (
    <FormItem className="flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <FormLabel className="font-bold">{label}</FormLabel>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-2.5 text-xs font-bold gap-1.5 rounded-full transition-all border",
            isLocked
              ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 shadow-xs"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          onClick={onToggleLock}
          title={isLocked ? "Congregação travada (não limpa após agendar). Clique para destravar." : "Travar esta congregação para os próximos agendamentos"}
        >
          {isLocked ? (
            <>
              <Lock className="h-3.5 w-3.5 text-amber-700" />
              <span>Travada</span>
            </>
          ) : (
            <>
              <Unlock className="h-3.5 w-3.5 opacity-60" />
              <span>Travar</span>
            </>
          )}
        </Button>
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={isOpen}
              className={cn(
                "w-full justify-between font-normal h-11 px-3 bg-background transition-colors",
                !value && "text-muted-foreground",
                isLocked && "border-amber-400 bg-amber-50/20"
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 text-left">
                <Building2 className={cn("h-4 w-4 shrink-0", isLocked ? "text-amber-600" : "text-primary opacity-70")} />
                <span className="truncate font-semibold text-foreground text-sm">
                  {selectedCong ? (
                    <>
                      {selectedCong.name}
                      {selectedCong.id === myCongId ? ' (Minha)' : ''}
                    </>
                  ) : (
                    "Selecione a congregação"
                  )}
                </span>
                {isLocked && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-800 border-amber-300 font-bold shrink-0 ml-1">
                    <Lock className="h-2.5 w-2.5 mr-0.5" /> Fixada
                  </Badge>
                )}
              </div>
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent
          className="z-[110] w-[var(--radix-popover-trigger-width)] min-w-[290px] p-0 shadow-2xl max-w-[95vw] overflow-hidden"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center px-3 border-b bg-muted/20">
            <Search className="mr-2 h-4 w-4 opacity-50 shrink-0" />
            <Input
              placeholder="Buscar por nome ou dia da reunião..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-none focus-visible:ring-0 shadow-none h-10 text-sm bg-transparent"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setSearch('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="px-3 py-1.5 border-b bg-muted/10 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>{filtered.length} congregação(ões)</span>
            {isLocked && (
              <span className="text-amber-700 font-bold flex items-center gap-1 text-[10px]">
                <Lock className="h-3 w-3" /> Modo fixado ativo
              </span>
            )}
          </div>

          <ScrollArea className="h-64 p-1">
            <div className="space-y-1">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground italic">
                  Nenhuma congregação encontrada para "{search}".
                </div>
              ) : (
                filtered.map(c => {
                  const isSelected = c.id === value;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted text-sm transition-colors flex items-center justify-between gap-2",
                        isSelected ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"
                      )}
                      onClick={() => {
                        onChange(c.id);
                        setIsOpen(false);
                        setSearch('');
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs leading-tight text-foreground flex items-center gap-1.5">
                          <HighlightedText text={c.name} highlight={search} />
                          {c.id === myCongId && (
                            <span className="text-[10px] text-muted-foreground font-normal">(Minha)</span>
                          )}
                        </div>
                        {c.meetingSchedule && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            🗓 {c.meetingSchedule}
                          </div>
                        )}
                      </div>
                      <Check className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100 text-primary" : "opacity-0")} />
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  );
};

export default function AgendarPage() {
  const [activeTab, setActiveTab] = useState('receber');
  const [isLoading, setIsLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');
  const [isTopicPopOpen, setIsTopicPopOpen] = useState(false);
  const [topicTab, setTopicTab] = useState('esboços');
  const [pendingValues, setPendingValues] = useState<z.infer<typeof formSchema> | null>(null);
  const [pendingTopicToAdd, setPendingTopicToAdd] = useState<string | null>(null);
  const [isConfirmPastOpen, setIsConfirmPastOpen] = useState(false);
  const [isAddToRepertoireOpen, setIsAddToRepertoireOpen] = useState(false);
  const [lastClick, setLastClick] = useState<{ date: Date, time: number } | null>(null);
  const [activeDate, setActiveDate] = useState<Date | undefined>(undefined);
  const [contactChoice, setContactChoice] = useState<{ name: string, numbers: string[] } | null>(null);

  const [isNewSpeakerDialogOpen, setIsNewSpeakerDialogOpen] = useState(false);
  const [isSavingNewSpeaker, setIsSavingNewSpeaker] = useState(false);
  const [notifyAfterSave, setNotifyAfterSave] = useState<{
    speaker: Speaker;
    topic: string;
    dateObj: Date;
    congregation: Congregation;
  } | null>(null);

  const [isCongLocked, setIsCongLocked] = useState(false);
  const [lockedCongId, setLockedCongId] = useState<string | null>(null);

  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { hostCongregationId: '', originCongregationId: '', speakerId: '', topic: '', time: '' }
  });

  const speakerForm = useForm<z.infer<typeof speakerFormSchema>>({
    resolver: zodResolver(speakerFormSchema),
    defaultValues: { name: '', phone: '' }
  });

  useEffect(() => {
    setActiveDate(new Date());
  }, []);

  const myCongQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'congregations'), where('authorizedUsers', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: myCongs } = useCollection<Congregation>(myCongQuery);
  const myCong = myCongs?.[0];

  const neighborsQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'neighbors'); }, [firestore, myCong?.id]);
  const speakersQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'speakers'); }, [firestore, myCong?.id]);
  const talksQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'scheduledTalks'); }, [firestore, myCong?.id]);
  const eventsQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'events'); }, [firestore, myCong?.id]);

  const { data: neighbors } = useCollection<Congregation>(neighborsQuery);
  const { data: speakers } = useCollection<Speaker>(speakersQuery);
  const { data: talks } = useCollection<ScheduledTalk>(talksQuery);
  const { data: events } = useCollection<any>(eventsQuery);

  const neighborsMap = useMemo(() => {
    const map: Record<string, Congregation> = {};
    (neighbors || []).forEach(n => { map[n.id] = n; });
    if (myCong) map[myCong.id] = myCong;
    return map;
  }, [neighbors, myCong]);

  const sortedNeighbors = useMemo(() => {
    if (!neighbors) return [];
    return [...neighbors].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [neighbors]);

  const toggleCongLock = (currentValue: string) => {
    if (!currentValue) {
      toast({
        variant: "default",
        title: "Selecione uma congregação",
        description: "Escolha uma congregação antes de ativar a trava.",
      });
      return;
    }

    if (isCongLocked && lockedCongId === currentValue) {
      setIsCongLocked(false);
      setLockedCongId(null);
      toast({
        title: "Congregação destravada",
        description: "O campo voltará ao comportamento padrão após agendar.",
      });
    } else {
      setIsCongLocked(true);
      setLockedCongId(currentValue);
      const name = neighborsMap[currentValue]?.name || 'Congregação';
      toast({
        title: "Congregação travada!",
        description: `${name} continuará selecionada nos próximos agendamentos.`,
      });
    }
  };

  useEffect(() => {
    if (activeTab === 'receber' && myCong) {
      const originId = isCongLocked && lockedCongId ? lockedCongId : '';
      form.reset({ hostCongregationId: myCong.id, originCongregationId: originId, speakerId: '', topic: '', time: '' });
    } else if (activeTab === 'saindo' && myCong) {
      const hostId = isCongLocked && lockedCongId ? lockedCongId : '';
      form.reset({ originCongregationId: myCong.id, hostCongregationId: hostId, speakerId: '', topic: '', time: '' });
    }
  }, [activeTab, myCong]);

  const filteredSpeakers = useMemo(() => {
    let list = (speakers || []).filter(s => s.homeCongregationId === form.watch('originCongregationId'));
    if (activeTab === 'saindo') {
      list = list.filter(s => !s.onlyLocal);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [speakers, form.watch('originCongregationId'), activeTab]);
  
  const currentSpeaker = useMemo(() => {
    return speakers?.find(s => s.id === form.watch('speakerId'));
  }, [speakers, form.watch('speakerId')]);

  const speakerConflict = useMemo(() => {
    const sId = form.watch('speakerId');
    const date = form.watch('date');
    if (!sId || !date || !talks) return null;
    const d = startOfDay(date);
    const existingTalk = talks.find(t => {
      const isSameSpeaker = t.speakerId === sId;
      const isSameDayVal = isSameDay(startOfDay(new Date(t.dateTime)), d);
      return isSameSpeaker && isSameDayVal;
    });
    if (existingTalk) {
      const destCongName = neighborsMap[existingTalk.congregationId]?.name || myCong?.name || 'outra congregação';
      return `Atenção: Este orador já tem um discurso agendado para este dia em: ${destCongName}.`;
    }
    return null;
  }, [form.watch('speakerId'), form.watch('date'), talks, neighborsMap, myCong]);

  const hostCong = useMemo(() => {
    const targetId = activeTab === 'receber' ? myCong?.id : form.watch('hostCongregationId');
    if (!targetId) return null;
    if (targetId === myCong?.id) return myCong;
    return neighborsMap[targetId] || null;
  }, [activeTab, myCong, neighborsMap, form.watch('hostCongregationId')]);

  useEffect(() => {
    if (hostCong?.meetingSchedule) {
      const parts = hostCong.meetingSchedule.split(',');
      if (parts.length > 1) form.setValue('time', parts[1].trim());
    }
  }, [hostCong, form]);

  const getDayInfo = useCallback((date: Date): CalendarDayState | undefined => {
    const d = startOfDay(date);
    const event = (events || []).find(e => { const start = startOfDay(new Date(e.date)); const end = e.endDate ? startOfDay(new Date(e.endDate)) : start; return d >= start && d <= end; });
    if (event) return { label: `Evento: ${event.title}`, type: 'visita', isBlocked: true };
    
    const dayTalks = (talks || []).filter(t => isSameDay(startOfDay(new Date(t.dateTime)), d));
    const localTalk = dayTalks.find(t => t.congregationId === myCong?.id);
    const outgoingTalk = dayTalks.find(t => t.congregationId !== myCong?.id);
    const isSlotTaken = activeTab === 'receber' ? !!localTalk : !!outgoingTalk;
    
    let info: CalendarDayState | undefined = undefined;
    if (localTalk || outgoingTalk) {
      const labels = [];
      if (localTalk) {
        const s = speakers?.find(sp => sp.id === localTalk.speakerId);
        const isTrueLocal = s?.homeCongregationId === myCong?.id;
        const prefix = isTrueLocal ? 'Local' : 'Recebendo';
        labels.push(`${prefix}: ${s?.name || '---'} - ${localTalk.topic}`);
      }
      if (outgoingTalk) {
        const s = speakers?.find(sp => sp.id === outgoingTalk.speakerId);
        labels.push(`Saindo: ${s?.name || '---'} - ${outgoingTalk.topic}`);
      }
      info = { label: labels.join(' | '), type: localTalk ? 'local' : 'outgoing', isBlocked: talkTopics.length > 0 && isSlotTaken };
    }

    if (hostCong && isMeetingDay(date, hostCong)) {
      return { 
        label: info?.label || 'Dia de Reunião', 
        type: info?.type || 'meeting', 
        isBlocked: info?.isBlocked || false 
      };
    }

    return info;
  }, [talks, events, myCong, activeTab, hostCong, speakers]);

  const calendarFooter = useMemo(() => {
    const dateToShow = activeDate || new Date();
    const info = getDayInfo(dateToShow);

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
                <div className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0", (item.toLowerCase().includes('local') || item.toLowerCase().includes('recebendo') || item.toLowerCase().includes('saindo')) ? "bg-blue-500" : item.toLowerCase().includes('reunião') ? "bg-primary" : "bg-orange-500")} />
                <span className="font-medium break-words whitespace-normal flex-1 min-w-0">{item}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [activeDate, getDayInfo]);

  const handlePickContact = async () => {
    if (!('contacts' in navigator && 'select' in (navigator as any).contacts)) {
      toast({ title: "Indisponível", description: "Navegador não suporta seleção de contatos.", variant: "destructive" });
      return;
    }
    try {
      const prop = ['name', 'tel']; const opts = { multiple: false };
      const contacts = await (navigator as any).contacts.select(prop, opts);
      if (contacts && contacts.length > 0) {
        const contact = contacts[0]; 
        const name = contact.name?.[0]?.trim() || ''; 
        const tels = contact.tel || [];
        if (name && !speakerForm.getValues('name')) speakerForm.setValue('name', name);
        
        const applyTel = (raw: string) => {
          const cleaned = cleanRawNumber(raw);
          speakerForm.setValue('phone', formatPhoneNumber(cleaned));
        };

        if (tels.length === 1) {
          applyTel(tels[0]);
        } else if (tels.length > 1) {
          setContactChoice({ name, numbers: tels });
        }
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

  const onSaveNewSpeaker = async (values: z.infer<typeof speakerFormSchema>) => {
    if (!firestore || !myCong) return;
    const originId = form.getValues('originCongregationId');
    if (!originId) { toast({ variant: "destructive", title: "Erro", description: "Selecione a congregação primeiro." }); return; }
    
    setIsSavingNewSpeaker(true);
    try {
      const docRef = await addDocumentNonBlocking(collection(firestore, 'congregations', myCong.id, 'speakers'), {
        name: values.name.trim(),
        phoneNumber: (values.phone || '').trim(),
        homeCongregationId: originId,
        availableTopics: [],
        onlyLocal: false
      });
      if (docRef) {
        form.setValue('speakerId', docRef.id);
        toast({ title: "Orador cadastrado!" });
        setIsNewSpeakerDialogOpen(false);
        speakerForm.reset();
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao salvar" });
    } finally {
      setIsSavingNewSpeaker(false);
    }
  };

  const handleAddTopicToRepertoire = async () => {
    if (!firestore || !myCong || !currentSpeaker || !pendingTopicToAdd) return;
    const updatedTopics = Array.from(new Set([...(currentSpeaker.availableTopics || []), pendingTopicToAdd.trim()]));
    updateDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'speakers', currentSpeaker.id), {
      availableTopics: updatedTopics
    });
    toast({ title: "Repertório atualizado!" });
    setIsAddToRepertoireOpen(false);
    setPendingTopicToAdd(null);
  };

  const handleTopicSelection = (tStr: string, field: any) => {
    field.onChange(tStr);
    setIsTopicPopOpen(false);
    if (currentSpeaker && !currentSpeaker.availableTopics?.includes(tStr.trim())) {
      setPendingTopicToAdd(tStr.trim());
      setIsAddToRepertoireOpen(true);
    }
  };

  const triggerNotificationWhatsApp = (info: { speaker: Speaker, topic: string, dateObj: Date, congregation: Congregation }, isDesignation: boolean) => {
    const dateFormatted = format(info.dateObj, "dd/MM/yyyy");
    const weekDay = format(info.dateObj, "eeee", { locale: ptBR }).toLowerCase();
    const timeFormatted = format(info.dateObj, "HH:mm");
    
    const intro = isDesignation 
      ? "Nova designação de discursos público." 
      : "Confirmando seu discurso público:";
      
    const msg = `Olá, irmão *${info.speaker.name}*!\n\n${intro}\n\n📅 *Data*: ${dateFormatted} (${weekDay})\n⏰ *Horário*: ${timeFormatted}\n👤 *Orador*: ${info.speaker.name}\n📚 *Tema*: ${info.topic}\n🏛️ *Congregação*: ${info.congregation.name || '---'}\n📍 *Endereço*: ${info.congregation.address || '---'}${info.congregation.coordinates ? `\n🗺️ *Localização*: https://www.google.com/maps/search/?api=1&query=${info.congregation.coordinates.trim().replace(/\s+/g, ',')}` : `\n🗺️ *Localização*: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.congregation.address || '')}`}`;
    
    let phone = (info.speaker.phoneNumber || '').replace(/\D/g, '');
    if (phone.length >= 10 && !phone.startsWith('55')) {
      phone = `55${phone}`;
    }
    
    window.open(
      phone 
        ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}` 
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, 
      '_blank'
    );
  };

  const saveTalk = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !myCong) return; 
    setIsLoading(true);
    const [h, m] = values.time.split(':').map(Number); 
    const talkDate = new Date(values.date); 
    talkDate.setHours(h, m);
    await addDocumentNonBlocking(collection(firestore, 'congregations', myCong.id, 'scheduledTalks'), { 
      congregationId: values.hostCongregationId, 
      speakerId: values.speakerId, 
      topic: values.topic.trim(), 
      dateTime: talkDate.toISOString() 
    });
    toast({ title: "Sucesso!" }); 
    
    const speaker = speakers?.find(s => s.id === values.speakerId);
    const congregation = neighborsMap[values.hostCongregationId];
    if (speaker && congregation && speaker.homeCongregationId === myCong.id) {
      setNotifyAfterSave({
        speaker,
        topic: values.topic.trim(),
        dateObj: talkDate,
        congregation,
      });
    }

    const preservedHost = activeTab === 'receber' 
      ? myCong.id 
      : (isCongLocked && lockedCongId ? lockedCongId : '');

    const preservedOrigin = activeTab === 'saindo' 
      ? myCong.id 
      : (isCongLocked && lockedCongId ? lockedCongId : '');

    form.reset({ 
      hostCongregationId: preservedHost, 
      originCongregationId: preservedOrigin, 
      speakerId: '', 
      topic: '', 
      time: hostCong?.meetingSchedule?.split(', ')?.[1] || '' 
    });
    setIsLoading(false); 
    setPendingValues(null); 
    setIsConfirmPastOpen(false);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !myCong) return; 
    const d = startOfDay(values.date); 
    if (d < startOfDay(new Date()) && !isConfirmPastOpen) { 
      setPendingValues(values); 
      setIsConfirmPastOpen(true); 
      return; 
    }
    
    if (activeTab === 'saindo') {
      const weekStart = startOfWeek(d, { weekStartsOn: 1, locale: ptBR });
      const weekEnd = endOfWeek(d, { weekStartsOn: 1, locale: ptBR });
      const maxOut = myCong.settings?.maxSpeakersOutPerWeek || 1;
      
      const outgoingThisWeek = (talks || []).filter(t => {
        const talkDate = new Date(t.dateTime);
        const speaker = speakers?.find(s => s.id === t.speakerId);
        const isFromOurCong = speaker?.homeCongregationId === myCong.id;
        const isGoingOut = t.congregationId !== myCong.id;
        return isFromOurCong && isGoingOut && talkDate >= weekStart && talkDate <= weekEnd;
      });

      if (outgoingThisWeek.length >= maxOut) {
        toast({
          variant: "destructive",
          title: "Limite de Saídas Atingido",
          description: `Nesta semana já temos ${outgoingThisWeek.length} orador(es) saindo. O limite permitido é ${maxOut}.`,
        });
        return;
      }
    }

    if (getDayInfo(values.date)?.isBlocked) { 
      toast({ variant: "destructive", title: "Conflito", description: "Esta vaga já está ocupada." }); 
      return; 
    }
    saveTalk(values);
  }

  if (!myCong) return <div className="p-20 text-center"><HouseRoofIcon className="mx-auto h-12 w-12 text-muted-foreground" /><h2 className="text-xl font-bold mt-4 font-headline">Configuração Necessária</h2><Link href="/setup"><Button type="button" className="mt-4">Configurar Agora</Button></Link></div>;

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <Alert className="bg-primary/10 border-primary/20 text-primary">
        <Info className="h-4 w-4" />
        <AlertDescription className="font-medium">
          Dica! Verifique se o endereço e horário da reunião estão corretos no site <strong>jw.org</strong> antes de agendar um discurso!
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
          <TabsTrigger value="receber" className="gap-2"><ArrowLeft className="h-4 w-4" /> Recebendo</TabsTrigger>
          <TabsTrigger value="saindo" className="gap-2">Saindo <ArrowRight className="h-4 w-4" /></TabsTrigger>
        </TabsList>
        <Card className="border-none shadow-none">
          <CardHeader className="text-center px-4">
            <CardTitle className="text-xl font-headline">{activeTab === 'receber' ? 'Agendar Visitante' : 'Agendar Saída'}</CardTitle>
            <CardDescription>
              {activeTab === 'saindo' && myCong.settings ? (
                <span className="flex items-center justify-center gap-1.5 text-xs text-amber-600 font-bold bg-amber-50 py-1 px-3 rounded-full border border-amber-100 w-fit mx-auto mt-2">
                  <ShieldAlert className="h-3 v-3" /> Limite: {myCong.settings.maxSpeakersOutPerWeek} orador(es) por semana
                </span>
              ) : 'Preencha os campos abaixo.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-1.5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="hostCongregationId" render={({ field }) => (
                    activeTab === 'receber' ? (
                      <FormItem>
                        <FormLabel className="font-bold">Onde será?</FormLabel>
                        <div className="flex h-11 items-center justify-between rounded-md border bg-muted px-3 text-sm font-bold opacity-80 cursor-not-allowed">
                          <span>{myCong.name} (Minha)</span>
                          <HouseRoofIcon className="h-4 w-4 opacity-50" />
                        </div>
                        <FormMessage />
                      </FormItem>
                    ) : (
                      <SearchableCongregationSelect
                        value={field.value}
                        onChange={(val) => {
                          field.onChange(val);
                          if (isCongLocked) setLockedCongId(val);
                        }}
                        label="Onde será?"
                        congregations={[myCong, ...sortedNeighbors]}
                        isLocked={isCongLocked && lockedCongId === field.value}
                        onToggleLock={() => toggleCongLock(field.value)}
                        myCongId={myCong.id}
                      />
                    )
                  )} />
                  <FormField control={form.control} name="originCongregationId" render={({ field }) => (
                    activeTab === 'saindo' ? (
                      <FormItem>
                        <FormLabel className="font-bold">Origem do orador?</FormLabel>
                        <div className="flex h-11 items-center justify-between rounded-md border bg-muted px-3 text-sm font-bold opacity-80 cursor-not-allowed">
                          <span>{myCong.name} (Minha)</span>
                          <HouseRoofIcon className="h-4 w-4 opacity-50" />
                        </div>
                        <FormMessage />
                      </FormItem>
                    ) : (
                      <SearchableCongregationSelect
                        value={field.value}
                        onChange={(val) => {
                          field.onChange(val);
                          if (isCongLocked) setLockedCongId(val);
                        }}
                        label="Origem do orador?"
                        congregations={[myCong, ...sortedNeighbors]}
                        isLocked={isCongLocked && lockedCongId === field.value}
                        onToggleLock={() => toggleCongLock(field.value)}
                        myCongId={myCong.id}
                      />
                    )
                  )} />
                </div>
                {/* 2. Data e Horário */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-bold">Data</FormLabel>
                      <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <FormControl>
                          <Button 
                            type="button" 
                            variant="outline" 
                            className={cn("w-full pl-3 text-left font-normal h-11", !field.value && "text-muted-foreground")} 
                            onClick={() => {
                              setActiveDate(field.value || new Date());
                              setIsCalendarOpen(true);
                            }}
                          >
                            {field.value ? format(field.value, "dd/MM/yyyy") : "Escolha"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                        <DialogContent className="sm:max-w-[425px] w-[95vw] p-0 border-none shadow-2xl overflow-hidden">
                          <DialogHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                            <DialogTitle className="text-sm font-bold">Selecionar Data</DialogTitle>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsCalendarOpen(false)}><X className="h-4 w-4" /></Button>
                          </DialogHeader>
                          <div className="flex flex-col items-center">
                            <UICalendar 
                              mode="single" 
                              selected={activeDate} 
                              onSelect={(d) => { 
                                if (d) { 
                                  setActiveDate(d); 
                                  const info = getDayInfo(d); 
                                  if (lastClick && isSameDay(lastClick.date, d) && (Date.now() - lastClick.time) < 300) { 
                                    const validDay = isMeetingDay(d, hostCong);
                                    if (!info?.isBlocked && validDay) { 
                                      field.onChange(d); 
                                      setIsCalendarOpen(false); 
                                    } else if (!validDay) {
                                      toast({
                                        variant: "destructive",
                                        title: "Dia de Reunião Diferente",
                                        description: `A congregação ${hostCong?.name} se reúne aos ${hostCong?.meetingSchedule.split(',')[0]}s.`,
                                      });
                                    }
                                  } 
                                  setLastClick({ date: d, time: Date.now() }); 
                                } 
                              }} 
                              locale={ptBR} 
                              initialFocus 
                              getDayInfo={getDayInfo} 
                              defaultMonth={field.value || new Date()} 
                              modifiers={{
                                meetingDay: (d) => !!hostCong && isMeetingDay(d, hostCong)
                              }}
                              modifiersClassNames={{
                                meetingDay: "ring-2 ring-primary/50 ring-inset"
                              }}
                            />
                            {calendarFooter}
                            <div className="p-3 pt-0 w-full bg-muted/20">
                              <Button 
                                type="button" 
                                className="w-full h-11 font-bold bg-primary text-white" 
                                disabled={!activeDate}
                                onClick={() => {
                                  if (activeDate) {
                                    const info = getDayInfo(activeDate);
                                    const validDay = isMeetingDay(activeDate, hostCong);
                                    if (!info?.isBlocked && validDay) {
                                      field.onChange(activeDate);
                                      setIsCalendarOpen(false);
                                    } else if (!validDay) {
                                      toast({
                                        variant: "destructive",
                                        title: "Dia de Reunião Diferente",
                                        description: `A congregação ${hostCong?.name} se reúne aos ${hostCong?.meetingSchedule.split(',')[0]}s.`,
                                      });
                                    } else {
                                      toast({ variant: "destructive", title: "Conflito", description: "Esta vaga já está ocupada ou bloqueada." });
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
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="time" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Horário</FormLabel>
                      <FormControl><Input type="time" {...field} disabled className="bg-muted opacity-80 cursor-not-allowed font-semibold h-11" /></FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* 3. Orador e Tema do Discurso */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="speakerId" render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="font-bold">Orador</FormLabel>
                        {form.watch('originCongregationId') && (
                          <Button 
                            type="button" 
                            variant="link" 
                            className="h-auto p-0 text-xs font-bold gap-1"
                            onClick={() => {
                              speakerForm.reset();
                              setIsNewSpeakerDialogOpen(true);
                            }}
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Novo Orador
                          </Button>
                        )}
                      </div>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!form.watch('originCongregationId')}>
                        <FormControl><SelectTrigger type="button"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {filteredSpeakers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          {filteredSpeakers.length === 0 && form.watch('originCongregationId') && (
                            <div className="p-2 text-center text-xs text-muted-foreground italic">Nenhum orador disponível para saídas nesta congregação.</div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="topic" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Tema do Discurso</FormLabel>
                      <Popover open={isTopicPopOpen} onOpenChange={setIsTopicPopOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button type="button" variant="outline" className="w-full justify-between font-normal h-auto min-h-10 py-2">
                              <span className="flex-1 text-left whitespace-normal break-words leading-tight">{field.value || "Selecione"}</span>
                              <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="z-[110] w-[var(--radix-popover-trigger-width)] p-0 shadow-xl max-w-[95vw] max-h-[95vh] overflow-y-auto" 
                          align="start" 
                          onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                          <div className="flex items-center px-3 border-b">
                            <Search className="mr-2 h-4 w-4 opacity-50" />
                            <Input placeholder="Pesquisar..." value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} className="border-none focus-visible:ring-0 shadow-none h-10" />
                          </div>
                          <Tabs value={topicTab} onValueChange={setTopicTab}>
                            <TabsList className="grid w-full grid-cols-2 h-9 rounded-none border-b bg-muted/50">
                              <TabsTrigger value="esboços" className="text-xs">Esboços</TabsTrigger>
                              <TabsTrigger value="especial" className="text-xs">Especial</TabsTrigger>
                            </TabsList>
                            <TabsContent value="esboços" className="mt-0">
                              <ScrollArea className="h-64 p-1">
                                <div className="space-y-0.5">
                                  {currentSpeaker?.availableTopics && currentSpeaker.availableTopics.length > 0 && (
                                    <div className="mb-2">
                                      <div className="px-2 py-1 text-[10px] font-bold text-primary uppercase bg-primary/5 rounded-sm mb-1 flex items-center gap-1">
                                        <Star className="h-3 w-3 fill-primary" /> Repertório do Orador
                                      </div>
                                      {currentSpeaker.availableTopics.filter(t => t.toLowerCase().includes(topicSearch.toLowerCase())).map(tStr => (
                                        <button
                                          key={tStr}
                                          type="button"
                                          className={cn("w-full text-left flex items-start gap-3 px-3 py-2 rounded hover:bg-muted text-sm transition-colors", field.value === tStr ? "bg-primary/10 text-primary font-bold" : "bg-primary/5 border-l-2 border-primary/30")}
                                          onClick={() => handleTopicSelection(tStr, field)}
                                        >
                                          <Check className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", field.value === tStr ? "opacity-100" : "opacity-0")} />
                                          <div className="flex-1 min-w-0 break-words whitespace-normal"><HighlightedText text={tStr} highlight={topicSearch} /></div>
                                        </button>
                                      ))}
                                      <Separator className="my-2" />
                                    </div>
                                  )}
                                  {talkTopics.filter(t => t.title.toLowerCase().includes(topicSearch.toLowerCase()) || t.id.toString().includes(topicSearch)).map(t => { 
                                    const s = `${t.id}. ${t.title}`; 
                                    const isFromRepertoire = currentSpeaker?.availableTopics?.includes(s);
                                    return (
                                      <button 
                                        key={t.id} 
                                        type="button"
                                        className={cn("w-full text-left flex items-start gap-3 px-3 py-2 rounded hover:bg-muted text-sm transition-colors", field.value === s ? "bg-primary/10 text-primary font-bold" : isFromRepertoire ? "bg-primary/5 border-l-2 border-primary/30" : "")} 
                                        onClick={() => handleTopicSelection(s, field)}
                                      >
                                        <Check className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", field.value === s ? "opacity-100" : "opacity-0")} />
                                        <div className="flex-1 min-w-0 break-words whitespace-normal">
                                          <span className="font-bold mr-1">{t.id}.</span>
                                          <HighlightedText text={t.title} highlight={topicSearch} />
                                        </div>
                                      </button>
                                    ); 
                                  })}
                                </div>
                              </ScrollArea>
                            </TabsContent>
                            <TabsContent value="especial" className="py-4 px-2 text-center">
                              <button
                                type="button"
                                className="w-full h-12 border rounded-md font-bold hover:bg-muted transition-colors"
                                onClick={() => { if(topicSearch.trim()) { handleTopicSelection(topicSearch.trim(), field); } }}
                              >
                                Confirmar: "{topicSearch || '...'}"
                              </button>
                            </TabsContent>
                          </Tabs>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                {speakerConflict && (
                  <Alert className="bg-amber-50 border-amber-200 text-amber-800 rounded-xl flex gap-2 items-start py-3 shadow-none">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <AlertDescription className="text-xs font-semibold leading-relaxed">
                      {speakerConflict}
                    </AlertDescription>
                  </Alert>
                )}
                <Button type="submit" disabled={isLoading} className="w-full h-12 text-lg font-bold bg-primary text-primary-foreground">
                  {isLoading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : null}Confirmar Agendamento
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </Tabs>

      <Dialog open={isNewSpeakerDialogOpen} onOpenChange={setIsNewSpeakerDialogOpen}>
        <DialogContent className="sm:max-w-[425px] w-[95vw] px-4 py-6 border-none shadow-2xl">
          <DialogHeader className="text-center flex flex-col items-center">
            <div className="bg-primary/10 p-3 rounded-full mb-2">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl font-headline font-bold">Cadastrar Novo Orador</DialogTitle>
            <DialogDescription>
              Ele será salvo em <strong>{neighborsMap[form.getValues('originCongregationId')]?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Form {...speakerForm}>
            <form onSubmit={speakerForm.handleSubmit(onSaveNewSpeaker)} className="space-y-4 py-4">
              <FormField
                control={speakerForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Nome Completo</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="Nome do irmão" {...field} className="h-11" />
                      </FormControl>
                      <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={handlePickContact}>
                        <Contact className="h-5 w-5" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={speakerForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Telefone (Opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="(00) 00000-0000" 
                        {...field} 
                        onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2 flex flex-col sm:flex-row pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsNewSpeakerDialogOpen(false)} className="flex-1">Cancelar</Button>
                <Button 
                  type="submit"
                  disabled={isSavingNewSpeaker}
                  className="flex-1 bg-primary text-white font-bold"
                >
                  {isSavingNewSpeaker && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar Orador
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contactChoice} onOpenChange={(o) => !o && setContactChoice(null)}>
        <DialogContent className="sm:max-w-[425px] w-[95vw] shadow-2xl border-none"><DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-headline"><Phone className="h-5 w-5 text-primary" /> Escolher Telefone</DialogTitle><DialogDescription>O contato <strong>{contactChoice?.name}</strong> possui múltiplos números.</DialogDescription></DialogHeader>
          <div className="grid gap-2 py-4">{contactChoice?.numbers.map((num, i) => (<Button key={i} variant="outline" className="justify-start h-12 text-base font-semibold" type="button" onClick={() => { const cleaned = cleanRawNumber(num); speakerForm.setValue('phone', formatPhoneNumber(cleaned)); setContactChoice(null); }}><Phone className="mr-2 h-4 w-4 opacity-50" /> {formatPhoneNumber(cleanRawNumber(num))}</Button>))}</div>
          <div className="flex justify-end"><Button variant="ghost" type="button" onClick={() => setContactChoice(null)}>Cancelar</Button></div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmPastOpen} onOpenChange={setIsConfirmPastOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-500" />Data no Passado</AlertDialogTitle><AlertDialogDescription>Deseja realmente salvar este registro histórico?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel type="button" onClick={() => { setPendingValues(null); setIsConfirmPastOpen(false); }}>Não</AlertDialogCancel><AlertDialogAction onClick={() => pendingValues && saveTalk(pendingValues)}>Sim, Confirmar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isAddToRepertoireOpen} onOpenChange={setIsAddToRepertoireOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Star className="text-primary fill-primary h-5 w-5" /> Adicionar ao Repertório?</AlertDialogTitle>
            <AlertDialogDescription>O tema <strong>{pendingTopicToAdd}</strong> não está na lista de temas que <strong>{currentSpeaker?.name}</strong> costuma proferir.<br/><br/>Deseja adicionar este tema ao repertório dele para agendamentos futuros?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" onClick={() => { setIsAddToRepertoireOpen(false); setPendingTopicToAdd(null); }}>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddTopicToRepertoire}>Sim, Adicionar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!notifyAfterSave} onOpenChange={(o) => !o && setNotifyAfterSave(null)}>
        <DialogContent className="sm:max-w-[420px] w-[92vw] rounded-3xl border-none shadow-2xl p-6">
          <DialogHeader className="text-center flex flex-col items-center">
            <div className="bg-emerald-100 p-4 rounded-full mb-3 shrink-0">
              <Phone className="h-8 w-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-xl font-extrabold tracking-tight">
              Notificar Orador Local
            </DialogTitle>
            <DialogDescription className="text-sm text-center mt-2 leading-relaxed text-muted-foreground">
              Orador local agendado com sucesso! Deseja enviar a notificação da nova designação para o irmão <strong>{notifyAfterSave?.speaker.name}</strong> por WhatsApp?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              className="w-full h-12 rounded-2xl gap-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10 transition-all text-sm"
              onClick={() => {
                if (notifyAfterSave) {
                  triggerNotificationWhatsApp(notifyAfterSave, true);
                  setNotifyAfterSave(null);
                }
              }}
            >
              Sim, Enviar Designação
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 rounded-2xl gap-2 font-bold border-border text-foreground hover:bg-muted/50 transition-all text-sm"
              onClick={() => {
                if (notifyAfterSave) {
                  triggerNotificationWhatsApp(notifyAfterSave, false);
                  setNotifyAfterSave(null);
                }
              }}
            >
              Sim, Enviar Confirmação
            </Button>
            <Button
              variant="ghost"
              className="w-full h-11 rounded-2xl text-muted-foreground hover:text-foreground text-xs"
              onClick={() => setNotifyAfterSave(null)}
            >
              Agora não
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
