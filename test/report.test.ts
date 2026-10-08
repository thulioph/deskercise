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
  assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=|<img[^>]+src=/i);
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
