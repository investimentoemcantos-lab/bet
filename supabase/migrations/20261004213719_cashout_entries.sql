alter table public.bet_entries add column cashout_amount numeric(14,2);
alter table public.bet_entries drop constraint bet_entries_status_check;
alter table public.bet_entries add constraint bet_entries_status_check check(status in ('pending','won','lost','refunded','cashed_out'));
alter table public.bet_entries add constraint bet_entries_cashout_check check((status='cashed_out' and cashout_amount is not null and cashout_amount>=0 and cashout_amount::text not in ('NaN','Infinity','-Infinity')) or (status<>'cashed_out' and cashout_amount is null));
create or replace function bet_private.command(action text,payload jsonb,request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); w public.bet_wallets; e public.bet_entries; c public.bet_catalog; amount numeric(14,2); target text; result_id uuid; description text; st numeric(14,2); od numeric(10,3); payout numeric(14,2);
begin
 if uid is null then raise exception 'Faça login para continuar.'; end if;
 if request is null then raise exception 'Identificador obrigatório.'; end if;
 insert into public.bet_wallets(user_id) values(uid) on conflict do nothing;
 select * into w from public.bet_wallets where user_id=uid for update;
 if exists(select 1 from public.bet_ledger where user_id=uid and request_id=request) then return jsonb_build_object('balance',w.balance,'duplicate',true); end if;
 if action in ('deposit','withdraw') then
  amount:=round((payload->>'amount')::numeric,2);
  if amount is null or amount<=0 or amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Informe um valor positivo.';end if;
  if action='withdraw' then amount:=-amount;end if;
  description:=case when action='deposit' then 'Aporte na banca' else 'Retirada da banca' end;
 elsif action='place' then
  if exists(select 1 from public.bet_entries where user_id=uid and request_id=request) then return jsonb_build_object('balance',w.balance,'duplicate',true);end if;
  select * into c from public.bet_catalog where id=payload->>'catalog_id';
  if not found or not(c.teams ? (payload->>'home')) or not(c.teams ? (payload->>'away')) then raise exception 'Selecione equipes válidas para a competição.';end if;
  st:=round((payload->>'stake')::numeric,2);od:=(payload->>'odds')::numeric;
  if st is null or od is null or st<=0 or od<1 or st::text in ('NaN','Infinity','-Infinity') or od::text in ('NaN','Infinity','-Infinity') then raise exception 'Valor e odd inválidos.';end if;
  insert into public.bet_entries(user_id,catalog_id,home,away,market,stake,odds,event_at,bookmaker,notes,request_id) values(uid,c.id,payload->>'home',payload->>'away',trim(payload->>'market'),st,od,(payload->>'event_at')::timestamptz,coalesce(payload->>'bookmaker',''),coalesce(payload->>'notes',''),request) returning id into result_id;
  amount:=-st;description:='Entrada: '||(payload->>'home')||' × '||(payload->>'away');
 elsif action='settle' then
  select * into e from public.bet_entries where id=(payload->>'id')::uuid and user_id=uid and deleted_at is null for update;
  if not found then raise exception 'Entrada não encontrada.';end if;
  target:=payload->>'status';
  if target not in ('pending','won','lost','refunded','cashed_out') or target is null then raise exception 'Resultado inválido.';end if;
  if target='cashed_out' then
   payout:=round((payload->>'cashout_amount')::numeric,2);
   if payout is null or payout<0 or payout::text in ('NaN','Infinity','-Infinity') then raise exception 'Informe um valor de encerramento válido, maior ou igual a zero.';end if;
  end if;
  if target=e.status and (target<>'cashed_out' or payout=e.cashout_amount) then return jsonb_build_object('balance',w.balance,'duplicate',true);end if;
  amount:=(case target when 'cashed_out' then payout when 'won' then round(e.stake*e.odds,2) when 'refunded' then e.stake else 0 end)-(case e.status when 'cashed_out' then e.cashout_amount when 'won' then round(e.stake*e.odds,2) when 'refunded' then e.stake else 0 end);
  update public.bet_entries set status=target,cashout_amount=case when target='cashed_out' then payout else null end,settled_at=case when target='pending' then null else now() end where id=e.id;
  result_id:=e.id;description:='Resultado: '||e.status||' → '||target||case when target='cashed_out' then ' | recebido '||payout else '' end;

 elsif action in ('edit','delete') then
  select * into e from public.bet_entries where id=(payload->>'id')::uuid and user_id=uid and deleted_at is null for update;
  if not found then raise exception 'Entrada não encontrada.';end if;
  result_id:=e.id;
  -- Reverse the original net effect, then apply the edited net effect if needed.
  amount:=e.stake-(case e.status when 'cashed_out' then e.cashout_amount when 'won' then round(e.stake*e.odds,2) when 'refunded' then e.stake else 0 end);
  if action='delete' then
   update public.bet_entries set deleted_at=now() where id=e.id;
   description:='Entrada apagada: '||e.home||' × '||e.away;
  else
   select * into c from public.bet_catalog where id=payload->>'catalog_id';
   if not found or not(c.teams ? (payload->>'home')) or not(c.teams ? (payload->>'away')) then raise exception 'Selecione equipes válidas para a competição.';end if;
   st:=round((payload->>'stake')::numeric,2);od:=(payload->>'odds')::numeric;
   if st is null or od is null or st<=0 or od<1 or st::text in ('NaN','Infinity','-Infinity') or od::text in ('NaN','Infinity','-Infinity') then raise exception 'Valor e odd inválidos.';end if;
   amount:=amount-st+(case e.status when 'cashed_out' then e.cashout_amount when 'won' then round(st*od,2) when 'refunded' then st else 0 end);
   update public.bet_entries set catalog_id=c.id,home=payload->>'home',away=payload->>'away',market=trim(payload->>'market'),stake=st,odds=od,event_at=(payload->>'event_at')::timestamptz,bookmaker=coalesce(payload->>'bookmaker',''),notes=coalesce(payload->>'notes','') where id=e.id;
   description:='Entrada editada: '||e.home||' × '||e.away||' | valor '||e.stake||' → '||st||' | odd '||e.odds||' → '||od;
  end if;
 else raise exception 'Operação inválida.';end if;
 if w.balance+amount<0 then raise exception 'Saldo insuficiente para esta operação.';end if;
 update public.bet_wallets set balance=balance+amount where user_id=uid returning balance into w.balance;
 insert into public.bet_ledger(user_id,entry_id,amount,balance_after,kind,description,request_id) values(uid,result_id,amount,w.balance,action,description,request);
 return jsonb_build_object('balance',w.balance,'entry_id',result_id);
end;$$;
revoke all on function bet_private.command(text,jsonb,uuid) from public,anon;
grant execute on function bet_private.command(text,jsonb,uuid) to authenticated;
