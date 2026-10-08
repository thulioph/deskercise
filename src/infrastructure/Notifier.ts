import notifier from 'node-notifier';
import type { Exercise } from '../core/model.js';
import type { Notifier } from '../core/ports.js';
export class MacNotifier implements Notifier {
  notify(exercise: Exercise, durationSeconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Notification timed out')), 3000);
      notifier.notify({ title: 'Deskercise · time to move',
        message: `${exercise.name} · ${durationSeconds}s. Return to your terminal to Start, Skip or Snooze.`,
        sound: true, wait: false, timeout: 2 }, (error) => {
        clearTimeout(timer); error ? reject(error) : resolve();
      });
    });
  }
}
