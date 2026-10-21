import { formatPhoneNumber } from './utils';

export interface JwMeetingParsed {
  id: string;
  name: string;
  address: string;
  meetingDay: string;
  meetingTime: string;
  coordinates: string;
  phones: string[];
}

export function extractJwUrlInfo(text: string): { scopeId?: string; eventId?: string; url?: string } | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s"'<>]+/);
  if (!match) return null;
  const rawUrl = match[0];
  try {
    const url = new URL(rawUrl);
    if (!url.hostname.includes('jw.org')) return null;
    const scopeId =
      url.searchParams.get('scope_id') ||
      url.searchParams.get('meetingLocationGuid') ||
      url.searchParams.get('locationId') ||
      url.searchParams.get('locationGuid') ||
      undefined;

    const eventId =
      url.searchParams.get('eventId') ||
      url.searchParams.get('meetingLocationEventGuid') ||
      url.searchParams.get('eventGuid') ||
      undefined;

    return { scopeId, eventId, url: rawUrl };
  } catch {
    return null;
  }
}

export async function fetchJwMeetingData(params: { scopeId?: string; eventId?: string }): Promise<{
  meetings: JwMeetingParsed[];
  selectedMeeting: JwMeetingParsed;
}> {
  const queryParams = new URLSearchParams();
  if (params.scopeId) queryParams.set('meetingLocationGuid', params.scopeId);
  if (params.eventId) queryParams.set('meetingLocationEventGuid', params.eventId);

  let responseData: any = null;

  // Try via local proxy first
  try {
    const res = await fetch(`/api/jw-meeting?${queryParams.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      responseData = await res.json();
    }
  } catch (err) {
    console.warn('Local proxy fetch failed, trying fallback...', err);
  }

  // Fallback direct or CORS proxy if local proxy not available
  if (!responseData || !responseData.items) {
    const targetUrl = `https://hub.jw.org/meetings/api/meeting-search?${queryParams.toString()}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error('Não foi possível obter dados do link do JW Hub.');
    }
    responseData = await res.json();
  }

  const items = responseData?.items || [];
  if (items.length === 0) {
    throw new Error('Nenhuma congregação encontrada para as informações deste link.');
  }

  const loc = items[0];
  const meetingsList = loc.congregationMeetings || [];
  if (meetingsList.length === 0) {
    throw new Error('Nenhuma reunião encontrada para este local no JW Hub.');
  }

  const dayMap: Record<number, string> = {
    0: 'Domingo',
    1: 'Segunda',
    2: 'Terça',
    3: 'Quarta',
    4: 'Quinta',
    5: 'Sexta',
    6: 'Sábado',
  };

  const coordinates = loc.latitude && loc.longitude ? `${loc.latitude}, ${loc.longitude}` : '';

  const parsedMeetings: JwMeetingParsed[] = meetingsList.map((m: any) => {
    const cleanAddress = m.address
      ? m.address
          .split(/\r?\n/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
          .join(', ')
      : '';

    const day =
      (m.weekendMeetingDay !== undefined && dayMap[m.weekendMeetingDay]) ||
      (m.midweekMeetingDay !== undefined && dayMap[m.midweekMeetingDay]) ||
      'Domingo';

    const rawTime = m.weekendMeetingTime || m.midweekMeetingTime || '19:00:00';
    const meetingTime = rawTime.slice(0, 5);

    // Extract phones
    const phoneMatches = m.phoneNumber
      ? m.phoneNumber.match(/(\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4})/g) || []
      : [];
    const phones = phoneMatches
      .map((p: string) => formatPhoneNumber(p.replace(/\D/g, '')))
      .filter((p: string) => p.length >= 10);

    return {
      id: m.id,
      name: m.name || '',
      address: cleanAddress,
      meetingDay: day,
      meetingTime,
      coordinates,
      phones,
    };
  });

  const selectedMeeting =
    (params.eventId && parsedMeetings.find((m) => m.id === params.eventId)) ||
    parsedMeetings[0];

  return {
    meetings: parsedMeetings,
    selectedMeeting,
  };
}
