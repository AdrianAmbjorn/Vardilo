alter table public.family_budget_entries alter column member_id drop not null;
create or replace function vardilo_private.validate_budget_member()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.member_id is not null and not exists(select 1 from public.family_members where id=new.member_id and family_id=new.family_id and role in ('admin','förälder')) then raise exception 'Välj en förälder i samma familj.' using errcode='42501';end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.family_id is distinct from old.family_id or new.created_at is distinct from old.created_at) then raise exception 'Postens identitet kan inte ändras.' using errcode='42501';end if;
 return new;
end $$;
