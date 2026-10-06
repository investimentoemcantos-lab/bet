-- Shared provider cache is server-only. Favorites and notes belong to the signed-in user.
create table public.bet_sports_cache (
  cache_key text primary key check (length(cache_key) between 1 and 512),
  payload jsonb, fetched_at timestamptz, expires_at timestamptz not null default now(),
  lock_until timestamptz, lock_token uuid
);
alter table public.bet_sports_cache enable row level security;
revoke all on public.bet_sports_cache from public, anon, authenticated;
grant select, insert, update, delete on public.bet_sports_cache to service_role;
create index bet_sports_cache_expiry on public.bet_sports_cache(expires_at);

create table public.bet_sports_usage (
  usage_day date primary key, calls integer not null default 0 check (calls >= 0),
  minute_start timestamptz not null default date_trunc('minute', now()),
  minute_calls integer not null default 0 check (minute_calls >= 0)
);
alter table public.bet_sports_usage enable row level security;
revoke all on public.bet_sports_usage from public, anon, authenticated;
grant select, insert, update on public.bet_sports_usage to service_role;

create table public.bet_sports_watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  fixture_id bigint not null check (fixture_id > 0),
  match_data jsonb not null check (jsonb_typeof(match_data) = 'object' and (match_data->>'id')::bigint = fixture_id),
  notes text not null default '' check (length(notes) <= 5000),
  created_at timestamptz not null default now(),
  primary key (user_id, fixture_id)
);
alter table public.bet_sports_watchlist enable row level security;
revoke all on public.bet_sports_watchlist from public, anon;
grant select, insert, update, delete on public.bet_sports_watchlist to authenticated;
create policy sports_watchlist_select on public.bet_sports_watchlist for select to authenticated using ((select auth.uid()) = user_id);
create policy sports_watchlist_insert on public.bet_sports_watchlist for insert to authenticated with check ((select auth.uid()) = user_id);
create policy sports_watchlist_update on public.bet_sports_watchlist for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy sports_watchlist_delete on public.bet_sports_watchlist for delete to authenticated using ((select auth.uid()) = user_id);

-- Atomic reservation: deduplicates concurrent calls and caps daily/minute consumption.
-- SECURITY INVOKER, callable exclusively by service_role.
create function public.bet_sports_claim(p_key text, p_budget integer, p_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c public.bet_sports_cache%rowtype; u public.bet_sports_usage%rowtype; d date := (now() at time zone 'UTC')::date;
begin
  if p_budget < 1 or p_budget > 7500 then raise exception 'Invalid sports budget'; end if;
  insert into public.bet_sports_cache(cache_key) values (p_key) on conflict do nothing;
  select * into c from public.bet_sports_cache where cache_key = p_key for update;
  select * into u from public.bet_sports_usage where usage_day = d;
  if c.payload is not null and c.expires_at > now() then
    return jsonb_build_object('state','cached','payload',c.payload,'fetchedAt',c.fetched_at,'remaining',greatest(0,p_budget-coalesce(u.calls,0)));
  end if;
  if c.lock_until > now() then
    return jsonb_build_object('state','busy','payload',c.payload,'fetchedAt',c.fetched_at,'remaining',greatest(0,p_budget-coalesce(u.calls,0)));
  end if;
  insert into public.bet_sports_usage(usage_day) values (d) on conflict do nothing;
  select * into u from public.bet_sports_usage where usage_day = d for update;
  if u.calls >= p_budget then
    return jsonb_build_object('state','limit','payload',c.payload,'fetchedAt',c.fetched_at,'remaining',0);
  end if;
  if u.minute_start <> date_trunc('minute',now()) then u.minute_calls := 0; end if;
  if u.minute_calls >= 10 then
    return jsonb_build_object('state','minute_limit','payload',c.payload,'fetchedAt',c.fetched_at,'remaining',p_budget-u.calls);
  end if;
  update public.bet_sports_usage set calls = calls + 1, minute_start = date_trunc('minute',now()), minute_calls = u.minute_calls + 1 where usage_day = d;
  update public.bet_sports_cache set lock_until = now() + interval '30 seconds', lock_token = p_token where cache_key = p_key;
  return jsonb_build_object('state','claimed','payload',c.payload,'fetchedAt',c.fetched_at,'remaining',p_budget-u.calls-1);
end $$;
revoke all on function public.bet_sports_claim(text,integer,uuid) from public, anon, authenticated;
grant execute on function public.bet_sports_claim(text,integer,uuid) to service_role;
