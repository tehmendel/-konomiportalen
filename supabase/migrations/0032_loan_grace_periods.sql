-- Avdragsfrie perioder på et lån (kun renter betales, saldoen holdes uendret
-- i perioden) — brukes til å korrigere den planlagte nedbetalingskurven og
-- gjenværende-tid-estimatet, i stedet for å anta jevn nedbetaling hele veien.

create table loan_grace_periods (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table loan_grace_periods enable row level security;

create policy "loan_grace_periods_select" on loan_grace_periods for select
  using (exists (
    select 1 from loans l join accounts a on a.id = l.account_id
    where l.id = loan_grace_periods.loan_id
      and (a.owner_id = auth.uid() or (a.visibility = 'shared' and is_household_member(a.household_id)))
  ));
create policy "loan_grace_periods_insert" on loan_grace_periods for insert
  with check (exists (select 1 from loans l where l.id = loan_grace_periods.loan_id and l.owner_id = auth.uid()));
create policy "loan_grace_periods_update" on loan_grace_periods for update
  using (exists (select 1 from loans l where l.id = loan_grace_periods.loan_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from loans l where l.id = loan_grace_periods.loan_id and l.owner_id = auth.uid()));
create policy "loan_grace_periods_delete" on loan_grace_periods for delete
  using (exists (select 1 from loans l where l.id = loan_grace_periods.loan_id and l.owner_id = auth.uid()));

create policy "admin_read_loan_grace_periods" on loan_grace_periods for select using (is_platform_admin());
