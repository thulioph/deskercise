import type { Clock } from '../core/ports.js';
export class SystemClock implements Clock {
  now() { return Date.now(); }
  monotonic() { return performance.now(); }
  wait(milliseconds: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return; }
      const deadline = Date.now() + milliseconds;
      const finish = () => { clearInterval(timer); signal.removeEventListener('abort', abort); resolve(); };
      const abort = () => { clearInterval(timer); signal.removeEventListener('abort', abort); reject(signal.reason); };
      // Recheck the deadline to avoid a burst of queued reminders after sleep.
      const timer = setInterval(() => { if (Date.now() >= deadline) finish(); }, Math.min(200, Math.max(1, milliseconds)));
      signal.addEventListener('abort', abort, { once: true });
    });
  }
}
