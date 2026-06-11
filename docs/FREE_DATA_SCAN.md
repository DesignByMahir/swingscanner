# Live End-of-Day Scan

## Why It Runs Once Daily

Free public endpoints are not suitable for a full-market real-time scanner.
SwingScanner therefore uses completed daily candles after the U.S. close and
serves the cached result the next morning.

## Data Flow

1. NasdaqTrader supplies the current U.S. listed-symbol universe.
2. The scanner removes ETFs, test issues, warrants, rights, units, preferred
   shares, acquisition shells, invalid suffixes, and file footers.
3. Yahoo's multi-symbol endpoint downloads daily history in bounded batches.
4. The single-symbol path retains Stooq and Yahoo fallback for chart/API requests.
5. Successful histories are cached for 20 hours on the D: drive.
6. The complete eligible universe is scored by default.
7. The latest scan and watchlist are cached for 48 hours.

## Local Cache Keys

- `universe:nasdaqtrader`
- `daily:AAPL:250`
- `scan:free-eod:latest`

## Run Manually

```powershell
Set-Location D:\SwingScannerRuntime\app
npm run scan:free
```

For a short smoke scan:

```powershell
$env:SCAN_MAX_UNIVERSE = "12"
npm run scan:free
```

## Known Limits

- Free candles do not include market capitalization. The scanner uses price,
  share volume, dollar volume, and ADR liquidity gates and marks market cap
  unavailable.
- Sector and theme mappings are manual and incomplete.
- Earnings dates and economic-event risk are not included.
- Daily histories may be adjusted differently by each provider.
- Stooq may challenge automated downloads.
- Yahoo is an unofficial fallback and can change without notice.
- Public endpoints can change or throttle without notice.
- Entry plans must be confirmed against a live broker feed before execution.
