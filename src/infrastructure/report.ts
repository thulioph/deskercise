import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { Report } from '../core/model.js';
export { terminalReport } from '../presentation/Report.js';
const require = createRequire(import.meta.url);
function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtNum(n: number, digits = 1): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
/** Sentence-first summary of the same headline metrics. */
export function progressNarrative(report: Report): string {
  if (report.totalPrompted === 0) {
    return 'No activity yet. Run deskercise start, complete a break, then regenerate this report.';
  }
  const minutes = (report.activeSeconds / 60).toFixed(1);
  const sessions = `${report.sessionCount} ${plural(report.sessionCount, 'session', 'sessions')}`;
  const breaks = `${report.completed} ${plural(report.completed, 'break', 'breaks')}`;
  const snoozed = `snoozed <strong>${report.snoozes}</strong> ${plural(report.snoozes, 'time', 'times')}`;
  let second = `You completed <strong>${report.completionRate.toFixed(0)}%</strong> of prompts and ${snoozed}`;
  if (report.avgResponseSeconds != null) {
    second = `You completed <strong>${report.completionRate.toFixed(0)}%</strong> of prompts, ${snoozed}, and typically started within <strong>~${fmtNum(report.avgResponseSeconds)}s</strong>`;
  }
  const interval = report.avgIntervalMinutes == null
    ? ''
    : ` Prompts landed about every <strong>${fmtNum(report.avgIntervalMinutes)} min</strong>.`;
  return `Across <strong>${sessions}</strong>, you confirmed <strong>${breaks}</strong> (<strong>${minutes} min</strong>). ${second}.${interval}`;
}
/** e.g. Fri, 10 Oct — ISO stays available via title for hover. */
function fmtDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(d);
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric' }).format(d);
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d);
  return `${weekday}, ${day} ${month}`;
}
export function writeReport(report: Report, filename: string, demo: boolean) {
  const chartPath = path.join(path.dirname(require.resolve('chart.js')), 'chart.umd.js');
  const chartJs = readFileSync(chartPath, 'utf8').replace(/<\/script/gi, '<\\/script').replace(/\/\/# sourceMappingURL=.*$/gm, '');
  const data = JSON.stringify(report).replace(/</g, '\\u003c');
  const dayRows = report.days.map(d =>
    `<tr><td><time datetime="${esc(d.date)}" title="${esc(d.date)}">${esc(fmtDayLabel(d.date))}</time></td><td>${d.prompted}</td><td>${d.completed}</td><td>${(d.seconds / 60).toFixed(1)}</td><td>${d.prompted ? ((d.completed / d.prompted) * 100).toFixed(0) : '—'}%</td></tr>`).join('');
  const bodyTotal = report.bodyParts.reduce((s, p) => s + p.completed, 0) || 1;
  const bodyBars = report.bodyParts.length
    ? report.bodyParts.map(p => {
      const pct = (p.completed / bodyTotal) * 100;
      return `<li><span class="bar-label">${esc(p.name)}</span><span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${pct.toFixed(1)}%"></span></span><span class="bar-value">${p.completed} <span class="muted">(${pct.toFixed(0)}%)</span></span></li>`;
    }).join('')
    : '<li class="muted">No completed breaks in this period.</li>';
  const exerciseRows = report.exercises.length
    ? report.exercises.map(e =>
      `<tr><td>${esc(e.name)}</td><td>${esc(e.bodyPart)}</td><td>${e.completions}</td><td>${fmtNum(e.avgActualSeconds)}</td></tr>`).join('')
    : '<tr><td colspan="4">No completed exercises in this period.</td></tr>';
  const outcomes: [string, number][] = [
    ['Completed', report.completed], ['Skipped', report.skipped], ['Expired', report.expired],
    ['Interrupted', report.interrupted], ['Unconfirmed', report.unconfirmed],
    ['Cancelled', report.cancelled], ['Pending', report.pending],
  ];
  const outcomeTotal = outcomes.reduce((s, [, n]) => s + n, 0);
  const outcomeRows = outcomes.map(([label, n]) =>
    `<tr><td>${esc(label)}</td><td>${n}</td></tr>`).join('');
  const narrative = progressNarrative(report);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deskercise · ${demo ? 'Demo ' : ''}Movement report</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f6f7f2;color:#17382e;font:16px/1.6 system-ui,sans-serif;color-scheme:light}
main{max-width:1100px;margin:auto;padding:48px 24px 80px}
.top{display:flex;justify-content:space-between;align-items:center;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
.badge{border:1px solid #c9d8ce;border-radius:20px;padding:5px 14px}
h1{font-size:clamp(36px,6vw,60px);line-height:1.1;letter-spacing:-.04em;margin:36px 0 14px;text-wrap:balance}
h2{font-size:17px;margin:0 0 6px}p,.muted,.subtitle{color:#3f5c52}
.subtitle{margin:0 0 16px;font-size:13px;line-height:1.45}
.progress-narrative{margin:30px 0}
.progress-narrative .narrative{margin:0;font-size:clamp(18px,2.4vw,22px);line-height:1.55;color:#17382e;text-wrap:pretty}
.progress-narrative .narrative strong{font-variant-numeric:tabular-nums}
.progress-narrative #period{margin:12px 0 0;font-size:13px;color:#3f5c52}
.chart{min-width:0;background:#fff;border:1px solid #e0e7dc;border-radius:16px;padding:24px}
.charts{display:grid;grid-template-columns:2fr 1fr;gap:16px}.plot{height:270px;position:relative}.wide{grid-column:1/-1}
.tog{display:inline-flex;gap:8px;margin:0 0 16px;flex-wrap:wrap}
button{background:#17382e;color:#fff;border:0;padding:10px 18px;border-radius:24px;cursor:pointer}
button:hover{background:#234a3d}button[aria-pressed=true]{background:#6a8762}
button:focus-visible{outline:3px solid #17382e;outline-offset:3px}
table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
th,td{padding:12px;text-align:left;border-bottom:1px solid #e0e7dc}caption{text-align:left;font-weight:600;margin:0 0 12px;color:#17382e}
.donut-wrap{position:relative;max-width:560px;margin:0 auto;height:100%}
.donut-center{position:absolute;inset:0;right:28%;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;text-align:center}
.donut-center strong{font-size:32px;line-height:1.1;font-variant-numeric:tabular-nums}
.donut-center span{font-size:13px;color:#3f5c52}
.bars{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.bars li{display:grid;grid-template-columns:minmax(72px,1fr) 3fr auto;gap:10px;align-items:center}
.bar-track{height:10px;background:#e0e7dc;border-radius:999px;overflow:hidden}
.bar-fill{display:block;height:100%;background:#6a8762;border-radius:999px}
.bar-value{font-variant-numeric:tabular-nums;white-space:nowrap}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
#mode-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
footer{margin:40px auto 0;max-width:42rem;text-align:center;color:#3f5c52}
footer .footer-lead{margin:0;font-size:13px;line-height:1.5;color:#17382e}
footer .footer-meta{margin:10px 0 0;font-size:12px;line-height:1.5}
@media(max-width:700px){.charts{grid-template-columns:1fr}th,td{font-size:12px;padding:8px 4px}.chart{padding:16px}.bars li{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
@media print{body{background:#fff}.plot,canvas,.tog{display:none!important}.chart{break-inside:avoid;border-color:#ccc}
.sr-only.print-show{position:static;width:auto;height:auto;padding:0;margin:24px 0 0;overflow:visible;clip:auto;white-space:normal;border:0}}
</style></head><body><main id="main">
<div class="top"><strong>Deskercise / ${demo ? 'Demo report' : 'Movement report'}</strong><span class="badge">Local · offline</span></div>
<h1>Small breaks.<br>A little more movement.</h1>
<p class="sr-only" id="mode-live" aria-live="polite"></p>
<section class="progress-narrative" aria-labelledby="summary-heading">
<h2 id="summary-heading" class="sr-only">Summary</h2>
<p class="narrative">${narrative}</p>
<p id="period"></p>
</section>
<div class="charts">
<section class="chart" aria-labelledby="daily-heading">
<h2 id="daily-heading">Daily movement</h2>
<p class="subtitle">How much confirmed movement did you get each day?</p>
<div class="tog" role="group" aria-label="Daily movement units">
<button type="button" id="minutes" aria-pressed="true">Minutes</button>
<button type="button" id="breaks" aria-pressed="false">Breaks</button>
</div>
<div class="plot"><canvas id="activity" role="img" aria-label="Daily movement chart" aria-describedby="daily-table"></canvas></div>
</section>
<section class="chart" aria-labelledby="parts-heading">
<h2 id="parts-heading">Body area</h2>
<p class="subtitle">Which body areas got the most completed breaks?</p>
<ul class="bars" aria-label="Completed breaks by body area">${bodyBars}</ul>
</section>
<section class="chart wide" aria-labelledby="trend-heading">
<h2 id="trend-heading">Completion rate · by day</h2>
<p class="subtitle">How often did you finish the breaks you were prompted for?</p>
<div class="plot"><canvas id="trend" role="img" aria-label="Daily completion rate chart" aria-describedby="daily-table"></canvas></div>
</section>
<div class="sr-only print-show">
<table id="daily-table"><caption>Daily activity totals for the report period</caption>
<thead><tr><th scope="col">Day</th><th scope="col">Prompted</th><th scope="col">Completed</th><th scope="col">Minutes</th><th scope="col">Rate</th></tr></thead>
<tbody>${dayRows}</tbody></table>
</div>
<section class="chart wide" aria-labelledby="outcomes-heading">
<h2 id="outcomes-heading">Outcomes</h2>
<p class="subtitle">How did prompts end — completed, skipped, expired, or otherwise?</p>
${outcomeTotal === 0
  ? '<p class="muted">No prompted exercises in this period.</p>'
  : `<div class="plot"><div class="donut-wrap"><canvas id="outcomes" role="img" aria-label="Prompt outcomes doughnut chart" aria-describedby="outcomes-table"></canvas><div class="donut-center" aria-hidden="true"><strong>${outcomeTotal}</strong><span>prompts</span></div></div></div>`}
<div class="sr-only print-show">
<table id="outcomes-table"><caption>Prompt outcomes for the report period</caption>
<thead><tr><th scope="col">Outcome</th><th scope="col">Count</th></tr></thead>
<tbody>${outcomeRows}</tbody></table>
</div>
</section>
<section class="chart wide" aria-labelledby="exercises-heading">
<h2 id="exercises-heading">Per-exercise</h2>
<p class="subtitle">Which exercises did you complete, and for how long on average?</p>
<table><caption>Completed exercises in the report period</caption>
<thead><tr><th scope="col">Exercise</th><th scope="col">Body area</th><th scope="col">Completions</th><th scope="col">Avg seconds</th></tr></thead>
<tbody>${exerciseRows}</tbody></table>
</section>
</div>
<footer>
<p class="footer-lead">This file contains a snapshot of your local data. No analytics, external fonts or network requests.</p>
<p class="footer-meta">Minutes use timer duration only for user-confirmed completions. This is a habit log, not a measurement of physical activity. Days group by first prompt in your current local timezone; the period includes today and six previous calendar days.</p>
</footer>
</main><script>${chartJs}</script><script>
const r=${data};
const fmt=new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'});
const short=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'});
const tipDay=new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'});
const dayLabels=r.days.map(d=>short.format(new Date(d.date+'T12:00:00')));
document.getElementById('period').textContent=fmt.format(new Date(r.days[0].date+'T12:00:00'))+' — '+fmt.format(new Date(r.days[6].date+'T12:00:00'));
Chart.defaults.font.family='system-ui';Chart.defaults.color='#3f5c52';Chart.defaults.animation=false;
const ink='#17382e', moss='#6a8762', mossMuted='#c7d8b6', grid='#e0e7dc', tipBg='#17382e';
const tipBase={backgroundColor:tipBg,titleColor:'#fff',bodyColor:'#e8efe6',borderColor:'#6a8762',borderWidth:1,cornerRadius:10,padding:12,displayColors:false,
  titleFont:{weight:'600'},callbacks:{title(items){const i=items[0]?.dataIndex;return i==null?'':tipDay.format(new Date(r.days[i].date+'T12:00:00'));}}};
const scalesBase={
  x:{grid:{display:false},border:{display:false},ticks:{padding:8,color:'#3f5c52'}},
  y:{beginAtZero:true,grace:'8%',border:{display:false},grid:{color:grid,drawTicks:false},ticks:{padding:10,color:'#3f5c52'}}
};
const common={responsive:true,maintainAspectRatio:false,layout:{padding:{top:8,right:8,bottom:0,left:0}},
  interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:tipBase},scales:scalesBase};
function barColors(values){return values.map(v=>v>0?moss:mossMuted);}
function withLabel(labelFn){
  return {...common,plugins:{...common.plugins,tooltip:{...tipBase,callbacks:{...tipBase.callbacks,label:labelFn}}}};
}
const minuteVals=r.days.map(d=>d.seconds/60);
const promptedVals=r.days.map(d=>d.prompted);
const completedVals=r.days.map(d=>d.completed);
const barGeom={borderRadius:8,borderSkipped:false,maxBarThickness:28,categoryPercentage:0.75,barPercentage:0.9};
function minutesDatasets(){
  return [{label:'Minutes',data:minuteVals,backgroundColor:barColors(minuteVals),...barGeom,maxBarThickness:36}];
}
function breaksDatasets(){
  return [
    {label:'Prompted',data:promptedVals,backgroundColor:mossMuted,...barGeom},
    {label:'Completed',data:completedVals,backgroundColor:moss,...barGeom}
  ];
}
const activity=new Chart(document.getElementById('activity'),{
  type:'bar',
  data:{labels:dayLabels,datasets:minutesDatasets()},
  options:withLabel(function(ctx){
    const v=ctx.parsed.y; const name=ctx.dataset.label||'';
    if(name==='Minutes') return v.toFixed(1)+' min';
    if(name==='Prompted') return v+' prompted';
    return v+' completed';
  })
});
const trendData=r.days.map(d=>d.prompted?d.completed/d.prompted*100:null);
new Chart(document.getElementById('trend'),{
  type:'line',
  data:{labels:dayLabels,datasets:[{
    label:'Completion %',data:trendData,borderColor:ink,backgroundColor:'rgba(106,135,98,0.18)',fill:true,
    borderWidth:2,spanGaps:true,cubicInterpolationMode:'monotone',
    pointRadius:function(ctx){return trendData[ctx.dataIndex]==null?0:4;},
    pointHoverRadius:6,pointBackgroundColor:ink,pointBorderColor:'#fff',pointBorderWidth:2,
    segment:{borderColor:function(ctx){
      const a=ctx.p0.parsed.y, b=ctx.p1.parsed.y;
      return a==null||b==null?mossMuted:ink;
    }}
  }]},
  options:{
    ...withLabel(function(ctx){return ctx.parsed.y==null?'No prompts':(Math.round(ctx.parsed.y)+'% completed');}),
    scales:{...scalesBase,y:{...scalesBase.y,min:0,max:100,grace:0,ticks:{...scalesBase.y.ticks,callback:function(v){return v+'%';}}}}
  }
});
function summarizeActivity(useMinutes){
  if(useMinutes){
    const total=minuteVals.reduce((a,b)=>a+b,0);
    document.getElementById('activity').setAttribute('aria-label','Daily movement chart showing minutes for seven days. Total '+total.toFixed(1)+' minutes.');
    document.getElementById('mode-live').textContent='Showing minutes.';
    return;
  }
  const prompted=r.days.reduce((a,d)=>a+d.prompted,0);
  const completed=r.days.reduce((a,d)=>a+d.completed,0);
  document.getElementById('activity').setAttribute('aria-label','Daily movement chart showing grouped prompted and completed breaks for seven days. '+completed+' completed of '+prompted+' prompted.');
  document.getElementById('mode-live').textContent='Showing prompted and completed breaks.';
}
function mode(useMinutes){
  activity.data.datasets=useMinutes?minutesDatasets():breaksDatasets();
  activity.options.plugins.legend.display=!useMinutes;
  activity.options.plugins.legend.position='bottom';
  activity.options.plugins.legend.labels={boxWidth:12,boxHeight:12,padding:16,color:'#3f5c52'};
  activity.update();
  document.getElementById('minutes').setAttribute('aria-pressed',String(useMinutes));
  document.getElementById('breaks').setAttribute('aria-pressed',String(!useMinutes));
  summarizeActivity(useMinutes);
}
document.getElementById('minutes').onclick=()=>mode(true);
document.getElementById('breaks').onclick=()=>mode(false);
summarizeActivity(true);
const trendVals=r.days.filter(d=>d.prompted).map(d=>d.completed/d.prompted*100);
document.getElementById('trend').setAttribute('aria-label',trendVals.length
  ?('Daily completion rate chart. Average '+(trendVals.reduce((a,b)=>a+b,0)/trendVals.length).toFixed(0)+'% on days with prompts.')
  :'Daily completion rate chart. No prompted exercises in this period.');
const outcomeAll=[['Completed',r.completed],['Skipped',r.skipped],['Expired',r.expired],['Interrupted',r.interrupted],['Unconfirmed',r.unconfirmed],['Cancelled',r.cancelled],['Pending',r.pending]];
const outcomeSlice=outcomeAll.filter(([,n])=>n>0);
const outcomeEl=document.getElementById('outcomes');
if(outcomeEl&&outcomeSlice.length){
  const outcomeColors=['#17382e','#2f5445','#4a6f5a','#6a8762','#8aa37a','#a8bd96','#c7d8b6'];
  const outcomeTotal=outcomeSlice.reduce((s,[,n])=>s+n,0);
  new Chart(outcomeEl,{
    type:'doughnut',
    data:{labels:outcomeSlice.map(([l])=>l),datasets:[{data:outcomeSlice.map(([,n])=>n),backgroundColor:outcomeColors.slice(0,outcomeSlice.length),borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',layout:{padding:8},
      plugins:{legend:{display:true,position:'right',labels:{boxWidth:12,boxHeight:12,padding:14,color:'#3f5c52'}},
        tooltip:{...tipBase,callbacks:{title(){return '';},label(ctx){
          const n=ctx.parsed; const pct=outcomeTotal?Math.round(n/outcomeTotal*100):0;
          return (ctx.label||'')+': '+n+' ('+pct+'%)';
        }}}}}
  });
  outcomeEl.setAttribute('aria-label','Prompt outcomes doughnut chart. '+outcomeSlice.map(([l,n])=>n+' '+l.toLowerCase()).join(', ')+'. '+outcomeTotal+' prompts total.');
}
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
