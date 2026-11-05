create policy wishlist_owner_delete on public.family_wishlists as restrictive for delete to authenticated
using(exists(select 1 from public.family_members me where me.family_id=family_wishlists.family_id and me.user_id=(select auth.uid()) and (me.id=family_wishlists.member_id or me.role in ('admin','förälder'))));
create policy wishlist_owner_insert on public.family_wishlists as restrictive for insert to authenticated
with check(exists(select 1 from public.family_members me where me.family_id=family_wishlists.family_id and me.user_id=(select auth.uid()) and (me.id=family_wishlists.member_id or me.role in ('admin','förälder'))));
create function vardilo_private.protect_wishlist_owner()
returns trigger language plpgsql set search_path='' as $$
declare actor public.family_members;
begin
 select * into actor from public.family_members where user_id=(select auth.uid()) and family_id=old.family_id;
 if actor.id is not null and (new.family_id is distinct from old.family_id or (actor.role not in ('admin','förälder') and (old.member_id<>actor.id or new.member_id is distinct from old.member_id))) then raise exception 'Du kan bara ändra din egen önskelista.' using errcode='42501';end if;
 return new;
end $$;
revoke all on function vardilo_private.protect_wishlist_owner() from public,anon,authenticated;
create trigger protect_wishlist_owner before update on public.family_wishlists for each row execute function vardilo_private.protect_wishlist_owner();
create function vardilo_private.notify_deleted_wishlist()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(family_id,recipient_member_id,type,title,body,href,metadata)
 select distinct old.family_id,me.id,'system','Önskelistan är inte längre aktuell',old.title||' har tagits bort. Dina reservationer på listan gäller inte längre.','/onskelistor',jsonb_build_object('wishlist_id',old.id,'action','wishlist_deleted')
 from public.family_wishlist_reservations r join public.family_wishlist_items i on i.id=r.item_id join public.family_members me on me.id=r.reserved_by
 where i.wishlist_id=old.id and me.family_id=old.family_id and me.role<>'barn';
 return old;
end $$;
revoke all on function vardilo_private.notify_deleted_wishlist() from public,anon,authenticated;
create trigger notify_deleted_wishlist before delete on public.family_wishlists for each row execute function vardilo_private.notify_deleted_wishlist();
create or replace function public.reserve_wishlist_item(p_item_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor public.family_members; list public.family_wishlists;
begin
 select w.* into list from public.family_wishlists w join public.family_wishlist_items i on i.wishlist_id=w.id where i.id=p_item_id for update of w;
 select * into actor from public.family_members me where me.family_id=list.family_id and me.user_id=(select auth.uid()) and me.role<>'barn';
 if actor.id is null then raise exception 'Not permitted to reserve' using errcode='42501';end if;
 insert into public.family_wishlist_reservations(item_id,reserved_by)values(p_item_id,actor.id);
 exception when unique_violation then raise exception 'Already reserved';
end $$;
create or replace function public.unreserve_wishlist_item(p_item_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare list public.family_wishlists;
begin
 select w.* into list from public.family_wishlists w join public.family_wishlist_items i on i.wishlist_id=w.id where i.id=p_item_id for update of w;
 delete from public.family_wishlist_reservations r using public.family_members me where r.item_id=p_item_id and me.id=r.reserved_by and me.family_id=list.family_id and me.user_id=(select auth.uid()) and me.role<>'barn';
 if not found then raise exception 'Only your own reservation can be removed';end if;
end $$;
revoke all on function public.reserve_wishlist_item(uuid),public.unreserve_wishlist_item(uuid) from public,anon;
grant execute on function public.reserve_wishlist_item(uuid),public.unreserve_wishlist_item(uuid) to authenticated;
