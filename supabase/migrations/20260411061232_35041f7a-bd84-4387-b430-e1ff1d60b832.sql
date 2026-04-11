
-- Create module_pages table for admin-editable module content
CREATE TABLE public.module_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  pillar TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.module_pages ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read module pages
CREATE POLICY "Authenticated users can read module pages"
ON public.module_pages FOR SELECT
TO authenticated
USING (true);

-- Admins can manage module pages
CREATE POLICY "Admins manage module pages"
ON public.module_pages FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Seed the Design Retainer Offer module
INSERT INTO public.module_pages (module_id, title, subtitle, pillar, sections) VALUES (
  'design-retainer-offer',
  'Design Your Retainer Offer',
  'How to build a results-driven retainer that stacks recurring revenue, delivers real client outcomes, and positions you as a growth partner, not just a videographer.',
  'build',
  '[
    {
      "type": "section_header",
      "number": 1,
      "label": "WHY"
    },
    {
      "type": "heading",
      "text": "The Problem with One-Off Shoots"
    },
    {
      "type": "paragraph",
      "text": "Most videographers are stuck in a cycle of one-off projects. At the start of every month, revenue resets to zero. They chase the same sales all over again to hit the same number. There is no compounding. No forecasting. No stability. This is the feast and famine cycle, and it is the single biggest reason videographers plateau at a certain income level and cannot break through."
    },
    {
      "type": "callout",
      "title": "The core problem:",
      "items": [
        "No recurring revenue means no financial momentum",
        "One-off projects do not compound, they reset",
        "You cannot forecast growth when every month starts from scratch",
        "You end up competing on price because clients do not see long-term value"
      ]
    },
    {
      "type": "paragraph",
      "text": "A monthly retainer fixes all of this. It stacks revenue month on month, gives you predictability, and lets you build real momentum in your business. The goal is simple: sign a client once, keep delivering value, and compound revenue over time."
    },
    {
      "type": "callout",
      "title": "THE REAL SHIFT: FROM VIDEO VENDOR TO GROWTH PARTNER",
      "text": "There is a deeper problem beyond the revenue model. Most videographers are only offering top-of-funnel services: pretty reels, polished content, X video hours per month. And clients do not value that. Not because it is not good, but because they cannot connect it to business growth.\n\nWhat clients actually want is more leads, more sales, more customers in their door. They do not care about view counts or vanity metrics. They want their business to grow."
    },
    {
      "type": "paragraph",
      "text": "The retainer model solves this by covering the full marketing funnel:"
    },
    {
      "type": "bullet_list",
      "items": [
        {"emoji": "🎥", "bold": "Short-form video content", "text": "top of funnel awareness and reach"},
        {"emoji": "📱", "bold": "Social media management", "text": "middle of funnel nurturing and consistency"},
        {"emoji": "📢", "bold": "Paid ads", "text": "bottom of funnel direct lead generation and booked calls"}
      ]
    },
    {
      "type": "paragraph",
      "text": "When you cover all three parts of the funnel, you stop pitching videos for a price. You are pitching business growth. That is a completely different conversation, and a much easier one to win."
    },
    {
      "type": "section_header",
      "number": 2,
      "label": "WHAT"
    },
    {
      "type": "heading",
      "text": "The Results-Driven Retainer"
    },
    {
      "type": "paragraph",
      "text": "A results-driven retainer is a monthly package that combines content creation, social media management, and paid advertising into a single offer, designed to actually move the needle for your client''s business, not just fill their feed with content."
    },
    {
      "type": "paragraph",
      "text": "It is structured so that you know exactly what you are delivering every month. No scope creep. No one-off shoots that blow out. Clear deliverables, clear expectations, and a clear path to results."
    },
    {
      "type": "callout",
      "title": "The headline package (your best-case offer):",
      "items": [
        "6 to 8 short-form reels per month (1 to 2 posts per week for your client)",
        "Social media management: you schedule and post everything for them",
        "Level 1 paid ads: Instagram profile visit ads to build momentum and traffic",
        "Level 2 paid ads (when ready): lead form or landing page ads to generate direct enquiries, booked calls, and sales"
      ]
    },
    {
      "type": "paragraph",
      "text": "You always lead with the headline package in a sales conversation. If a client is not quite ready for the full package, maybe they do not have a social presence yet, you can dial it back. But you should always have confidence in your headline offer because you know: if someone commits to this for 12 months, they will get results."
    },
    {
      "type": "callout",
      "title": "Why the 4 to 8 reel range is the sweet spot:",
      "items": [
        "Covers 1 to 2 posts per week: consistent without overwhelming your clients",
        "Manageable with 2 to 3 clients without burning out on delivery",
        "High enough volume to drive results, low enough to maintain quality",
        "Avoids the trap of 15 to 20 reels where delivery becomes unsustainable"
      ]
    },
    {
      "type": "section_header",
      "number": 3,
      "label": "HOW"
    },
    {
      "type": "heading",
      "text": "Building Your Retainer Offer"
    },
    {
      "type": "paragraph",
      "text": "Here is how to build your own retainer from scratch. Work through each step in order."
    },
    {
      "type": "numbered_steps",
      "items": [
        {
          "title": "Decide on your reel volume",
          "text": "Think honestly about what you can produce per client per month. If you shoot high-quality, cinematic content, lean towards quality over quantity (4 to 6 reels). If you are built for volume and speed, go up to 8. The key is: could you deliver this for 3 clients simultaneously without cracking under the pressure?"
        },
        {
          "title": "Define your social media management scope",
          "text": "At minimum, this means scheduling and posting the reels you film. You can also add extras like carousels, graphics, or photo posts depending on your skillset. The core value here is removing the client from the process. They post at the wrong time, the wrong day, and kill the video''s performance. You take that away from them entirely."
        },
        {
          "title": "Choose your ad level",
          "text": "Level 1: Simple Instagram profile visit ads. Great for new clients who need to build momentum and social proof before running direct response ads.\n\nLevel 2: Lead form or landing page ads. For clients with a solid social presence who are ready to generate direct leads, sales, and booked calls. This is where you become genuinely invaluable: you are making them more than they pay you."
        },
        {
          "title": "Price it using the pricing calculator",
          "text": "Use the ProfitX pricing calculator to input your deliverables and get a suggested price for your package. This removes the guesswork and ensures your retainer is priced to be profitable."
        },
        {
          "title": "Give it a unique name using the NESB Formula",
          "text": "This is critical. Clients have heard the words ''reels'', ''social media management'', and ''ads'' before. You need your retainer to feel like something new and proprietary, not a bundle of services they have already said no to."
        }
      ]
    },
    {
      "type": "callout",
      "title": "THE NESB FORMULA: Make your retainer look and feel:",
      "items": [
        "N: New. Something they have not heard before",
        "E: Easy. Simple to understand, easy to say yes to",
        "S: Safe. Low risk, clear deliverables, proven process",
        "B: Big. A bold promise tied to what they actually want"
      ]
    },
    {
      "type": "pro_tip",
      "text": "Avoid names like ''Video Package'' or ''Social Media Bundle''. These sound generic and commoditised. Example name: The Ecosystem."
    },
    {
      "type": "section_header",
      "number": 4,
      "label": "NOW"
    },
    {
      "type": "heading",
      "text": "Your Action Steps"
    },
    {
      "type": "paragraph",
      "text": "Before you move to the next module, complete the following. This is your non-negotiable homework."
    },
    {
      "type": "action_checklist",
      "items": [
        {"id": "retainer-reel-volume", "text": "Reel volume defined"},
        {"id": "retainer-smm-scope", "text": "Social media management scope locked in"},
        {"id": "retainer-ad-level", "text": "Ad level chosen (Level 1 or Level 2)"},
        {"id": "retainer-pricing", "text": "Package priced using the calculator"},
        {"id": "retainer-nesb-name", "text": "Retainer named using the NESB formula"}
      ]
    },
    {
      "type": "link_placeholder",
      "label": "Pricing Calculator",
      "url": ""
    },
    {
      "type": "next_module",
      "text": "Next up: Module 02: Client Onboarding and Strategy Sessions"
    }
  ]'::jsonb
);
