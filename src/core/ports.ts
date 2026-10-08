import type { Exercise, ExerciseEvent, Session, Action, View } from './model.js';
export interface Analytics {
  startSession(session: Session): void;
  endSession(id: string, at: string): void;
  saveEvent(event: ExerciseEvent, action: Action): void;
  events(from: string, to: string): ExerciseEvent[];
}
export interface Catalog { select(previousId?: string): Exercise }
export interface Clock {
  now(): number;
  monotonic(): number;
  wait(milliseconds: number, signal: AbortSignal): Promise<void>;
}
export interface Interaction {
  show(view: View): void;
  ask(choices: readonly string[], signal: AbortSignal): Promise<string>;
  warn(message: string): void;
}
export interface Notifier { notify(exercise: Exercise, durationSeconds: number): Promise<void> }
export interface Ids { next(): string }
