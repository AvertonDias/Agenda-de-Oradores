'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Link2,
  FileText,
  Search,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Building2,
  Clock,
  MapPin,
} from 'lucide-react';
import {
  extractJwUrlInfo,
  fetchJwMeetingData,
  type JwMeetingParsed,
} from '@/lib/jw-import';

interface JwImportBoxProps {
  onApply: (data: {
    name?: string;
    address?: string;
    meetingDay?: string;
    meetingTime?: string;
    coordinates?: string;
    phoneNumbers?: string[];
    jwUrl?: string;
  }) => void;
  currentName?: string;
  currentAddress?: string;
}

export function JwImportBox({
  onApply,
  currentName,
  currentAddress,
}: JwImportBoxProps) {
  const [tab, setTab] = useState<'link' | 'text'>('link');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [multipleMeetings, setMultipleMeetings] = useState<JwMeetingParsed[]>([]);
  const [importedName, setImportedName] = useState<string | null>(null);

  const { toast } = useToast();

  const getJwSearchUrl = (name?: string, address?: string) => {
    const queryParts = [];
    if (name) queryParts.push(name);
    if (address) queryParts.push(address);
    const searchStr = queryParts.join(' ').trim();
    const queryParam = encodeURIComponent(searchStr);
    return `https://hub.jw.org/meetings/pt?q=%7B%22location%22:%22${queryParam}%22%7D`;
  };

  const applyMeetingData = (meeting: JwMeetingParsed, urlUsed?: string) => {
    onApply({
      name: meeting.name,
      address: meeting.address,
      meetingDay: meeting.meetingDay,
      meetingTime: meeting.meetingTime,
      coordinates: meeting.coordinates,
      phoneNumbers: meeting.phones,
      jwUrl: urlUsed || urlInput,
    });
    setImportedName(meeting.name);
    toast({
      title: 'Congregação Importada!',
      description: `${meeting.name} preenchida com sucesso (${meeting.meetingDay} às ${meeting.meetingTime}).`,
    });
  };

  const handleFetchLink = async (urlString: string) => {
    const cleanUrl = urlString.trim();
    if (!cleanUrl) {
      toast({
        variant: 'destructive',
        title: 'Insira um link',
        description: 'Cole o link do JW Hub ou do jw.org.',
      });
      return;
    }

    const info = extractJwUrlInfo(cleanUrl);
    if (!info || (!info.scopeId && !info.eventId)) {
      toast({
        variant: 'destructive',
        title: 'Link não reconhecido',
        description:
          'O link precisa conter o identificador da congregação (ex: link de compartilhamento do JW Hub).',
      });
      return;
    }

    setIsLoading(true);
    setMultipleMeetings([]);
    setImportedName(null);

    try {
      const result = await fetchJwMeetingData({
        scopeId: info.scopeId,
        eventId: info.eventId,
      });

      if (result.meetings.length > 1 && !info.eventId) {
        setMultipleMeetings(result.meetings);
      }

      applyMeetingData(result.selectedMeeting, cleanUrl);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao importar',
        description: err?.message || 'Não foi possível carregar os dados deste link.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextParse = (text: string) => {
    setTextInput(text);
    if (!text.trim()) return;

    // If user pastes a JW link inside the text area, auto-route to link fetcher!
    const linkInfo = extractJwUrlInfo(text);
    if (linkInfo && (linkInfo.scopeId || linkInfo.eventId)) {
      setTab('link');
      setUrlInput(linkInfo.url || text);
      handleFetchLink(linkInfo.url || text);
      return;
    }

    // Original text parsing logic
    const lines = text
      .split(/\n|\s{2,}/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 1) return;

    let name = '';
    let address = '';
    let meetingDay = '';
    let meetingTime = '';
    let phone = '';
    let coordinates = '';
    const weekendDays = ['domingo', 'sábado', 'sabado'];

    lines.forEach((line, index) => {
      const lowerLine = line.toLowerCase();
      if (index === 0) {
        let pot = line;
        ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo', 'sabado'].forEach((d) => {
          const i = pot.toLowerCase().indexOf(d);
          if (i !== -1) pot = pot.substring(0, i).trim();
        });
        name = pot.replace(/\s*-\s*$/, '').trim();
      }
      weekendDays.forEach((day) => {
        if (lowerLine.includes(day)) {
          meetingDay = day.charAt(0).toUpperCase() + day.slice(1).replace('sabado', 'Sábado');
          const tm = line.match(/(\d{1,2}:\d{2})/);
          if (tm) meetingTime = tm[1].padStart(5, '0');
        }
      });
      if (line.includes(',') && /\d/.test(line) && line.length > 15 && !line.match(/(-?\d+\.\d+)/)) {
        address = line;
      }
      const ph = line.match(/(\d{2}[-\s]*9?\d{4}[-\s]?\d{4})|(\d{2}-9?\d{4}-9\d{4})/);
      if (ph && !phone) phone = ph[0];
      const co = line.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
      if (co) coordinates = co[0];
    });

    onApply({
      name: name || undefined,
      address: address || undefined,
      meetingDay: meetingDay || undefined,
      meetingTime: meetingTime || undefined,
      coordinates: coordinates || undefined,
      phoneNumbers: phone ? [phone] : undefined,
    });

    toast({ title: 'Texto do JW.org processado com sucesso!' });
  };

  return (
    <div className="p-3 bg-muted/40 rounded-xl border border-dashed mb-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Importar do JW.org / JW Hub</span>
        </div>
        <a
          href={getJwSearchUrl(currentName, currentAddress)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
        >
          <span>Abrir JW Hub</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-0.5 bg-muted/60 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setTab('link')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
            tab === 'link'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Link2 className="h-3.5 w-3.5 text-primary" />
          <span>Por Link do JW Hub</span>
          <span className="text-[9px] px-1 bg-primary/10 text-primary font-bold rounded">Novo</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('text')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
            tab === 'text'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Por Texto Copiado</span>
        </button>
      </div>

      {tab === 'link' ? (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Link2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cole o link do JW Hub (hub.jw.org/meetings/...)"
                className="pl-8 text-xs h-9 bg-background"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  const info = extractJwUrlInfo(e.target.value);
                  if (info && (info.scopeId || info.eventId)) {
                    handleFetchLink(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFetchLink(urlInput);
                  }
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 px-3 gap-1.5 text-xs font-semibold shrink-0"
              disabled={isLoading || !urlInput.trim()}
              onClick={() => handleFetchLink(urlInput)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  <span>Buscar</span>
                </>
              )}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground leading-tight">
            Cole o link gerado pelo botão <strong>Compartilhar</strong> no JW Hub ou copie o endereço da página da reunião. Todos os dados (nome, endereço, dia/horário, telefones e coordenadas) serão preenchidos automaticamente.
          </p>

          {multipleMeetings.length > 1 && (
            <div className="p-2 bg-background border rounded-lg space-y-1.5 mt-2">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Várias congregações neste local. Escolha qual deseja importar:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {multipleMeetings.map((m) => (
                  <Button
                    key={m.id}
                    type="button"
                    variant={importedName === m.name ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs px-2 gap-1"
                    onClick={() => applyMeetingData(m, urlInput)}
                  >
                    <span>{m.name}</span>
                    <span className="text-[10px] opacity-75">
                      ({m.meetingDay} {m.meetingTime})
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {importedName && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Dados de <strong>{importedName}</strong> aplicados nos campos abaixo!
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Textarea
            placeholder="Cole aqui os dados copiados da página do JW.org..."
            className="text-[11px] h-20 bg-background"
            value={textInput}
            onChange={(e) => handleTextParse(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground leading-tight">
            Dica: Se colar um link do JW Hub aqui, ele será reconhecido e importado automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}
