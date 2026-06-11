# Morning Command Center

## Market state

The scanner page calculates a real market state from completed daily data:

- SPY and QQQ relative to their 20-day and 50-day moving averages.
- Positive 20-day participation across the 11 SPDR sector ETFs.
- Leading sectors based on relative performance versus SPY.
- VIX context when Yahoo Finance returns volatility data.

The result is labeled Bullish, Bearish, Mixed, or Choppy. No state is generated
from mock data.

## News and events

Market and watchlist headlines use the existing Yahoo Finance public search
feed. Queries cover watchlist tickers, sector ETFs, broad macro news, and
geopolitical risk. The compact scanner view shows the four newest deduplicated
headlines. The Sector Pulse page keeps the larger feed.

High-impact events are read from the U.S. Bureau of Labor Statistics public
calendar. If either source is unavailable, the app shows an empty or cached
state rather than fabricated content.

No news API key is currently required. A future provider can be added behind
`src/lib/data/market-intelligence.ts`.

## Daily reminder

Daily reflections are stored in:

```text
.data/daily-reflections.json
```

Existing trades remain in `.data/journal.json`. The reminder first uses an
explicit next-day lesson. Otherwise it deterministically detects recent themes
such as chasing, moving stops, bad fills, early entries, overnight breaks,
failure to trim, market-state errors, and pivot patience. Private notes are not
sent to an external AI service.

Settings can use only the latest trading day or recent journal history.

## Optional account sync

Cross-device sync uses plain username/password authentication through Supabase
Auth. It is not OAuth. Configure:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Run `supabase/migrations/20260611_user_state.sql` in the Supabase SQL editor.
Disable email confirmation for this username-only workflow. Usernames are
mapped internally to private synthetic email identifiers; the UI never asks
for an email address.

The public anon key is safe for the client because row-level security restricts
every record to `auth.uid()`. Never use or ship a Supabase service-role key.
Without these environment values, SwingScanner continues in local-only mode.

## Desktop update control

Settings includes a disabled `Check for updates` pill. The future Electron
updater should expose its check/install state to this control through the
desktop preload bridge. No update result is currently simulated.
