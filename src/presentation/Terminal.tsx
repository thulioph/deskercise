import { useEffect, useState } from 'react';
import { Box, Text, render, useInput, type RenderOptions } from 'ink';
import type { Interaction } from '../core/ports.js';
import type { View } from '../core/model.js';
import { SessionSummary } from './SessionSummary.js';
import { ShortcutBar } from './ShortcutBar.js';
import { ExerciseIllustration } from './ExerciseIllustration.js';
import { TimerFeedback } from './TimerFeedback.js';
type Snapshot = { view: View; choices: readonly string[]; warning?: string; selected?: string; requestId: number };
const keys: Record<string, string> = { '1': 'start', '2': 'skip', '3': 'snooze', s: 'stop', y: 'completed', n: 'not-completed' };
export function Screen({ terminal, onExit }: { terminal: Terminal; onExit: () => void }) {
  const [snapshot, setSnapshot] = useState(terminal.snapshot);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { terminal.subscribe = setSnapshot; return () => { terminal.subscribe = undefined; }; }, [terminal]);
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(tick); }, []);
  useInput((input, key) => {
    if ((key.ctrl && input === 'c') || input.toLowerCase() === 'q') { onExit(); return; }
    if (key.upArrow || key.downArrow) {
      terminal.navigate(key.upArrow ? -1 : 1, snapshot.requestId); return;
    }
    if (key.return) { terminal.submitSelection(snapshot.requestId); return; }
    const action = keys[input.toLowerCase()];
    if (action && snapshot.choices.includes(action)) terminal.answer(action, snapshot.requestId);
  });
  const { view, choices, selected, warning } = snapshot;
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
        <ExerciseIllustration exerciseId={view.exercise.id} />
        {view.exercise.instructions.map((step, i) => <Text key={i}>{i + 1}. {step}</Text>)}
        <Text dimColor>Rest after the listed movements. Do not hold a stretch for the whole timer.</Text>
        <Text color="yellow">{view.exercise.caution}</Text>
        <Text dimColor>Source: {view.exercise.source.title}</Text>
      </>}
    </>}
    {view.message && <Text>{view.message}</Text>}
    <TimerFeedback view={view} now={now} />
    <Text> </Text>
    {view.phase === 'confirm' && <Text>Did you perform the exercise? The timer alone does not record a completion.</Text>}
    <ShortcutBar choices={choices} selected={selected} />
    {warning && <Text color="yellow">{warning}</Text>}
  </Box>;
}
export class Terminal implements Interaction {
  snapshot: Snapshot = { view: { phase: 'waiting', demo: false }, choices: [], requestId: 0 };
  subscribe?: (snapshot: Snapshot) => void;
  private pending?: (value: string) => void;
  private nextRequestId = 0;
  private publish() { this.subscribe?.({ ...this.snapshot }); }
  show(view: View) {
    this.snapshot = { ...this.snapshot, view, choices: [], selected: undefined, requestId: ++this.nextRequestId };
    this.publish();
  }
  warn(warning: string) { this.snapshot = { ...this.snapshot, warning }; this.publish(); }
  answer(value: string, requestId = this.snapshot.requestId) {
    if (requestId !== this.snapshot.requestId || !this.snapshot.choices.includes(value)) return;
    this.pending?.(value);
  }
  navigate(direction: -1 | 1, requestId: number) {
    const { choices, selected } = this.snapshot;
    if (requestId !== this.snapshot.requestId || choices.length === 0) return;
    const index = choices.indexOf(selected ?? choices[0]!);
    this.snapshot = { ...this.snapshot, selected: choices[(index + direction + choices.length) % choices.length] };
    this.publish();
  }
  submitSelection(requestId: number) {
    if (this.snapshot.selected) this.answer(this.snapshot.selected, requestId);
  }
  ask(choices: readonly string[], signal: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return; }
      const cleanup = () => {
        signal.removeEventListener('abort', abort);
        if (this.pending !== answer) return;
        this.pending = undefined;
        this.snapshot = { ...this.snapshot, choices: [], selected: undefined }; this.publish();
      };
      const abort = () => { cleanup(); reject(signal.reason); };
      const answer = (value: string) => { if (!choices.includes(value)) return; cleanup(); resolve(value); };
      this.pending = answer;
      signal.addEventListener('abort', abort, { once: true });
      this.snapshot = { ...this.snapshot, choices, selected: choices[0], requestId: ++this.nextRequestId }; this.publish();
    });
  }
  mount(onExit: () => void, options: RenderOptions = {}) {
    return render(<Screen terminal={this} onExit={onExit} />, { ...options, exitOnCtrlC: false });
  }
}
