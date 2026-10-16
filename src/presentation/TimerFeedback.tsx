import { Box, Text } from 'ink';
import type { View } from '../core/model.js';
import { Countdown } from './Countdown.js';
import { ProgressBar } from './ProgressBar.js';

const countdownLabels: Record<View['phase'], string> = {
  waiting: 'Next movement break in', prompt: 'Time to respond',
  snoozing: 'Same exercise returns in', exercise: 'Movement break remaining',
  confirm: 'Time to confirm', done: '',
};

export function TimerFeedback({ view, now }: { view: View; now: number }) {
  const timedPhase = ['waiting', 'snoozing', 'exercise'].includes(view.phase);
  const rawRemaining = Math.max(0, Math.ceil(((view.deadline ?? now) - now) / 1000));
  const remaining = timedPhase && view.durationSeconds
    ? Math.min(view.durationSeconds, rawRemaining) : rawRemaining;
  // Timer expiry alone must never show success, including when the screen
  // still displays 00:00. Only a resolved, explicitly confirmed result counts.
  const completed = ['waiting', 'done'].includes(view.phase) && view.lastResult === 'COMPLETED';
  return <Box flexDirection="column">
    {view.phase === 'waiting' && <Text dimColor>Focus time. Your next break begins after this interval.</Text>}
    {view.phase === 'exercise' && <Text>Follow the listed movements, then rest. This timer is the whole break window.</Text>}
    {view.phase === 'confirm' && <Text color="yellow">Timer finished. Completion still needs your confirmation.</Text>}
    {completed && <Text color="green" bold>Completed and saved. Take a moment to rest.</Text>}
    {view.phase === 'done' && !completed && <Text bold>Session finished.</Text>}
    {view.deadline !== undefined && view.phase !== 'done' && <>
      <Countdown seconds={remaining} label={countdownLabels[view.phase]} />
      {timedPhase && view.durationSeconds !== undefined && view.durationSeconds > 0 &&
        <ProgressBar progress={1 - remaining / view.durationSeconds} />}
    </>}
  </Box>;
}
