begin;
insert into auth.users(id,email) values('11111111-1111-4111-8111-111111111111','bet-transaction-test@example.invalid'),('22222222-2222-4222-8222-222222222222','bet-isolation-test@example.invalid');
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare c public.bet_catalog;e uuid; r uuid:=gen_random_uuid(); p jsonb; bal numeric;
begin
 select * into c from public.bet_catalog where kind='clubs' limit 1;
 perform public.bet_command('deposit','{"amount":1000}',gen_random_uuid());
 p:=jsonb_build_object('catalog_id',c.id,'home',c.teams->>0,'away',c.teams->>1,'market','Vitória','stake',100,'odds',2,'event_at',now());
 e:=(public.bet_command('place',p,r)->>'entry_id')::uuid;
 perform public.bet_command('place',p,r);
 select balance into bal from public.bet_wallets where user_id=auth.uid();if bal<>900 then raise exception 'Place/idempotency failed: %',bal;end if;
 r:=gen_random_uuid();perform public.bet_command('settle',jsonb_build_object('id',e,'status','won'),r);perform public.bet_command('settle',jsonb_build_object('id',e,'status','won'),r);
 select balance into bal from public.bet_wallets where user_id=auth.uid();if bal<>1100 then raise exception 'Win/duplicate failed';end if;
 perform public.bet_command('settle',jsonb_build_object('id',e,'status','lost'),gen_random_uuid());
 select balance into bal from public.bet_wallets where user_id=auth.uid();if bal<>900 then raise exception 'Loss correction failed';end if;
 perform public.bet_command('settle',jsonb_build_object('id',e,'status','refunded'),gen_random_uuid());
 select balance into bal from public.bet_wallets where user_id=auth.uid();if bal<>1000 then raise exception 'Refund failed';end if;
 perform public.bet_command('settle',jsonb_build_object('id',e,'status','pending'),gen_random_uuid());
 select balance into bal from public.bet_wallets where user_id=auth.uid();if bal<>900 then raise exception 'Reopen failed';end if;
 begin perform public.bet_command('withdraw','{"amount":901}',gen_random_uuid());raise exception 'Overspend accepted';exception when raise_exception then if sqlerrm='Overspend accepted' then raise;end if;end;
 begin perform public.bet_command('place',p||'{"stake":950}',gen_random_uuid());raise exception 'Insufficient bet accepted';exception when raise_exception then if sqlerrm='Insufficient bet accepted' then raise;end if;end;
 begin perform public.bet_command('place',p||'{"stake":"NaN"}',gen_random_uuid());raise exception 'NaN accepted';exception when raise_exception then if sqlerrm='NaN accepted' then raise;end if;end;
 begin update public.bet_wallets set balance=500000;raise exception 'Direct financial write accepted';exception when insufficient_privilege then null;end;
 if (select sum(amount) from public.bet_ledger where user_id=auth.uid())<>900 then raise exception 'Ledger mismatch';end if;
end;$$;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$begin
 if exists(select 1 from public.bet_wallets) or exists(select 1 from public.bet_entries) or exists(select 1 from public.bet_ledger) then raise exception 'Cross-account read leak';end if;
 begin perform public.bet_command('settle','{"id":"11111111-1111-4111-8111-111111111111","status":"won"}',gen_random_uuid());raise exception 'Foreign entry accepted';exception when raise_exception then if sqlerrm='Foreign entry accepted' then raise;end if;end;
end;$$;
set local request.jwt.claim.sub='';
do $$begin
 begin perform public.bet_command('deposit','{"amount":1}',gen_random_uuid());raise exception 'Unauthenticated accepted';exception when raise_exception then if sqlerrm='Unauthenticated accepted' then raise;end if;end;
end;$$;
select 'PASS: debit, win, loss, refund, corrections, idempotency, insufficient funds, NaN, direct-write denial, account isolation, authentication' as result;
rollback;
