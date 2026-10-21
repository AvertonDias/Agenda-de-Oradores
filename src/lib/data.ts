
import { Timestamp } from 'firebase/firestore';

export type Speaker = {
  id: string;
  name: string;
  phoneNumber?: string;
  availableTopics: string[];
  avatarId: string;
  homeCongregationId?: string;
  onlyLocal?: boolean;
};

export type Coordinator = {
  name?: string;
  phone?: string;
};

export type CongregationSettings = {
  maxSpeakersOutPerWeek: number;
  monthsBefore: number;
};

export type Congregation = {
  id: string;
  name: string;
  address: string;
  coordinates?: string;
  coordinators: Coordinator[];
  meetingSchedule: string;
  adminUid?: string;
  authorizedUsers?: string[];
  settings?: CongregationSettings;
};

export type ScheduledTalk = {
  id: string;
  congregationId: string;
  speakerId: string;
  topic: string;
  dateTime: string;
};

export type EnrichedSpeech = ScheduledTalk & {
    speaker?: Speaker;
    congregation?: Congregation;
    dateObj: Date;
    isReceiving: boolean;
    isLocal: boolean;
    itemType: 'talk';
    originName?: string;
};

export type EnrichedEvent = {
    id: string;
    title: string;
    description?: string;
    date: string;
    endDate?: string | null;
    type: string;
    dateObj: Date;
    endDateObj: Date | null;
    itemType: 'event';
};

export type CalendarItem = EnrichedSpeech | EnrichedEvent;
