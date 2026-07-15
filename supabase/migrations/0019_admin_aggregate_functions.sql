-- household_net_worth/household_category_totals gate hver rad på
-- is_household_member(), som en platform-admin (som ikke er medlem av
-- husstanden de "ser som") aldri oppfyller — uten denne fiksen ville
-- Formue/Oversikt vist 0 kr under impersonasjon i stedet for faktiske tall.
create or replace function household_category_totals(p_household_id uuid)
returns table(category_id uuid, category_name text, type text, year int, month int, total_amount numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.category_id,
    c.name as category_name,
    t.type,
    extract(year from t.date)::int as year,
    extract(month from t.date)::int as month,
    sum(t.amount) as total_amount
  from transactions t
  left join categories c on c.id = t.category_id
  where t.household_id = p_household_id
    and (is_household_member(p_household_id) or is_platform_admin())
  group by t.category_id, c.name, t.type, extract(year from t.date), extract(month from t.date);
$$;

create or replace function household_net_worth(p_household_id uuid)
returns table(category text, total_amount numeric)
language sql
stable
security definer
set search_path = public
as $$
  select 'bank'::text, coalesce(sum(balance), 0)
    from accounts
    where household_id = p_household_id and account_type in ('checking', 'savings', 'child')
      and (is_household_member(p_household_id) or is_platform_admin())
  union all
  select 'loan'::text, coalesce(sum(balance), 0)
    from accounts
    where household_id = p_household_id and account_type in ('loan', 'card')
      and (is_household_member(p_household_id) or is_platform_admin())
  union all
  select 'investment'::text, coalesce(sum(h.quantity * h.current_price), 0)
    from holdings h
    join accounts a on a.id = h.account_id
    where a.household_id = p_household_id and (is_household_member(p_household_id) or is_platform_admin())
  union all
  select category, coalesce(sum(case when is_liability then -value else value end), 0)
    from assets
    where household_id = p_household_id and (is_household_member(p_household_id) or is_platform_admin())
    group by category;
$$;

revoke all on function household_category_totals(uuid) from anon;
revoke all on function household_net_worth(uuid) from anon;
grant execute on function household_category_totals(uuid) to authenticated;
grant execute on function household_net_worth(uuid) to authenticated;
