create or replace function vardilo_private.protect_wishlist_purchase_status()
returns trigger language plpgsql set search_path='' as $$
declare is_child boolean;
begin
 select me.role='barn' into is_child from public.family_members me join public.family_wishlists w on w.family_id=me.family_id
 where w.id=new.wishlist_id and me.user_id=(select auth.uid());
 if coalesce(is_child,false) then
  if tg_op='INSERT' then new.purchased:=false;
  else raise exception 'Köpstatus hanteras av vuxna.' using errcode='42501';end if;
 end if;
 return new;
end $$;
revoke all on function vardilo_private.protect_wishlist_purchase_status() from public,anon,authenticated;
drop trigger protect_wishlist_purchase_status on public.family_wishlist_items;
create trigger protect_wishlist_purchase_status before insert or update of purchased on public.family_wishlist_items for each row execute function vardilo_private.protect_wishlist_purchase_status();
