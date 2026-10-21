
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { format, startOfDay, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Search,
  Star,
  ChevronsUpDown,
  Check,
  Loader2,
  AlertTriangle,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter as AlertFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar, type CalendarDayState } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { talkTopics } from '@/lib/talk-topics';
import { useToast } from '@/hooks/use-toast';
import { doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { EnrichedSpeech, Congregation, Speaker } from '@/lib/data';

interface EditTalkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  speech: EnrichedSpeech | null;
  neighborsMap: Record<string, Congregation>;
  getDayInfo: (date: Date) => CalendarDayState | undefined;
  onSave: (topic: string, date: Date, congregationId: string) => Promise<void>;
  talks?: any[] | null;
  events?: any[] | null;
  myCongId?: string;
  myCongSettings?: any;
  allSpeakers?: Speaker[] | null;
}

const isMeetingDay = (date: Date, cong: Congregation | null) => {
  if (!cong || !cong.meetingSchedule) return true;
  const schedule = cong.meetingSchedule.toLowerCase();
  const day = date.getDay();
  const dayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const hasAccentlessSabado = day === 6 && (schedule.includes('sabado') || schedule.includes('sábado'));
  return schedule.includes(dayNames[day]) || hasAccentlessSabado;
};

const HighlightedText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const safeHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safeHighlight})`, "gi"));
  return (<span>{parts.map((part, i) => part.toLowerCase() === highlight.toLowerCase() ? (<mark key={i} className="bg-primary/20 text-primary font-bold rounded-sm px-0.5">{part}</mark>) : (part))}</span>);
};

export function EditTalkDialog({ 
  open, 
  onOpenChange, 
  speech, 
  neighborsMap, 
  getDayInfo, 
  onSave, 
  talks = [], 
  events = [], 
  myCongId,
  myCongSettings,
  allSpeakers
}: EditTalkDialogProps) {
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [congregationId, setCongregationId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');
  const [isTopicOpen, setIsTopicOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [topicTab, setTopicTab] = useState('esboços');
  const [isConfirmPastOpen, setIsConfirmPastOpen] = useState(false);
  const [isAddToRepertoireOpen, setIsAddToRepertoireOpen] = useState(false);
  const [pendingTopicToAdd, setPendingTopicToAdd] = useState<string | null>(null);
  const [lastClick, setLastClick] = useState<{ date: Date, time: number } | null>(null);
  const [activeDate, setActiveDate] = useState<Date | undefined>(undefined);

  const { toast } = useToast();
  const firestore = useFirestore();

  const hostCong = useMemo(() => {
    if (!congregationId) return null;
    return neighborsMap[congregationId] || null;
  }, [congregationId, neighborsMap]);

  useEffect(() => {
    if (open) {
      setActiveDate(new Date());
      setIsCalendarOpen(false);
      setIsTopicOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (speech && open) {
      setTopic(speech.topic); setDate(speech.dateObj); setCongregationId(speech.congregationId); setTopicSearch(''); setIsSaving(false); setTopicTab('esboços'); setActiveDate(speech.dateObj);
    }
  }, [speech, open]);

  const hasChanges = useMemo(() => {
    if (!speech) return false; const sameDate = date && speech.dateObj && isSameDay(date, speech.dateObj);
    return topic !== speech.topic || !sameDate || congregationId !== speech.congregationId;
  }, [topic, date, congregationId, speech]);

  const filteredTopicsList = useMemo(() => {
    const queryStr = topicSearch.trim().toLowerCase(); return talkTopics.filter(t => t.title.toLowerCase().includes(queryStr) || t.id.toString().includes(queryStr));
  }, [topicSearch]);

  const internalGetDayInfo = useCallback((d: Date): CalendarDayState | undefined => {
    const info = getDayInfo(d); 
    const isCurrentOriginal = speech?.dateObj && isSameDay(d, speech.dateObj);
    const isMeeting = hostCong && isMeetingDay(d, hostCong);
    
    let result = info;
    if (isCurrentOriginal) { 
      if (info && info.label.includes('|')) result = { ...info, isBlocked: false }; 
      else result = undefined; 
    }

    if (isMeeting) {
      return {
        label: result?.label || 'Dia de Reunião',
        type: result?.type || 'meeting',
        isBlocked: result?.isBlocked || false
      };
    }

    return result;
  }, [getDayInfo, speech?.dateObj, hostCong]);

  const calendarFooter = useMemo(() => {
    const dateToShow = activeDate || new Date();
    const info = internalGetDayInfo(dateToShow);

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
  }, [activeDate, internalGetDayInfo]);

  const handleTopicSelection = (topicStr: string) => {
    setTopic(topicStr); setIsTopicOpen(false);
    if (speech?.speaker && !speech.speaker.availableTopics?.includes(topicStr.trim())) { setPendingTopicToAdd(topicStr.trim()); setIsAddToRepertoireOpen(true); }
  };

  const handleAddTopicToRepertoire = async () => {
    if (!firestore || !myCongId || !speech?.speaker || !pendingTopicToAdd) return;
    const updated = Array.from(new Set([...(speech.speaker.availableTopics || []), pendingTopicToAdd.trim()]));
    updateDocumentNonBlocking(doc(firestore, 'congregations', myCongId, 'speakers', speech.speaker.id), { availableTopics: updated });
    toast({ title: "Repertório atualizado!" }); setIsAddToRepertoireOpen(false); setPendingTopicToAdd(null);
  };

  const handleSave = async (force = false) => {
    if (!topic || !date || !congregationId || !speech) return;
    const d = startOfDay(date); 
    if (d < startOfDay(new Date()) && !force) { setIsConfirmPastOpen(true); return; }

    const isOutgoing = congregationId !== myCongId;
    const speaker = allSpeakers?.find(s => s.id === speech.speakerId);
    const isFromOurCong = speaker?.homeCongregationId === myCongId;

    if (isOutgoing && isFromOurCong) {
      const weekStart = startOfWeek(d, { weekStartsOn: 1, locale: ptBR });
      const weekEnd = endOfWeek(d, { weekStartsOn: 1, locale: ptBR });
      const maxOut = myCongSettings?.maxSpeakersOutPerWeek || 1;

      const outgoingThisWeek = (talks || []).filter(t => {
        if (t.id === speech.id) return false; 
        const talkDate = new Date(t.dateTime);
        const s = allSpeakers?.find(sp => sp.id === t.speakerId);
        const fromOur = s?.homeCongregationId === myCongId;
        const goingOut = t.congregationId !== myCongId;
        return fromOur && goingOut && talkDate >= weekStart && talkDate <= weekEnd;
      });

      if (outgoingThisWeek.length >= maxOut) {
        toast({
          variant: "destructive",
          title: "Limite de Saídas Atingido",
          description: `Nesta semana já existem ${outgoingThisWeek.length} orador(es) saindo. O limite é ${maxOut}.`,
        });
        return;
      }
    }

    const talkConf = (talks || []).filter(t => t.id !== speech.id && isSameDay(new Date(t.dateTime), d));
    if (speech.isReceiving || speech.isLocal) { if (talkConf.some(t => t.congregationId === speech.congregationId)) { toast({ variant: "destructive", title: "Conflito" }); return; } }
    
    setIsSaving(true); 
    try { await onSave(topic, date, congregationId); onOpenChange(false); } 
    finally { setIsSaving(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[95vh] overflow-y-auto px-4 py-6 gap-4 border-none shadow-2xl overflow-hidden" onInteractOutside={(e) => { if (hasChanges) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl font-bold text-center w-full">Editar Agendamento</DialogTitle>
            <DialogDescription className="text-center">Altere as informações do discurso.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-bold">Tema do Discurso</Label>
              <Popover open={isTopicOpen} onOpenChange={setIsTopicOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between font-normal h-auto min-h-11 py-2">
                    <span className="flex-1 text-left whitespace-normal break-words leading-tight">{topic || "Selecione"}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[var(--radix-popover-trigger-width)] p-0 z-[110] shadow-xl max-w-[95vw] max-h-[95vh] overflow-y-auto" 
                  align="start" 
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="flex items-center px-3 border-b">
                    <Search className="mr-2 h-4 w-4 opacity-50" />
                    <Input placeholder="Pesquisar..." value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} className="border-none focus-visible:ring-0 shadow-none h-10" />
                  </div>
                  <Tabs value={topicTab} onValueChange={setTopicTab}>
                    <TabsList className="grid w-full grid-cols-2 h-9 rounded-none bg-muted/50 border-b">
                      <TabsTrigger value="esboços" className="text-xs">Esboços</TabsTrigger>
                      <TabsTrigger value="especial" className="text-xs">Especial</TabsTrigger>
                    </TabsList>
                    <TabsContent value="esboços" className="mt-0">
                      <ScrollArea className="h-64 p-1">
                        <div className="space-y-0.5">
                          {speech?.speaker?.availableTopics && speech.speaker.availableTopics.length > 0 && (
                            <div className="mb-2">
                              <div className="px-2 py-1 text-[10px] font-bold text-primary uppercase bg-primary/5 rounded-sm mb-1 flex items-center gap-1">
                                <Star className="h-3 w-3 fill-primary" /> Repertório
                              </div>
                              {speech.speaker.availableTopics.filter(t => t.toLowerCase().includes(topicSearch.toLowerCase())).map(tStr => (
                                <button key={tStr} type="button" className={cn("w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm transition-colors flex items-start gap-3", topic === tStr ? "bg-primary/10 text-primary font-bold" : "bg-primary/5 border-l-2 border-primary/30")} onClick={() => handleTopicSelection(tStr)}>
                                  <Check className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", topic === tStr ? "opacity-100" : "opacity-0")} />
                                  <div className="flex-1 min-w-0 break-words whitespace-normal"><HighlightedText text={tStr} highlight={topicSearch} /></div>
                                </button>
                              ))}
                              <Separator className="my-2" />
                            </div>
                          )}
                          {filteredTopicsList.map(t => { 
                            const full = `${t.id}. ${t.title}`; 
                            return (
                              <button key={t.id} type="button" className={cn("w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm transition-colors flex items-start gap-3", topic === full ? "bg-primary/10 text-primary font-bold" : "")} onClick={() => handleTopicSelection(full)}>
                                <Check className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", topic === full ? "opacity-100" : "opacity-0")} />
                                <div className="flex-1 min-w-0 break-words whitespace-normal"><span className="font-bold mr-1">{t.id}.</span><HighlightedText text={t.title} highlight={topicSearch} /></div>
                              </button>
                            ); 
                          })}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="especial" className="py-4 px-2 text-center">
                      <button type="button" className="w-full h-12 border rounded-md font-bold hover:bg-muted transition-colors" onClick={() => { if(topicSearch.trim()) handleTopicSelection(topicSearch.trim()); }}>
                        Confirmar: "{topicSearch || '...'}"
                      </button>
                    </TabsContent>
                  </Tabs>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">Data do Discurso</Label>
              <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full justify-start font-normal h-11" 
                  onClick={() => {
                    setActiveDate(date || new Date());
                    setIsCalendarOpen(true);
                  }}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                  {date ? format(date, "dd/MM/yyyy") : "Escolha"}
                </Button>
                <DialogContent className="sm:max-w-[425px] w-[95vw] p-0 border-none shadow-2xl overflow-hidden">
                  <DialogHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                    <DialogTitle className="text-sm font-bold">Selecionar Data</DialogTitle>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsCalendarOpen(false)}><X className="h-4 w-4" /></Button>
                  </DialogHeader>
                  <div className="flex flex-col items-center">
                    <Calendar 
                      mode="single" 
                      selected={activeDate} 
                      onSelect={(d) => { 
                        if(d) { 
                          setActiveDate(d); 
                          if(lastClick && isSameDay(lastClick.date, d) && (Date.now()-lastClick.time) < 300) { 
                            const validDay = isMeetingDay(d, hostCong);
                            if(!internalGetDayInfo(d)?.isBlocked && validDay) { 
                              setDate(d); 
                              setIsCalendarOpen(false); 
                            } else if (!validDay) {
                              toast({
                                variant: "destructive",
                                title: "Dia de Reunião Diferente",
                                description: `A congregação ${hostCong?.name} se reúne aos ${hostCong?.meetingSchedule.split(',')[0]}s.`,
                              });
                            }
                          } 
                          setLastClick({date:d, time:Date.now()}); 
                        } 
                      }} 
                      initialFocus 
                      locale={ptBR} 
                      getDayInfo={internalGetDayInfo} 
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
                            const info = internalGetDayInfo(activeDate);
                            const validDay = isMeetingDay(activeDate, hostCong);
                            if (info?.isBlocked || !validDay) {
                               if (!validDay) {
                                 toast({
                                   variant: "destructive",
                                   title: "Dia de Reunião Diferente",
                                   description: `A congregação ${hostCong?.name} se reúne aos ${hostCong?.meetingSchedule.split(',')[0]}s.`,
                                 });
                               } else {
                                 toast({ variant: "destructive", title: "Conflito", description: "Esta vaga já está ocupada ou bloqueada." });
                               }
                            } else {
                              setDate(activeDate);
                              setIsCalendarOpen(false);
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
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 h-12">Cancelar</Button>
            <Button type="button" onClick={() => handleSave()} disabled={isSaving || !hasChanges} className="flex-1 bg-primary text-primary-foreground font-bold h-12">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmPastOpen} onOpenChange={setIsConfirmPastOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Data no Passado</AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente salvar este registro histórico?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertFooter>
            <AlertDialogCancel onClick={() => setIsConfirmPastOpen(false)}>Não</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setIsConfirmPastOpen(false); handleSave(true); }} className="bg-primary text-primary-foreground">Sim, Confirmar</AlertDialogAction>
          </AlertFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isAddToRepertoireOpen} onOpenChange={setIsAddToRepertoireOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Star className="text-primary fill-primary h-5 w-5" /> Adicionar ao Repertório?</AlertDialogTitle>
            <AlertDialogDescription>Deseja adicionar <strong>{pendingTopicToAdd}</strong> ao repertório deste orador?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertFooter>
            <AlertDialogCancel onClick={() => { setIsAddToRepertoireOpen(false); setPendingTopicToAdd(null); }}>Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddTopicToRepertoire} className="bg-primary text-primary-foreground">Sim, Adicionar</AlertDialogAction>
          </AlertFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
