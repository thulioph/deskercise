# Deskercise — macOS prototype

Short workplace movement breaks for people who work at a computer. A foreground CLI with exercises based on official references, a local SQLite history, and an offline HTML report. No accounts, telemetry, or backend.

## Getting started

Requires **Node.js 22.13+**; Node 24 is recommended. macOS is the initial target platform.

### Install a release

Open [GitHub Releases](https://github.com/thulioph/deskercise/releases), choose a version, and download its `deskercise-<version>.tgz` and `SHA256SUMS` assets into the same directory. Releases inherit the repository's visibility: this private repository requires GitHub access to download them.

In Terminal, enter the download directory, verify the checksum, and install the package (replace `<version>` with the selected release version):

```bash
shasum -a 256 -c SHA256SUMS
npm install --global ./deskercise-<version>.tgz
deskercise --version
```

Installing another release with the same command upgrades or downgrades the app without removing local history. This is an installable Node.js CLI package; native dependencies are installed for your Mac during installation. Internet access is required for installation.

### Build from source

Clone the repository and enter the project directory:

```bash
git clone https://github.com/thulioph/deskercise.git
cd deskercise
node --version
npm ci
npm run build
npm link
```

Run a quick test with a 3-second interval and a 5-second timer:

```bash
deskercise start --demo --once
deskercise report --demo
```

When the exercise appears, press **1** to start and **y** to confirm completion when the timer ends. The `report` command prints a summary and opens the HTML report in your default browser. Demo mode tests the interface; it is not a recommended 5-second exercise routine. Demo data is kept separate from your regular history.

To run without installing the command globally, use `node dist/index.js` instead of `deskercise`:

```bash
node dist/index.js start --demo --once
node dist/index.js report --demo
```

## Everyday use

```bash
deskercise start
```

On your first run, choose an interval between breaks (suggested default: 45 minutes). Keep the terminal open. Each break offers:

| Key | Action |
|---|---|
| `1` | Start the 60-second timer |
| `2` | Skip this exercise |
| `3` | Snooze the same exercise for 10 minutes |
| `s` | Stop an exercise early |
| `y` / `n` | Confirm / deny completion after the timer |
| `q` / `Ctrl+C` | End and save the session |

The next interval starts after the exercise is resolved. An unanswered prompt expires after 5 minutes. The final confirmation also expires after 5 minutes; this records `UNCONFIRMED` and adds no completed minutes.

```bash
deskercise start --interval 1 --once
deskercise start --no-notifications
deskercise report
deskercise report --no-open
```

`--interval` is measured in minutes and overrides your preference for the current run only. If no configuration exists yet, the supplied value becomes your initial preference. To change the saved preference, edit `intervalMinutes` in `~/.deskercise/config.json`.

## Exercises and references

The initial catalog contains **15 workplace movement exercises** for the neck, shoulders, hands, wrists, arms, back, chest, and legs. Each entry includes instructions, position, precautions, and a source URL. It does not include sports training routines.

- [Newcastle Hospitals NHS — 1 minute body check](https://www.newcastle-hospitals.nhs.uk/services/newcastle-occupational-health-service/information-for-staff/physiotherapy/self-help-leaflets/1-minute-body-check/)
- [CCOHS — Stretching at the workstation](https://www.ccohs.ca/oshanswers/ergonomics/office/stretching.html)
- [Mersey Care NHS — Desk-based jobs](https://www.merseycare.nhs.uk/msk-work/desk-based-jobs)

Instructions are shortened adaptations with their own repetition counts or hold times. **The 60 seconds are a break window, including rest; do not hold a stretch for the entire timer.** The 45-minute interval and 60-second window are product choices, not universal recommendations from these organizations. Stop any movement that causes pain. The app logs self-reported habits; it does not diagnose conditions or guarantee injury prevention.

## Data and reporting

```text
~/.deskercise/config.json
~/.deskercise/analytics.db
~/.deskercise/report.html
~/.deskercise/demo/analytics.db
~/.deskercise/demo/report.html
```

Set `DESKERCISE_HOME` to use a different directory. There are no network requests during app use or when viewing reports; the initial installation downloads dependencies from npm. Chart.js, styles, and data are embedded in the HTML, which opens through `file://` without a server. There are no CDNs, remote fonts, or analytics.

The reporting period includes **today and the previous six days in your current local timezone**. Activities are assigned to the date of their first prompt. Minutes count timer duration only for exercises confirmed as completed. Interrupted events retain their timer seconds but do not contribute to confirmed minutes. Snooze actions remain in the action history while preserving one exercise in the completion-rate denominator. Pending exercises also count toward that denominator.

A report generated during testing is available at `docs/demo-report.html`; open it in your browser to preview the report before installing.

## Project structure

- `src/core`: entities, ports, timer orchestration, and report aggregation; no imports from Node, React, SQLite, or the terminal.
- `src/infrastructure`: cancellable clock, JSON catalog, SQLite, configuration, notifications, and HTML generation.
- `src/presentation`: Ink interface; Clack handles onboarding before Ink is mounted.
- `src/index.ts`: Commander commands and dependency composition.
- `test`: tests for timer behavior, persistence, catalog, configuration, and reports.
- `docs/decisions.md`: decisions, limitations, and the Mac testing checklist.

```bash
npm test
npm run check
npm run build
npm run test:package
npm run dev -- start --demo --once
```

## Automated releases

Each push to `main` (including a merged PR) runs the `Tests` and `Build` jobs on macOS. The build job also installs the packed app in a temporary directory and checks its version, CLI commands, native SQLite, and offline report. Only after both jobs succeed does the `Release` job package the exact validated commit and publish a GitHub Release with a `.tgz`, SHA-256 checksum, and generated change notes. PRs and manual CI runs do not publish releases.

Release versions use the base major/minor version from `package.json` and its patch plus the CI workflow run number. For example, base `0.1.0` and CI run `7` produce `v0.1.7`. PR checks also consume run numbers, so gaps are expected. Concurrent main pushes retain their own runs and versions. Retrying a run uses the same version, leaves a published release intact, and can resume a draft after an upload failure.

The version is applied to the package in CI, without committing a version bump back to `main`. Release packages include an npm shrinkwrap to pin dependency versions. Git tags identify the original validated source commit, and `deskercise --version` reports the installed package version. Keep the CI workflow identity and version base stable within a release line; change the base major/minor version when starting a new line. The workflow uses GitHub's built-in token and needs no npm publishing credentials.

## First test on macOS

The core, SQLite, and CLI flow were verified in a Linux environment; **native notifications and the macOS `open` command still require testing on a real Mac**. Native macOS compatibility has not been assumed to be verified.

1. Run `deskercise start --demo --once` and confirm that the notification appears.
2. Return to the terminal, press `1`, wait for the timer, and confirm with `y`.
3. Run `deskercise report --demo`: check for one completion and verify that the HTML opens.
4. Run it again; press `3` to snooze and confirm that the same exercise returns after 5 seconds in demo mode. Press `2` to skip.
5. End a run with `Ctrl+C` and check the report again.
6. Run `deskercise start --interval 1 --once` to test a real 60-second movement break.

If notifications do not appear, check macOS notification permissions and Focus settings. The prototype uses `node-notifier` / `terminal-notifier`; presentation depends on the operating system version. The terminal flow continues working if notification delivery fails. If the browser does not open automatically, open the `report.html` path printed in the terminal.

If `better-sqlite3` needs to compile and installation fails, install the Xcode command line tools (`xcode-select --install`) and try `npm ci` again. Native dependency binaries are installed on your Mac; the source package does not include modules compiled on Linux.

To remove a release installation, run `npm uninstall -g deskercise`; for a source-linked installation, use `npm unlink -g deskercise`. Your history remains in the local data directory until you choose to remove it.
