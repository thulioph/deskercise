import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SQLiteAnalytics } from '../src/infrastructure/SQLiteAnalytics.js';
import { getReport } from '../src/core/GetReport.js';
import { terminalReport } from '../src/infrastructure/report.js';

function history() {
  const db = new SQLiteAnalytics(':memory:');
  const now = new Date(2026, 9, 8, 12);
  const promptedAt = new Date(2026, 9, 7, 23, 30).toISOString();
  db.startSession({ id: 'session', startedAt: promptedAt, intervalMinutes: 45, demo: false });
  for (const [id, status, actualSeconds, bodyPart] of [
    ['one', 'COMPLETED', 60, 'wrists'], ['two', 'COMPLETED', 30, 'legs'],
    ['three', 'INTERRUPTED', 99, 'wrists'], ['four', 'UNCONFIRMED', 99, 'legs'],
    ['five', 'PROMPTED', 0, 'wrists'],
  ] as const) {
    db.saveEvent({ id, sessionId: 'session', exerciseId: id, exerciseName: id, bodyPart,
      promptedAt, startedAt: null, resolvedAt: null, plannedSeconds: 60, actualSeconds, status, snoozeCount: 0 },
    { eventId: id, at: promptedAt, status });
  }
  const report = getReport(db, now);
  db.close();
  return report;
}

test('terminal report shows seven local dates and only confirmed movement minutes', () => {
  const report = history();
  const output = terminalReport(report, false, { columns: 80, unicode: true });
  assert.match(output, /Confirmed breaks\s+2 \/ 5/);
  assert.match(output, /Confirmed minutes\s+1\.5/);
  assert.match(output, /Seven-day history/);
  assert.match(output, /Date\s+Prompted\s+Completed\s+Minutes/);
  for (const day of report.days) assert.ok(output.includes(day.date), day.date);
  assert.match(output, /2026-10-07\s+5\s+2\s+1\.5/);
  assert.match(output, /2026-10-08\s+0\s+0\s+0\.0/);
  assert.match(output, /Completed breaks by day/);
  assert.match(output, /2026-10-07\s+█+\s+2/);
  assert.match(output, /Completed breaks by body area/);
  assert.match(output, /wrists\s+█+\s+1/);
  assert.match(output, /legs\s+█+\s+1/);
});

test('empty demo history stays useful and finite, without completion bars', () => {
  const db = new SQLiteAnalytics(':memory:');
  const report = getReport(db, new Date(2026, 9, 8, 12));
  db.close();
  const output = terminalReport(report, true, { columns: 80, unicode: false });
  assert.match(output, /DESKERCISE DEMO/);
  assert.match(output, /No activity yet/);
  assert.match(output, /deskercise start --demo/);
  assert.match(output, /No completed breaks in this period/);
  assert.equal((output.match(/2026-10-0[2-8]/g) ?? []).length, 14);
  assert.doesNotMatch(output, /NaN|Infinity|█|#/);
});

test('terminal report adapts to narrow widths and uses ASCII for redirected output', () => {
  const report = history();
  report.bodyParts[0]!.name = 'a body area with an unusually long label';
  for (const columns of [20, 32, 48, 80]) {
    const output = terminalReport(report, false, { columns, unicode: false });
    assert.doesNotMatch(output, /[^\x00-\x7f]/);
    assert.match(output, /#/);
    assert.ok(output.split('\n').every(line => line.length <= columns), `fits ${columns} columns`);
    assert.ok(output.includes('2026-10-07'));
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
  const narrow = terminalReport(history(), false, { columns: 32, unicode: false });
  assert.match(narrow, /Prompted 5, completed 2/);
  assert.match(narrow, /Confirmed minutes 1\.5/);
});

test('report CLI prints ASCII history when piped and still writes offline HTML', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'deskercise-terminal-report-'));
  try {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', 'report', '--no-open'], {
      cwd: process.cwd(), env: { ...process.env, DESKERCISE_HOME: root }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Seven-day history/);
    assert.match(result.stdout, /No activity yet/);
    assert.doesNotMatch(result.stdout, /[^\x00-\x7f]|\x1b\[/);
    const html = readFileSync(path.join(root, 'report.html'), 'utf8');
    assert.match(html, /new Chart/);
    assert.doesNotMatch(html, /<script[^>]+src=/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
