-- Seed canonical people for V1.
-- Email addresses are @innovera.ai — confirm spellings with Harry.

insert into people (email, display_name, aliases) values
  ('pedram@innovera.ai', 'Pedram',   array['Pedram']),
  ('spencer@innovera.ai','Spencer',  array['Spencer']),
  ('jeff@innovera.ai',   'Jeff',     array['Jeff']),
  ('daniel@innovera.ai', 'Daniel',   array['Daniel', 'Dan''l', 'Dan', 'Danl']),
  ('harry@innovera.ai',  'Harry',    array['Harry']),
  ('felipe@innovera.ai', 'Felipe',   array['Felipe']),
  ('maksym@innovera.ai', 'Maksym',   array['Maksym', 'Maks', 'Max']),  -- Max/Maksym collapsed; confirm.
  ('olga@innovera.ai',   'Olga',     array['Olga']),
  ('vika@innovera.ai',   'Vika',     array['Vika']),
  ('carson@innovera.ai', 'Carson',   array['Carson']),
  ('annah@innovera.ai',  'Anna H.',  array['Anna H.', 'AnnaH', 'Anna']),
  ('hanna@innovera.ai',  'Hanna',    array['Hanna']),
  ('nobu@innovera.ai',   'Nobu',     array['Nobu'])
on conflict (email) do update
  set display_name = excluded.display_name,
      aliases      = excluded.aliases;

-- Flatten aliases into name_aliases (lowercased) for fast lookup at sync time.
truncate name_aliases;
insert into name_aliases (alias, canonical_email)
select lower(trim(a)), p.email
from people p, unnest(p.aliases) as a
on conflict (alias) do nothing;
