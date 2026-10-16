import { Text } from 'ink';

export function Countdown({ seconds, label }: { seconds: number; label: string }) {
  const remaining = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const remainder = (remaining % 60).toString().padStart(2, '0');
  return <Text>{label}: <Text bold color="cyan">{minutes}:{remainder}</Text></Text>;
}
