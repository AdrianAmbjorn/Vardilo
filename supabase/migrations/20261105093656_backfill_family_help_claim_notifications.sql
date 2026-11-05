-- Give existing claim notices the same names and family-wide visibility.
update public.notifications notification
set title = coalesce(nullif(helper.display_name, ''), 'En familjemedlem') || ' hjälper ' ||
      coalesce(nullif(requester.display_name, ''), 'en familjemedlem'),
    metadata = notification.metadata || jsonb_build_object(
      'created_by_member_id', request.created_by_member_id, 'action', 'help_claimed'
    )
from public.help_requests request
left join public.family_members requester
  on requester.id = request.created_by_member_id and requester.family_id = request.family_id
left join public.family_members helper
  on helper.family_id = request.family_id
where notification.type = 'help' and notification.title = 'Hjälp är tagen'
  and notification.family_id = request.family_id
  and notification.metadata->>'help_request_id' = request.id::text
  and notification.metadata->>'claimed_by_member_id' = helper.id::text;

with existing_claims as (
  select distinct on (family_id, metadata->>'help_request_id', metadata->>'claimed_by_member_id', created_at)
    family_id, title, body, href, metadata, created_at
  from public.notifications
  where type = 'help' and metadata->>'action' = 'help_claimed'
  order by family_id, metadata->>'help_request_id', metadata->>'claimed_by_member_id', created_at, id
)
insert into public.notifications (family_id, recipient_member_id, type, title, body, href, metadata, created_at)
select claim.family_id, member.id, 'help', claim.title, claim.body, claim.href, claim.metadata, claim.created_at
from existing_claims claim
join public.family_members member on member.family_id = claim.family_id
where not exists (
  select 1 from public.notifications existing
  where existing.family_id = claim.family_id and existing.recipient_member_id = member.id
    and existing.type = 'help' and existing.created_at = claim.created_at
    and existing.metadata->>'help_request_id' = claim.metadata->>'help_request_id'
    and existing.metadata->>'claimed_by_member_id' = claim.metadata->>'claimed_by_member_id'
);
