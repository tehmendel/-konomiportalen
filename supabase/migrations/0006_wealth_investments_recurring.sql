-- Formue, eiendeler/gjeld, investeringsbeholdninger og faste-utgifter-deteksjon.

alter table accounts add column balance numeric;

-- ── Eiendeler/gjeld utenfor banktilknyttede kontoer (bolig, kjøretøy, pensjon, annet) ──

create table assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('property', 'vehicle', 'pension', 'other_asset', 'other_debt')),
  value numeric not null check (value >= 0),
  is_liability boolean not null default false,
  visibility text not null default 'personal' check (visibility in ('shared', 'personal')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table assets enable row level security;

create policy "assets_select" on assets for select
  using (owner_id = auth.uid() or (visibility = 'shared' and is_household_member(household_id)));
create policy "assets_insert" on assets for insert
  with check (owner_id = auth.uid() and is_household_member(household_id));
create policy "assets_update" on assets for update using (owner_id = auth.uid());
create policy "assets_delete" on assets for delete using (owner_id = auth.uid());

-- ── Investeringsbeholdninger, knyttet til en investment-type konto ──────────

create table holdings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  instrument_name text not null,
  instrument_type text not null check (instrument_type in ('fond', 'aksje', 'etf', 'obligasjon', 'krypto')),
  quantity numeric not null default 0,
  avg_price numeric not null default 0,
  current_price numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table holdings enable row level security;

create policy "holdings_select" on holdings for select
  using (
    owner_id = auth.uid()
    or exists (select 1 from accounts a where a.id = holdings.account_id and a.visibility = 'shared' and is_household_member(a.household_id))
  );
create policy "holdings_insert" on holdings for insert
  with check (owner_id = auth.uid() and is_household_member(household_id));
create policy "holdings_update" on holdings for update using (owner_id = auth.uid());
create policy "holdings_delete" on holdings for delete using (owner_id = auth.uid());

-- ── Skjulte falske positiver i faste-utgifter-deteksjon (klient-side beregnet) ──

create table dismissed_recurring (
  household_id uuid not null references households(id) on delete cascade,
  vendor_key text not null,
  dismissed_by uuid not null references auth.users(id),
  dismissed_at timestamptz not null default now(),
  primary key (household_id, vendor_key)
);

alter table dismissed_recurring enable row level security;

create policy "dismissed_recurring_all" on dismissed_recurring for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

-- ── Husstandens formue, summert per kategori. Aldri rad-nivå-detalj for ────
-- andres personlige kontoer/eiendeler — samme prinsipp som household_category_totals.

create or replace function household_net_worth(p_household_id uuid)
returns table (category text, total_amount numeric)
language sql
stable
security definer
set search_path = public
as $$
  select 'bank'::text, coalesce(sum(balance), 0)
    from accounts
    where household_id = p_household_id and account_type in ('checking', 'savings', 'child')
      and is_household_member(p_household_id)
  union all
  select 'loan'::text, coalesce(sum(balance), 0)
    from accounts
    where household_id = p_household_id and account_type in ('loan', 'card')
      and is_household_member(p_household_id)
  union all
  select 'investment'::text, coalesce(sum(h.quantity * h.current_price), 0)
    from holdings h
    join accounts a on a.id = h.account_id
    where a.household_id = p_household_id and is_household_member(p_household_id)
  union all
  select category, coalesce(sum(case when is_liability then -value else value end), 0)
    from assets
    where household_id = p_household_id and is_household_member(p_household_id)
    group by category;
$$;

revoke all on function household_net_worth(uuid) from public;
grant execute on function household_net_worth(uuid) to authenticated;
