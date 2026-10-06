begin;
-- All mutations below roll back. No financial tables are mutated.
update public.bet_sports_usage set calls=0, minute_calls=0 where usage_day=(now() at time zone 'UTC')::date;
set local role service_role;
do $$
declare r jsonb; a uuid:=gen_random_uuid();
begin
  r:=public.bet_sports_claim('__sports_test_1',2,a);
  if r->>'state'<>'claimed' or (r->>'remaining')::int<>1 then raise exception 'reservation failed';end if;
  r:=public.bet_sports_claim('__sports_test_1',2,gen_random_uuid());
  if r->>'state'<>'busy' then raise exception 'duplicate reservation was not prevented';end if;
  update public.bet_sports_cache set payload='{"response":[]}'::jsonb,fetched_at=now(),expires_at=now()+interval '1 hour',lock_until=null where cache_key='__sports_test_1';
  r:=public.bet_sports_claim('__sports_test_1',2,gen_random_uuid());
  if r->>'state'<>'cached' or (r->>'remaining')::int<>1 then raise exception 'cache consumed quota';end if;
  r:=public.bet_sports_claim('__sports_test_2',2,gen_random_uuid());
  if r->>'state'<>'claimed' or (r->>'remaining')::int<>0 then raise exception 'second reservation failed';end if;
  r:=public.bet_sports_claim('__sports_test_3',2,gen_random_uuid());
  if r->>'state'<>'limit' then raise exception 'daily limit was not enforced';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.bet_wallets limit 1),true);
set local role authenticated;
insert into public.bet_sports_watchlist(user_id,fixture_id,match_data,notes) values(auth.uid(),999999999999,'{"id":999999999999}'::jsonb,'Rollback test');
update public.bet_sports_watchlist set is_favorite=false where fixture_id=999999999999;
do $$begin
  if (select notes from public.bet_sports_watchlist where fixture_id=999999999999) <> 'Rollback test' then raise exception 'favorite removal deleted notes';end if;
  if (select count(*) from public.bet_sports_watchlist where fixture_id=999999999999)<>1 then raise exception 'owner cannot read favorite';end if;
  if has_table_privilege('authenticated','public.bet_sports_cache','SELECT') or has_function_privilege('authenticated','public.bet_sports_claim(text,integer,uuid)','EXECUTE') then raise exception 'provider cache or reservation exposed';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
do $$begin
  if exists(select 1 from public.bet_sports_watchlist where fixture_id=999999999999) then raise exception 'favorite leaked to another user';end if;
  update public.bet_sports_watchlist set notes='Not allowed' where fixture_id=999999999999;
  if found then raise exception 'favorite modified by another user';end if;
end $$;
reset role;
rollback;
