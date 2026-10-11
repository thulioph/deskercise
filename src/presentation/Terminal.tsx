import { useEffect, useState } from 'react';
import { Box, Text, render, useInput, type RenderOptions } from 'ink';
import type { Interaction } from '../core/ports.js';
import type { View } from '../core/model.js';
import { SessionSummary } from './SessionSummary.js';
type Snapshot = { view: View; choices: readonly string[]; warning?: string };
const labels: Record<string, string> = {
  start: '[1] Start', skip: '[2] Skip', snooze: '[3] Snooze', stop: '[s] Stop early',
  completed: '[y] Completed', 'not-completed': '[n] Not completed',
};
const keys: Record<string, string> = { '1': 'start', '2': 'skip', '3': 'snooze', s: 'stop', y: 'completed', n: 'not-completed' };
function Screen({ terminal, onExit }: { terminal: Terminal; onExit: () => void }) {
  const [snapshot, setSnapshot] = useState(terminal.snapshot);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { terminal.subscribe = setSnapshot; return () => { terminal.subscribe = undefined; }; }, [terminal]);
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(tick); }, []);
  useInput((input, key) => {
    if ((key.ctrl && input === 'c') || input.toLowerCase() === 'q') { onExit(); return; }
    const action = keys[input.toLowerCase()];
    if (action && snapshot.choices.includes(action)) terminal.answer(action);
  });
  const { view, choices, warning } = snapshot;
  const rawRemaining = Math.max(0, Math.ceil(((view.deadline ?? now) - now) / 1000));
  const remaining = ['waiting', 'snoozing', 'exercise'].includes(view.phase) && view.durationSeconds
    ? Math.min(view.durationSeconds, rawRemaining) : rawRemaining;
  const formatted = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;
  const progress = view.durationSeconds ? Math.max(0, Math.min(1, 1 - remaining / view.durationSeconds)) : 0;
  const blocks = Math.round(progress * 24);
  const title = { waiting: 'Space to focus', prompt: 'Time to move', snoozing: 'A little later', exercise: 'Your movement break', confirm: 'How did it go?', done: 'Session saved' }[view.phase];
  return <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="round" borderColor="cyan">
    <Text bold color="cyan">DESKERCISE {view.demo ? '· DEMO / 5-second test' : '· workplace movement'}</Text>
    <SessionSummary view={view} now={now} />
    <Text bold>{title}</Text>
    {view.exercise && <>
      <Text color="green">{view.exercise.name} · {view.exercise.bodyPart} · {view.exercise.position}</Text>
      <Text dimColor>Break window: {view.durationSeconds ?? view.exercise.durationSeconds}s</Text>
      {['prompt', 'exercise'].includes(view.phase) && <>
        <Text> </Text>
        {view.exercise.instructions.map((step, i) => <Text key={i}>{i + 1}. {step}</Text>)}
        <Text dimColor>Rest after the listed movements. Do not hold a stretch for the whole timer.</Text>
        <Text color="yellow">{view.exercise.caution}</Text>
        <Text dimColor>Source: {view.exercise.source.title}</Text>
      </>}
    </>}
    {view.message && <Text>{view.message}</Text>}
    {view.deadline && <Text color="cyan">{formatted} {['waiting', 'snoozing', 'exercise'].includes(view.phase) ? '━'.repeat(blocks) + '─'.repeat(24 - blocks) : 'to respond'}</Text>}
    <Text> </Text>
    {view.phase === 'confirm' && <Text>Did you perform the exercise? The timer alone does not record a completion.</Text>}
    <Text bold>{choices.map(c => labels[c]).join('    ')}</Text>
    {warning && <Text color="yellow">{warning}</Text>}
    <Text dimColor>q or Ctrl+C to end · keep this terminal open</Text>
  </Box>;
}
export class Terminal implements Interaction {
  snapshot: Snapshot = { view: { phase: 'waiting', demo: false }, choices: [] };
  subscribe?: (snapshot: Snapshot) => void;
  private pending?: (value: string) => void;
  private publish() { this.subscribe?.({ ...this.snapshot }); }
  show(view: View) { this.snapshot = { ...this.snapshot, view, choices: [] }; this.publish(); }
  warn(warning: string) { this.snapshot = { ...this.snapshot, warning }; this.publish(); }
  answer(value: string) { this.pending?.(value); }
  ask(choices: readonly string[], signal: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return; }
      const cleanup = () => {
        signal.removeEventListener('abort', abort); this.pending = undefined;
        this.snapshot = { ...this.snapshot, choices: [] }; this.publish();
      };
      const abort = () => { cleanup(); reject(signal.reason); };
      this.pending = (value) => { if (!choices.includes(value)) return; cleanup(); resolve(value); };
      signal.addEventListener('abort', abort, { once: true });
      this.snapshot = { ...this.snapshot, choices }; this.publish();
    });
  }
  mount(onExit: () => void, options: RenderOptions = {}) {
    return render(<Screen terminal={this} onExit={onExit} />, { ...options, exitOnCtrlC: false });
  }
}
