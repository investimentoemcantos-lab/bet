create schema if not exists bet_private;
revoke all on schema bet_private from public,anon;
grant usage on schema bet_private to authenticated;
create table public.bet_catalog(id text primary key,kind text not null check(kind in ('clubs','national')),country text not null,name text not null,teams jsonb not null,source text not null,updated_at date not null);
create table public.bet_wallets(user_id uuid primary key references auth.users(id) on delete cascade,balance numeric(14,2) not null default 0 check(balance>=0),created_at timestamptz not null default now());
create table public.bet_entries(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.bet_wallets(user_id),catalog_id text not null references public.bet_catalog(id),home text not null,away text not null,market text not null check(length(market) between 1 and 200),stake numeric(14,2) not null check(stake>0),odds numeric(10,3) not null check(odds>=1),status text not null default 'pending' check(status in ('pending','won','lost','refunded')),bookmaker text not null default '',notes text not null default '',event_at timestamptz not null,created_at timestamptz not null default now(),settled_at timestamptz,request_id uuid not null,unique(user_id,request_id),check(home<>away));
create index bet_entries_user_created on public.bet_entries(user_id,created_at desc);
create index bet_entries_catalog on public.bet_entries(catalog_id);
create table public.bet_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.bet_wallets(user_id),entry_id uuid references public.bet_entries(id),amount numeric(14,2) not null,balance_after numeric(14,2) not null,kind text not null,description text not null,request_id uuid not null,created_at timestamptz not null default now(),unique(user_id,request_id));
create index bet_ledger_user_created on public.bet_ledger(user_id,created_at desc);
create index bet_ledger_entry on public.bet_ledger(entry_id);
alter table public.bet_catalog enable row level security;
alter table public.bet_wallets enable row level security;
alter table public.bet_entries enable row level security;
alter table public.bet_ledger enable row level security;
create policy catalog_read on public.bet_catalog for select to authenticated using(true);
create policy wallet_own on public.bet_wallets for select to authenticated using(user_id=(select auth.uid()));
create policy entries_own on public.bet_entries for select to authenticated using(user_id=(select auth.uid()));
create policy ledger_own on public.bet_ledger for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.bet_catalog,public.bet_wallets,public.bet_entries,public.bet_ledger from anon,authenticated;
grant select on public.bet_catalog,public.bet_wallets,public.bet_entries,public.bet_ledger to authenticated;
-- Only this private, authenticated command handler can change financial records.
create function bet_private.command(action text,payload jsonb,request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); w public.bet_wallets; e public.bet_entries; c public.bet_catalog; amount numeric(14,2); target text; result_id uuid; description text; st numeric(14,2); od numeric(10,3);
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
  select * into e from public.bet_entries where id=(payload->>'id')::uuid and user_id=uid for update;
  if not found then raise exception 'Entrada não encontrada.';end if;
  target:=payload->>'status';
  if target not in ('pending','won','lost','refunded') or target is null then raise exception 'Resultado inválido.';end if;
  if target=e.status then return jsonb_build_object('balance',w.balance,'duplicate',true);end if;
  amount:=(case target when 'won' then round(e.stake*e.odds,2) when 'refunded' then e.stake else 0 end)-(case e.status when 'won' then round(e.stake*e.odds,2) when 'refunded' then e.stake else 0 end);
  update public.bet_entries set status=target,settled_at=case when target='pending' then null else now() end where id=e.id;
  result_id:=e.id;description:='Resultado: '||e.status||' → '||target;
 else raise exception 'Operação inválida.';end if;
 if w.balance+amount<0 then raise exception 'Saldo insuficiente para esta operação.';end if;
 update public.bet_wallets set balance=balance+amount where user_id=uid returning balance into w.balance;
 insert into public.bet_ledger(user_id,entry_id,amount,balance_after,kind,description,request_id) values(uid,result_id,amount,w.balance,action,description,request);
 return jsonb_build_object('balance',w.balance,'entry_id',result_id);
end;$$;
revoke all on function bet_private.command(text,jsonb,uuid) from public,anon;
grant execute on function bet_private.command(text,jsonb,uuid) to authenticated;
create function public.bet_command(action text,payload jsonb,request uuid) returns jsonb language sql security invoker set search_path='' as $$ select bet_private.command(action,payload,request); $$;
revoke all on function public.bet_command(text,jsonb,uuid) from public,anon;
grant execute on function public.bet_command(text,jsonb,uuid) to authenticated;
