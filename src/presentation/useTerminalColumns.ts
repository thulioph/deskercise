import { useEffect, useState } from 'react';
import { useStdout } from 'ink';

export function useTerminalColumns(): number {
  const { stdout } = useStdout();
  const read = () => Number.isFinite(stdout.columns) && stdout.columns > 0
    ? Math.floor(stdout.columns) : 80;
  const [columns, setColumns] = useState(read);
  useEffect(() => {
    const resize = () => setColumns(read());
    resize();
    stdout.on('resize', resize);
    return () => { stdout.off('resize', resize); };
  }, [stdout]);
  return columns;
}
