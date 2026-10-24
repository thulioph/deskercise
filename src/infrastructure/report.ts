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
:root{
  --paper:#e6ebe7;
  --ink:#14261f;
  --mist:#f4f6f3;
  --moss:#5f7a58;
  --mute:#4a6358;
  --rule:#c5d0c6;
  --font-sans:system-ui,-apple-system,"Segoe UI","Helvetica Neue",sans-serif;
  --font-mono:ui-monospace,"SF Mono","JetBrains Mono","Fira Code",monospace;
  --prose:52rem;
}
*,*::before,*::after{box-sizing:border-box}
html{color-scheme:light;scroll-behavior:smooth}
body{
  margin:0;min-height:100%;background:var(--paper);color:var(--ink);
  font-family:var(--font-sans);font-size:1.0625rem;line-height:1.6;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
}
:focus-visible{outline:2px solid var(--moss);outline-offset:3px}
main{width:min(80vw,96rem);margin:0 auto;padding:clamp(2.5rem,7vw,5.5rem) 1.25rem 5rem}

/* Masthead */
.masthead{
  display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap;
  padding-bottom:1rem;border-bottom:1px solid var(--rule);
  font-family:var(--font-mono);font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);
}
.masthead .wordmark{color:var(--ink);font-weight:600}
.masthead .badge{border:1px solid var(--rule);border-radius:2px;padding:.28rem .6rem;color:var(--ink);text-transform:lowercase;letter-spacing:.02em}

/* Hero */
.hero{margin:clamp(3rem,8vh,5rem) 0 clamp(2.5rem,6vh,3.5rem)}
.hero .kicker{margin:0 0 1.5rem;font-family:var(--font-mono);font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--moss)}
h1{margin:0;font-size:clamp(2.75rem,8.5vw,4.75rem);font-weight:700;line-height:1;letter-spacing:-.035em;text-wrap:balance}
h1 .tone{color:var(--moss);font-weight:500}

/* Narrative / lede */
.lede{margin:0 0 clamp(3rem,7vh,4.5rem)}
.lede .narrative{margin:0;max-width:var(--prose);font-size:clamp(1.4rem,3vw,1.85rem);line-height:1.45;letter-spacing:-.01em;text-wrap:pretty;color:var(--ink)}
.narrative strong{
  font-family:var(--font-mono);font-weight:500;font-size:1.16em;font-variant-numeric:tabular-nums;
  color:var(--moss);letter-spacing:-.01em;padding:0 .04em;
}

/* Ritual */
.ritual{margin:2.25rem 0 0;padding:1rem 1.25rem;max-width:var(--prose);background:var(--mist);border:1px solid var(--rule);border-radius:2px}
.ritual-log{margin:0;font-family:var(--font-mono);font-size:.82rem;line-height:1.6;color:var(--ink);white-space:nowrap;overflow-x:auto}
.ritual-log .prompt{color:var(--moss);font-weight:500}
.ritual-log #period{color:var(--mute)}
.ritual-log .cursor{color:var(--moss)}

/* Sections */
.section{margin-top:clamp(2.5rem,6vh,3.5rem)}
.section-head{padding-top:clamp(2.5rem,6vh,3.5rem);border-top:1px solid var(--rule)}
.section h2{margin:0 0 .7rem;font-size:clamp(1.3rem,2.6vw,1.7rem);font-weight:700;letter-spacing:-.02em;line-height:1.15;text-wrap:pretty}
.section h2::after{content:"";display:block;width:2.25rem;height:3px;margin-top:.6rem;background:var(--moss)}
.subtitle{margin:0 0 1.5rem;max-width:var(--prose);color:var(--mute);font-size:1.02rem;text-wrap:pretty}
.muted{color:var(--mute)}

/* Toggle */
.tog{display:inline-flex;gap:0;margin:0 0 1.5rem;border:1px solid var(--ink);border-radius:2px;overflow:hidden}
button{appearance:none;background:transparent;color:var(--mute);border:0;border-right:1px solid var(--rule);padding:.55rem 1.05rem;font-family:var(--font-mono);font-size:.8rem;font-weight:500;letter-spacing:.02em;cursor:pointer}
button:hover{color:var(--ink);background:rgba(20,38,31,.05)}
button[aria-pressed="true"]{color:var(--mist);background:var(--ink)}
button:last-child{border-right:0}

/* Plot */
.plot{position:relative;height:300px}

/* Bars */
.bars{list-style:none;margin:0;padding:0;display:grid;gap:1.05rem}
.bars li{display:grid;grid-template-columns:8rem 1fr auto;gap:1rem;align-items:center}
.bar-label{font-family:var(--font-mono);font-size:.85rem;color:var(--ink);white-space:nowrap}
.bar-track{height:.5rem;background:var(--rule);border-radius:2px;overflow:hidden}
.bar-fill{display:block;height:100%;background:var(--moss);border-radius:2px}
.bar-value{font-family:var(--font-mono);font-size:.85rem;font-variant-numeric:tabular-nums;color:var(--ink);white-space:nowrap;text-align:right}

/* Donut */
.donut-wrap{position:relative;max-width:40rem;margin:1.5rem auto 0;height:300px}
.donut-center{position:absolute;inset:0;right:24%;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;text-align:center}
.donut-center strong{font-family:var(--font-mono);font-size:2.6rem;font-weight:500;line-height:1;font-variant-numeric:tabular-nums;color:var(--ink)}
.donut-center span{font-family:var(--font-mono);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);margin-top:.35rem}

/* Tables */
table{border-collapse:collapse;width:100%;font-size:.95rem;font-variant-numeric:tabular-nums}
caption{text-align:left;font-family:var(--font-mono);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);margin:0 0 1.1rem}
th,td{padding:.8rem .75rem;text-align:left;border-bottom:1px solid var(--rule)}
th{font-family:var(--font-mono);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;font-weight:500;color:var(--mute)}
td{color:var(--ink)}

/* Ledger — Per-exercise */
.ledger thead th{border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);padding-top:.7rem}
.ledger tbody tr:last-child td{border-bottom:2px solid var(--ink)}
.ledger td:first-child{font-weight:500}
.ledger td:nth-child(2){font-family:var(--font-mono);font-size:.8rem;color:var(--mute)}
.ledger th:nth-child(3),.ledger td:nth-child(3),
.ledger th:nth-child(4),.ledger td:nth-child(4){text-align:right}
.ledger tbody tr:hover{background:var(--mist)}

/* Footer */
footer{padding-top:clamp(2.5rem,6vh,3.5rem);margin-top:clamp(2.5rem,6vh,3.5rem);border-top:1px solid var(--rule)}
.footer-top{margin-bottom:1.4rem;font-family:var(--font-mono);font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink);font-weight:600}
footer .footer-lead{margin:0;max-width:var(--prose);font-size:.9rem;line-height:1.5;color:var(--ink)}
footer .footer-meta{margin:.85rem 0 0;max-width:var(--prose);font-size:.78rem;line-height:1.6;color:var(--mute)}

/* Accessible hiding */
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
#mode-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}

@media(max-width:700px){
  main{width:100%}
  .plot{height:240px}
  .bars li{grid-template-columns:7rem 1fr auto;gap:.75rem}
  .donut-wrap{max-width:100%;height:280px}
  th,td{font-size:.8rem;padding:.7rem .3rem}
  .ritual-log{white-space:pre-wrap}
}
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
  html{scroll-behavior:auto}
}
@media print{
  body{background:#fff;color:#000;font-size:12px}
  main{display:block;width:auto;max-width:none;padding:0}
  .masthead,.footer-top,.ritual,.tog,.cursor,.hero .kicker{display:none!important}
  h1{font-size:1.9rem;margin:0 0 1.2rem}
  .lede .narrative{font-size:1rem}
  .narrative strong{font-size:1em;color:#000}
  .plot,.donut-wrap,canvas,.donut-center{display:none!important}
  .section{margin-top:1.4rem;break-inside:avoid}
  .section-head{padding-top:1.4rem;border-top-color:#aaa}
  .sr-only.print-show{position:static;width:auto;height:auto;padding:0;margin:1.4rem 0 0;overflow:visible;clip:auto;white-space:normal;border:0}
}
</style></head><body><main id="main">
<header class="masthead"><span><span class="wordmark">Deskercise</span> / ${demo ? 'Demo report' : 'Movement report'}</span><span class="badge">Local · offline</span></header>
<header class="hero">
<p class="kicker">A letter to this week</p>
<h1>Small breaks.<br><span class="tone">a little more movement.</span></h1>
</header>
<p class="sr-only" id="mode-live" aria-live="polite"></p>
<section class="lede" aria-labelledby="summary-heading">
<h2 id="summary-heading" class="sr-only">Summary</h2>
<p class="narrative">${narrative}</p>
<div class="ritual"><p class="ritual-log"><span class="prompt">$</span> deskercise report <span id="period"></span><span class="cursor" aria-hidden="true">▌</span></p></div>
</section>
<section class="section" aria-labelledby="daily-heading">
<div class="section-head">
<h2 id="daily-heading">Daily movement</h2>
<p class="subtitle">How much confirmed movement did you get each day?</p>
<div class="tog" role="group" aria-label="Daily movement units">
<button type="button" id="minutes" aria-pressed="true">Minutes</button>
<button type="button" id="breaks" aria-pressed="false">Breaks</button>
</div>
</div>
<div class="plot"><canvas id="activity" role="img" aria-label="Daily movement chart" aria-describedby="daily-table"></canvas></div>
<div class="sr-only print-show">
<table id="daily-table"><caption>Daily activity totals for the report period</caption>
<thead><tr><th scope="col">Day</th><th scope="col">Prompted</th><th scope="col">Completed</th><th scope="col">Minutes</th><th scope="col">Rate</th></tr></thead>
<tbody>${dayRows}</tbody></table>
</div>
</section>
<section class="section" aria-labelledby="parts-heading">
<div class="section-head">
<h2 id="parts-heading">Body area</h2>
<p class="subtitle">Which body areas got the most completed breaks?</p>
</div>
<ul class="bars" aria-label="Completed breaks by body area">${bodyBars}</ul>
</section>
<section class="section" aria-labelledby="trend-heading">
<div class="section-head">
<h2 id="trend-heading">Completion rate · by day</h2>
<p class="subtitle">How often did you finish the breaks you were prompted for?</p>
</div>
<div class="plot"><canvas id="trend" role="img" aria-label="Daily completion rate chart" aria-describedby="daily-table"></canvas></div>
</section>
<section class="section" aria-labelledby="outcomes-heading">
<div class="section-head">
<h2 id="outcomes-heading">Outcomes</h2>
<p class="subtitle">How did prompts end — completed, skipped, expired, or otherwise?</p>
</div>
${outcomeTotal === 0
  ? '<p class="muted">No prompted exercises in this period.</p>'
  : `<div class="donut-wrap"><canvas id="outcomes" role="img" aria-label="Prompt outcomes doughnut chart" aria-describedby="outcomes-table"></canvas><div class="donut-center" aria-hidden="true"><strong>${outcomeTotal}</strong><span>prompts</span></div></div>`}
<div class="sr-only print-show">
<table id="outcomes-table"><caption>Prompt outcomes for the report period</caption>
<thead><tr><th scope="col">Outcome</th><th scope="col">Count</th></tr></thead>
<tbody>${outcomeRows}</tbody></table>
</div>
</section>
<section class="section" aria-labelledby="exercises-heading">
<div class="section-head">
<h2 id="exercises-heading">Per-exercise</h2>
<p class="subtitle">Which exercises did you complete, and for how long on average?</p>
</div>
<table class="ledger"><caption>Completed exercises in the report period</caption>
<thead><tr><th scope="col">Exercise</th><th scope="col">Body area</th><th scope="col">Completions</th><th scope="col">Avg seconds</th></tr></thead>
<tbody>${exerciseRows}</tbody></table>
</section>
<footer>
<div class="footer-top">Deskercise</div>
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
Chart.defaults.font.family='ui-monospace,"SF Mono","Menlo",monospace';Chart.defaults.color='#4a6358';Chart.defaults.animation=false;
const ink='#14261f', moss='#5f7a58', mossMuted='#cdd6c3', mossDark='#4a604d', mossMutedDark='#b7c6a4', grid='#c5d0c6', mute='#4a6358', tipBg='#14261f', paper='#e6ebe7';
const tipBase={backgroundColor:tipBg,titleColor:'#f4f6f3',bodyColor:'#e6ebe7',borderColor:moss,borderWidth:1,cornerRadius:4,padding:12,displayColors:false,
  titleFont:{weight:'600'},callbacks:{title(items){const i=items[0]?.dataIndex;return i==null?'':tipDay.format(new Date(r.days[i].date+'T12:00:00'));}}};
const scalesBase={
  x:{grid:{display:false},border:{display:false},ticks:{padding:8,color:mute}},
  y:{beginAtZero:true,grace:'8%',border:{display:false},grid:{color:grid,drawTicks:false},ticks:{padding:10,color:mute}}
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
const barGeom={borderRadius:2,borderSkipped:false,maxBarThickness:28,categoryPercentage:0.75,barPercentage:0.9};
function minutesDatasets(){
  return [{label:'Minutes',data:minuteVals,backgroundColor:barColors(minuteVals),hoverBackgroundColor:mossDark,...barGeom,maxBarThickness:36}];
}
function breaksDatasets(){
  return [
    {label:'Prompted',data:promptedVals,backgroundColor:mossMuted,hoverBackgroundColor:mossMutedDark,...barGeom},
    {label:'Completed',data:completedVals,backgroundColor:moss,hoverBackgroundColor:mossDark,...barGeom}
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
    label:'Completion %',data:trendData,borderColor:ink,backgroundColor:'rgba(95,122,88,.16)',fill:true,
    borderWidth:2,spanGaps:true,cubicInterpolationMode:'monotone',
    pointRadius:function(ctx){return trendData[ctx.dataIndex]==null?0:4;},
    pointHoverRadius:6,pointBackgroundColor:ink,pointBorderColor:paper,pointBorderWidth:2,
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
  activity.options.plugins.legend.labels={usePointStyle:true,boxWidth:12,boxHeight:12,padding:16,color:mute};
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
  const outcomeColors=['#14261f','#1f392b','#2e5038','#42644c','#5f7a58','#86a077','#b7c9ae'];
  const outcomeTotal=outcomeSlice.reduce((s,[,n])=>s+n,0);
  new Chart(outcomeEl,{
    type:'doughnut',
    data:{labels:outcomeSlice.map(([l])=>l),datasets:[{data:outcomeSlice.map(([,n])=>n),backgroundColor:outcomeColors.slice(0,outcomeSlice.length),borderWidth:2,borderColor:paper,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',layout:{padding:8},
      plugins:{legend:{display:true,position:'right',labels:{usePointStyle:true,boxWidth:12,boxHeight:12,padding:14,color:mute}},
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
