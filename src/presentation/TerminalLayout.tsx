import { Box, Text } from 'ink';
import type { View } from '../core/model.js';
import { useTerminalColumns } from './useTerminalColumns.js';
import { SessionSummary } from './SessionSummary.js';
import { ExerciseIllustration } from './ExerciseIllustration.js';
import { TimerFeedback } from './TimerFeedback.js';
import { ShortcutBar } from './ShortcutBar.js';

export type Snapshot = { view: View; choices: readonly string[]; warning?: string; selected?: string };
function ExerciseDetails({ view }: { view: View }) {
  if (!view.exercise || !['prompt', 'exercise'].includes(view.phase)) return null;
  return <Box flexDirection="column">
    <ExerciseIllustration exerciseId={view.exercise.id} />
    {view.exercise.instructions.map((step, i) => <Text key={i}>{i + 1}. {step}</Text>)}
    <Text dimColor>Rest after the listed movements. Do not hold a stretch for the whole timer.</Text>
    <Text color="yellow">{view.exercise.caution}</Text>
    <Text dimColor>Source: {view.exercise.source.title}</Text>
  </Box>;
}

function Status({ snapshot, now }: { snapshot: Snapshot; now: number }) {
  const { view, choices, selected, warning } = snapshot;
  return <Box flexDirection="column">
    <TimerFeedback view={view} now={now} />
    {view.message && <Text>{view.message}</Text>}
    {view.phase === 'confirm' && <Text>Did you perform the exercise? The timer alone does not record a completion.</Text>}
    <ShortcutBar choices={choices} selected={selected} />
    {warning && <Text color="yellow">{warning}</Text>}
  </Box>;
}

export function TerminalLayout({ snapshot, now }: { snapshot: Snapshot; now: number }) {
  const columns = useTerminalColumns();
  const { view } = snapshot;
  const layoutWidth = Math.min(columns, 120);
  const bordered = layoutWidth >= 40;
  const padding = layoutWidth >= 60 ? 2 : bordered ? 1 : 0;
  const contentWidth = Math.max(1, layoutWidth - (bordered ? 2 : 0) - padding * 2);
  const showDetails = !!view.exercise && ['prompt', 'exercise'].includes(view.phase);
  const wide = layoutWidth >= 100 && showDetails;
  const statusWidth = wide ? 36 : contentWidth;
  const title = { waiting: 'Space to focus', prompt: 'Time to move', snoozing: 'A little later', exercise: 'Your movement break', confirm: 'How did it go?', done: 'Session saved' }[view.phase];

  return <Box width={columns} justifyContent="center">
    <Box width={layoutWidth} flexDirection="column" paddingX={padding} paddingY={bordered ? 1 : 0}
      borderStyle={bordered ? 'round' : undefined} borderColor="cyan">
    <Text bold color="cyan">DESKERCISE {view.demo ? '· DEMO / 5-second test' : '· workplace movement'}</Text>
    <SessionSummary view={view} now={now} />
    <Text bold>{title}</Text>
    {view.exercise && <>
      <Text color="green">{view.exercise.name} · {view.exercise.bodyPart} · {view.exercise.position}</Text>
      <Text dimColor>Break window: {view.durationSeconds ?? view.exercise.durationSeconds}s</Text>
    </>}
    <Box marginTop={1} flexDirection={wide ? 'row' : 'column'} gap={wide ? 2 : showDetails ? 1 : 0}>
      {wide && <Box width={contentWidth - statusWidth - 2} flexShrink={0} flexDirection="column">
        <ExerciseDetails view={view} />
      </Box>}
      <Box width={statusWidth} flexShrink={0} flexDirection="column">
        <Status snapshot={snapshot} now={now} />
      </Box>
      {!wide && <ExerciseDetails view={view} />}
    </Box>
    </Box>
  </Box>;
}
