import { Box, Text } from 'ink';
import type { View } from '../core/model.js';

function elapsedTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const tail = (seconds % 60).toString().padStart(2, '0');
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${(minutes % 60).toString().padStart(2, '0')}:${tail}`
    : `${minutes.toString().padStart(2, '0')}:${tail}`;
}

export function SessionSummary({ view, now }: { view: View; now: number }) {
  if (!view.session) return null;
  const { startedAt, completed, activeSeconds } = view.session;
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  let nextBreak: string | undefined;
  if (view.phase === 'waiting' || view.phase === 'snoozing') {
    if (view.deadline !== undefined) {
      const rawRemaining = Math.max(0, Math.ceil((view.deadline - now) / 1000));
      nextBreak = elapsedTime(view.durationSeconds === undefined ? rawRemaining : Math.min(view.durationSeconds, rawRemaining));
    }
  } else if (view.phase === 'prompt') nextBreak = 'ready';
  else if (view.phase === 'exercise' || view.phase === 'confirm') nextBreak = 'after this exercise';
  return <Box flexDirection="column" marginTop={1}>
    <Text dimColor>{view.demo ? 'Demo session' : 'Session'}: {elapsedTime(elapsed)} · Completed: {completed}</Text>
    <Text dimColor>Confirmed active: {(activeSeconds / 60).toFixed(1)} min</Text>
    {nextBreak !== undefined && <Text dimColor>Next break: {nextBreak}</Text>}
  </Box>;
}
