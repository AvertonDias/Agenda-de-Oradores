'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  PlusCircle, 
  Edit, 
  Loader2, 
  Plus, 
  Trash2, 
  Building, 
  Users,
  Search,
  Share2,
  CalendarDays,
  MapPin,
  ClipboardList,
  LogOut,
  Contact,
  Phone,
  FileUp,
  FileSpreadsheet,
  BookOpen,
  Star,
  Check
} from 'lucide-react';
import { HouseRoofIcon } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { setDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { Congregation, Speaker } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { talkTopics } from '@/lib/talk-topics';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn, formatPhoneNumber, cleanRawNumber } from '@/lib/utils';
import Link from 'next/link';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  isSameDay,
  setMonth,
  setYear,
  isWithinInterval
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const congregationSchema = z.object({
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

const speakerSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.'),
  phoneNumber: z.string().optional(),
  availableTopics: z.array(z.string()).min(1, 'Selecione ao menos um tema.'),
  homeCongregationId: z.string().min(1, 'A congregação é obrigatória.'),
  onlyLocal: z.boolean(),
});

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

const getDayOfWeekIndex = (dayName: string): number | null => {
  if (!dayName) return null;
  const d = dayName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (d.includes('dom')) return 0;
  if (d.includes('seg')) return 1;
  if (d.includes('ter')) return 2;
  if (d.includes('qua')) return 3;
  if (d.includes('qui')) return 4;
  if (d.includes('sex')) return 5;
  if (d.includes('sab')) return 6;
  return null;
};

const getJwSearchUrl = (name?: string, address?: string) => {
  const queryParts = [];
  if (name) queryParts.push(name);
  if (address) queryParts.push(address);
  const searchStr = queryParts.join(" ").trim();
  const queryParam = encodeURIComponent(searchStr);
  return `https://hub.jw.org/meetings/pt?q=%7B%22location%22:%22${queryParam}%22%7D`;
};

const HighlightedText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${highlight})`, "gi"));
  return (<span>{parts.map((part, i) => part.toLowerCase() === highlight.toLowerCase() ? (<mark key={i} className="bg-primary/20 text-primary font-bold rounded-sm px-0.5">{part}</mark>) : (part))}</span>);
};

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const AVAILABLE_YEARS = Array.from({ length: 11 }, (_, i) => 2024 + i);

export default function CongregacoesPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCongregation, setEditingCongregation] = useState<Congregation | null>(null);
  const [rawJwData, setRawJwData] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importStage, setImportStage] = useState<'upload_congs' | 'preview_congs' | 'upload_speakers' | 'preview_speakers'>('upload_congs');
  const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
  const [localCongIndex, setLocalCongIndex] = useState<number | null>(null);
  const [contactChoice, setContactChoice] = useState<{ name: string, numbers: string[], index: number, formType: 'add' | 'edit' | 'speaker' } | null>(null);
  const [isSpeakerEditDialogOpen, setIsSpeakerEditDialogOpen] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
  const [speakerTopicSearch, setSpeakerTopicSearch] = useState('');
  const [congregationToDelete, setCongregationToDelete] = useState<Congregation | null>(null);
  const [speakerToDelete, setSpeakerToDelete] = useState<Speaker | null>(null);
  const [isShareArrangementDialogOpen, setIsShareArrangementDialogOpen] = useState(false);
  const [sharingNeighbor, setSharingNeighbor] = useState<Congregation | null>(null);
  const [shareMonth, setShareMonth] = useState(new Date().getMonth());
  const [shareYear, setShareYear] = useState(new Date().getFullYear());
  const [includeOutgoing, setIncludeOutgoing] = useState(true);
  const [includeIncoming, setIncludeIncoming] = useState(true);
  const [isShareSpeakersDialogOpen, setIsShareSpeakersDialogOpen] = useState(false);
  const [sharingNeighborForSpeakers, setSharingNeighborForSpeakers] = useState<Congregation | null>(null);
  const [shareSpeakersStep, setShareSpeakersStep] = useState<'options' | 'select'>('options');
  const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<string[]>([]);
  const [isShareLocalScheduleDialogOpen, setIsShareLocalScheduleDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const myCongregationQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'congregations'), where('authorizedUsers', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: myCongs, isLoading: isLoadingMyCong } = useCollection<Congregation>(myCongregationQuery);
  const myCong = myCongs?.[0];

  const neighborsQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'neighbors'); }, [firestore, myCong?.id]);
  const speakersQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'speakers'); }, [firestore, myCong?.id]);
  const talksQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'scheduledTalks'); }, [firestore, myCong?.id]);
  const eventsQuery = useMemoFirebase(() => { if (!firestore || !myCong?.id) return null; return collection(firestore, 'congregations', myCong.id, 'events'); }, [firestore, myCong?.id]);

  const { data: neighborsData } = useCollection<Congregation>(neighborsQuery);
  const { data: speakersData } = useCollection<Speaker>(speakersQuery);
  const { data: talksData } = useCollection<any>(talksQuery);
  const { data: eventsData } = useCollection<any>(eventsQuery);

  const mySpeakersCount = useMemo(() => {
    if (!speakersData || !myCong) return 0;
    return speakersData.filter(s => s.homeCongregationId === myCong.id).length;
  }, [speakersData, myCong]);

  const filteredNeighbors = useMemo(() => {
    if (!neighborsData) return [];
    const searchLower = searchQuery.toLowerCase();
    return neighborsData.filter(n => n.name.toLowerCase().includes(searchLower) || n.address.toLowerCase().includes(searchLower)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [neighborsData, searchQuery]);

  const sortedNeighborsList = useMemo(() => {
    if (!neighborsData) return [];
    return [...neighborsData].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [neighborsData]);

  const editForm = useForm<z.infer<typeof congregationSchema>>({
    resolver: zodResolver(congregationSchema),
    defaultValues: { name: '', address: '', coordinates: '', coordinators: [{ name: '', phone: '' }], meetingDay: '', meetingTime: '' }
  });

  const { fields: editFields, append: editAppend, remove: editRemove } = useFieldArray({ control: editForm.control, name: "coordinators" });

  const addForm = useForm<z.infer<typeof congregationSchema>>({
    resolver: zodResolver(congregationSchema),
    defaultValues: { name: '', address: '', coordinates: '', coordinators: [{ name: '', phone: '' }], meetingDay: '', meetingTime: '' }
  });

  const { fields: addFields, append: addAppend, remove: addRemove } = useFieldArray({ control: addForm.control, name: "coordinators" });

  const speakerForm = useForm<z.infer<typeof speakerSchema>>({
    resolver: zodResolver(speakerSchema),
    defaultValues: { name: '', phoneNumber: '', homeCongregationId: '', availableTopics: [], onlyLocal: false }
  });

  useEffect(() => {
    if (editingCongregation && isEditDialogOpen) {
      const schedule = editingCongregation.meetingSchedule || ''; 
      const [day, time] = schedule.split(',').map(s => s?.trim());
      editForm.reset({ name: editingCongregation.name, address: editingCongregation.address, coordinates: editingCongregation.coordinates || '', coordinators: editingCongregation.coordinators || [{ name: '', phone: '' }], meetingDay: day || '', meetingTime: time || '' });
    }
  }, [editingCongregation, isEditDialogOpen, editForm]);

  const filteredSpeakers = useMemo(() => { 
    if (!editingCongregation || !speakersData) return []; 
    return speakersData.filter(s => s.homeCongregationId === editingCongregation.id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')); 
  }, [editingCongregation, speakersData]);

  const handleEditSpeakerInTab = (speaker: Speaker) => { 
    setEditingSpeaker(speaker); speakerForm.reset({ name: speaker.name, phoneNumber: speaker.phoneNumber || '', availableTopics: speaker.availableTopics || [], homeCongregationId: speaker.homeCongregationId || '', onlyLocal: speaker.onlyLocal || false }); setIsSpeakerEditDialogOpen(true); 
  };

  const onSpeakerSubmit = (values: z.infer<typeof speakerSchema>) => {
    if (!firestore || !myCong) return; setIsLoading(true);
    const trimmed = values.name.trim(); if ((speakersData || []).some(s => s.id !== editingSpeaker?.id && s.name.toLowerCase() === trimmed.toLowerCase())) { toast({ variant: "destructive", title: "Erro", description: "Nome já cadastrado." }); setIsLoading(false); return; }
    const dat = { name: trimmed, phoneNumber: values.phoneNumber?.trim() || '', availableTopics: values.availableTopics, homeCongregationId: values.homeCongregationId, onlyLocal: values.onlyLocal };
    if (editingSpeaker) setDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'speakers', editingSpeaker.id), dat, { merge: true });
    else addDocumentNonBlocking(collection(firestore, 'congregations', myCong.id, 'speakers'), dat);
    setIsSpeakerEditDialogOpen(false); setEditingSpeaker(null); setIsLoading(false); toast({ title: "Salvo!" });
  };

  const parseJwData = (text: string, formType: 'add' | 'edit') => {
    const lines = text.split(/\n|\s{2,}/).map(l => l.trim()).filter(l => l.length > 0); if (lines.length < 1) return;
    let name = ''; let address = ''; let meetingDay = ''; let meetingTime = ''; let phone = ''; let coordinates = '';
    const weekendDays = ['domingo', 'sábado', 'sabado'];
    lines.forEach((line, index) => {
      const lowerLine = line.toLowerCase();
      if (index === 0) {
        let pot = line; ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo', 'sabado'].forEach(d => { const i = pot.toLowerCase().indexOf(d); if (i !== -1) pot = pot.substring(0, i).trim(); });
        name = pot.replace(/\s*-\s*$/, '').trim();
      }
      weekendDays.forEach(day => { if (lowerLine.includes(day)) { meetingDay = day.charAt(0).toUpperCase() + day.slice(1).replace('sabado', 'Sábado'); const tm = line.match(/(\d{1,2}:\d{2})/); if (tm) meetingTime = tm[1].padStart(5, '0'); } });
      if (line.includes(',') && /\d/.test(line) && line.length > 15 && !line.match(/(-?\d+\.\d+)/)) address = line;
      const ph = line.match(/(\d{2}[-\s]*9?\d{4}[-\s]?\d{4})|(\d{2}-9?\d{4}-9\d{4})/); if (ph && !phone) phone = ph[0];
      const co = line.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/); if (co) coordinates = co[0];
    });
    const f = formType === 'add' ? addForm : editForm;
    if (name) f.setValue('name', name); if (address) f.setValue('address', address); if (meetingDay) f.setValue('meetingDay', meetingDay); if (meetingTime) f.setValue('meetingTime', meetingTime); if (coordinates) f.setValue('coordinates', coordinates); if (phone) f.setValue('coordinators.0.phone', formatPhoneNumber(phone));
    toast({ title: "Dados processados!" });
  };

  const handlePickContact = async (index: number, formType: 'add' | 'edit' | 'speaker') => {
    if (!('contacts' in navigator && 'select' in (navigator as any).contacts)) { toast({ variant: "destructive", title: "Indisponível", description: "Seleção de contatos não suportada." }); return; }
    try {
      const prop = ['name', 'tel']; const opts = { multiple: false };
      const contacts = await (navigator as any).contacts.select(prop, opts);
      if (contacts && contacts.length > 0) {
        const contact = contacts[0]; const name = contact.name?.[0]?.trim() || ''; const tels = contact.tel || [];
        const apply = (ph: string) => {
          const fmt = formatPhoneNumber(cleanRawNumber(ph));
          if (formType === 'add') { if (name && !addForm.getValues(`coordinators.${index}.name`)) addForm.setValue(`coordinators.${index}.name`, name); addForm.setValue(`coordinators.${index}.phone`, fmt); }
          else if (formType === 'edit') { if (name && !editForm.getValues(`coordinators.${index}.name`)) editForm.setValue(`coordinators.${index}.name`, name); editForm.setValue(`coordinators.${index}.phone`, fmt); }
          else if (formType === 'speaker') { if (name && !speakerForm.getValues('name')) speakerForm.setValue('name', name); speakerForm.setValue('phoneNumber', fmt); }
        };
        if (tels.length === 1) apply(tels[0]); else if (tels.length > 1) setContactChoice({ name, numbers: tels, index, formType });
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

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !firestore || !myCong) return;
    setIsLoading(true); const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const parse = (content: string) => {
          const res = []; let row: string[] = []; let cur = ''; let inQ = false;
          for (let i = 0; i < content.length; i++) {
            const c = content[i]; const next = content[i + 1];
            if (c === '"') { if (inQ && next === '"') { cur += '"'; i++; } else inQ = !inQ; }
            else if (c === ',' && !inQ) { row.push(cur.trim()); cur = ''; }
            else if ((c === '\r' || c === '\n') && !inQ) { if (cur !== '' || row.length > 0) { row.push(cur.trim()); res.push(row); row = []; cur = ''; } if (c === '\r' && next === '\n') i++; }
            else cur += c;
          }
          if (cur !== '' || row.length > 0) { row.push(cur.trim()); res.push(row); }
          return res;
        };
        const rows = parse(text); if (rows.length <= 1) { toast({ variant: "destructive", title: "Inválido" }); setIsLoading(false); return; }
        const dataRows = rows.slice(1); const prev: any[] = [];
        if (importStage === 'upload_congs') {
          const exist = new Set([myCong.name.toLowerCase(), ...(neighborsData || []).map(n => n.name.toLowerCase())]);
          for (const row of dataRows) {
            const nm = row[0]; if (nm && !exist.has(nm.toLowerCase())) { prev.push({ name: nm, address: row[2] || '', coordinates: '', coordinators: [{ name: `${row[5] || ''} ${row[6] || ''}`.trim() || 'Coordenador', phone: formatPhoneNumber(row[7] || '') }], meetingSchedule: `${translateDay(row[3] || 'Sábado')}, ${row[4] || '19:00'}` }); exist.add(nm.toLowerCase()); }
          }
          setImportPreviewData(prev); setImportStage('preview_congs');
        } else if (importStage === 'upload_speakers') {
          const exist = new Set((speakersData || []).map(s => s.name.toLowerCase()));
          for (const row of dataRows) {
            const [nC, fN, lN, , , pM, , tm] = row; const full = `${fN || ''} ${lN || ''}`.trim();
            if (full && !exist.has(full.toLowerCase())) {
              const topics: string[] = []; (tm || '').replace(/"/g, '').split(/[,;]/).map(t => t.trim()).forEach(t => { const n = parseInt(t); if (!isNaN(n)) { const tp = talkTopics.find(tp => tp.id === n); if (tp) topics.push(`${tp.id}. ${tp.title}`); } });
              prev.push({ name: full, phoneNumber: formatPhoneNumber(pM || ''), homeCongregationName: (nC || '').toLowerCase(), availableTopics: topics, onlyLocal: false });
              exist.add(full.toLowerCase());
            }
          }
          setImportPreviewData(prev); setImportStage('preview_speakers');
        }
      } catch (err) { toast({ variant: "destructive", title: "Erro" }); } finally { setIsLoading(false); e.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const handleConfirmFinalImport = async () => {
    if (!firestore || !myCong) return; setIsLoading(true);
    try {
      if (importStage === 'preview_congs') {
        for (let i = 0; i < importPreviewData.length; i++) {
          const c = importPreviewData[i]; if (i === localCongIndex) setDocumentNonBlocking(doc(firestore, 'congregations', myCong.id), c, { merge: true });
          else addDocumentNonBlocking(collection(firestore, 'congregations', myCong.id, 'neighbors'), c);
        }
        toast({ title: "Importado!" }); setImportStage('upload_speakers'); setImportPreviewData([]); setLocalCongIndex(null);
      } else if (importStage === 'preview_speakers') {
        const map = new Map<string, string>(); map.set(myCong.name.toLowerCase(), myCong.id); (neighborsData || []).forEach(n => map.set(n.name.toLowerCase(), n.id));
        for (const s of importPreviewData) {
          const hId = map.get(s.homeCongregationName) || myCong.id; const { homeCongregationName, ...rest } = s;
          addDocumentNonBlocking(collection(firestore, 'congregations', myCong.id, 'speakers'), { ...rest, homeCongregationId: hId });
        }
        toast({ title: "Importado!" }); setImportStage('upload_congs'); setImportPreviewData([]); setIsImportDialogOpen(false);
      }
    } catch (err) { toast({ variant: "destructive", title: "Erro" }); } finally { setIsLoading(false); }
  };

  const onEditSubmit = (values: z.infer<typeof congregationSchema>) => {
    if (!editingCongregation || !firestore || !myCong) return; 
    setIsLoading(true);
    const trimmed = values.name.trim(); 
    const others = (neighborsData || []).filter(n => n.id !== editingCongregation.id);
    const dup = others.some(n => n.name.toLowerCase() === trimmed.toLowerCase()) || (editingCongregation.id !== myCong.id && myCong.name.toLowerCase() === trimmed.toLowerCase());
    if (dup) { 
      toast({ variant: "destructive", title: "Nome já existe" }); 
      setIsLoading(false); 
      return; 
    }

    const newMeetingSchedule = `${values.meetingDay}, ${values.meetingTime}`;
    const oldSchedule = editingCongregation.meetingSchedule || '';
    const [oldDayRaw, oldTimeRaw] = oldSchedule.split(',').map(s => s?.trim());
    const oldDay = oldDayRaw || '';
    const oldTime = oldTimeRaw || '';
    const newDay = values.meetingDay.trim();
    const newTime = values.meetingTime.trim();

    const upd = { 
      name: trimmed, 
      address: values.address.trim(), 
      coordinates: values.coordinates?.trim() || '', 
      coordinators: values.coordinators.map(c => ({ name: (c.name || '').trim(), phone: (c.phone || '').trim() })), 
      meetingSchedule: newMeetingSchedule 
    };
    
    const ref = editingCongregation.id === myCong.id 
      ? doc(firestore, 'congregations', myCong.id) 
      : doc(firestore, 'congregations', myCong.id, 'neighbors', editingCongregation.id);
      
    setDocumentNonBlocking(ref, upd, { merge: true });

    // Sincronizar todos os agendamentos já marcados para esta congregação na agenda
    const [newH, newM] = newTime.split(':').map(Number);
    const hasValidNewTime = !isNaN(newH) && !isNaN(newM);
    
    const oldDayIdx = getDayOfWeekIndex(oldDay);
    const newDayIdx = getDayOfWeekIndex(newDay);
    const dayChanged = oldDayIdx !== null && newDayIdx !== null && oldDayIdx !== newDayIdx;
    const timeChanged = newTime !== oldTime && hasValidNewTime;

    let updatedCount = 0;
    if (talksData && (timeChanged || dayChanged)) {
      const matchingTalks = (talksData || []).filter(t => t.congregationId === editingCongregation.id);
      
      matchingTalks.forEach(t => {
        if (!t.dateTime) return;
        const currentTalkDate = new Date(t.dateTime);
        if (isNaN(currentTalkDate.getTime())) return;
        
        const updatedDate = new Date(currentTalkDate);
        
        // Se o dia da reunião mudou e o discurso estava no dia antigo da semana, ajusta para o novo dia na mesma semana
        if (dayChanged && currentTalkDate.getDay() === oldDayIdx) {
          let diff = newDayIdx - oldDayIdx;
          if (diff > 3) diff -= 7;
          if (diff < -3) diff += 7;
          updatedDate.setDate(updatedDate.getDate() + diff);
        }
        
        // Atualiza horário da reunião se foi alterado
        if (hasValidNewTime) {
          updatedDate.setHours(newH, newM, 0, 0);
        }
        
        if (updatedDate.toISOString() !== t.dateTime) {
          updateDocumentNonBlocking(
            doc(firestore, 'congregations', myCong.id, 'scheduledTalks', t.id),
            { dateTime: updatedDate.toISOString() }
          );
          updatedCount++;
        }
      });
    }

    if (updatedCount > 0) {
      toast({ 
        title: 'Sucesso!', 
        description: updatedCount === 1 
          ? 'Congregação atualizada e 1 agendamento sincronizado na agenda.' 
          : `Congregação atualizada e ${updatedCount} agendamentos sincronizados na agenda.` 
      });
    } else {
      toast({ title: 'Sucesso!' });
    }

    setIsLoading(false); 
    setIsEditDialogOpen(false); 
    setEditingCongregation(null); 
    setRawJwData('');
  };

  const onAddSubmit = (values: z.infer<typeof congregationSchema>) => {
    if (!firestore || !myCong) return; setIsLoading(true);
    const trimmed = values.name.trim(); const dup = (neighborsData || []).some(n => n.name.toLowerCase() === trimmed.toLowerCase()) || myCong.name.toLowerCase() === trimmed.toLowerCase();
    if (dup) { toast({ variant: "destructive", title: "Nome já existe" }); setIsLoading(false); return; }
    const n = { name: trimmed, address: values.address.trim(), coordinates: values.coordinates?.trim() || '', coordinators: values.coordinators.map(c => ({ name: (c.name || '').trim(), phone: (c.phone || '').trim() })), meetingSchedule: `${values.meetingDay}, ${values.meetingTime}` };
    addDocumentNonBlocking(collection(firestore, 'congregations', myCong.id, 'neighbors'), n); toast({ title: 'Sucesso!' }); setIsLoading(false); setIsAddDialogOpen(false); addForm.reset(); setRawJwData('');
  };

  const handleDeleteCongregation = () => {
    if (!firestore || !myCong || !congregationToDelete) return;
    (speakersData || []).filter(s => s.homeCongregationId === congregationToDelete.id).forEach(s => deleteDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'speakers', s.id)));
    deleteDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'neighbors', congregationToDelete.id)); toast({ title: 'Excluída!' }); setCongregationToDelete(null);
  };

  const handleShareSpeakers = (neighbor: Congregation, type: 'full' | 'themesOnly', ids?: string[]) => {
    if (!myCong || !speakersData) return;
    let list = speakersData.filter(s => s.homeCongregationId === myCong.id && !s.onlyLocal); 
    if (list.length === 0) { toast({ variant: "destructive", title: "Sem oradores disponíveis para compartilhar" }); return; }
    let msg = '';
    if (type === 'full') {
      if (ids && ids.length > 0) list = list.filter(s => ids.includes(s.id));
      list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')); msg = `Olá, oradores de *${myCong.name}*:\n\n`;
      list.forEach(s => { msg += `👤 *${s.name}*\n`; if (s.availableTopics?.length) msg += `📚 Temas: ${s.availableTopics.map(t => t.split('. ')[0]).join(', ')}\n`; msg += `\n`; });
    } else {
      msg = `Olá, temas disponíveis em *${myCong.name}*:\n\n`;
      const all = Array.from(new Set(list.flatMap(s => s.availableTopics || []))).sort((a, b) => parseInt(a) - parseInt(b));
      all.forEach(t => { msg += `• ${t}\n`; });
    }
    const enc = encodeURIComponent(msg); const ph = (neighbor.coordinators?.[0]?.phone || '').replace(/\D/g, ''); let fin = ph; if (ph.length >= 10 && !ph.startsWith('55')) fin = `55${ph}`;
    window.open(fin ? `https://api.whatsapp.com/send?phone=${fin}&text=${enc}` : `https://api.whatsapp.com/send?text=${enc}`, '_blank');
  };

  const handleShareArrangement = (neighbor: Congregation, mon: number, yr: number, incOut: boolean, incIn: boolean) => {
    if (!myCong || !talksData || !speakersData) return;
    const date = setYear(setMonth(new Date(), mon), yr);
    const mName = format(date, 'MMMM', { locale: ptBR }).toUpperCase();
    let msg = `*ARRANJO DE ORADORES - ${mName} / ${yr}*\nDa Congregação *${myCong.name}* com a Congregação *${neighbor.name}*\n\n`;
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const interval = { start, end };
  
    if (incOut) {
      const out = (talksData || [])
        .filter(t => t.congregationId === neighbor.id && isWithinInterval(new Date(t.dateTime), interval))
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      if (out.length) {
        msg += `📤 *VAMOS ENVIAR:*\n`;
        out.forEach(t => {
          const s = speakersData.find(s => s.id === t.speakerId);
          msg += `• *${format(new Date(t.dateTime), "dd/MM")}*: ${s?.name || '---'}\n`;
          msg += `📚 *Tema*: ${t.topic}\n`;
          msg += `📱 *Contato*: ${s?.phoneNumber || '---'}\n\n`;
        });
      }
    }
  
    if (incIn) {
      const inc = (talksData || []).filter(t => t.congregationId === myCong.id && isWithinInterval(new Date(t.dateTime), interval));
      const nTalks = inc
        .filter(t => speakersData.find(s => s.id === t.speakerId)?.homeCongregationId === neighbor.id)
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      if (nTalks.length) {
        msg += `📥 *VOCÊS ENVIAM:*\n`;
        nTalks.forEach(t => {
          const s = speakersData.find(s => s.id === t.speakerId);
          msg += `• *${format(new Date(t.dateTime), "dd/MM")}*: ${s?.name || '---'}\n`;
          msg += `📚 *Tema*: ${t.topic}\n\n`;
        });
      }
    }
  
    msg += `*${myCong.name}:*\n`;
    msg += `${myCong.address}\n`;
    msg += `*Reunião no ${myCong.meetingSchedule}*\n`;
    const co = myCong.coordinates ? myCong.coordinates.trim().replace(/\s+/g, ',') : encodeURIComponent(myCong.address);
    msg += `📍 *Localização*: https://www.google.com/maps/search/?api=1&query=${co}\n\n`;
  
    const sender = myCong.coordinators || [];
    const sStr = sender.map(c => `${c.name} ${c.phone}`).join(' ou ');
    if (sStr) msg += `Sobre o arranjo tratar com o irmão ${sStr}`;
  
    const enc = encodeURIComponent(msg);
    const ph = (neighbor.coordinators?.[0]?.phone || '').replace(/\D/g, '');
    let fin = ph;
    if (ph.length >= 10 && !ph.startsWith('55')) {
      fin = `55${ph}`;
    }
    window.open(fin ? `https://api.whatsapp.com/send?phone=${fin}&text=${enc}` : `https://api.whatsapp.com/send?text=${enc}`, '_blank');
  };

  const handleShareLocalSchedule = (mon: number, yr: number) => {
    if (!myCong || !talksData || !speakersData) return;
    const date = setYear(setMonth(new Date(), mon), yr); const mName = format(date, 'MMMM', { locale: ptBR }).toUpperCase(); const start = startOfMonth(date); const end = endOfMonth(date); const interval = { start, end };
    const mTalks = (talksData || []).filter(t => isWithinInterval(new Date(t.dateTime), interval));
    const mEvents = (eventsData || []).filter((e: any) => { const s = new Date(e.date); const ed = e.endDate ? new Date(e.endDate) : s; return (s <= end && ed >= start); });
    const mySp = (speakersData || []).filter(s => s.homeCongregationId === myCong.id);
    let msg = `*PROGRAMAÇÃO COMPLETA - ${mName} DE ${yr}*\nCongregação: *${myCong.name}*\n\n`;
    if (mEvents.length) { msg += `📅 *EVENTOS:*\n`; mEvents.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach((e: any) => { const dt = e.endDate && !isSameDay(new Date(e.date), new Date(e.endDate)) ? `${format(new Date(e.date), "dd/MM")} a ${format(new Date(e.endDate), "dd/MM")}` : format(new Date(e.date), "dd/MM"); msg += `• *${dt}*: ${e.title} (${e.type})\n`; }); msg += `\n`; }
    const inc = mTalks.filter(t => t.congregationId === myCong.id && !mySp.some(s => s.id === t.speakerId));
    if (inc.length) { msg += `📥 *RECEBENDO:*\n`; inc.sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).forEach(t => { const s = speakersData.find(s => s.id === t.speakerId); const or = neighborsData?.find(n => n.id === s?.homeCongregationId)?.name || 'Congregação vizinha'; msg += `• *${format(new Date(t.dateTime), "dd/MM")}*: ${s?.name || '---'} - ${t.topic} (${or})\n`; }); msg += `\n`; }
    const loc = mTalks.filter(t => t.congregationId === myCong.id && mySp.some(s => s.id === t.speakerId));
    if (loc.length) { msg += `🏠 *LOCAL (CASA):*\n`; loc.sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).forEach(t => { const s = speakersData.find(s => s.id === t.speakerId); msg += `• *${format(new Date(t.dateTime), "dd/MM")}*: ${s?.name || '---'} - ${t.topic}\n`; }); msg += `\n`; }
    const out = mTalks.filter(t => t.congregationId !== myCong.id && mySp.some(s => s.id === t.speakerId));
    if (out.length) { msg += `📤 *SAINDO:*\n`; out.sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).forEach(t => { const s = speakersData.find(s => s.id === t.speakerId); const de = neighborsData?.find(n => n.id === t.congregationId)?.name || 'Destino'; msg += `• *${format(new Date(t.dateTime), "dd/MM")}*: ${s?.name || '---'} - ${t.topic} (${de})\n`; }); msg += `\n`; }
    const enc = encodeURIComponent(msg); const ph = (myCong.coordinators?.[0]?.phone || '').replace(/\D/g, ''); let fin = ph; if (ph.length >= 10 && !ph.startsWith('55')) fin = `55${ph}`;
    window.open(fin ? `https://api.whatsapp.com/send?phone=${fin}&text=${enc}` : `https://api.whatsapp.com/send?text=${enc}`, '_blank');
  };

  if (isLoadingMyCong) return <div className="p-20 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" /></div>;
  if (!myCong) return <div className="p-20 text-center"><Building className="mx-auto h-12 w-12 text-muted-foreground" /><h2 className="text-xl font-bold mt-4 font-headline">Configuração Necessária</h2><Link href="/setup"><Button className="mt-4 bg-accent text-accent-foreground" type="button">Configurar Agora</Button></Link></div>;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">Congregações</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-fit">
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) { addForm.reset(); setRawJwData(''); } }}><DialogTrigger asChild><Button className="gap-2 bg-primary text-primary-foreground w-full md:w-fit h-11" type="button"><PlusCircle className="h-4 w-4" /> Adicionar Congregação</Button></DialogTrigger><DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[95vh] overflow-y-auto shadow-2xl border-none"><DialogHeader><DialogTitle className="text-xl font-headline">Adicionar Congregação</DialogTitle></DialogHeader>
            <div className="p-3 bg-muted/50 rounded-lg border border-dashed mb-3"><a href={getJwSearchUrl(addForm.watch('name'), addForm.watch('address'))} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline">Importar do JW.org</a><Textarea placeholder="Cole aqui os dados..." className="text-[10px] h-20 mt-2" value={rawJwData} onChange={(e) => { setRawJwData(e.target.value); parseJwData(e.target.value, 'add'); }} /></div>
            <Form {...addForm}><form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-3">
              <FormField control={addForm.control} name="name" render={({ field }) => (<FormItem><FormLabel className="text-sm font-bold">Nome</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
              <FormField control={addForm.control} name="address" render={({ field }) => (<FormItem><FormLabel className="text-sm font-bold">Endereço</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
              <div className="grid grid-cols-2 gap-3"><FormField control={addForm.control} name="meetingDay" render={({ field }) => (<FormItem><FormLabel className="text-sm font-bold">Dia</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger type="button"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Sábado">Sábado</SelectItem><SelectItem value="Domingo">Domingo</SelectItem><SelectItem value="Sexta">Sexta</SelectItem><SelectItem value="Quinta">Quinta</SelectItem><SelectItem value="Quarta">Quarta</SelectItem><SelectItem value="Terça">Terça</SelectItem><SelectItem value="Segunda">Segunda</SelectItem></SelectContent></Select></FormItem>)} /><FormField control={addForm.control} name="meetingTime" render={({ field }) => (<FormItem><FormLabel className="text-sm font-bold">Horário</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>)} /></div>
              <div className="space-y-3 rounded-lg border p-3 bg-muted/20"><div className="flex items-center justify-between"><FormLabel className="text-sm font-bold">Coordenadores</FormLabel><Button type="button" variant="outline" size="sm" onClick={() => addAppend({ name: '', phone: '' })}><Plus className="h-3.5 w-3.5" /></Button></div>{addFields.map((f, i) => (<div key={f.id} className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 bg-background rounded-md border relative">{i > 0 && (<Button type="button" variant="ghost" size="icon" className="absolute right-0.5 top-0.5 text-destructive" onClick={() => addRemove(i)}><Trash2 className="h-3 v-3" /></Button>)}<FormField control={addForm.control} name={`coordinators.${i}.name`} render={({ field }) => (<FormItem><FormControl><Input {...field} placeholder="Nome" className="h-8" /></FormControl></FormItem>)} /><FormField control={addForm.control} name={`coordinators.${i}.phone`} render={({ field }) => (<FormItem><div className="flex gap-1"><FormControl><Input {...field} onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))} placeholder="Telefone" className="h-8 flex-1" /></FormControl><Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePickContact(i, 'add')}><Contact className="h-3.5 w-3.5" /></Button></div></FormItem>)} /></div>))}</div>
              <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1 h-10">Cancelar</Button><Button type="submit" disabled={isLoading} className="flex-1 h-10">Salvar</Button></div>
            </form></Form></DialogContent></Dialog>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}><DialogTrigger asChild><Button variant="outline" className="gap-2 h-11 border-dashed border-primary text-primary" type="button"><FileUp className="h-4 w-4" /> Importar CSV</Button></DialogTrigger><DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[95vh] overflow-y-auto shadow-2xl border-none"><DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> Importar Dados</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">{importStage.includes('upload') ? (<><div className="bg-muted/50 p-4 rounded-lg text-[11px] font-mono break-all border">Confirme as colunas do arquivo exportado do NW Scheduler.</div><div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 bg-muted/10"><label className="cursor-pointer flex flex-col items-center"><FileUp className="h-10 w-10 text-primary mb-2" /><span className="text-sm font-bold">Selecionar CSV</span><input type="file" accept=".csv" className="hidden" onChange={handleCsvFileChange} /></label></div></>) : (
              <div className="space-y-4"><ScrollArea className="h-64 border rounded-lg p-2 bg-muted/5">{importPreviewData.map((it, idx) => (<div key={idx} className={cn("p-2 bg-background border rounded mb-2 flex justify-between items-center", idx === localCongIndex && "ring-2 ring-primary")}><div><div className="text-sm font-bold text-primary">{it.name}</div><div className="text-[10px] text-muted-foreground">{it.address || `${it.availableTopics?.length || 0} temas`}</div></div>{importStage === 'preview_congs' && (<Button variant={idx === localCongIndex ? "default" : "outline"} size="sm" className="h-7 text-[10px]" type="button" onClick={() => setLocalCongIndex(localCongIndex === idx ? null : idx)}>Minha</Button>)}</div>))}</ScrollArea><div className="flex gap-2"><Button variant="outline" className="flex-1" type="button" onClick={() => setImportStage(importStage === 'preview_congs' ? 'upload_congs' : 'upload_speakers')}>Voltar</Button><Button className="flex-1 font-bold" onClick={handleConfirmFinalImport} disabled={isLoading}>Confirmar</Button></div></div>
            )}</div></DialogContent></Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-border/50 rounded-2xl shadow-sm bg-card relative hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20 transition-all duration-200 ease-in-out group overflow-hidden">
          <div className="absolute left-0 top-0 w-1.5 h-full bg-primary/30" />
          <div className="absolute bottom-2 right-2 flex gap-1 z-10">
            <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/50 backdrop-blur-sm border shadow-sm" type="button" onClick={() => { setEditingCongregation(myCong); setIsEditDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
          </div>
          <CardHeader className="pb-2"><Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary w-fit">Minha Congregação</Badge><CardTitle className="text-xl font-headline pt-1 pr-14 font-bold">{myCong.name}</CardTitle></CardHeader>
          <CardContent className="space-y-3"><div className="flex items-start gap-2 text-sm text-muted-foreground"><Building className="h-4 w-4 shrink-0" /><span>{myCong.address}</span></div><div className="flex items-center justify-between text-sm font-medium border-t pt-2 mt-2"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><span>Reunião: {myCong.meetingSchedule}</span></div><div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-muted/20 px-2 py-0.5 rounded-full border"><Users className="h-3.5 w-3.5 text-primary" /><span>{mySpeakersCount}</span></div></div></CardContent>
          <CardFooter className="pt-2 border-t flex justify-between items-center p-3 bg-muted/5"><Button variant="ghost" size="icon" className="h-8 w-8 text-primary" type="button" onClick={() => setIsShareLocalScheduleDialogOpen(true)}><ClipboardList className="h-4 w-4" /></Button></CardFooter>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 px-1"><div className="flex items-center gap-2"><h2 className="text-lg font-bold font-headline">Congregações Vizinhas</h2><span className="text-xs text-muted-foreground">({filteredNeighbors.length})</span></div><div className="relative w-full"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input type="search" placeholder="Pesquisar..." className="pl-8 h-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div>
        {!neighborsData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border/50 rounded-2xl p-5 space-y-4 animate-pulse relative overflow-hidden">
                <div className="absolute left-0 top-0 w-1.5 h-full bg-muted" />
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
                <div className="space-y-2 pt-2">
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNeighbors.map(n => (
              <Card key={n.id} className="border border-border/50 rounded-2xl shadow-sm relative hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20 transition-all duration-200 ease-in-out group bg-card overflow-hidden">
                <div className="absolute left-0 top-0 w-1.5 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                <div className="absolute bottom-2 right-2 flex gap-1 z-10">
                  <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/50 backdrop-blur-sm border shadow-sm" type="button" onClick={() => { setEditingCongregation(n); setIsEditDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive bg-background/50 backdrop-blur-sm border shadow-sm" type="button" onClick={() => setCongregationToDelete(n)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <CardHeader className="pb-2"><CardTitle className="text-base font-headline font-bold pr-14 leading-tight">{n.name}</CardTitle></CardHeader>
                <CardContent className="pb-3 text-sm space-y-2">
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2 min-h-[40px]">{n.address}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold border-t pt-2 mt-2">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      <span>{n.meetingSchedule}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-muted/20 px-2 py-0.5 rounded-full border">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      <span>{speakersData?.filter(s => s.homeCongregationId === n.id).length || 0}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-2 border-t flex justify-between items-center p-3 bg-muted/5">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" type="button" onClick={() => { setSharingNeighbor(n); setIsShareArrangementDialogOpen(true); }}>
                      <CalendarDays className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" type="button" onClick={() => { setSharingNeighborForSpeakers(n); setIsShareSpeakersDialogOpen(true); }}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { setEditingCongregation(null); setRawJwData(''); } }}><DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[95vh] overflow-y-auto shadow-2xl border-none"><DialogHeader className="relative"><DialogTitle className="text-xl font-headline">Editar {editingCongregation?.name}</DialogTitle></DialogHeader>
        <Tabs defaultValue="info" className="w-full"><TabsList className="grid w-full grid-cols-2 mb-3"><TabsTrigger value="info">Informações</TabsTrigger><TabsTrigger value="speakers">Oradores</TabsTrigger></TabsList>
          <TabsContent value="info">
            <div className="p-3 bg-muted/50 rounded-lg border border-dashed mb-3"><a href={getJwSearchUrl(editForm.watch('name'), editForm.watch('address'))} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline">Importar do JW.org</a><Textarea placeholder="Cole dados aqui..." className="text-[10px] h-20 mt-2" value={rawJwData} onChange={(e) => { setRawJwData(e.target.value); parseJwData(e.target.value, 'edit'); }} /></div>
            <Form {...editForm}><form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-3">
              <FormField control={editForm.control} name="name" render={({ field }) => (<FormItem><FormLabel className="text-sm font-bold">Nome</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
              <FormField control={editForm.control} name="address" render={({ field }) => (<FormItem><FormLabel className="text-sm font-bold">Endereço</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
              <FormField control={editForm.control} name="coordinates" render={({ field }) => (<FormItem><FormLabel className="text-sm font-bold">Coordenadas</FormLabel><FormControl><Input {...field} placeholder="Ex: -21.176, -47.820" /></FormControl></FormItem>)} />
              <div className="grid grid-cols-2 gap-3"><FormField control={editForm.control} name="meetingDay" render={({ field }) => (<FormItem><FormLabel className="text-sm font-bold">Dia</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger type="button"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Sábado">Sábado</SelectItem><SelectItem value="Domingo">Domingo</SelectItem><SelectItem value="Sexta">Sexta</SelectItem><SelectItem value="Quinta">Quinta</SelectItem><SelectItem value="Quarta">Quarta</SelectItem><SelectItem value="Terça">Terça</SelectItem><SelectItem value="Segunda">Segunda</SelectItem></SelectContent></Select></FormItem>)} /><FormField control={editForm.control} name="meetingTime" render={({ field }) => (<FormItem><FormLabel className="text-sm font-bold">Horário</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>)} /></div>
              <div className="space-y-3 rounded-lg border p-3 bg-muted/20"><div className="flex items-center justify-between"><FormLabel className="text-sm font-bold">Coordenadores</FormLabel><Button type="button" variant="outline" size="sm" onClick={() => editAppend({ name: '', phone: '' })}><Plus className="h-3.5 w-3.5" /></Button></div>{editFields.map((f, i) => (<div key={f.id} className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 bg-background rounded-md border relative">{i > 0 && (<Button type="button" variant="ghost" size="icon" className="absolute right-0.5 top-0.5 text-destructive" onClick={() => editRemove(i)}><Trash2 className="h-3 w-3" /></Button>)}<FormField control={editForm.control} name={`coordinators.${i}.name`} render={({ field }) => (<FormItem><FormControl><Input {...field} placeholder="Nome" className="h-8" /></FormControl></FormItem>)} /><FormField control={editForm.control} name={`coordinators.${i}.phone`} render={({ field }) => (<FormItem><div className="flex gap-1"><FormControl><Input {...field} onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))} placeholder="Telefone" className="h-8 flex-1" /></FormControl><Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePickContact(i, 'edit')}><Contact className="h-3.5 w-3.5" /></Button></div></FormItem>)} /></div>))}</div>
              <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1 h-10">Cancelar</Button><Button type="submit" disabled={isLoading} className="flex-1 h-10">Atualizar</Button></div>
            </form></Form>
          </TabsContent>
          <TabsContent value="speakers"><div className="py-2 space-y-3 px-1"><Button onClick={() => { setEditingSpeaker(null); speakerForm.reset({ name: '', phoneNumber: '', availableTopics: [], homeCongregationId: editingCongregation?.id || '', onlyLocal: false }); setIsSpeakerEditDialogOpen(true); }} className="w-full gap-2 mb-2 bg-primary/10 text-primary border-none shadow-none font-bold" variant="outline" type="button"><PlusCircle className="h-4 w-4" /> Novo Orador</Button><div className="space-y-2">{filteredSpeakers.map(s => (<div key={s.id} className="flex items-center justify-between p-2 border rounded-lg bg-background shadow-sm cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleEditSpeakerInTab(s)}><div><div className="font-semibold text-sm">{s.name}</div><div className="text-xs text-muted-foreground">{s.phoneNumber || 'Sem telefone'}</div>{s.onlyLocal && <Badge variant="outline" className="text-[8px] h-3 py-0 px-1 mt-1">SÓ LOCAL</Badge>}</div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 bg-background border" type="button" onClick={(e) => { e.stopPropagation(); handleEditSpeakerInTab(s); }}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive bg-background border" type="button" onClick={(e) => { e.stopPropagation(); setSpeakerToDelete(s); }}><Trash2 className="h-4 w-4" /></Button></div></div>))}</div><div className="pt-4 border-t"><Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full h-10 gap-2" type="button"><LogOut className="h-4 w-4" /> Sair</Button></div></div></TabsContent>
        </Tabs></DialogContent></Dialog>

      <Dialog open={isSpeakerEditDialogOpen} onOpenChange={setIsSpeakerEditDialogOpen}><DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[95vh] overflow-y-auto shadow-2xl border-none"><DialogHeader><DialogTitle className="text-xl font-headline">{editingSpeaker ? `Editar Orador` : 'Novo Orador'}</DialogTitle></DialogHeader>
        <Form {...speakerForm}><form onSubmit={speakerForm.handleSubmit(onSpeakerSubmit)} className="space-y-3">
          <FormField control={speakerForm.control} name="name" render={({ field }) => (<FormItem><FormLabel className="text-sm font-bold">Nome</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
          <FormField control={speakerForm.control} name="homeCongregationId" render={({ field }) => (<FormItem><FormLabel className="text-sm font-bold">Origem</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger type="button"><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl><SelectContent>{myCong && <SelectItem value={myCong.id}>{myCong.name} (Minha)</SelectItem>}{sortedNeighborsList.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}</SelectContent></Select></FormItem>)} />
          <FormField control={speakerForm.control} name="phoneNumber" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-bold">Telefone (Opcional)</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input {...field} onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))} className="h-11 flex-1" />
                </FormControl>
                <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => handlePickContact(0, 'speaker')}>
                  <Contact className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight mt-1">
                <strong>Dica:</strong> Para selecionar diretamente da agenda de contatos do seu celular, abra o app em uma nova aba (fora do editor).
              </p>
            </FormItem>
          )} />
          
          {speakerForm.watch('homeCongregationId') === myCong?.id && (
            <FormField control={speakerForm.control} name="onlyLocal" render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 bg-muted/20">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-bold cursor-pointer">Não faz discurso fora</FormLabel>
                  <p className="text-[10px] text-muted-foreground">Se marcado, o orador não aparecerá para agendamentos em outras congregações.</p>
                </div>
              </FormItem>
            )} />
          )}

          <FormField control={speakerForm.control} name="availableTopics" render={({ field }) => {
            const filteredTopics = talkTopics.filter(t => t.title.toLowerCase().includes(speakerTopicSearch.toLowerCase()) || t.id.toString().includes(speakerTopicSearch));
            const selected = filteredTopics.filter(t => field.value.includes(`${t.id}. ${t.title}`));
            const unselected = filteredTopics.filter(t => !field.value.includes(`${t.id}. ${t.title}`));
            return (
              <FormItem><FormLabel className="text-sm font-bold">Temas Disponíveis ({field.value.length})</FormLabel><div className="space-y-2 mt-1"><div className="flex items-center gap-2 px-2 border rounded-md h-10"><Search className="h-4 w-4 text-muted-foreground" /><Input placeholder="Pesquisar..." value={speakerTopicSearch} onChange={(e) => setSpeakerTopicSearch(e.target.value)} className="h-9 text-sm border-0 bg-transparent w-full shadow-none" /></div>
                <ScrollArea className="h-[250px] border rounded-md p-1 bg-muted/5">
                  {selected.length > 0 && (
                    <div className="mb-2">
                      <div className="px-2 py-1 text-[10px] font-bold text-primary uppercase bg-primary/5 rounded-sm mb-1 flex items-center gap-1">
                        <Star className="h-3 w-3 fill-primary" /> Repertório Atual
                      </div>
                      {selected.map(t => {
                        const tStr = `${t.id}. ${t.title}`;
                        return (<div key={t.id} onClick={() => field.onChange(field.value.filter(v => v !== tStr))} className={cn("flex items-start gap-2 p-1.5 rounded cursor-pointer hover:bg-muted text-sm bg-primary/10 text-primary font-bold")}><div className="h-4 w-4 shrink-0 border rounded-sm mt-0.5 flex items-center justify-center bg-primary border-primary text-white"><Check className="h-3.5 w-3.5" /></div><span className="font-bold min-w-[20px]">{t.id}.</span><span><HighlightedText text={t.title} highlight={speakerTopicSearch} /></span></div>);
                      })}
                      <Separator className="my-2" />
                    </div>
                  )}
                  {unselected.map(t => {
                    const tStr = `${t.id}. ${t.title}`;
                    return (<div key={t.id} onClick={() => field.onChange([...field.value, tStr])} className="flex items-start gap-2 p-1.5 rounded cursor-pointer hover:bg-muted text-sm"><div className="h-4 w-4 shrink-0 border rounded-sm mt-0.5 border-muted-foreground/30 flex items-center justify-center"></div><span className="font-bold min-w-[20px]">{t.id}.</span><span><HighlightedText text={t.title} highlight={speakerTopicSearch} /></span></div>);
                  })}
                </ScrollArea></div></FormItem>
            );
          }} />
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setIsSpeakerEditDialogOpen(false)} className="flex-1 h-10">Cancelar</Button><Button type="submit" disabled={isLoading} className="flex-1 h-10">Salvar</Button></div>
        </form></Form></DialogContent></Dialog>

      <Dialog open={!!contactChoice} onOpenChange={(o) => !o && setContactChoice(null)}><DialogContent className="sm:max-w-[425px] w-[95vw] shadow-2xl border-none"><DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-headline"><Phone className="h-5 w-5 text-primary" /> Escolher Telefone</DialogTitle><DialogDescription>O contato <strong>{contactChoice?.name}</strong> possui múltiplos números.</DialogDescription></DialogHeader>
        <div className="grid gap-2 py-4">{contactChoice?.numbers.map((num, i) => (<Button key={i} variant="outline" className="justify-start h-12 text-base font-semibold" type="button" onClick={() => { const cleaned = cleanRawNumber(num); const ph = formatPhoneNumber(cleaned); if (contactChoice.formType === 'add') { if (contactChoice.name && !addForm.getValues(`coordinators.${contactChoice.index}.name`)) addForm.setValue(`coordinators.${contactChoice.index}.name`, contactChoice.name); addForm.setValue(`coordinators.${contactChoice.index}.phone`, ph); } else if (contactChoice.formType === 'edit') { if (contactChoice.name && !editForm.getValues(`coordinators.${contactChoice.index}.name`)) editForm.setValue(`coordinators.${contactChoice.index}.name`, contactChoice.name); editForm.setValue(`coordinators.${contactChoice.index}.phone`, ph); } else if (contactChoice.formType === 'speaker') { if (contactChoice.name && !speakerForm.getValues('name')) speakerForm.setValue('name', contactChoice.name); speakerForm.setValue('phoneNumber', ph); } setContactChoice(null); }}><Phone className="mr-2 h-4 w-4 opacity-50" /> {formatPhoneNumber(cleanRawNumber(num))}</Button>))}</div>
        <div className="flex justify-end"><Button variant="ghost" type="button" onClick={() => setContactChoice(null)}>Cancelar</Button></div>
      </DialogContent></Dialog>

      <Dialog open={isShareLocalScheduleDialogOpen} onOpenChange={setIsShareLocalScheduleDialogOpen}><DialogContent className="sm:max-w-[425px] w-[95vw]"><DialogHeader><DialogTitle className="flex items-center gap-2 font-headline"><ClipboardList className="h-5 w-5 text-primary" /> Programação Mensal</DialogTitle><DialogDescription>Selecione o mês para o relatório completo.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-4"><div className="grid grid-cols-2 gap-2"><div><Label className="text-xs font-bold">Mês</Label><Select value={shareMonth.toString()} onValueChange={(v) => setShareMonth(parseInt(v))}><SelectTrigger className="h-10 text-sm" type="button"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => (<SelectItem key={i} value={i.toString()}>{m}</SelectItem>))}</SelectContent></Select></div><div><Label className="text-xs font-bold">Ano</Label><Select value={shareYear.toString()} onValueChange={(v) => setShareYear(parseInt(v))}><SelectTrigger className="h-10 text-sm" type="button"><SelectValue /></SelectTrigger><SelectContent>{AVAILABLE_YEARS.map(y => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}</SelectContent></Select></div></div><Button className="w-full h-12 gap-2 bg-green-600 hover:bg-green-700 text-white font-bold" type="button" onClick={() => { handleShareLocalSchedule(shareMonth, shareYear); setIsShareLocalScheduleDialogOpen(false); }}><Share2 className="h-4 w-4" /> Gerar no WhatsApp</Button></div>
        <Button variant="ghost" type="button" onClick={() => setIsShareLocalScheduleDialogOpen(false)} className="w-full">Fechar</Button></DialogContent></Dialog>

      <Dialog open={isShareArrangementDialogOpen} onOpenChange={setIsShareArrangementDialogOpen}><DialogContent className="sm:max-w-[425px] w-[95vw]"><DialogHeader><DialogTitle className="flex items-center gap-2 font-headline"><CalendarDays className="h-5 w-5 text-primary" /> Arranjo Mensal</DialogTitle><DialogDescription>Relatório para <strong>{sharingNeighbor?.name}</strong>.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-4"><div className="grid grid-cols-2 gap-2"><div><Label className="text-xs font-bold">Mês</Label><Select value={shareMonth.toString()} onValueChange={(v) => setShareMonth(parseInt(v))}><SelectTrigger className="h-10 text-sm" type="button"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => (<SelectItem key={i} value={i.toString()}>{m}</SelectItem>))}</SelectContent></Select></div><div><Label className="text-xs font-bold">Ano</Label><Select value={shareYear.toString()} onValueChange={(v) => setShareYear(parseInt(v))}><SelectTrigger className="h-10 text-sm" type="button"><SelectValue /></SelectTrigger><SelectContent>{AVAILABLE_YEARS.map(y => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}</SelectContent></Select></div></div><div className="flex flex-col gap-2 p-2 bg-muted/30 rounded border border-dashed"><div className="flex items-center space-x-2"><Checkbox id="sh-out" checked={includeOutgoing} onCheckedChange={(v) => setIncludeOutgoing(!!v)} /><Label htmlFor="sh-out" className="text-xs cursor-pointer">VAMOS ENVIAR</Label></div><div className="flex items-center space-x-2"><Checkbox id="sh-in" checked={includeIncoming} onCheckedChange={(v) => setIncludeIncoming(!!v)} /><Label htmlFor="sh-in" className="text-xs cursor-pointer">VOCÊS ENVIAM</Label></div></div><Button className="w-full h-12 gap-2 bg-green-600 hover:bg-green-700 text-white font-bold" type="button" onClick={() => { if(sharingNeighbor) handleShareArrangement(sharingNeighbor, shareMonth, shareYear, includeOutgoing, includeIncoming); setIsShareArrangementDialogOpen(false); }} disabled={!includeOutgoing && !includeIncoming}><Share2 className="h-4 w-4" /> Enviar p/ Coordenador</Button></div>
        <Button variant="ghost" type="button" onClick={() => setIsShareArrangementDialogOpen(false)} className="w-full">Fechar</Button></DialogContent></Dialog>

      <Dialog open={isShareSpeakersDialogOpen} onOpenChange={(o) => { setIsShareSpeakersDialogOpen(o); if(!o) setShareSpeakersStep('options'); }}><DialogContent className="sm:max-w-[425px] w-[95vw]"><DialogHeader><DialogTitle className="flex items-center gap-2 font-headline"><Users className="h-5 w-5 text-primary" /> Lista de Oradores</DialogTitle></DialogHeader>
        {shareSpeakersStep === 'options' ? (<div className="grid grid-cols-1 gap-3 py-4"><Button variant="outline" className="h-14 justify-start gap-3 border-primary/20" type="button" onClick={() => { if(sharingNeighborForSpeakers) handleShareSpeakers(sharingNeighborForSpeakers, 'themesOnly'); setIsShareSpeakersDialogOpen(false); }}><BookOpen className="h-5 w-5 text-primary" /><div><div className="font-bold text-sm">Apenas Temas</div><div className="text-[10px] text-muted-foreground">Lista de esboços</div></div></Button><Button variant="outline" className="h-14 justify-start gap-3 border-primary/20" type="button" onClick={() => { if(sharingNeighborForSpeakers) handleShareSpeakers(sharingNeighborForSpeakers, 'full'); setIsShareSpeakersDialogOpen(false); }}><Check className="h-5 w-5 text-primary" /><div><div className="font-bold text-sm">Lista Completa</div><div className="text-[10px] text-muted-foreground">Oradores e temas</div></div></Button><Button variant="outline" className="h-14 justify-start gap-3 border-primary/20" type="button" onClick={() => { setSelectedSpeakerIds([]); setShareSpeakersStep('select'); }}><Plus className="h-5 w-5 text-primary" /><div><div className="font-bold text-sm">Selecionar Específicos</div><div className="text-[10px] text-muted-foreground">Escolha os oradores</div></div></Button></div>) : (
          <div className="space-y-4 py-2"><ScrollArea className="h-64 border rounded p-2"><div className="space-y-1">{(speakersData || []).filter(s => s.homeCongregationId === myCong.id && !s.onlyLocal).sort((a,b) => a.name.localeCompare(b.name, 'pt-BR')).map(s => (<div key={s.id} onClick={() => setSelectedSpeakerIds(p => p.includes(s.id) ? p.filter(id => id !== s.id) : [...p, s.id])} className={cn("flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted text-sm", selectedSpeakerIds.includes(s.id) && "bg-primary/10 text-primary font-bold")}><div className={cn("h-4 w-4 border rounded flex items-center justify-center", selectedSpeakerIds.includes(s.id) ? "bg-primary border-primary text-white" : "border-muted-foreground")}>{selectedSpeakerIds.includes(s.id) && <Check className="h-3" />}</div><span>{s.name}</span></div>))}</div></ScrollArea><Button className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold" type="button" disabled={!selectedSpeakerIds.length} onClick={() => { if(sharingNeighborForSpeakers) handleShareSpeakers(sharingNeighborForSpeakers, 'full', selectedSpeakerIds); setIsShareSpeakersDialogOpen(false); }}>Enviar ({selectedSpeakerIds.length})</Button><Button variant="ghost" type="button" className="w-full" onClick={() => setShareSpeakersStep('options')}>Voltar</Button></div>
        )}<Button variant="ghost" type="button" onClick={() => setIsShareSpeakersDialogOpen(false)} className="w-full">Fechar</Button></DialogContent></Dialog>

      <AlertDialog open={!!congregationToDelete} onOpenChange={(o) => !o && setCongregationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Congregação?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? <strong>Todos os oradores vinculados a ela também serão excluídos.</strong> Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCongregation} className="bg-destructive text-white hover:bg-destructive/90">Excluir Tudo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!speakerToDelete} onOpenChange={(o) => !o && setSpeakerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Orador?</AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente remover "{speakerToDelete?.name}" desta congregação?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (speakerToDelete && myCong) { deleteDocumentNonBlocking(doc(firestore, 'congregations', myCong.id, 'speakers', speakerToDelete.id)); setSpeakerToDelete(null); } }} className="bg-destructive text-white hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
