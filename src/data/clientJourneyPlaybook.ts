/**
 * Onboarding playbook — the exact steps, messages and links for each stage of
 * the Client Journey. Mirrors the Notion onboarding process.
 *
 * Message bodies use {{name}} for the client's name and {{time}} for the
 * kickoff call time, both filled in before copying.
 */

export type PlaybookLink = {
  label: string;
  url: string;
  note?: string;
};

export type PlaybookMessage = {
  label: string;
  body: string;
};

export type StagePlaybook = {
  /** Things to do at this stage, in order. */
  checklist?: string[];
  /** Messages to copy and paste, in order. */
  messages?: PlaybookMessage[];
  /** Links to send or open. */
  links?: PlaybookLink[];
  /** Context that isn't an action — shown as a note at the top. */
  note?: string;
};

export const PLAYBOOK: Record<string, StagePlaybook> = {
  new: {
    checklist: [
      'Send the payment link (or they click through from the ad)',
      'Add the client to the spreadsheet — name, number, email, messages to send',
    ],
  },

  payment: {
    checklist: [
      "Add their phone number into Phone — you'll already have it from the DMs",
    ],
  },

  onboarding: {
    checklist: [
      'Create a private WhatsApp group called "{{name}} x Dan"',
      'Send the announcement group link',
      'Send the Q&A group link',
      'Send the ProfitX onboarding landing page',
    ],
    links: [
      {
        label: 'WhatsApp — Announcement group',
        url: 'https://chat.whatsapp.com/LLFJlGw75PyAzgs2C5IVDP?s=cl&p=i&mlu=4',
      },
      {
        label: 'WhatsApp — Q&A group',
        url: 'https://chat.whatsapp.com/EPiZRWT4Bij5027N5o3Y1v?s=cl&p=i&mlu=4',
      },
      {
        label: 'ProfitX onboarding landing page',
        url: 'https://profitx-onboard.lovable.app/',
      },
    ],
  },

  pre_call: {
    messages: [
      {
        label: 'Message 1 — kickoff call',
        body: `Hey bro, super keen to have you in and get started.

Does {{time}} work for your kickoff call?

We'll get you clear on your exact retainer offer + how to deliver it.
Give you some simple control over how to sell it`,
      },
      {
        label: 'Message 2 — calendar',
        body: `https://calendar.google.com/calendar/u/0?cid=Y19lYmM5MWUxODUyYzgyMmEyMmYyNzZmODkzNDFiNjYzYmMwMmJkMmQ3OTMxZjE2Njc3NTA5NDExMTJlNzY3MmZlQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20

Add that to your calendar - all the calls I put in will auto add to yours!

Most of the stuff in the portal is probably a bit much now - the first month is all about getting this retainer and your biz sorted. Can watch the calls or workshops if you like though.`,
      },
    ],
  },

  call1_scheduled: {
    note: 'Nothing to send — waiting on the kickoff call.',
  },

  call1_complete: {
    messages: [
      {
        label: 'Message 1 — tasks after Call 1',
        body: `Thanks for the chat bro! Super pumped to get this going for you.

Few little things to sort first:

- Create new retainer system name & tier 1 offer
- Create Tier 1 offer system proposal doc
- Simple write out of delivery roadmap.

I'll drop some examples below.

Send through when they're done - no time pressure`,
      },
    ],
    links: [
      {
        label: 'Proposal Template',
        url: 'https://drive.google.com/file/d/1vDwonzRERRzK3AlNqzaYe_QRITL5s_TV/view?usp=sharing',
      },
      {
        label: 'Delivery Roadmap',
        url: 'https://ripe-age-78d.notion.site/Delivery-Roadmap-2b7f13ad5f5d803eb0e0d240d09dc810?source=copy_link',
      },
      {
        label: 'Example Delivery Roadmap',
        url: 'https://ripe-age-78d.notion.site/Delivery-Example-306f13ad5f5d8053a63bc9c0281c693b?source=copy_link',
      },
      {
        label: 'Proposal Examples',
        url: 'https://drive.google.com/drive/folders/1qLAwEE5tsGqKcwvg0mj-i2utLqNoGZFm?usp=sharing',
        note: 'Pick the specific proposals that fit this client',
      },
    ],
  },

  call2_scheduled: {
    note: 'Call 2 gets booked once they have finished the three things from Call 1 and sent them through.',
    checklist: [
      'Check the offer docs and delivery roadmap are all sweet',
      'Go through the client management Notion',
      'Simple ad tutorial',
    ],
  },

  active: {
    note: 'Onboarding done — ongoing coaching from here.',
  },
};

/** Fills {{name}} and {{time}} placeholders before copying. */
export function fillTemplate(
  template: string,
  values: { name?: string; time?: string }
): string {
  return template
    .replace(/\{\{name\}\}/g, values.name?.trim() || '[name]')
    .replace(/\{\{time\}\}/g, values.time?.trim() || '[time that works for you]');
}
