export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface CreatedEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
  googleEventId?: string;
  htmlLink?: string;
}

export interface VoiceAction {
  id: string;
  rawText: string;
  events: CreatedEvent[];
  createdAt: string;
}

export interface UsageData {
  used: number;
  limit: number;
}
