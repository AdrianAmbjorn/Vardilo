-- Purchase status is adult-only, including direct API reads.
revoke select on public.family_wishlist_items from public,anon,authenticated;
revoke select(purchased) on public.family_wishlist_items from public,anon,authenticated;
grant select(id,wishlist_id,title,url,price,created_at) on public.family_wishlist_items to authenticated;
create function public.get_wishlist_items(p_wishlist_id uuid)
returns table(id uuid,title text,url text,price numeric,purchased boolean)
language plpgsql security definer set search_path='' as $$
declare actor public.family_members;
begin
 select me.* into actor from public.family_members me join public.family_wishlists w on w.family_id=me.family_id
 where w.id=p_wishlist_id and me.user_id=(select auth.uid());
 if actor.id is null then raise exception 'Önskelistan är inte tillgänglig.' using errcode='42501';end if;
 return query select i.id,i.title,i.url,i.price,case when actor.role='barn' then false else i.purchased end
 from public.family_wishlist_items i where i.wishlist_id=p_wishlist_id order by i.created_at,i.id;
end $$;
revoke all on function public.get_wishlist_items(uuid) from public,anon;
grant execute on function public.get_wishlist_items(uuid) to authenticated;
create function vardilo_private.protect_wishlist_purchase_status()
returns trigger language plpgsql set search_path='' as $$
declare is_child boolean;
begin
 select me.role='barn' into is_child from public.family_members me join public.family_wishlists w on w.family_id=me.family_id
 where w.id=new.wishlist_id and me.user_id=(select auth.uid());
 if coalesce(is_child,false) then
  if tg_op='INSERT' then new.purchased:=false;
  elsif new.purchased is distinct from old.purchased then raise exception 'Köpstatus hanteras av vuxna.' using errcode='42501';end if;
 end if;
 return new;
end $$;
revoke all on function vardilo_private.protect_wishlist_purchase_status() from public,anon,authenticated;
create trigger protect_wishlist_purchase_status before insert or update on public.family_wishlist_items for each row execute function vardilo_private.protect_wishlist_purchase_status();
