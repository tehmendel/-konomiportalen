-- Global admin-rolle for "Se som bruker" (impersonasjon). Bevisst begrenset til
-- LESING på tvers av husstander — ingen skriverettigheter gis via denne rollen,
-- slik at funksjonen aldri kan brukes til å endre eller slette andres data.
-- Tildeling skjer kun via SQL/dashboard, aldri via appen selv.

create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);

alter table platform_admins enable row level security;

create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;
revoke all on function is_platform_admin() from public;
grant execute on function is_platform_admin() to authenticated;

-- Kun andre platform-admins kan se listen over hvem som er admin. Ingen
-- insert/update/delete-policy finnes i det hele tatt — kan ikke gjøres via API.
create policy "platform_admins_select" on platform_admins for select
  using (is_platform_admin());

-- Logg over hver gang noen starter en "se som"-økt: hvem, som hvem, når.
-- Skriveadgang er insert-only for egne rader (ingen kan slette/endre loggen).
create table admin_impersonation_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_household_id uuid not null references households(id) on delete cascade,
  started_at timestamptz not null default now()
);

alter table admin_impersonation_log enable row level security;

create policy "admin_impersonation_log_select" on admin_impersonation_log for select
  using (is_platform_admin());
create policy "admin_impersonation_log_insert" on admin_impersonation_log for insert
  with check (is_platform_admin() and admin_user_id = auth.uid());

-- ── Skrivebeskyttet admin-lesetilgang på tvers av husstander ──────────────
-- Én ekstra permissive select-policy per tabell (OR'es sammen med de
-- eksisterende) — endrer ingenting ved den vanlige tilgangsmodellen for
-- husstandsmedlemmer, legger kun til at en platform-admin også kan lese alt.

create policy "admin_read_profiles" on profiles for select using (is_platform_admin());
create policy "admin_read_households" on households for select using (is_platform_admin());
create policy "admin_read_household_members" on household_members for select using (is_platform_admin());
create policy "admin_read_household_invites" on household_invites for select using (is_platform_admin());
create policy "admin_read_categories" on categories for select using (is_platform_admin());
create policy "admin_read_accounts" on accounts for select using (is_platform_admin());
create policy "admin_read_bank_connections" on bank_connections for select using (is_platform_admin());
create policy "admin_read_bank_imports" on bank_imports for select using (is_platform_admin());
create policy "admin_read_categorization_rules" on categorization_rules for select using (is_platform_admin());
create policy "admin_read_vendors" on vendors for select using (is_platform_admin());
create policy "admin_read_categorization_log" on categorization_log for select using (is_platform_admin());
create policy "admin_read_transactions" on transactions for select using (is_platform_admin());
create policy "admin_read_assets" on assets for select using (is_platform_admin());
create policy "admin_read_holdings" on holdings for select using (is_platform_admin());
create policy "admin_read_dismissed_recurring" on dismissed_recurring for select using (is_platform_admin());
create policy "admin_read_net_worth_snapshots" on net_worth_snapshots for select using (is_platform_admin());
create policy "admin_read_holding_price_snapshots" on holding_price_snapshots for select using (is_platform_admin());
