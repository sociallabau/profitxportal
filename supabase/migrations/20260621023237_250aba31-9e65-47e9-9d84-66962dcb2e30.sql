UPDATE public.module_pages
SET title = 'Organic Content Flywheel',
    pillar = 'clients',
    sections = jsonb_set(sections, '{0,title}', '"Organic Content Flywheel"'::jsonb),
    updated_at = now()
WHERE module_id = 'C1';