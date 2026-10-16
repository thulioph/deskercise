import { Text } from 'ink';

export function ProgressBar({ progress }: { progress: number }) {
  const elapsed = Math.max(0, Math.min(1, progress));
  const blocks = Math.round(elapsed * 24);
  return <Text color="cyan">{'━'.repeat(blocks)}{'─'.repeat(24 - blocks)} <Text bold>{Math.round(elapsed * 100)}% elapsed</Text></Text>;
}
