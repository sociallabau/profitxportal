UPDATE module_pages
SET sections = sections || '[
  {"label":"BTS/Authority example","type":"link_placeholder","url":"https://www.instagram.com/p/DZrZNU3DwSh/?img_index=1"},
  {"label":"BTS/Authority example 2","type":"link_placeholder","url":"https://www.instagram.com/p/DZHV5xoj83i/?img_index=1"},
  {"label":"Simple Authority carousel","type":"link_placeholder","url":"https://www.instagram.com/sociallabau/"},
  {"label":"BTS","type":"link_placeholder","url":"https://www.instagram.com/p/DZCNeWyD93u/?img_index=1"}
]'::jsonb,
updated_at = now()
WHERE module_id = 'C1';