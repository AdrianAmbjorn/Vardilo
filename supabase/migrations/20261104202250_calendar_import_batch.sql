alter table public.calendar_events add column import_batch_id uuid;

create index calendar_events_import_batch_idx
  on public.calendar_events (family_id, import_batch_id)
  where import_batch_id is not null;

notify pgrst, 'reload schema';
