begin;
do $$declare uid uuid:=gen_random_uuid();begin
 insert into auth.users(id,email) values(uid,'bet-national-test-'||uid::text||'@example.invalid');
 perform set_config('request.jwt.claim.sub',uid::text,true);
end;$$;
set local role authenticated;
do $$declare c public.bet_catalog; eid uuid;bal numeric;begin
 select * into c from public.bet_catalog where name='Liga das Nações da UEFA A · 2026/27' and selectable;
 if not found or not(c.teams ? 'Grécia') or not(c.teams ? 'Alemanha') then raise exception 'National teams missing';end if;
 perform public.bet_command('deposit','{"amount":100}',gen_random_uuid());
 eid:=(public.bet_command('place',jsonb_build_object('catalog_id',c.id,'home','Grécia','away','Alemanha','market','Cartões · Total do jogo · Mais de 3,5 · Jogo inteiro','stake',10,'odds',1.77,'event_at',now()),gen_random_uuid())->>'entry_id')::uuid;
 if not exists(select 1 from public.bet_entries where id=eid and home='Grécia' and away='Alemanha' and market='Cartões · Total do jogo · Mais de 3,5 · Jogo inteiro') then raise exception 'National entry not saved';end if;
 select balance into bal from public.bet_wallets where user_id=auth.uid();if bal<>90 then raise exception 'Debit mismatch';end if;
end;$$;
select 'PASS: Grécia × Alemanha, UEFA Liga A, cartões mais de 3,5, odd 1,77, debit verified' as result;
rollback;
