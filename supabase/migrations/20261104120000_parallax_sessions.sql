-- One saved decision per browser. The browser holds a random device code; only its SHA-256 is stored here.
-- Access goes through Parallax's own /api/session route, and row-level security makes every request reach only the
-- row whose hash matches the x-parallax-device header it carries, so a request can never read another founder's row.
-- Applied to the Parallax Supabase project on 4 Nov 2026.

create table public.parallax_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  state jsonb not null check (jsonb_typeof(state) = 'object' and pg_column_size(state) <= 262144),
  business text check (char_length(business) <= 200),
  decision text check (char_length(decision) <= 300),
  step text check (char_length(step) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.parallax_sessions is 'Parallax: the saved decision for one browser, keyed by the SHA-256 of its device code.';

-- The hash of the device code on the current request, or null when the header is missing or too short to be one.
create function public.parallax_request_token_hash()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when char_length(coalesce(current_setting('request.headers', true)::json ->> 'x-parallax-device', '')) between 32 and 128
      then encode(sha256(convert_to(current_setting('request.headers', true)::json ->> 'x-parallax-device', 'UTF8')), 'hex')
    else null
  end;
$$;

create function public.parallax_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger parallax_sessions_touch
before update on public.parallax_sessions
for each row execute function public.parallax_touch_updated_at();

alter table public.parallax_sessions enable row level security;

create policy "a device reads its own session" on public.parallax_sessions
  for select to anon using (token_hash = public.parallax_request_token_hash());
create policy "a device saves its own session" on public.parallax_sessions
  for insert to anon with check (token_hash = public.parallax_request_token_hash());
create policy "a device updates its own session" on public.parallax_sessions
  for update to anon using (token_hash = public.parallax_request_token_hash()) with check (token_hash = public.parallax_request_token_hash());
create policy "a device deletes its own session" on public.parallax_sessions
  for delete to anon using (token_hash = public.parallax_request_token_hash());

-- Signed-in roles are not used by Parallax; keep them out entirely.
revoke all on public.parallax_sessions from authenticated;
grant select, insert, update, delete on public.parallax_sessions to anon;
