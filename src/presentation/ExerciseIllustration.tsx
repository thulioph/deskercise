import { useEffect, useState } from 'react';
import { Text, useStdout } from 'ink';

// These sketches describe only movements already present in the sourced catalogue.
// They are supplementary cues: instructions, repetition counts and cautions stay visible.
const sketches: Record<string, string> = {
  'neck-turn': [
    'Movement sketch: head direction (top view)',
    'Look left       Centre       Look right',
    '   <O              O              O>',
    '    ←              |              →',
    'Return to centre; rest between turns.',
  ].join('\n'),
  'shoulder-rolls': [
    'Movement sketch: shoulder rolls',
    'Relax shoulders       Forward x3, then Backward x3',
    '       O                         O',
    '      /|\\                    ↻ /|\\ ↺',
    '       |                         |',
    'Pause and relax.',
  ].join('\n'),
  'cross-body': [
    'Movement sketch: cross-body shoulder stretch',
    'Support above elbow        Across chest',
    '       O                        O',
    '      /|--^--               ←--^--|',
    '       |                        |',
    '^ = supporting hand. Hold 5s; switch arms.',
  ].join('\n'),
};

export function supportsUnicode(environment: NodeJS.ProcessEnv = process.env): boolean {
  if (environment.TERM === 'dumb') return false;
  const locale = environment.LC_ALL || environment.LC_CTYPE || environment.LANG;
  return !locale || /utf-?8/i.test(locale);
}

export function ExerciseIllustration({ exerciseId, unicode = supportsUnicode() }: {
  exerciseId: string; unicode?: boolean;
}) {
  const { stdout } = useStdout();
  const dimensions = () => ({ columns: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
  const [size, setSize] = useState(dimensions);
  useEffect(() => {
    const resize = () => setSize(dimensions());
    stdout.on('resize', resize);
    return () => { stdout.removeListener('resize', resize); };
  }, [stdout]);

  const sketch = sketches[exerciseId];
  // Reserve room for the border, full instructions, safety text and controls.
  if (!sketch || size.columns < 60 || size.rows < 30 || process.env.INK_SCREEN_READER === 'true') return null;
  const text = unicode ? sketch : sketch.replaceAll('←', '<-').replaceAll('→', '->')
    .replaceAll('↻', '(o)').replaceAll('↺', '(o)');
  return <Text color="cyan">{text}</Text>;
}
