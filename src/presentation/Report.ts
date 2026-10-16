import type { Report } from '../core/model.js';

export interface TerminalReportOptions {
  columns?: number;
  unicode?: boolean;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Wrap text without terminal escape sequences, including on very narrow screens. */
function wrap(line: string, columns: number): string[] {
  const lines: string[] = [];
  while (line.length > columns) {
    const space = line.lastIndexOf(' ', columns);
    const end = space > 0 ? space : columns;
    lines.push(line.slice(0, end));
    line = line.slice(end).trimStart();
  }
  lines.push(line);
  return lines;
}

/** Render already-aggregated local history; confirmed minutes retain core semantics. */
export function terminalReport(report: Report, demo: boolean, options: TerminalReportOptions = {}): string {
  const columns = options.columns != null && Number.isFinite(options.columns)
    ? Math.max(10, Math.floor(options.columns)) : 80;
  const unicode = options.unicode ?? false;
  const separator = unicode ? '·' : '-';
  const lines = [
    '', `DESKERCISE ${demo ? 'DEMO ' : ''}${separator} today + previous 6 local calendar days`, '',
    `  Confirmed breaks    ${report.completed} / ${report.totalPrompted}`,
    `  Completion rate     ${report.completionRate.toFixed(0)}%`,
    `  Confirmed minutes   ${(report.activeSeconds / 60).toFixed(1)}`,
    `  Skipped / expired   ${report.skipped} / ${report.expired}`,
    `  Interrupted         ${report.interrupted}`,
    `  Unconfirmed         ${report.unconfirmed}`,
    `  Cancelled / pending ${report.cancelled} / ${report.pending}`,
    `  Snooze actions      ${report.snoozes}`,
    `  Sessions            ${report.sessionCount}` +
      (report.avgIntervalMinutes == null ? '' : ` ${separator} avg interval ${fmtNum(report.avgIntervalMinutes)} min`),
    `  Avg response        ${report.avgResponseSeconds == null ? '-' : `${fmtNum(report.avgResponseSeconds)}s`}`,
    '',
  ];
  if (report.totalPrompted === 0) {
    lines.push(`No activity yet. Run deskercise start${demo ? ' --demo' : ''}, then regenerate this report.`, '');
  }
  lines.push('Seven-day history');
  if (columns >= 40) {
    const row = (date: string, prompted: string, completed: string, minutes: string) =>
      `${date.padEnd(12)}${prompted.padStart(8)} ${completed.padStart(9)} ${minutes.padStart(7)}`;
    lines.push(row('Date', 'Prompted', 'Completed', 'Minutes'));
    for (const day of report.days) {
      lines.push(row(day.date, String(day.prompted), String(day.completed), (day.seconds / 60).toFixed(1)));
    }
  } else {
    for (const day of report.days) {
      lines.push(day.date, `  Prompted ${day.prompted}, completed ${day.completed}`,
        `  Confirmed minutes ${(day.seconds / 60).toFixed(1)}`);
    }
  }
  const bars = (heading: string, values: { label: string; count: number }[]) => {
    lines.push('', heading);
    if (values.length === 0) {
      lines.push('No completed breaks in this period.');
      return;
    }
    const max = Math.max(0, ...values.map(value => value.count));
    const labelWidth = Math.min(24, columns - 8, Math.max(...values.map(value => value.label.length)));
    const countWidth = Math.max(...values.map(value => String(value.count).length));
    const barWidth = Math.max(1, Math.min(30, columns - labelWidth - countWidth - 4));
    for (const { label, count } of values) {
      const clipped = label.length > labelWidth
        ? label.slice(0, labelWidth - 1) + (unicode ? '…' : '~') : label;
      const length = max > 0 && count > 0 ? Math.max(1, Math.round(count / max * barWidth)) : 0;
      lines.push(`${clipped.padEnd(labelWidth)}  ${(unicode ? '█' : '#').repeat(length).padEnd(barWidth)}  ${count}`);
    }
  };
  bars('Completed breaks by day', report.days.map(day => ({ label: day.date, count: day.completed })));
  bars('Completed breaks by body area', report.bodyParts.map(part => ({ label: part.name, count: part.completed })));
  lines.push('', 'Minutes count confirmed timer duration only. Days use the first prompt in your local timezone.');
  return lines.flatMap(line => wrap(line, columns)).join('\n') + '\n';
}
