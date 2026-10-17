# Deskercise

Short workplace movement breaks for people who work at a computer.

A local-first macOS CLI: timed exercises from official references, SQLite history on your machine, and an offline HTML report. No accounts, telemetry, or backend.

## Quick start

Requires **Node.js 22.13+** (Node 24 recommended).

```bash
npm install --global @thulioph/deskercise
deskercise start
```

On first run, choose an interval between breaks (suggested default: 45 minutes). Keep the terminal open.

```bash
deskercise --version
deskercise report
```

The npm package is public; local history stays on your machine when you install another version.

## Everyday use

Each break offers:

| Key | Action |
|---|---|
| `↑` / `↓` | Select an available action (wraps at either end) |
| `Enter` | Choose the highlighted action |
| `1` | Start the 60-second timer |
| `2` | Skip this exercise |
| `3` | Snooze the same exercise for 10 minutes |
| `s` | Stop an exercise early |
| `y` / `n` | Confirm / deny completion after the timer |
| `q` / `Ctrl+C` | End and save the session |

The highlighted action resets to the first option at each prompt. The shortcut bar shows the available choices; numeric and letter shortcuts work directly without moving the selection.

The next interval starts after the exercise is resolved. An unanswered prompt expires after 5 minutes. The final confirmation also expires after 5 minutes; that records `UNCONFIRMED` and adds no completed minutes.

The terminal labels each countdown and shows elapsed progress during focus, snooze,
and movement windows. When the break timer ends, it asks for confirmation;
only a saved `COMPLETED` result shows success. Follow the listed movements, then
rest for the remainder of the break window.

### Terminal layout

Resize the terminal while Deskercise runs: at 100 columns or more, exercise instructions sit beside the timer and actions. On extra-wide terminals, the dashboard stays at 120 columns and is centered, keeping the actions close to the instructions. Smaller terminals stack the timer and actions above the instructions. Precautions and sources remain visible in both layouts. Borders and spacing shrink to fit narrow terminals; when terminal width is unavailable, the layout uses 80 columns.

```bash
deskercise start --interval 1 --once
deskercise start --no-notifications
deskercise report
deskercise report --no-open
```

`--interval` is in minutes and overrides your preference for the current run only. If no configuration exists yet, that value becomes your initial preference. To change the saved preference, edit `intervalMinutes` in `~/.deskercise/config.json`.

## Live session dashboard

The terminal shows elapsed session time, the next break countdown, completed breaks, and confirmed active minutes. Totals belong to the current session and increase only after you confirm completion. Demo sessions are labelled separately. The countdown updates while the terminal remains open; snoozing shows when the same exercise will return.

## Exercises and references

The catalog has **15 workplace movement exercises** for the neck, shoulders, hands, wrists, arms, back, chest, and legs. Each entry includes instructions, position, precautions, and a source URL. It is not a sports training program.

Neck turns, shoulder rolls and the cross-body shoulder stretch include offline movement sketches during the prompt and exercise. These static cues supplement the full instructions and precautions. Sketches use ASCII in non-UTF locales or `TERM=dumb`; terminals smaller than 60 columns or 30 rows, screen-reader mode, and other exercises keep the text instructions without a sketch.

- [Newcastle Hospitals NHS — 1 minute body check](https://www.newcastle-hospitals.nhs.uk/services/newcastle-occupational-health-service/information-for-staff/physiotherapy/self-help-leaflets/1-minute-body-check/)
- [CCOHS — Stretching at the workstation](https://www.ccohs.ca/oshanswers/ergonomics/office/stretching.html)
- [Mersey Care NHS — Desk-based jobs](https://www.merseycare.nhs.uk/msk-work/desk-based-jobs)

Instructions are shortened adaptations with their own repetition counts or hold times. **The 60 seconds are a break window, including rest; do not hold a stretch for the entire timer.** The 45-minute interval and 60-second window are product choices, not universal recommendations from these organizations. Stop any movement that causes pain. The app logs self-reported habits; it does not diagnose conditions or guarantee injury prevention.

## Data and privacy

```text
~/.deskercise/config.json
~/.deskercise/analytics.db
~/.deskercise/report.html
~/.deskercise/demo/analytics.db
~/.deskercise/demo/report.html
```

Set `DESKERCISE_HOME` to use a different directory. There are no network requests during app use or when viewing reports; installation downloads dependencies from npm. Chart.js, styles, and data are embedded in the HTML (`file://`, no server). There are no CDNs, remote fonts, or analytics.

The reporting period is **today and the previous six days in your local timezone**. Activities are assigned to the date of their first prompt. Minutes count timer duration only for exercises confirmed as completed. Interrupted events keep their timer seconds but do not add confirmed minutes. Snooze actions stay in the action history while counting as one exercise in the completion-rate denominator. Pending exercises also count toward that denominator.

Preview a sample report at [`docs/demo-report.html`](docs/demo-report.html).

`deskercise report` also prints seven days of prompted and completed breaks,
confirmed minutes, and bar charts for daily completions and body areas directly
in the terminal. Narrow terminals use stacked history rows; redirected output
uses plain ASCII bars. The same command still generates the offline HTML report.

## Other ways to install

### GitHub Release

Open [GitHub Releases](https://github.com/thulioph/deskercise/releases), download `deskercise-<version>.tgz` and `SHA256SUMS` into the same directory. Releases inherit repository visibility (private repos need GitHub access).

```bash
shasum -a 256 -c SHA256SUMS
npm install --global ./deskercise-<version>.tgz
deskercise --version
```

Installing another release upgrades or downgrades without removing local history. Native dependencies install for your Mac during setup.

### Build from source

```bash
git clone https://github.com/thulioph/deskercise.git
cd deskercise
node --version
npm ci
npm run build
npm link
```

Smoke-test with demo mode (separate from your regular history):

```bash
deskercise start --demo --once
deskercise report --demo
```

When the exercise appears, press **1** to start and **y** to confirm when the timer ends. Demo mode exercises the interface; it is not a recommended 5-second routine.

Without a global link, use `node dist/index.js` instead of `deskercise`.

## macOS notes

1. Run `deskercise start --demo --once` and confirm the notification appears.
2. Return to the terminal, press `1`, wait for the timer, and confirm with `y`.
3. Run `deskercise report --demo`: check for one completion and that the HTML opens.
4. Run again; press `3` to snooze (same exercise returns after 5 seconds in demo). Press `2` to skip.
5. End a run with `Ctrl+C` and check the report again.
6. Run `deskercise start --interval 1 --once` for a real 60-second break.

If notifications do not appear, check macOS notification permissions and Focus settings. The app uses `node-notifier` / `terminal-notifier`; delivery depends on the OS version. The terminal flow continues if notifications fail. If the browser does not open, use the `report.html` path printed in the terminal.

If `better-sqlite3` fails to compile, install Xcode command line tools (`xcode-select --install`) and retry `npm ci`.

```bash
npm uninstall -g @thulioph/deskercise   # npm install
npm unlink -g deskercise                # source-linked install
```

History remains in `~/.deskercise` until you remove it.

## For developers

```text
src/core           # entities, ports, timer, report aggregation (no Node/React/SQLite/terminal)
src/infrastructure # clock, catalog, SQLite, config, notifications, HTML
src/presentation   # Ink UI; Clack onboarding before Ink mounts
src/index.ts       # Commander commands and composition
test               # timer, persistence, catalog, config, reports
docs/decisions.md  # decisions, limits, Mac testing checklist
```

```bash
npm test
npm run check
npm run build
npm run test:package
npm run dev -- start --demo --once
```

CI on every PR and push to `main` runs commit-message checks, tests, and build. Releases use Semantic Release from Conventional Commits. See [CONTRIBUTING.md](CONTRIBUTING.md) for commit style, merge policy, and release details, and [docs/npm-publishing.md](docs/npm-publishing.md) for the one-time npm Trusted Publishing setup.
