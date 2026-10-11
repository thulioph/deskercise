import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SQLiteAnalytics } from '../src/infrastructure/SQLiteAnalytics.js';
import { getReport } from '../src/core/GetReport.js';
import { writeReport } from '../src/infrastructure/report.js';
test('empty report is a self-contained HTML file with inline charts and no external resources', () => {
  const root = mkdtempSync(path.join(tmpdir(),'deskercise-report-')); const db = new SQLiteAnalytics(':memory:');
  const report = getReport(db,new Date('2026-10-08T12:00:00Z')); const filename = path.join(root,'report.html');
  writeReport(report,filename,false); const html = readFileSync(filename,'utf8');
  assert.equal(report.days.length,7); assert.equal(report.completionRate,0);
  assert.match(html,/No activity yet/); assert.match(html,/new Chart/);
  assert.match(html,/interaction:\{mode:'index'/);
  assert.match(html,/cubicInterpolationMode:'monotone'/);
  assert.match(html,/spanGaps:true/);
  assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=|<img[^>]+src=/i);
  assert.match(html,/:focus-visible/);
  assert.match(html,/prefers-reduced-motion/);
  assert.match(html,/@media\s+print/);
  assert.match(html,/role="group"/);
  assert.match(html,/scope="col"/);
  assert.match(html,/<caption>/);
  assert.match(html,/class="progress-narrative"/);
  assert.match(html,/class="narrative"/);
  assert.match(html,/visually-hidden|class="sr-only"/);
  assert.match(html,/class="subtitle"/);
  assert.match(html,/How much confirmed movement did you get each day\?/);
  assert.doesNotMatch(html,/chart-data|Body area data table/);
  assert.doesNotMatch(html,/class="metrics"|class="session-strip"/);
  db.close(); rmSync(root,{recursive:true});
});
test('report excludes old events and computes local dates across midnight', () => {
  const db = new SQLiteAnalytics(':memory:');
  db.startSession({id:'session',startedAt:'2026-01-01T00:00:00Z',intervalMinutes:45,demo:false});
  const now = new Date(2026,9,8,12,0,0); const yesterday = new Date(2026,9,7,23,30,0).toISOString();
  const event = {id:'recent',sessionId:'session',exerciseId:'a',exerciseName:'A',bodyPart:'wrists',promptedAt:yesterday,
    startedAt:yesterday,resolvedAt:now.toISOString(),plannedSeconds:60,actualSeconds:60,status:'COMPLETED' as const,snoozeCount:2};
  db.saveEvent(event,{eventId:event.id,at:yesterday,status:'COMPLETED'});
  db.saveEvent({...event,id:'old',promptedAt:'2026-01-01T00:00:00Z'},{eventId:'old',at:'2026-01-01T00:00:00Z',status:'COMPLETED'});
  const report = getReport(db,now); assert.equal(report.totalPrompted,1); assert.equal(report.activeSeconds,60);
  assert.equal(report.days[5]?.completed,1); assert.equal(report.snoozes,2); db.close();
});
test('report aggregates exercises, response latency, and sessions', () => {
  const db = new SQLiteAnalytics(':memory:');
  db.startSession({id:'s1',startedAt:'2026-10-08T10:00:00Z',intervalMinutes:30,demo:false});
  db.startSession({id:'s2',startedAt:'2026-10-08T11:00:00Z',intervalMinutes:45,demo:true});
  const prompted = '2026-10-08T12:00:00.000Z';
  const started = '2026-10-08T12:00:15.000Z';
  const resolved = '2026-10-08T12:01:15.000Z';
  const base = {
    exerciseId: 'leg-lift', exerciseName: 'Seated leg lift', bodyPart: 'legs',
    promptedAt: prompted, startedAt: started, resolvedAt: resolved,
    plannedSeconds: 60, actualSeconds: 60, status: 'COMPLETED' as const, snoozeCount: 0,
  };
  db.saveEvent({...base,id:'e1',sessionId:'s1'},{eventId:'e1',at:prompted,status:'COMPLETED'});
  db.saveEvent({...base,id:'e2',sessionId:'s2',actualSeconds:40,startedAt:'2026-10-08T12:00:05.000Z'},
    {eventId:'e2',at:prompted,status:'COMPLETED'});
  db.saveEvent({
    id:'e3',sessionId:'s1',exerciseId:'neck',exerciseName:'Neck roll',bodyPart:'neck',
    promptedAt:prompted,startedAt:null,resolvedAt:resolved,plannedSeconds:30,actualSeconds:0,
    status:'SKIPPED',snoozeCount:1,
  },{eventId:'e3',at:prompted,status:'SKIPPED'});
  const report = getReport(db, new Date('2026-10-08T18:00:00Z'));
  assert.equal(report.sessionCount, 2);
  assert.equal(report.avgIntervalMinutes, 37.5);
  assert.equal(report.demoSessions, 1);
  assert.equal(report.avgResponseSeconds, 10);
  assert.equal(report.exercises.length, 1);
  assert.equal(report.exercises[0]?.name, 'Seated leg lift');
  assert.equal(report.exercises[0]?.completions, 2);
  assert.equal(report.exercises[0]?.avgActualSeconds, 50);
  assert.equal(report.skipped, 1);
  const root = mkdtempSync(path.join(tmpdir(),'deskercise-report-'));
  const filename = path.join(root,'report.html');
  writeReport(report, filename, false);
  const html = readFileSync(filename,'utf8');
  assert.match(html,/Per-exercise/);
  assert.match(html,/Seated leg lift/);
  assert.match(html,/Outcomes/);
  assert.match(html,/id="outcomes"/);
  assert.match(html,/type:'doughnut'/);
  assert.match(html,/donut-center/);
  assert.match(html,/>prompts</);
  assert.match(html,/id="outcomes-table"/);
  assert.match(html,/aria-describedby="outcomes-table"/);
  assert.doesNotMatch(html,/class="outcomes"/);
  assert.match(html,/class="progress-narrative"/);
  assert.match(html,/id="summary-heading"/);
  assert.match(html,/Across <strong>2 sessions<\/strong>/);
  assert.match(html,/confirmed <strong>2 breaks<\/strong>/);
  assert.match(html,/completed <strong>\d+%<\/strong> of prompts/);
  assert.match(html,/typically started within <strong>~10s<\/strong>/);
  assert.match(html,/every <strong>37\.5 min<\/strong>/);
  assert.doesNotMatch(html,/Demo sessions in this period|Response time is the average delay/);
  assert.doesNotMatch(html,/How many work sessions ran/);
  assert.doesNotMatch(html,/class="metrics"|class="session-strip"|class="session-metrics"/);
  const narrativeAt = html.indexOf('class="narrative"');
  const periodAt = html.indexOf('id="period"');
  const chartsAt = html.indexOf('class="charts"');
  assert.ok(narrativeAt >= 0 && periodAt > narrativeAt && chartsAt > periodAt);
  assert.match(html,/Body area/);
  assert.match(html,/id="daily-table"/);
  assert.match(html,/aria-describedby="daily-table"/);
  assert.match(html,/class="sr-only[^"]*">\s*<table id="daily-table"/);
  assert.doesNotMatch(html,/Activity details/);
  assert.doesNotMatch(html,/stacked=!useMinutes/);
  assert.match(html,/label:'Prompted'/);
  assert.match(html,/label:'Completed'/);
  assert.match(html,/breaksDatasets/);
  assert.match(html,/grouped prompted and completed/);
  assert.match(html,/<time datetime="2026-10-08" title="2026-10-08">/);
  assert.match(html,/\w{3}, \d{1,2} \w{3}/);
  assert.doesNotMatch(html,/chart-data|Body area data table|Daily movement data table|Completion rate data table/);
  assert.equal((html.match(/Daily activity totals for the report period/g) ?? []).length, 1);
  db.close(); rmSync(root,{recursive:true});
});
