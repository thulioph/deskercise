import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Report } from '../core/model.js';
const require = createRequire(import.meta.url);
export function terminalReport(report: Report, demo: boolean): string {
  return `\nDESKERCISE ${demo ? 'DEMO ' : ''}· today + previous 6 local calendar days\n\n` +
    `  Confirmed breaks    ${report.completed} / ${report.totalPrompted}\n` +
    `  Completion rate     ${report.completionRate.toFixed(0)}%\n` +
    `  Confirmed minutes   ${(report.activeSeconds / 60).toFixed(1)}\n` +
    `  Skipped / expired   ${report.skipped} / ${report.expired}\n` +
    `  Interrupted         ${report.interrupted}\n` +
    `  Unconfirmed         ${report.unconfirmed}\n` +
    `  Cancelled / pending ${report.cancelled} / ${report.pending}\n` +
    `  Snooze actions      ${report.snoozes}\n`;
}
export function writeReport(report: Report, filename: string, demo: boolean) {
  const chartPath = path.join(path.dirname(require.resolve('chart.js')), 'chart.umd.js');
  const chartJs = readFileSync(chartPath, 'utf8').replace(/<\/script/gi, '<\\/script').replace(/\/\/# sourceMappingURL=.*$/gm, '');
  const data = JSON.stringify(report).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deskercise · ${demo ? 'Demo ' : ''}Movement report</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f6f7f2;color:#17382e;font:16px/1.6 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:48px 24px 80px}
.top{display:flex;justify-content:space-between;align-items:center;font-size:12px;text-transform:uppercase;letter-spacing:2px}.badge{border:1px solid #c9d8ce;border-radius:20px;padding:5px 14px}
h1{font-size:clamp(36px,6vw,60px);line-height:1.1;letter-spacing:-2px;margin:36px 0 14px}p{color:#597167}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:30px 0}
.metric,.chart{min-width:0;background:white;border:1px solid #e0e7dc;border-radius:16px;padding:24px}.metric strong{display:block;font-size:36px;line-height:1.4}.metric span{color:#597167;font-size:13px}.charts{display:grid;grid-template-columns:2fr 1fr;gap:16px}.chart h2{font-size:17px;margin:0 0 20px}.plot{height:270px;position:relative}.wide{grid-column:1/-1}button{background:#17382e;color:white;border:0;padding:10px 18px;border-radius:24px;cursor:pointer}button[aria-pressed=true]{background:#6a8762}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:12px;text-align:left;border-bottom:1px solid #e0e7dc}footer{margin-top:30px;font-size:13px;color:#597167}
@media(max-width:700px){.metrics{grid-template-columns:repeat(2,1fr)}.charts{grid-template-columns:1fr}.top{letter-spacing:1px}.metric{padding:16px}th,td{font-size:12px;padding:8px 4px}.chart{padding:16px}}
</style></head><body><main>
<div class="top"><strong>Deskercise / ${demo ? 'Demo report' : 'Movement report'}</strong><span class="badge">Local · offline</span></div>
<h1>Small breaks.<br>A little more movement.</h1><p id="period"></p>
<div class="metrics"><div class="metric"><strong>${(report.activeSeconds / 60).toFixed(1)}</strong><span>confirmed minutes</span></div><div class="metric"><strong>${report.completed}</strong><span>completed breaks</span></div><div class="metric"><strong>${report.completionRate.toFixed(0)}%</strong><span>of unique exercises prompted</span></div><div class="metric"><strong>${report.snoozes}</strong><span>snooze actions</span></div></div>
${report.totalPrompted === 0 ? '<p>No activity yet. Run deskercise start, complete a break, then regenerate this report.</p>' : ''}
<div class="charts"><section class="chart"><h2>Daily movement</h2><button id="minutes" aria-pressed="true">Minutes</button> <button id="breaks" aria-pressed="false">Completed breaks</button><div class="plot"><canvas id="activity" aria-label="Daily movement chart" role="img"></canvas></div></section>
<section class="chart"><h2>Completed breaks by body area</h2><div class="plot"><canvas id="parts" aria-label="Body area chart" role="img"></canvas></div>${report.completed ? '' : '<p>No completed breaks in this period.</p>'}</section>
<section class="chart wide"><h2>Completion rate · by day</h2><div class="plot"><canvas id="trend" aria-label="Daily completion rate" role="img"></canvas></div></section>
<section class="chart wide"><h2>Activity details</h2><table><thead><tr><th>Day</th><th>Prompted</th><th>Completed</th><th>Minutes</th></tr></thead><tbody>${report.days.map(d => `<tr><td>${d.date}</td><td>${d.prompted}</td><td>${d.completed}</td><td>${(d.seconds / 60).toFixed(1)}</td></tr>`).join('')}</tbody></table>
<p>Skipped: ${report.skipped} · Expired: ${report.expired} · Interrupted: ${report.interrupted} · Unconfirmed: ${report.unconfirmed} · Cancelled: ${report.cancelled} · Pending: ${report.pending}</p></section></div>
<footer>This file contains a snapshot of your local data. No analytics, external fonts or network requests.<br>Minutes use timer duration only for user-confirmed completions. This is a habit log, not a measurement of physical activity. Days group by first prompt in your current local timezone; the period includes today and six previous calendar days.</footer>
</main><script>${chartJs}</script><script>
const r=${data};
document.getElementById('period').textContent=r.days[0].date+' — '+r.days[6].date+' · seven local calendar days';
Chart.defaults.font.family='system-ui';Chart.defaults.color='#597167';Chart.defaults.animation=false;
const common={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true},x:{grid:{display:false}}}};
const activity=new Chart(document.getElementById('activity'),{type:'bar',data:{labels:r.days.map(d=>d.date.slice(5)),datasets:[{label:'Minutes',data:r.days.map(d=>d.seconds/60),backgroundColor:'#6a8762',borderRadius:6}]},options:common});
new Chart(document.getElementById('parts'),{type:'doughnut',data:{labels:r.bodyParts.map(p=>p.name),datasets:[{data:r.bodyParts.map(p=>p.completed),backgroundColor:['#17382e','#6a8762','#a3b18a','#c7d8b6','#dfb676','#9bc5bf','#c8a3a8']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
new Chart(document.getElementById('trend'),{type:'line',data:{labels:r.days.map(d=>d.date.slice(5)),datasets:[{label:'Completion %',data:r.days.map(d=>d.prompted?d.completed/d.prompted*100:null),borderColor:'#17382e',tension:.3,pointRadius:4}]},options:{...common,scales:{...common.scales,y:{min:0,max:100,ticks:{callback:v=>v+'%'}}}}});
function mode(useMinutes){activity.data.datasets[0].data=r.days.map(d=>useMinutes?d.seconds/60:d.completed);activity.data.datasets[0].label=useMinutes?'Minutes':'Completed breaks';activity.update();document.getElementById('minutes').setAttribute('aria-pressed',String(useMinutes));document.getElementById('breaks').setAttribute('aria-pressed',String(!useMinutes));}
document.getElementById('minutes').onclick=()=>mode(true);document.getElementById('breaks').onclick=()=>mode(false);
</script></body></html>`;
  writeFileSync(filename, html, { mode: 0o600 });
}
export async function openReport(filename: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('open', [filename], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('Could not open report.')));
  });
}
