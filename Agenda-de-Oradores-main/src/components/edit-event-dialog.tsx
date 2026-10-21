'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, getDay, startOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  Loader2,
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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, type CalendarDayState } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { EnrichedEvent } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

const eventSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  date: z.date({ required_error: 'A data é obrigatória.' }),
  endDate: z.date().optional(),
  type: z.enum(["Assembleia", "Congresso", "Visita do Superintendente", "Celebração", "Outro"], { required_error: "Selecione o tipo de evento.", }),
  isSingleDay: z.boolean().default(true),
}).refine(data => { if (!data.isSingleDay && data.endDate) return data.endDate >= data.date; return true; }, { message: "A data de término não pode ser anterior à data de início.", path: ["endDate"] });

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EnrichedEvent | null;
  getDayInfo: (date: Date) => CalendarDayState | undefined;
  onSave: (values: z.infer<typeof eventSchema>) => Promise<void>;
  talks?: any[] | null;
  events?: any[] | null;
  speakers?: any[] | null;
}

export function EditEventDialog({ open, onOpenChange, event, onSave, talks = [], events = [], speakers = [] }: EditEventDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);
  const [lastClick, setLastClick] = useState<{ date: Date, time: number } | null>(null);
  const { toast } = useToast();
  const [activeDate, setActiveDate] = useState<Date | undefined>(undefined);
  const { firestore, user } = useFirebase();

  // Obter congregação local para contexto de labels
  const myCongQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'congregations'), where('authorizedUsers', 'array-contains', user.uid));
  }, [firestore, user?.uid]);
  const { data: myCongs } = useCollection<any>(myCongQuery);
  const myCong = myCongs?.[0];

  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: '', description: '', date: undefined, endDate: undefined, type: 'Outro', isSingleDay: true }
  });

  const { isSingleDay, type: eventTypeWatch, date: eventDateWatch } = form.watch();

  useEffect(() => {
    if (open) {
      setActiveDate(new Date());
      setIsStartDateOpen(false);
      setIsEndDateOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (event && open) {
      form.reset({ title: event.title, description: event.description || '', type: event.type as any, date: event.dateObj, endDate: event.endDateObj || undefined, isSingleDay: !event.endDateObj });
      setIsSaving(false); setActiveDate(event.dateObj);
    }
  }, [event, open, form]);

  const hasChanges = form.formState.isDirty;

  useEffect(() => {
    if (eventTypeWatch === 'Visita do Superintendente' && eventDateWatch) {
      const sunday = new Date(eventDateWatch); 
      const day = getDay(eventDateWatch);
      const diffToSunday = day === 0 ? 0 : 7 - day;
      sunday.setDate(sunday.getDate() + diffToSunday); 
      const finalSunday = startOfDay(sunday);
      const tuesday = new Date(finalSunday); 
      tuesday.setDate(tuesday.getDate() - 5); 
      const finalTuesday = startOfDay(tuesday);
      if (!isSameDay(form.getValues('date')!, finalTuesday)) {
        form.setValue('date', finalTuesday, { shouldDirty: true }); 
        form.setValue('endDate', finalSunday, { shouldDirty: true }); 
        form.setValue('isSingleDay', false, { shouldDirty: true });
      }
    }
  }, [eventTypeWatch, eventDateWatch, form]);

  const richDayInfo = useCallback((date: Date): CalendarDayState | undefined => {
    const d = startOfDay(date); 
    const talk = (talks || []).find(t => isSameDay(startOfDay(new Date(t.dateTime)), d));
    if (talk) {
      const s = speakers?.find(sp => sp.id === talk.speakerId);
      const isLocal = talk.congregationId === myCong?.id && s?.homeCongregationId === myCong?.id;
      const isReceiving = talk.congregationId === myCong?.id && !isLocal;
      const prefix = isLocal ? "Local" : isReceiving ? "Recebendo" : "Saindo";
      return { label: `${prefix}: ${s?.name || '---'} - ${talk.topic}`, isBlocked: true, type: isLocal ? 'local' : isReceiving ? 'receiving' : 'outgoing' };
    }
    const existing = (events || []).find(e => { if (event && e.id === event.id) return false; const s = startOfDay(new Date(e.date)); const ed = e.endDate ? startOfDay(new Date(e.endDate)) : s; return d >= s && d <= ed; });
    if (existing) return { label: `Evento: ${existing.title || existing.type}`, isBlocked: true, type: existing.type.toLowerCase().includes('visita') ? 'visita' : existing.type.toLowerCase().includes('assembleia') ? 'assembleia' : 'outro' };
    return undefined;
  }, [talks, events, event, speakers, myCong]);

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

  const handleSave = async (values: z.infer<typeof eventSchema>) => {
    setIsSaving(true); const start = startOfDay(values.date); const end = values.isSingleDay ? start : startOfDay(values.endDate || values.date);
    const overlap = (events || []).some(e => { if (event && e.id === event.id) return false; const eS = startOfDay(new Date(e.date)); const eE = e.endDate ? startOfDay(new Date(e.endDate)) : eS; return start <= eE && end >= eS; });
    if (overlap) { toast({ variant: "destructive", title: "Conflito", description: "Período ocupado." }); setIsSaving(false); return; }
    try { await onSave(values); onOpenChange(false); } finally { setIsSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[95vh] overflow-y-auto p-0 border-none shadow-2xl overflow-hidden" onInteractOutside={(e) => { if (hasChanges) e.preventDefault(); }}>
        <DialogHeader className="p-6 pb-2 text-center flex flex-col items-center justify-center">
          <DialogTitle className="text-2xl font-bold">Editar Evento</DialogTitle>
          <DialogDescription>Atualize os dados e datas.</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-5">
            <div className="space-y-1">
              <Label className="font-bold text-sm">Tipo</Label>
              <Select onValueChange={(v) => form.setValue('type', v as any, { shouldDirty: true })} value={form.watch('type')}>
                <SelectTrigger className="h-12" type="button"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Assembleia">Assembleia</SelectItem>
                  <SelectItem value="Congresso">Congresso</SelectItem>
                  <SelectItem value="Visita do Superintendente">Visita do Superintendente</SelectItem>
                  <SelectItem value="Celebração">Celebração</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="font-bold text-sm">Título (Opcional)</Label>
              <Input {...form.register('title')} className="h-12" placeholder="Ex: Reunião Especial" />
            </div>
            <div className="flex flex-row items-center space-x-3 space-y-0 rounded-lg border p-4 bg-muted/5">
              <Checkbox checked={isSingleDay} onCheckedChange={(v) => form.setValue('isSingleDay', !!v, { shouldDirty: true })} disabled={eventTypeWatch === 'Visita do Superintendente'} />
              <Label className="font-bold text-sm cursor-pointer">Apenas um dia</Label>
            </div>
            <div className={cn("grid gap-4", !isSingleDay && "grid-cols-2")}>
              <div className="space-y-1 flex flex-col">
                <Label className="font-bold text-sm">{isSingleDay ? "Data" : "Início"}</Label>
                <Dialog open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="h-12 w-full text-left font-normal px-3" 
                    onClick={() => {
                      setActiveDate(form.getValues('date') || new Date());
                      setIsStartDateOpen(true);
                    }}
                  >
                    {form.watch('date') ? format(form.watch('date')!, "dd/MM/yyyy") : <span className="text-muted-foreground">Escolha</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                  <DialogContent className="sm:max-w-[425px] w-[95vw] p-0 border-none shadow-2xl overflow-hidden">
                    <DialogHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                      <DialogTitle className="text-sm font-bold">Selecionar Data</DialogTitle>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsStartDateOpen(false)}><X className="h-4 w-4" /></Button>
                    </DialogHeader>
                    <div className="flex flex-col items-center">
                      <Calendar mode="single" selected={activeDate} onSelect={(d) => { if(d) { setActiveDate(d); if(lastClick && isSameDay(lastClick.date, d) && (Date.now()-lastClick.time) < 300) { if(!richDayInfo(d)?.isBlocked) form.setValue('date', d, { shouldDirty: true }); setIsStartDateOpen(false); } setLastClick({date:d, time:Date.now()}); } }} initialFocus locale={ptBR} getDayInfo={richDayInfo} />
                      {calendarFooter}
                      <div className="p-3 pt-0 w-full bg-muted/20">
                        <Button 
                          type="button" 
                          className="w-full h-11 font-bold bg-primary text-white" 
                          disabled={!activeDate}
                          onClick={() => {
                            if (activeDate) {
                              if (!richDayInfo(activeDate)?.isBlocked) {
                                form.setValue('date', activeDate, { shouldDirty: true });
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
              </div>
              {!isSingleDay && (
                <div className="space-y-1 flex flex-col">
                  <Label className="font-bold text-sm">Término</Label>
                  <Dialog open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="h-12 w-full text-left font-normal px-3" 
                      disabled={eventTypeWatch === 'Visita do Superintendente'} 
                      onClick={() => {
                        setActiveDate(form.getValues('endDate') || new Date());
                        setIsEndDateOpen(true);
                      }}
                    >
                      {form.watch('endDate') ? format(form.watch('endDate')!, "dd/MM/yyyy") : <span className="text-muted-foreground">Escolha</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                    <DialogContent className="sm:max-w-[425px] w-[95vw] p-0 border-none shadow-2xl overflow-hidden">
                      <DialogHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                        <DialogTitle className="text-sm font-bold">Selecionar Data de Término</DialogTitle>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEndDateOpen(false)}><X className="h-4 w-4" /></Button>
                      </DialogHeader>
                      <div className="flex flex-col items-center">
                        <Calendar mode="single" selected={activeDate} onSelect={(d) => { if(d) { setActiveDate(d); if(lastClick && isSameDay(lastClick.date, d) && (Date.now()-lastClick.time) < 300) { if(!richDayInfo(d)?.isBlocked) form.setValue('endDate', d, { shouldDirty: true }); setIsEndDateOpen(false); } setLastClick({date:d, time:Date.now()}); } }} initialFocus locale={ptBR} getDayInfo={richDayInfo} />
                        {calendarFooter}
                        <div className="p-3 pt-0 w-full bg-muted/20">
                          <Button 
                            type="button" 
                            className="w-full h-11 font-bold bg-primary text-white" 
                            disabled={!activeDate}
                            onClick={() => {
                              if (activeDate) {
                                if (!richDayInfo(activeDate)?.isBlocked) {
                                  form.setValue('endDate', activeDate, { shouldDirty: true });
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
                </div>
              )}
            </div>
            <DialogFooter className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-12 font-bold">Cancelar</Button>
              <Button type="submit" disabled={isSaving || !hasChanges} className="flex-1 h-12 font-bold bg-primary text-primary-foreground">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
