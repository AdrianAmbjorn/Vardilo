alter table public.family_lists
  drop constraint family_lists_category_check,
  add constraint family_lists_category_check
    check (category in ('Mathandling', 'Storhelg', 'Fest', 'Hemmet', 'Övrigt'));
