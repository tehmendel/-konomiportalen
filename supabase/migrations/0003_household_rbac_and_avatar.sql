-- Rollebasert tilgangsstyring for husstander + husstandsbilde.
-- Owner: kan endre husstandsinnstillinger, invitere/fjerne medlemmer.
-- Member: full bruk av appen, men ikke husstandsadministrasjon.

alter table households add column avatar_url text;

create or replace function is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members
    where household_id = target_household_id and user_id = auth.uid() and role = 'owner'
  );
$$;

revoke all on function is_household_owner(uuid) from public;
grant execute on function is_household_owner(uuid) to authenticated;

-- Kun eier kan endre husstandsnavn/bilde (tidligere: alle medlemmer).
drop policy "households_update" on households;
create policy "households_update" on households for update using (is_household_owner(id));

create or replace function remove_household_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_household_owner(p_household_id) then
    raise exception 'Kun eier kan fjerne medlemmer';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Kan ikke fjerne deg selv';
  end if;
  delete from household_members where household_id = p_household_id and user_id = p_user_id;
end;
$$;

revoke all on function remove_household_member(uuid, uuid) from public;
grant execute on function remove_household_member(uuid, uuid) to authenticated;

-- Kun eier kan generere invitasjoner (tidligere: alle medlemmer).
create or replace function create_household_invite(p_household_id uuid, p_email text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_token text;
begin
  if not is_household_owner(p_household_id) then
    raise exception 'Kun eier kan opprette invitasjoner';
  end if;

  new_token := encode(gen_random_bytes(18), 'hex');
  insert into household_invites (household_id, token, email, created_by)
    values (p_household_id, new_token, nullif(trim(p_email), ''), auth.uid());

  return new_token;
end;
$$;

-- Husstandsbilde: offentlig lesbar bucket, kun eier kan laste opp/endre/slette.
-- Filsti-konvensjon: {household_id}/avatar.<ext> — første mappesegment = husstands-ID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('household-avatars', 'household-avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "household_avatars_read" on storage.objects for select
  using (bucket_id = 'household-avatars');

create policy "household_avatars_insert" on storage.objects for insert
  with check (bucket_id = 'household-avatars' and is_household_owner((storage.foldername(name))[1]::uuid));

create policy "household_avatars_update" on storage.objects for update
  using (bucket_id = 'household-avatars' and is_household_owner((storage.foldername(name))[1]::uuid));

create policy "household_avatars_delete" on storage.objects for delete
  using (bucket_id = 'household-avatars' and is_household_owner((storage.foldername(name))[1]::uuid));
