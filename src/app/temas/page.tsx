'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  BookOpen, 
  Search, 
  History, 
  Loader2, 
  Building,
  Filter,
  CheckCircle,
  Clock,
  User,
  Calendar as CalendarIcon,
  Sparkles,
  TrendingUp,
  RotateCcw,
  Info,
  Heart,
  Shield,
  Star,
  Users as UsersIcon,
  CheckCircle2,
  Tag,
  Crosshair,
  ScrollText,
  Compass,
  Zap,
  Globe
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { talkTopics, type TalkTopicCategory } from '@/lib/talk-topics';
import { format, isAfter, subMonths, isBefore, subYears, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { suggestThemes, type SuggestThemesOutput } from '@/ai/flows/suggest-themes-flow';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const CATEGORIES = [
  { id: 'Deus — Quem Ele é e suas qualidades', label: 'Deus e Suas Qualidades', icon: Heart, desc: 'Personalidade, amor e justiça.' },
  { id: 'Jesus Cristo', label: 'Jesus Cristo', icon: Crosshair, desc: 'Vida, papel e exemplo de Jesus.' },
  { id: 'Reino de Deus e Profecias', label: 'Reino e Profecias', icon: Globe, desc: 'Armagedom, julgamento e futuro.' },
  { id: 'Esperança futura', label: 'Esperança Futura', icon: Star, desc: 'Novo mundo e ressurreição.' },
  { id: 'Família e casamento', label: 'Família e Casamento', icon: UsersIcon, desc: 'Relacionamentos e criação de filhos.' },
  { id: 'Vida cristã e conduta', label: 'Vida Cristã e Conduta', icon: CheckCircle2, desc: 'Moralidade, amor e integridade.' },
  { id: 'Fé, espiritualidade e relação com Deus', label: 'Fé e Espiritualidade', icon: Shield, desc: 'Oração e confiança em Deus.' },
  { id: 'Bíblia e verdade', label: 'Bíblia e Verdade', icon: ScrollText, desc: 'Autoridade e confiança nas Escrituras.' },
  { id: 'Doutrinas bíblicas', label: 'Doutrinas Bíblicas', icon: Info, desc: 'Morte, Trindade, sangue e sábado.' },
  { id: 'Organização cristã', label: 'Organização Cristã', icon: Compass, desc: 'Congregação e pregação.' },
  { id: 'Mundo atual e desafios espirituais', label: 'Mundo Atual', icon: Zap, desc: 'Materialismo, pressões e tentações.' },
];

export default function TemasPage() {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  
  const [aiSuggestions, setAiSuggestions] = useState<SuggestThemesOutput | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isNeedsDialogOpen, setIsNeedsDialogOpen] = useState(false);
  const [localNeed, setLocalNeed] = useState('aleatório');

  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  const myCongQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'congregations'), where('authorizedUsers', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: myCongs, isLoading: isLoadingMyCong } = useCollection<any>(myCongQuery);
  const myCong = myCongs?.[0];

  const talksQuery = useMemoFirebase(() => {
    if (!firestore || !myCong?.id) return null;
    return collection(firestore, 'congregations', myCong.id, 'scheduledTalks');
  }, [firestore, myCong?.id]);

  const speakersQuery = useMemoFirebase(() => {
    if (!firestore || !myCong?.id) return null;
    return collection(firestore, 'congregations', myCong.id, 'speakers');
  }, [firestore, myCong?.id]);

  const neighborsQuery = useMemoFirebase(() => {
    if (!firestore || !myCong?.id) return null;
    return collection(firestore, 'congregations', myCong.id, 'neighbors');
  }, [firestore, myCong?.id]);

  const { data: talksData, isLoading: isLoadingTalks } = useCollection<any>(talksQuery);
  const { data: speakersData } = useCollection<any>(speakersQuery);
  const { data: neighborsData } = useCollection<any>(neighborsQuery);

  const topicsWithHistory = useMemo(() => {
    if (!talksData || !myCong) return [];

    return talkTopics.map(topic => {
      const topicStr = `${topic.id}. ${topic.title}`;
      
      const themeTalks = (talksData || [])
        .filter((t: any) => t.topic === topicStr && t.congregationId === myCong.id)
        .map((t: any) => {
          const speaker = speakersData?.find((s: any) => s.id === t.speakerId);
          
          let congName = 'Outra Congregação';
          if (speaker) {
            if (speaker.homeCongregationId === myCong.id) {
              congName = myCong.name;
            } else {
              const neighbor = neighborsData?.find((n: any) => n.id === speaker.homeCongregationId);
              congName = neighbor?.name || 'Congregação Vizinha';
            }
          }

          return {
            date: new Date(t.dateTime),
            speakerName: speaker?.name || 'Orador não definido',
            congregationName: congName
          };
        })
        .sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

      const lastUsed = themeTalks.length > 0 ? themeTalks[0].date : null;
      
      return {
        ...topic,
        lastUsed,
        totalUses: themeTalks.length,
        history: themeTalks
      };
    });
  }, [talksData, myCong, speakersData, neighborsData]);

  const stats = useMemo(() => {
    if (!topicsWithHistory.length) return null;
    const now = new Date();
    const oneYearAgo = subYears(now, 1);

    return {
      neverUsed: topicsWithHistory.filter(t => !t.lastUsed).length,
      oldUsed: topicsWithHistory.filter(t => t.lastUsed && isBefore(t.lastUsed, oneYearAgo)).length,
      mostUsed: [...topicsWithHistory].sort((a, b) => b.totalUses - a.totalUses).slice(0, 5).filter(t => t.totalUses > 0)
    };
  }, [topicsWithHistory]);

  const filteredTopics = useMemo(() => {
    let result = topicsWithHistory.filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.id.toString().includes(searchQuery)
    );

    if (categoryFilter !== 'all') {
      result = result.filter(t => t.category === categoryFilter);
    }

    const now = new Date();
    if (filterType === 'unused') {
      result = result.filter(t => !t.lastUsed);
    } else if (filterType === 'recent') {
      const sixMonthsAgo = subMonths(now, 6);
      result = result.filter(t => t.lastUsed && isAfter(t.lastUsed, sixMonthsAgo));
    } else if (filterType === 'old') {
      const oneYearAgo = subYears(now, 1);
      result = result.filter(t => t.lastUsed && isBefore(t.lastUsed, oneYearAgo));
    } else if (filterType === 'popular') {
      result = result.filter(t => t.totalUses >= 2).sort((a, b) => b.totalUses - a.totalUses);
    }

    if (filterType !== 'popular') {
      result = result.sort((a, b) => a.id - b.id);
    }
    
    return result;
  }, [topicsWithHistory, searchQuery, filterType, categoryFilter]);

  const handleSuggestThemes = async () => {
    if (!myCong || isSuggesting) return;
    setIsSuggesting(true);
    setIsNeedsDialogOpen(false);
    
    try {
      const sixMonthsAgo = subMonths(new Date(), 6);
      let candidates = topicsWithHistory.filter(t => !t.lastUsed || isBefore(new Date(t.lastUsed), sixMonthsAgo));

      if (localNeed !== 'aleatório') {
        candidates = candidates.filter(t => t.category === localNeed);
      }

      const historyData = candidates.map(t => ({
        id: t.id,
        title: t.title,
        lastUsed: t.lastUsed ? t.lastUsed.toISOString() : null,
        totalUses: t.totalUses
      })).slice(0, 50);

      const result = await suggestThemes({
        congregationName: myCong.name,
        localNeed: localNeed === 'aleatório' ? undefined : localNeed,
        historyData
      });
      setAiSuggestions(result);
      toast({ title: "Sugestões geradas!", description: localNeed !== 'aleatório' ? `Focadas em: ${localNeed}` : "Focadas em variedade geral." });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erro na sugestão",
        description: "Não foi possível obter sugestões da IA agora."
      });
    } finally {
      setIsSuggesting(false);
    }
  };

  if (!mounted || isLoadingMyCong) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!myCong) return <div className="p-20 text-center"><Building className="mx-auto h-12 w-12 text-muted-foreground" /><h2 className="text-xl font-bold mt-4 font-headline">Configuração Necessária</h2><Link href="/setup"><Button className="mt-4 bg-accent text-accent-foreground">Configurar Agora</Button></Link></div>;

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 font-headline">
            <History className="h-6 w-6 text-primary" /> Histórico de Temas
          </h1>
          <p className="text-muted-foreground text-sm">Acompanhe o uso dos temas em <strong>{myCong.name}</strong>.</p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Button 
            onClick={() => setIsNeedsDialogOpen(true)} 
            disabled={isSuggesting}
            className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 gap-2 h-11 font-bold shadow-sm"
            variant="outline"
          >
            {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Pedir Sugestões à IA
          </Button>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground italic px-1">
            <Info className="h-2.5 w-2.5" /> Analisa temas inéditos ou antigos por categoria.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-blue-50/50">
          <CardHeader className="p-4 pb-2">
            <div className="text-[10px] uppercase font-bold flex items-center gap-1.5 text-blue-600 mb-1">
              <BookOpen className="h-3 w-3" /> Variedade
            </div>
            <CardTitle className="text-2xl font-headline text-blue-700">{stats?.neverUsed}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-blue-600/80">Temas nunca proferidos localmente.</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-amber-50/50">
          <CardHeader className="p-4 pb-2">
            <div className="text-[10px] uppercase font-bold flex items-center gap-1.5 text-amber-600 mb-1">
              <RotateCcw className="h-3 w-3" /> Reciclagem
            </div>
            <CardTitle className="text-2xl font-headline text-amber-700">{stats?.oldUsed}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-amber-600/80">Usados há mais de 1 ano.</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-purple-50/50">
          <CardHeader className="p-4 pb-2">
            <div className="text-[10px] uppercase font-bold flex items-center gap-1.5 text-purple-600 mb-1">
              <TrendingUp className="h-3 w-3" /> Frequência
            </div>
            <CardTitle className="text-2xl font-headline text-purple-700">Top 5</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-1">
              {stats?.mostUsed.map(t => (
                <Badge key={t.id} variant="outline" className="bg-white/50 border-purple-200 text-purple-700 text-[9px] px-1 h-4">
                  #{t.id} ({t.totalUses}x)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {aiSuggestions && (
        <Card className="border-primary/20 bg-primary/5 shadow-md overflow-hidden animate-in fade-in slide-in-from-top-4">
          <CardHeader className="p-4 border-b bg-white/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" /> Sugestões Inteligentes
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setAiSuggestions(null)}>
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-[11px] italic mt-1 text-primary/80 font-medium">
              "{aiSuggestions.generalAdvice}"
            </div>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {aiSuggestions.suggestions.map((s, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border shadow-sm flex flex-col gap-2 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold font-mono border border-primary/20">
                    {s.id}
                  </div>
                  <span className="text-xs font-bold line-clamp-1 flex-1">{s.title}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight italic">{s.reason}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2 w-full">
        <div className="relative">
          <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Pesquisar por número ou título..."
            className="pl-8 h-11"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-10 flex-1">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Categoria" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-10 sm:w-56">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="recent">Últimos 6 meses</SelectItem>
              <SelectItem value="old">Esquecidos (+1 ano)</SelectItem>
              <SelectItem value="unused">Nunca proferidos</SelectItem>
              <SelectItem value="popular">Mais repetidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoadingTalks ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
      ) : (
        <div className="grid gap-2">
          {filteredTopics.map((topic) => (
            <Card 
              key={topic.id} 
              className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
              onClick={() => setSelectedTopic(topic)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center p-3 gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold font-mono text-xs",
                    !topic.lastUsed ? "bg-green-100 text-green-700 border border-green-200" : "bg-primary/10 text-primary border border-primary/20"
                  )}>
                    {topic.id}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h3 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-1">
                      {topic.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[200px]">{topic.category}</span>
                      {topic.lastUsed ? (
                        <Badge variant="outline" className="text-[9px] py-0 h-4 gap-1 bg-accent/30 border-accent/50 text-accent-foreground font-bold shrink-0">
                          <CheckCircle className="h-2.5 w-2.5" /> {topic.totalUses}x proferido
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] py-0 h-4 bg-green-50 text-green-700 border-green-200 border-dashed font-bold shrink-0">
                          Inédito
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:pl-3 sm:border-l border-dashed shrink-0">
                  <div className="flex flex-col sm:items-end">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> Última Vez
                    </div>
                    <span className={cn(
                      "text-xs font-semibold",
                      topic.lastUsed ? "text-foreground" : "text-muted-foreground/50 italic"
                    )}>
                      {topic.lastUsed ? format(topic.lastUsed, "dd/MM/yyyy") : '---'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {filteredTopics.length === 0 && (
            <div className="py-20 text-center bg-muted/5 border-2 border-dashed rounded-lg">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-sm">Nenhum tema encontrado.</p>
              <Button variant="link" onClick={() => { setSearchQuery(''); setFilterType('all'); setCategoryFilter('all'); }} className="mt-2 text-xs">
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Diálogo de Escolha de Necessidade Local */}
      <Dialog open={isNeedsDialogOpen} onOpenChange={setIsNeedsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] border-none shadow-2xl overflow-hidden p-0">
          <div className="p-6 bg-primary/5 border-b border-primary/10">
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl font-headline flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Qual o foco da sugestão?
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                Escolha uma categoria para a IA sugerir temas específicos.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <ScrollArea className="h-[400px]">
            <div className="p-6">
              <RadioGroup value={localNeed} onValueChange={setLocalNeed} className="grid grid-cols-1 gap-2">
                <div>
                  <RadioGroupItem value="aleatório" id="aleatório" className="peer sr-only" />
                  <Label
                    htmlFor="aleatório"
                    className="flex items-center gap-3 p-3 rounded-xl border-2 border-transparent bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                  >
                    <div className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
                      localNeed === 'aleatório' ? "bg-primary text-white shadow-md" : "bg-muted text-muted-foreground"
                    )}>
                      <RotateCcw className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold leading-tight">Variedade Geral</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">Prioriza temas inéditos de qualquer categoria.</span>
                    </div>
                  </Label>
                </div>

                {CATEGORIES.map((cat) => (
                  <div key={cat.id}>
                    <RadioGroupItem value={cat.id} id={cat.id} className="peer sr-only" />
                    <Label
                      htmlFor={cat.id}
                      className="flex items-center gap-3 p-3 rounded-xl border-2 border-transparent bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    >
                      <div className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
                        localNeed === cat.id ? "bg-primary text-white shadow-md" : "bg-muted text-muted-foreground"
                      )}>
                        <cat.icon className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold leading-tight">{cat.id}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{cat.desc}</span>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 border-t gap-2 sm:flex-row flex-col bg-muted/5">
            <Button variant="ghost" onClick={() => setIsNeedsDialogOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSuggestThemes} disabled={isSuggesting} className="flex-1 bg-primary text-white font-bold gap-2">
              {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar Sugestões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTopic} onOpenChange={(open) => !open && setSelectedTopic(null)}>
        <DialogContent className="sm:max-w-[425px] px-4 py-6 border-none shadow-2xl">
          <DialogHeader className="flex flex-col items-center text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold font-mono text-lg mb-2 border border-primary/20">
              {selectedTopic?.id}
            </div>
            <DialogTitle className="text-xl font-headline leading-tight">
              {selectedTopic?.title}
            </DialogTitle>
            <Badge variant="secondary" className="mt-1 text-[10px] uppercase font-bold">{selectedTopic?.category}</Badge>
          </DialogHeader>
          
          <ScrollArea className="max-h-[350px] pr-4 mt-4">
            {selectedTopic?.history && selectedTopic.history.length > 0 ? (
              <div className="space-y-3">
                {selectedTopic.history.map((record: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 shadow-sm">
                    <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center border border-primary/20">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-bold truncate leading-tight">{record.speakerName}</span>
                      <span className="text-[10px] text-primary font-bold uppercase tracking-wide mt-0.5">{record.congregationName}</span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {format(record.date, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-muted-foreground italic text-sm border-2 border-dashed rounded-xl">
                Este tema ainda não foi registrado no sistema.
              </div>
            )}
          </ScrollArea>
          
          <div className="mt-6">
            <Button variant="outline" className="w-full h-11" onClick={() => setSelectedTopic(null)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
