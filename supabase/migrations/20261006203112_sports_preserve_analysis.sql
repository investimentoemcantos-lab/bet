-- Removing a favorite must preserve personal match notes.
alter table public.bet_sports_watchlist add column is_favorite boolean not null default true;
