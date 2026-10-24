import { execFile } from 'node:child_process';
import type { Exercise } from '../core/model.js';
import type { Notifier } from '../core/ports.js';

// Display a notification through macOS's built-in AppleScript facade instead of
// the deprecated node-notifier dependency. Title and message are passed as
// arguments (argv) so they never need to be interpolated into the script text.
const script = 'on run argv\n  display notification (item 2 of argv) with title (item 1 of argv) sound name "default"\nend run';

type Run = (command: string, args: string[], callback: (error: Error | null) => void) => void;

// The timeout mirrors the previous node-notifier helper's three-second limit.
const run: Run = (command, args, callback) => execFile(command, args, { timeout: 3000 }, callback);

export class MacNotifier implements Notifier {
  constructor(private readonly exec: Run = run) {}
  notify(exercise: Exercise, durationSeconds: number): Promise<void> {
    const title = 'Deskercise · time to move';
    const message = `${exercise.name} · ${durationSeconds}s. Return to your terminal to Start, Skip or Snooze.`;
    return new Promise((resolve, reject) => {
      this.exec('osascript', ['-e', script, title, message], (error) => {
        error ? reject(error) : resolve();
      });
    });
  }
}
