# SwingScanner Local

SwingScanner is a local swing-trading research workspace stored under
`D:\SwingScannerRuntime`. It combines:

- A once-daily live end-of-day scan.
- A focused watchlist generated from that scan.
- A private trading journal with P&L, win rate, expectancy, R-multiple,
  streak, and plan-adherence statistics.
- A local Gemma setup coach served by Ollama.
- A local Gemma journal reflection coach served by Ollama.
- A morning command center with market state, high-impact events, live news,
  and a reminder generated from recent journal lessons.
- Optional username/password account sync for journals, reflections, and
  flagged setups.

This is a research and journaling tool, not financial advice.

## Start

Double-click:

```text
D:\SwingScannerRuntime\START_SWINGSCANNER.cmd
```

The launcher starts Ollama and the built Next.js app, then opens
`http://127.0.0.1:3000/scanner`.

## Storage

- App: `D:\SwingScannerRuntime\app`
- Ollama engine: `D:\SwingScannerRuntime\ollama`
- Gemma model: `D:\SwingScannerRuntime\ollama-models`
- Scan cache: `D:\SwingScannerRuntime\app\.cache\swingscanner`
- Journal: `D:\SwingScannerRuntime\app\.data\journal.json`
- Logs: `D:\SwingScannerRuntime\logs`

Journal content is sent only to the local Ollama server when a coach message
is submitted.

Setup questions are also processed entirely by the local Gemma model.

## Daily Scan

`D:\SwingScannerRuntime\Install-Daily-Scan-Task.ps1` installs a weekday task
for 4:30 PM America/Phoenix time. The task runs:

```text
D:\SwingScannerRuntime\Run-Daily-Scan.ps1
```

The scan downloads the current NasdaqTrader common-stock universe, requests
completed daily candles in Yahoo batches with single-symbol fallback, applies
liquidity, trend, Bollinger-squeeze, setup, relative-strength, and extension filters, then writes the latest
result to the D-drive cache.

## Verification

From `D:\SwingScannerRuntime\app`:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run scan:free
```

See `docs\FREE_DATA_SCAN.md` for data-source limitations.
See `docs\MORNING_COMMAND_CENTER.md` for market-state, news, reminder, and
optional account-sync configuration.
