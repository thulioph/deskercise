import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
export const dataRoot = () => path.resolve(process.env.DESKERCISE_HOME ?? path.join(homedir(), '.deskercise'));
export function ensureDirectory(directory: string) { mkdirSync(directory, { recursive: true, mode: 0o700 }); }
export function validInterval(raw: string): number {
  const n = Number(raw);
  if (!raw.trim() || !Number.isFinite(n) || n < 0.01 || n > 480) throw new Error('Interval must be between 0.01 and 480 minutes.');
  return n;
}
export function readConfig(root: string): number | undefined {
  try {
    const value = JSON.parse(readFileSync(path.join(root, 'config.json'), 'utf8')) as { intervalMinutes?: unknown };
    if (typeof value.intervalMinutes !== 'number') throw new Error('Missing intervalMinutes.');
    return validInterval(String(value.intervalMinutes));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new Error(`Cannot read ${path.join(root, 'config.json')}. Fix the JSON or move it aside and run start again.`);
  }
}
export function writeConfig(root: string, intervalMinutes: number) {
  ensureDirectory(root);
  const filename = path.join(root, 'config.json');
  const temporary = `${filename}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ version: 1, intervalMinutes }, null, 2) + '\n', { mode: 0o600 });
  renameSync(temporary, filename);
}
