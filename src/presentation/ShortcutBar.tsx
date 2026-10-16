import { Box, Text } from 'ink';

const labels: Record<string, string> = {
  start: '[1] Start', skip: '[2] Skip', snooze: '[3] Snooze', stop: '[s] Stop early',
  completed: '[y] Completed', 'not-completed': '[n] Not completed',
};

export function ShortcutBar({ choices, selected }: { choices: readonly string[]; selected?: string }) {
  return <Box flexDirection="column">
    {choices.map(choice => <Text key={choice} bold inverse={choice === selected}>
      {choice === selected ? '› ' : '  '}{labels[choice] ?? choice}
    </Text>)}
    <Text dimColor>{choices.length > 0 ? '↑/↓ select · Enter choose · ' : ''}q or Ctrl+C to end · keep this terminal open</Text>
  </Box>;
}
