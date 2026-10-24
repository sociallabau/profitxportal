import { describe, expect, it } from 'vitest';
import { bestRecording, recordingName, titleDate } from '../../supabase/functions/ask-dan/recordings';
import { buildTaskTitle, sectionsText } from '../../supabase/functions/ask-dan/buildHelp';
import { helpPrompt } from '@/lib/growthHub';
import { resourceCatalogue, resourceLink, vaultSources } from '@/data/resourceCatalogue';

const lines = resourceCatalogue().split('\n');
const payToPlay = lines.find(l => l.includes('Pay To Play'))!;
const adMetrics = lines.find(l => l.includes('Ad Metrics'))!;

describe('Dan AI recording links', () => {
  it('names a session without its category or date', () => {
    expect(recordingName(payToPlay)).toBe('pay to play');
    expect(recordingName('Vault · Momentum Call · Momentum Call (Aug 31)')).toBe('');
    expect(recordingName('Roadmap · growth · Hire Your First Editor — Remove yourself')).toBe('');
  });
  it('picks the recording whose Drive file or title the passages come from', () => {
    const [fileId] = Object.entries(vaultSources()).find(([, l]) => l === adMetrics)!;
    expect(bestRecording([{ title: 'random.mp4', source_id: fileId, score: 9 }], lines, vaultSources())).toBe(adMetrics);
    expect(bestRecording([{ title: 'Pay To Play Workshop - transcript', score: 5 }, { title: 'Call with Sam', score: 8 }], lines, vaultSources())).toBe(payToPlay);
    expect(bestRecording([{ title: 'Call with Sam', score: 8 }], lines, vaultSources())).toBeNull();
  });
  it('matches dated call recordings from Drive to the Vault call on that date', () => {
    expect(titleDate('ProfitX - Momentum Call™ - 2026/09/15 07:29 AEST – Recording')).toBe('Sep 15');
    const sep15 = lines.find(l => l.endsWith('(Sep 15)'))!;
    expect(bestRecording([{ title: 'ProfitX - Momentum Call™ - 2026/09/15 07:29 AEST – Recording', score: 6 }], lines, {})).toBe(sep15);
    const sep2 = lines.find(l => l.endsWith('(Sep 2)'))!;
    expect(bestRecording([{ title: 'ProfitX - Edit Flow™ + Next 90 Workshop - 2026/09/02 06:56 AEST – Chat', score: 6 }], lines, {})).toBe(sep2);
  });
  it('links a picked line to the recording, not just its category', () => {
    const r = resourceLink(payToPlay);
    expect(r.title).toBe('Workshop — Pay To Play™');
    expect(r.href).toMatch(/^https:\/\/drive\.google\.com/);
    expect(r.extras.length).toBeGreaterThan(0);
  });
});


describe('Dan AI build-task help', () => {
  it('recognises the Playbook "Help me do this" question', () => {
    const q = helpPrompt({ title: 'Post 8 times on your own Instagram', module_codes: ['C1'], training_label: null });
    expect(buildTaskTitle(q)).toBe('Post 8 times on your own Instagram');
    expect(buildTaskTitle('How do I get more leads?')).toBeNull();
  });
  it('flattens module sections into readable text', () => {
    const text = sectionsText([{ type: 'steps', title: 'Build it', steps: ['Pick 3 posts', { text: 'Boost each for $50' }] }, { type: 'checklist', items: [{ emoji: '✅', text: 'Hook in 2s' }] }]);
    expect(text).toContain('## Build it');
    expect(text).toContain('2. Boost each for $50');
    expect(text).toContain('- Hook in 2s');
  });
});
