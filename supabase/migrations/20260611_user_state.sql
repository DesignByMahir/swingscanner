create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  journal jsonb not null default '[]'::jsonb,
  reflections jsonb not null default '[]'::jsonb,
  flagged_tickers text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "Users read their own SwingScanner state"
on public.user_state for select
using (auth.uid() = user_id);

create policy "Users insert their own SwingScanner state"
on public.user_state for insert
with check (auth.uid() = user_id);

create policy "Users update their own SwingScanner state"
on public.user_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
