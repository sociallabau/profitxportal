-- Tests built from Dan's own answers to the stuck points members hit most (playbook.ts).
-- Criteria check his reasoning applied to the persona's data, not his wording.
insert into public.dan_ai_tests (name, category, persona_key, question, must_include, must_not, position, active)
select v.name, v.category, 'P_EARLY', v.question, v.must_include::jsonb, v.must_not::jsonb, v.position, true
from (values
  ('CONVERSATIONS_BUILD', 'playbook', 20,
   'Help me do this build task step by step: "Start 6 retainer conversations" (training: C2)',
   '["starts with their own content: plan what they can film from their real estate work and when it goes live, BTS ideally", "posts it and puts a $50–100 profile-visit boost behind it", "ties it to their posting count this month being short of target", "DMs go to people who interact with the posts, after the content is out"]',
   '["opens with listing warm contacts or cold DMs as the first step", "generic \"do warm outreach\" with no how"]'),
  ('TOO_EXPENSIVE', 'playbook', 21,
   'A real estate agent I pitched said my retainer is too expensive. What do I do?',
   '["names the likely causes: price before context/outcome, or a tier too far along for them", "go back to where their business is now", "offer a smaller tier, not a discount"]',
   '["recommends discounting the same package"]'),
  ('TOO_BUSY', 'playbook', 22,
   'I''m too busy shooting and editing for clients to post my own content.',
   '["under $15–20k/mo busy means over-delivering or undercharging, so question where the time goes", "gives a simple way to document while shooting, like a quick intro then clips from the shoot, or paying someone ~$100 to film BTS", "holds the line that their own content isn''t optional"]',
   '["tells them to hire an editor now"]'),
  ('SCOPE_CREEP', 'playbook', 23,
   'My client keeps asking for extra videos outside what we agreed.',
   '["separates a random ask from a pattern", "if random, just do it, less transactional", "if every time, gives a line to raise it and charge a one-off fee", "set scope at the start in the strategy session next time"]',
   '["\"flag to Dan\""]')
) as v(name, category, position, question, must_include, must_not)
where not exists (select 1 from public.dan_ai_tests t where t.name = v.name);
