# MVP decisions and boundaries

## Product behavior

Two commands: `start` and `report`. macOS first; foreground execution only. Returning to the terminal is explicit in notifications. Clicking a toast does not start an exercise. No daemon, notification buttons, pause command, accounts, cloud storage, exercise editor or IDE integration.

Normal defaults: 45-minute suggested interval, 60-second break window, 10-minute snooze, 5-minute initial prompt expiry and 5-minute confirmation expiry. Demo: 3-second interval, 5-second break and snooze, 30-second response windows, separate data directory. `--once` resolves one exercise, including repeated snoozes, then exits.

A completed timer asks for confirmation; it never assumes physical participation. Interrupted timer seconds are preserved for future analysis but omitted from confirmed minutes. Rate = unique completed exercise events / unique prompted exercise events, including pending and unresolved events. Snooze actions never create new exercise events.

## State transitions

`WAITING` waits a full interval. `PROMPTED` allows Start, Skip or Snooze. Snooze retains the event ID and exercise. An unanswered prompt ends as `EXPIRED`. Start changes the event to `STARTED` and starts a new countdown. Stop ends as `INTERRUPTED`. Timer expiry enters confirmation: yes = `COMPLETED`, no = `INTERRUPTED`, timeout = `UNCONFIRMED`. A terminal result starts the next interval. Graceful shutdown finalizes pending events as `CANCELLED`, or `INTERRUPTED` if already started, and saves the session end time.

## Architecture

Dependencies point inward. Core ports cover analytics, exercise selection, clock, terminal-neutral interaction, notifications and IDs. The clock is injectable for deterministic tests. The terminal owns rendering/input and receives domain view states. Core use cases retain orchestration without knowing how the terminal works. Future UI or platform changes can replace presentation and infrastructure adapters; unchanged core behavior can be reused.

SQLite schema version 1: `sessions`, `exercise_events` and append-only `exercise_actions`. A transaction updates event state and appends each action. All timestamps are UTC ISO strings. Reporting uses the current local timezone to compute seven calendar dates and groups events by first prompt. Intervals can be fractional for testing. Static JSON exercises are copied into `dist` during build.

Chart.js is packaged through npm and embedded in one offline HTML. It includes interactive chart toggles and a textual data table. Body-area distribution counts completed exercises, not all prompts. Daily completion is omitted for days with no prompts. No network resources are required when the report opens.

## Known prototype limits

- No process lock: starting two copies produces two reminder loops. End the first before starting another. Session IDs remain separate.
- No forced-termination recovery: SIGKILL, power loss or a terminal killed without SIGINT/SIGTERM can leave `ended_at` unset and events pending. No completion is invented.
- No activity or sleep detection: waking from sleep can show one overdue reminder. Timing is a habit proxy, not sensed movement.
- Notification display depends on macOS permissions, Focus and helper support. Toast failure is nonfatal. Native notification/open behavior requires macOS validation.
- Report timestamps use the current timezone, even after travel. Midnight-crossing exercise events stay assigned to their original prompt day.
- One report file per data directory is overwritten on generation. It is a static snapshot: regenerate to refresh it.
- Configuration is a small JSON file; malformed data fails with the file path, rather than silently overwriting preferences.
- No SQLite repair or automatic migration framework; failures preserve existing files and surface an error.

## Verification record

17 automated tests cover completion confirmation, repeated snoozes, expiry, unconfirmed completion, early stop, interval reset, cancellation in five phases, notification failure, persistent SQLite history, catalogue selection, config validation, offline HTML and local-day aggregation. TypeScript strict checks and build pass. A real PTY smoke test exercised the compiled CLI through Start, countdown, confirmation and a persisted demo report. The generated HTML was opened in headless Chromium: all three charts rendered, the metric toggle worked, and zero external network requests or browser errors were observed. Desktop and 390px mobile layouts were visually inspected after chart resizing settled. Native macOS notification and browser-opening behavior remain unverified until tested on a Mac.
