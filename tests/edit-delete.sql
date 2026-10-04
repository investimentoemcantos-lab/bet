-- Run in a transaction; every fixture and change is rolled back.
begin;
do $$
declare uid uuid:=gen_random_uuid(); other_uid uuid:=gen_random_uuid(); c public.bet_catalog; e_id uuid; state text; expected numeric; req uuid; caught boolean;
begin
 insert into auth.users(id) values(uid),(other_uid);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 select * into c from public.bet_catalog where jsonb_array_length(teams)>=2 limit 1;
 perform public.bet_command('deposit','{"amount":1000}',gen_random_uuid());
 foreach state in array array['pending','won','lost','refunded'] loop
  e_id:=(public.bet_command('place',jsonb_build_object('catalog_id',c.id,'home',c.teams->>0,'away',c.teams->>1,'market','Gols mais de 2,5','stake',10,'odds',2,'event_at',now()),gen_random_uuid())->>'entry_id')::uuid;
  if state<>'pending' then perform public.bet_command('settle',jsonb_build_object('id',e_id,'status',state),gen_random_uuid());end if;
  req:=gen_random_uuid();
  perform public.bet_command('edit',jsonb_build_object('id',e_id,'catalog_id',c.id,'home',c.teams->>0,'away',c.teams->>1,'market','Gols mais de 2,5','stake',20,'odds',3,'event_at',now()),req);
  perform public.bet_command('edit',jsonb_build_object('id',e_id),req);
  expected:=case state when 'won' then 1040 when 'refunded' then 1000 else 980 end;
  if (select balance from public.bet_wallets where user_id=uid)<>expected then raise exception 'Wrong edit balance for %',state;end if;
  if (select status from public.bet_entries where id=e_id)<>state then raise exception 'Edit changed status';end if;
  perform set_config('request.jwt.claim.sub',other_uid::text,true);
  caught:=false;
  begin perform public.bet_command('delete',jsonb_build_object('id',e_id),gen_random_uuid());exception when others then caught:=sqlerrm='Entrada não encontrada.';end;
  if not caught then raise exception 'Ownership check failed';end if;
  perform set_config('request.jwt.claim.sub',uid::text,true);
  req:=gen_random_uuid();
  perform public.bet_command('delete',jsonb_build_object('id',e_id),req);
  perform public.bet_command('delete',jsonb_build_object('id',e_id),req);
  if (select balance from public.bet_wallets where user_id=uid)<>1000 then raise exception 'Wrong delete balance for %',state;end if;
  if not exists(select 1 from public.bet_entries where id=e_id and deleted_at is not null) then raise exception 'Delete did not hide entry';end if;
  caught:=false;
  begin perform public.bet_command('settle',jsonb_build_object('id',e_id,'status','won'),gen_random_uuid());exception when others then caught:=sqlerrm='Entrada não encontrada.';end;
  if not caught then raise exception 'Deleted entry accepted settlement';end if;
 end loop;
 e_id:=(public.bet_command('place',jsonb_build_object('catalog_id',c.id,'home',c.teams->>0,'away',c.teams->>1,'market','Teste','stake',10,'odds',2,'event_at',now()),gen_random_uuid())->>'entry_id')::uuid;
 perform public.bet_command('settle',jsonb_build_object('id',e_id,'status','won'),gen_random_uuid());
 perform public.bet_command('withdraw','{"amount":1005}',gen_random_uuid());
 caught:=false;
 begin perform public.bet_command('delete',jsonb_build_object('id',e_id),gen_random_uuid());exception when others then caught:=sqlerrm='Saldo insuficiente para esta operação.';end;
 if not caught or (select deleted_at from public.bet_entries where id=e_id) is not null or (select balance from public.bet_wallets where user_id=uid)<>5 then raise exception 'Insufficient funds rollback failed';end if;
 caught:=false;
 begin perform public.bet_command('edit',jsonb_build_object('id',e_id,'catalog_id',c.id,'home',c.teams->>0,'away',c.teams->>1,'market','Teste','stake',10,'odds',1,'event_at',now()),gen_random_uuid());exception when others then caught:=sqlerrm='Saldo insuficiente para esta operação.';end;
 if not caught or (select odds from public.bet_entries where id=e_id)<>2 then raise exception 'Edit rollback failed';end if;
end;$$;
select 'edit/delete: all four results, idempotency, ownership and rollback passed' as test;
rollback;
