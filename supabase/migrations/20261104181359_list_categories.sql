alter table public.family_lists
  add column category text not null default 'Övrigt',
  add constraint family_lists_category_check
    check (category in ('Mathandling', 'Storhelg', 'Fest', 'Övrigt'));

notify pgrst, 'reload schema';
