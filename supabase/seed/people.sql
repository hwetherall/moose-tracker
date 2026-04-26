-- Seed canonical people for V1.
-- Email addresses are @innovera.ai — confirm spellings with Harry.

insert into people (email, display_name, aliases) values
  ('pedram@innovera.ai',  'Pedram',  array['pedram', 'Pedram']),
  ('spencer@innovera.ai', 'Spencer', array['spencer', 'Spencer']),
  ('jeff@innovera.ai',    'Jeff',    array['jeff', 'Jeff']),
  ('daniel@innovera.ai',  'Daniel',  array['daniel', 'Daniel', 'Dan''l', 'dan''l']),
  ('harry@innovera.ai',   'Harry',   array['harry', 'Harry']),
  ('maksym@innovera.ai',  'Maksym',  array['maksym', 'Maksym', 'Maks', 'maks', 'Max', 'max']),  -- Max/Maksym collapsed; confirm.
  ('olga@innovera.ai',    'Olga',    array['olga', 'Olga']),
  ('vika@innovera.ai',    'Vika',    array['vika', 'Vika']),
  ('felipe@innovera.ai',  'Felipe',  array['felipe', 'Felipe']),
  ('carson@innovera.ai',  'Carson',  array['carson', 'Carson']),
  ('hanna@innovera.ai',   'Hanna',   array['hanna', 'Hanna']),
  ('anna.h@innovera.ai',  'Anna H.', array['AnnaH', 'annah', 'Anna H']),
  ('nobu@innovera.ai',    'Nobu',    array['nobu', 'Nobu'])
on conflict (email) do update
  set display_name = excluded.display_name,
      aliases      = excluded.aliases;

-- Flatten aliases into name_aliases (lowercased) for fast lookup at sync time.
truncate name_aliases;
insert into name_aliases (alias, canonical_email)
select lower(trim(a)), p.email
from people p, unnest(p.aliases) as a
on conflict (alias) do nothing;
