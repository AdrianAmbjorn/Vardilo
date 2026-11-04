insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-profile-photos', 'family-profile-photos', false, 262144, array['image/jpeg']);

create policy "Family members can read profile photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'family-profile-photos' and exists (
    select 1 from public.family_members member
    where member.user_id = (select auth.uid())
      and member.family_id::text = (storage.foldername(objects.name))[1]
  )
);

create policy "Members can add their own profile photo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'family-profile-photos' and exists (
    select 1 from public.family_members member
    where member.user_id = (select auth.uid())
      and objects.name = member.family_id::text || '/' || member.id::text || '.jpg'
  )
);

create policy "Members can replace their own profile photo"
on storage.objects for update to authenticated
using (
  bucket_id = 'family-profile-photos' and exists (
    select 1 from public.family_members member
    where member.user_id = (select auth.uid())
      and objects.name = member.family_id::text || '/' || member.id::text || '.jpg'
  )
)
with check (
  bucket_id = 'family-profile-photos' and exists (
    select 1 from public.family_members member
    where member.user_id = (select auth.uid())
      and objects.name = member.family_id::text || '/' || member.id::text || '.jpg'
  )
);

create policy "Members can remove their own profile photo"
on storage.objects for delete to authenticated
using (
  bucket_id = 'family-profile-photos' and exists (
    select 1 from public.family_members member
    where member.user_id = (select auth.uid())
      and objects.name = member.family_id::text || '/' || member.id::text || '.jpg'
  )
);
