export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  durationSeconds: number;
  position: 'seated' | 'standing' | 'either';
  instructions: string[];
  caution: string;
  source: { title: string; url: string; adaptation: string };
}
export type Status = 'PROMPTED' | 'SNOOZED' | 'STARTED' | 'COMPLETED' | 'SKIPPED' | 'EXPIRED' | 'INTERRUPTED' | 'CANCELLED' | 'UNCONFIRMED';
export interface ExerciseEvent {
  id: string; sessionId: string; exerciseId: string; exerciseName: string; bodyPart: string;
  promptedAt: string; startedAt: string | null; resolvedAt: string | null;
  plannedSeconds: number; actualSeconds: number; status: Status; snoozeCount: number;
}
export interface Session { id: string; startedAt: string; intervalMinutes: number; demo: boolean }
export interface Action { eventId: string; at: string; status: Status }
export interface View {
  phase: 'waiting' | 'prompt' | 'snoozing' | 'exercise' | 'confirm' | 'done';
  exercise?: Exercise; deadline?: number; durationSeconds?: number; message?: string; demo: boolean;
}
export interface DailyStats { date: string; prompted: number; completed: number; seconds: number }
export interface Report {
  from: string; to: string; totalPrompted: number; completed: number; skipped: number;
  expired: number; interrupted: number; cancelled: number; unconfirmed: number; pending: number;
  snoozes: number; activeSeconds: number; completionRate: number;
  days: DailyStats[]; bodyParts: { name: string; completed: number }[];
}
