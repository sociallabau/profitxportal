-- Dan or Emily can tell the Client Health chat a call is already booked with a client. It softens
-- the overdue-contact nag until the booked time (see clientCare.ts attention()) without hiding other
-- real problems — bad numbers or going silent on messages still show. Admin-only, via the existing
-- "Admins manage client care" policy on client_care.

ALTER TABLE public.client_care
  ADD COLUMN IF NOT EXISTS next_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_contact_note text,
  ADD COLUMN IF NOT EXISTS next_contact_kind text,
  ADD COLUMN IF NOT EXISTS next_contact_by uuid;

ALTER TABLE public.client_care
  ADD CONSTRAINT client_care_next_contact_kind_check
  CHECK (next_contact_kind IS NULL OR next_contact_kind IN ('whatsapp', 'call', 'quarterly_call', 'group_call', 'other'));
