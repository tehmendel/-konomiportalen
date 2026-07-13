revoke execute on function is_household_owner(uuid) from anon;
revoke execute on function remove_household_member(uuid, uuid) from anon;

-- Public URL fetches (<img src>) bypass RLS entirely for public buckets, so this
-- only affects the authenticated list/API path: stop cross-household enumeration
-- of avatar file paths while direct image loading keeps working.
drop policy "household_avatars_read" on storage.objects;
create policy "household_avatars_read" on storage.objects for select
  using (bucket_id = 'household-avatars' and is_household_member((storage.foldername(name))[1]::uuid));
