import type { Analytics, Catalog, Clock, Interaction, Notifier, Ids } from './ports.js';
import type { ExerciseEvent, Status, Exercise, View, SessionSummary } from './model.js';
export interface TimerOptions {
  intervalMinutes: number; snoozeSeconds: number; promptTimeoutSeconds: number;
  confirmationTimeoutSeconds: number; demo: boolean; once: boolean; exerciseSeconds?: number;
}
export class StartTimer {
  constructor(private db: Analytics, private catalog: Catalog, private clock: Clock,
    private ui: Interaction, private notifier: Notifier, private ids: Ids) {}
  private iso() { return new Date(this.clock.now()).toISOString(); }
  private async choose(choices: readonly string[], seconds: number, signal: AbortSignal): Promise<string> {
    const child = new AbortController();
    const abort = () => child.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) child.abort();
    try {
      return await Promise.race([
        this.ui.ask(choices, child.signal),
        this.clock.wait(seconds * 1000, child.signal).then(() => 'timeout'),
      ]);
    } finally {
      child.abort();
      signal.removeEventListener('abort', abort);
    }
  }
  async execute(options: TimerOptions, signal: AbortSignal): Promise<void> {
    const sessionId = this.ids.next();
    const session: SessionSummary = { startedAt: this.clock.now(), completed: 0, activeSeconds: 0 };
    this.db.startSession({ id: sessionId, startedAt: this.iso(), intervalMinutes: options.intervalMinutes, demo: options.demo });
    let current: ExerciseEvent | undefined;
    let exercise: Exercise | undefined;
    let previousId: string | undefined;
    let startedMono: number | undefined;
    const show = (view: Omit<View, 'demo' | 'session'>) => this.ui.show({ ...view, demo: options.demo, session: { ...session } });
    const record = (status: Status) => {
      if (!current) return;
      current.status = status;
      this.db.saveEvent(current, { eventId: current.id, at: this.iso(), status });
    };
    try {
      while (!signal.aborted) {
        show({ phase: 'waiting', deadline: this.clock.now() + options.intervalMinutes * 60_000,
          durationSeconds: options.intervalMinutes * 60, message: 'Next movement break' });
        await this.clock.wait(options.intervalMinutes * 60_000, signal);
        exercise = this.catalog.select(previousId);
        previousId = exercise.id;
        const seconds = options.exerciseSeconds ?? exercise.durationSeconds;
        current = { id: this.ids.next(), sessionId, exerciseId: exercise.id, exerciseName: exercise.name,
          bodyPart: exercise.bodyPart, promptedAt: this.iso(), startedAt: null, resolvedAt: null,
          plannedSeconds: seconds, actualSeconds: 0, status: 'PROMPTED', snoozeCount: 0 };
        record('PROMPTED');
        let decision: string;
        do {
          show({ phase: 'prompt', exercise, durationSeconds: seconds,
            deadline: this.clock.now() + options.promptTimeoutSeconds * 1000 });
          try { await this.notifier.notify(exercise, seconds); }
          catch { this.ui.warn('Notification unavailable. Follow the exercise here in the terminal.'); }
          signal.throwIfAborted();
          decision = await this.choose(['start', 'skip', 'snooze'], options.promptTimeoutSeconds, signal);
          signal.throwIfAborted();
          if (decision === 'snooze') {
            current.snoozeCount++;
            record('SNOOZED');
            show({ phase: 'snoozing', exercise, deadline: this.clock.now() + options.snoozeSeconds * 1000,
              durationSeconds: options.snoozeSeconds, message: 'Same exercise returns after snooze' });
            await this.clock.wait(options.snoozeSeconds * 1000, signal);
          }
        } while (decision === 'snooze');
        if (decision === 'start') {
          current.startedAt = this.iso();
          startedMono = this.clock.monotonic();
          record('STARTED');
          show({ phase: 'exercise', exercise, durationSeconds: seconds, deadline: this.clock.now() + seconds * 1000 });
          const result = await this.choose(['stop'], seconds, signal);
          signal.throwIfAborted();
          current.actualSeconds = Math.min(seconds, Math.max(0, Math.floor((this.clock.monotonic() - startedMono) / 1000)));
          if (result === 'stop') {
            current.resolvedAt = this.iso(); record('INTERRUPTED');
          } else {
            show({ phase: 'confirm', exercise, durationSeconds: seconds,
              deadline: this.clock.now() + options.confirmationTimeoutSeconds * 1000 });
            const confirmation = await this.choose(['completed', 'not-completed'], options.confirmationTimeoutSeconds, signal);
            signal.throwIfAborted();
            current.resolvedAt = this.iso();
            record(confirmation === 'completed' ? 'COMPLETED' : confirmation === 'timeout' ? 'UNCONFIRMED' : 'INTERRUPTED');
          }
        } else {
          current.resolvedAt = this.iso(); record(decision === 'skip' ? 'SKIPPED' : 'EXPIRED');
        }
        const status = current.status;
        if (status === 'COMPLETED') { session.completed++; session.activeSeconds += current.actualSeconds; }
        current = undefined;
        startedMono = undefined;
        if (options.once) { show({ phase: 'done', message: `Saved: ${status}. Run deskercise report to view it.` }); break; }
      }
    } catch (error) {
      if (current) {
        if (startedMono !== undefined) current.actualSeconds = Math.min(current.plannedSeconds,
          Math.max(0, Math.floor((this.clock.monotonic() - startedMono) / 1000)));
        current.resolvedAt = this.iso(); record(current.startedAt ? 'INTERRUPTED' : 'CANCELLED');
      }
      if (!signal.aborted) throw error;
    } finally {
      this.db.endSession(sessionId, this.iso());
    }
  }
}
