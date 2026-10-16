#!/usr/bin/env node
import { Command } from 'commander';
import { intro, text, outro, isCancel } from '@clack/prompts';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { StartTimer } from './core/StartTimer.js';
import { getReport } from './core/GetReport.js';
import { SQLiteAnalytics } from './infrastructure/SQLiteAnalytics.js';
import { JsonCatalog } from './infrastructure/Catalog.js';
import { SystemClock } from './infrastructure/Clock.js';
import { MacNotifier } from './infrastructure/Notifier.js';
import { dataRoot, ensureDirectory, readConfig, writeConfig, validInterval } from './infrastructure/config.js';
import { writeReport, terminalReport, openReport } from './infrastructure/report.js';
import { Terminal } from './presentation/Terminal.js';
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const program = new Command().name('deskercise').version(version).description('Private, local workplace movement breaks. macOS prototype.');
program.command('start').description('Run the foreground movement timer')
  .option('-i, --interval <minutes>', 'Override the saved interval for this run', validInterval)
  .option('--demo', 'Test with a 3-second interval and 5-second timer, in a separate data folder')
  .option('--once', 'End after one exercise is resolved')
  .option('--no-notifications', 'Use terminal prompts only')
  .action(async (options: { interval?: number; demo?: boolean; once?: boolean; notifications: boolean }) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('start requires an interactive terminal. Open Terminal or iTerm and try again.');
    if (process.platform !== 'darwin') console.error('macOS is the initial target. Running a terminal-only compatibility test on this platform.');
    const root = path.join(dataRoot(), options.demo ? 'demo' : '');
    ensureDirectory(root);
    let interval = options.demo ? 0.05 : readConfig(root);
    if (interval === undefined) {
      if (options.interval !== undefined) interval = options.interval;
      else {
        intro('Welcome to Deskercise');
        const answer = await text({ message: 'How many minutes between workplace movement breaks?', placeholder: '45', defaultValue: '45',
          validate(value) { try { validInterval(value ?? ''); } catch (e) { return (e as Error).message; } } });
        if (isCancel(answer)) { outro('Setup cancelled.'); return; }
        interval = validInterval(answer);
        outro('Preference saved. Keep this terminal open.');
      }
      writeConfig(root, interval);
    }
    interval = options.interval ?? interval;
    const db = new SQLiteAnalytics(path.join(root, 'analytics.db'));
    const terminal = new Terminal();
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    let screen: ReturnType<Terminal['mount']> | undefined;
    try {
      screen = terminal.mount(stop);
      const notifier = options.notifications && process.platform === 'darwin' ? new MacNotifier() : { notify: async () => {} };
      await new StartTimer(db, new JsonCatalog(), new SystemClock(), terminal, notifier, { next: randomUUID }).execute({
        intervalMinutes: interval, snoozeSeconds: options.demo ? 5 : 600,
        promptTimeoutSeconds: options.demo ? 30 : 300, confirmationTimeoutSeconds: options.demo ? 30 : 300,
        demo: !!options.demo, once: !!options.once, exerciseSeconds: options.demo ? 5 : undefined,
      }, controller.signal);
    } finally {
      screen?.unmount(); db.close();
      process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    }
    if (terminal.snapshot.view.phase === 'done' && terminal.snapshot.view.lastResult) {
      console.log(`Saved: ${terminal.snapshot.view.lastResult}.`);
    }
    console.log(`Session saved. ${options.demo ? 'Demo data: deskercise report --demo' : 'View it with deskercise report'}`);
  });
program.command('report').description('Print a summary and generate an offline browser report')
  .option('--demo', 'Read the separate demo history').option('--no-open', 'Generate HTML without opening the browser')
  .action(async (options: { demo?: boolean; open: boolean }) => {
    const root = path.join(dataRoot(), options.demo ? 'demo' : ''); ensureDirectory(root);
    const db = new SQLiteAnalytics(path.join(root, 'analytics.db'));
    try {
      const report = getReport(db);
      console.log(terminalReport(report, !!options.demo));
      const filename = path.join(root, 'report.html'); writeReport(report, filename, !!options.demo);
      console.log(`Offline report: ${filename}`);
      if (options.open && process.platform === 'darwin') {
        try { await openReport(filename); } catch { console.error('Browser could not open. Open the HTML path above manually.'); }
      }
    } finally { db.close(); }
  });
try { await program.parseAsync(); }
catch (error) { console.error(`Deskercise: ${(error as Error).message}`); process.exitCode = 1; }
