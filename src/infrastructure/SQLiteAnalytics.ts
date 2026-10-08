import Database from 'better-sqlite3';
import type { Analytics } from '../core/ports.js';
import type { Action, ExerciseEvent, Session } from '../core/model.js';
export class SQLiteAnalytics implements Analytics {
  private db: Database.Database;
  constructor(filename: string) {
    this.db = new Database(filename);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, started_at TEXT NOT NULL, ended_at TEXT,
      interval_minutes REAL NOT NULL, demo INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS exercise_events (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
        exercise_id TEXT NOT NULL, exercise_name TEXT NOT NULL, body_part TEXT NOT NULL,
        prompted_at TEXT NOT NULL, started_at TEXT, resolved_at TEXT,
        planned_seconds INTEGER NOT NULL, actual_seconds INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL, snooze_count INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS events_prompted ON exercise_events(prompted_at);
      CREATE TABLE IF NOT EXISTS exercise_actions (
        id INTEGER PRIMARY KEY, event_id TEXT NOT NULL REFERENCES exercise_events(id),
        at TEXT NOT NULL, status TEXT NOT NULL);
      PRAGMA user_version = 1;`);
  }
  startSession(s: Session) {
    this.db.prepare('INSERT INTO sessions(id,started_at,interval_minutes,demo) VALUES (?,?,?,?)')
      .run(s.id, s.startedAt, s.intervalMinutes, Number(s.demo));
  }
  endSession(id: string, at: string) { this.db.prepare('UPDATE sessions SET ended_at=? WHERE id=?').run(at, id); }
  saveEvent(e: ExerciseEvent, a: Action) {
    this.db.transaction(() => {
      this.db.prepare(`INSERT INTO exercise_events VALUES (@id,@sessionId,@exerciseId,@exerciseName,@bodyPart,
        @promptedAt,@startedAt,@resolvedAt,@plannedSeconds,@actualSeconds,@status,@snoozeCount)
        ON CONFLICT(id) DO UPDATE SET started_at=excluded.started_at, resolved_at=excluded.resolved_at,
        actual_seconds=excluded.actual_seconds, status=excluded.status, snooze_count=excluded.snooze_count`).run(e);
      this.db.prepare('INSERT INTO exercise_actions(event_id,at,status) VALUES (?,?,?)').run(a.eventId, a.at, a.status);
    })();
  }
  events(from: string, to: string): ExerciseEvent[] {
    return this.db.prepare(`SELECT id,session_id AS sessionId,exercise_id AS exerciseId,exercise_name AS exerciseName,
      body_part AS bodyPart,prompted_at AS promptedAt,started_at AS startedAt,resolved_at AS resolvedAt,
      planned_seconds AS plannedSeconds,actual_seconds AS actualSeconds,status,snooze_count AS snoozeCount
      FROM exercise_events WHERE prompted_at>=? AND prompted_at<? ORDER BY prompted_at`).all(from, to) as ExerciseEvent[];
  }
  close() { this.db.close(); }
}
