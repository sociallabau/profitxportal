import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Rocket, Plus, Copy, Check, Sparkles, Trash2, ArrowRight, Flame, X, Users, Target, Lock } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRequireAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

type Campaign = {
  id: string; user_id: string; status: string; daily_budget: number; duration_days: number;
  starting_followers: number | null; current_followers: number | null;
  ad_hook: string | null; offer_summary: string | null; notes: string | null;
  launched_at: string; ended_at: string | null;
};
type Follower = {
  id: string; campaign_id: string; user_id: string; handle: string;
  stage: string; qualified: boolean; dm_history: { role: 'me' | 'them'; text: string; at: string }[];
  notes: string | null; hot_list_id: string | null; created_at: string;
};
type DmTemplate = { id: string; stage_key: string; label: string; body: string; sort_order: number };

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: 'bg-muted text-muted-foreground' },
  { key: 'qualified', label: 'Qualified', color: 'bg-blue-500/15 text-blue-400' },
  { key: 'dmd', label: "DM'd", color: 'bg-amber-500/15 text-amber-400' },
  { key: 'replied', label: 'Replied', color: 'bg-purple-500/15 text-purple-400' },
  { key: 'positive', label: 'Positive Reply 🔥', color: 'bg-orange-500/15 text-orange-400' },
  { key: 'booked', label: 'Booked Call', color: 'bg-emerald-500/15 text-emerald-400' },
  { key: 'passed', label: 'Passed', color: 'bg-destructive/15 text-destructive' },
];

export default function LaunchHQ() {
  const { user, loading } = useRequireAuth();
  const qc = useQueryClient();
  const [showLaunch, setShowLaunch] = useState(false);
  const [bulkHandles, setBulkHandles] = useState('');
  const [openFollower, setOpenFollower] = useState<Follower | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile-tier-launch', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('tier').eq('id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });
  const isUnlocked = profile?.tier && profile.tier !== 'onramp';

  const { data: campaign } = useQuery({
    queryKey: ['active-campaign', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('ad_campaigns').select('*')
        .eq('user_id', user.id).eq('status', 'active').maybeSingle();
      return data as Campaign | null;
    },
    enabled: !!user && !!isUnlocked,
  });

  const { data: followers = [] } = useQuery({
    queryKey: ['campaign-followers', campaign?.id],
    queryFn: async () => {
      if (!campaign) return [];
      const { data } = await supabase.from('campaign_followers').select('*')
        .eq('campaign_id', campaign.id).order('created_at', { ascending: false });
      return ((data ?? []) as unknown) as Follower[];
    },
    enabled: !!campaign,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['dm-templates'],
    queryFn: async () => {
      const { data } = await supabase.from('dm_templates').select('*').order('sort_order');
      return (data ?? []) as DmTemplate[];
    },
  });

  const launchCampaign = useMutation({
    mutationFn: async (vals: { daily_budget: number; starting_followers: number; ad_hook: string; offer_summary: string }) => {
      const { error } = await supabase.from('ad_campaigns').insert({
        user_id: user!.id, status: 'active', duration_days: 5,
        ...vals, current_followers: vals.starting_followers,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-campaign'] });
      setShowLaunch(false);
      toast({ title: '🚀 Campaign launched!', description: '5-day countdown started. Go all in.' });
    },
    onError: (e: any) => toast({ title: 'Launch failed', description: e.message, variant: 'destructive' }),
  });

  const addFollowers = useMutation({
    mutationFn: async (text: string) => {
      const handles = text.split('\n').map(h => h.trim().replace(/^@/, '')).filter(Boolean);
      if (!handles.length) throw new Error('No handles');
      const rows = handles.map(h => ({ campaign_id: campaign!.id, user_id: user!.id, handle: h }));
      const { error } = await supabase.from('campaign_followers').insert(rows);
      if (error) throw error;
      return handles.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ['campaign-followers'] });
      setBulkHandles('');
      toast({ title: `+${n} follower${n > 1 ? 's' : ''} added`, description: 'Time to qualify them.' });
    },
  });

  const updateFollower = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Follower> }) => {
      const { error } = await supabase.from('campaign_followers').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-followers'] }),
  });

  const setStage = async (f: Follower, stage: string) => {
    let hot_list_id = f.hot_list_id;
    if ((stage === 'positive' || stage === 'booked') && !hot_list_id) {
      const dmText = f.dm_history.map(m => `${m.role === 'me' ? 'Me' : 'Them'}: ${m.text}`).join('\n');
      const { data, error } = await supabase.from('hot_list').insert({
        user_id: user!.id,
        name: `@${f.handle}`,
        instagram_handle: f.handle,
        source: 'IG Ad Campaign',
        column_id: 'reached_out',
        notes: `From Launch Command Centre.${dmText ? `\n\n${dmText}` : ''}${f.notes ? `\n\nNotes: ${f.notes}` : ''}`,
      }).select('id').single();
      if (error) {
        toast({ title: 'Could not add to Hot List', description: error.message, variant: 'destructive' });
      } else {
        hot_list_id = data?.id ?? null;
        qc.invalidateQueries({ queryKey: ['hot-list'] });
        if (hot_list_id) toast({ title: '🔥 Sent to Hot List!', description: 'Now go close them.' });
      }
    }
    updateFollower.mutate({ id: f.id, patch: { stage, hot_list_id } });
  };

  const endCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ad_campaigns').update({
        status: 'completed', ended_at: new Date().toISOString(),
      }).eq('id', campaign!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-campaign'] });
      toast({ title: 'Campaign ended', description: 'Check the report. Then run another.' });
    },
  });

  const deleteFollower = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaign_followers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-followers'] }),
  });

  if (loading || !user) return null;

  if (!isUnlocked) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <Lock className="w-10 h-10 text-primary" />
          <h1 className="text-2xl font-bold flex items-center gap-2"><Rocket className="w-6 h-6 text-primary" /> Launch Command Centre</h1>
          <p className="text-muted-foreground max-w-md">
            Launch HQ unlocks once you've finished your Onramp. Complete your foundations first — then it's all guns blazing.
          </p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Rocket className="w-7 h-7 text-primary" /> Launch Command Centre
            </h1>
            <p className="text-muted-foreground mt-1">
              Stupidly Simple Ad → New followers → DMs → Calls. All-guns-blazing mode.
            </p>
          </div>
          {!campaign && (
            <Button onClick={() => setShowLaunch(true)} size="lg" className="gap-2">
              <Rocket className="w-4 h-4" /> Launch Campaign
            </Button>
          )}
          {campaign && (
            <Button variant="outline" onClick={() => endCampaign.mutate()} className="gap-2">
              <Check className="w-4 h-4" /> End Campaign
            </Button>
          )}
        </header>

        {!campaign ? <PreLaunchView onLaunch={() => setShowLaunch(true)} /> : (
          <>
            <CampaignTracker campaign={campaign} followers={followers} />
            <AddFollowersCard value={bulkHandles} onChange={setBulkHandles} onSubmit={() => addFollowers.mutate(bulkHandles)} />
            <FollowerKanban
              followers={followers}
              onStageChange={setStage}
              onOpen={setOpenFollower}
              onDelete={(id) => deleteFollower.mutate(id)}
            />
          </>
        )}
      </div>

      <LaunchDialog open={showLaunch} onClose={() => setShowLaunch(false)} onSubmit={(v) => launchCampaign.mutate(v)} />
      {openFollower && (
        <FollowerDialog
          follower={openFollower}
          templates={templates}
          campaign={campaign}
          onClose={() => setOpenFollower(null)}
          onUpdate={(patch) => {
            updateFollower.mutate({ id: openFollower.id, patch });
            setOpenFollower({ ...openFollower, ...patch } as Follower);
          }}
          onStageChange={(s) => { setStage(openFollower, s); setOpenFollower({ ...openFollower, stage: s }); }}
        />
      )}
    </PageLayout>
  );
}

function PreLaunchView({ onLaunch }: { onLaunch: () => void }) {
  const checklist = [
    'Profile Optimised',
    'Call Out Target Market In Video',
    "Caption Is 'Follow @(handle) If You're A (Industry)'",
    'Budget Locked In',
  ];
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-1">Pre-Launch Checklist</h2>
      <p className="text-sm text-muted-foreground mb-4">Tick these off in your head, then hit launch.</p>
      <div className="space-y-3">
        {checklist.map((c) => (
          <div key={c} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border items-center">
            <div className="w-6 h-6 rounded-full border-2 border-primary/50 shrink-0" />
            <div className="font-medium">{c}</div>
          </div>
        ))}
      </div>
      <Button onClick={onLaunch} size="lg" className="w-full mt-5 gap-2">
        <Rocket className="w-4 h-4" /> I'm ready — Launch Campaign
      </Button>
    </Card>
  );
}

function CampaignTracker({ campaign, followers }: { campaign: Campaign; followers: Follower[] }) {
  const start = new Date(campaign.launched_at).getTime();
  const totalMs = campaign.duration_days * 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - start;
  const dayNum = Math.min(campaign.duration_days, Math.floor(elapsed / (24 * 60 * 60 * 1000)) + 1);
  const pct = Math.min(100, (elapsed / totalMs) * 100);
  const totalSpend = (campaign.daily_budget * Math.min(campaign.duration_days, dayNum)).toFixed(0);
  const totalBudget = (campaign.daily_budget * campaign.duration_days).toFixed(0);

  const qualified = followers.filter(f => f.qualified).length;
  const dmd = followers.filter(f => ['dmd', 'replied', 'positive', 'booked'].includes(f.stage)).length;
  const positive = followers.filter(f => ['positive', 'booked'].includes(f.stage)).length;

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/10 via-card to-card border-primary/30">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Badge className="mb-2 bg-primary/20 text-primary border-primary/30">🚀 LIVE — Day {dayNum} of {campaign.duration_days}</Badge>
          <h2 className="text-2xl font-bold">${totalSpend} / ${totalBudget} spent</h2>
          <p className="text-sm text-muted-foreground mt-1">{campaign.ad_hook || 'Stupidly Simple Ad running'}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-primary">{followers.length}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">followers tracked</div>
        </div>
      </div>
      <Progress value={pct} className="mt-4 h-2" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
        <Stat icon={Users} label="Tracked" value={followers.length} />
        <Stat icon={Target} label="Qualified" value={qualified} />
        <Stat icon={ArrowRight} label="DM'd" value={dmd} />
        <Stat icon={Flame} label="Positive" value={positive} />
      </div>
    </Card>
  );
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="bg-card/50 border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function AddFollowersCard({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <Card className="p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-1">
        <Plus className="w-4 h-4 text-primary" /> Add new followers
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Paste IG handles (one per line). Strip the @ or leave it — we'll handle it.
      </p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="@johndoe&#10;@janefilms&#10;@sarahmedia"
        rows={4}
        className="font-mono text-sm"
      />
      <div className="flex justify-end mt-3">
        <Button onClick={onSubmit} disabled={!value.trim()} className="gap-2">
          <Plus className="w-4 h-4" /> Add to tracker
        </Button>
      </div>
    </Card>
  );
}

function FollowerKanban({ followers, onStageChange, onOpen, onDelete }: any) {
  const grouped = useMemo(() => {
    const g: Record<string, Follower[]> = {};
    STAGES.forEach(s => g[s.key] = []);
    followers.forEach((f: Follower) => { (g[f.stage] ?? g.new).push(f); });
    return g;
  }, [followers]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {STAGES.filter(s => s.key !== 'passed').map(stage => (
        <div key={stage.key} className="bg-muted/20 rounded-lg p-3 border border-border min-h-32">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${stage.color}`}>{stage.label}</span>
            <span className="text-xs text-muted-foreground">{grouped[stage.key].length}</span>
          </div>
          <div className="space-y-2">
            {grouped[stage.key].map(f => (
              <div key={f.id} className="bg-card border border-border rounded-md p-2.5 hover:border-primary/50 transition-colors group">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => onOpen(f)} className="font-medium text-sm truncate hover:text-primary text-left flex-1">
                    @{f.handle}
                  </button>
                  <button onClick={() => onDelete(f.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {f.dm_history.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">{f.dm_history.length} msg{f.dm_history.length > 1 ? 's' : ''}</div>
                )}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {STAGES.filter(s => s.key !== f.stage && s.key !== 'passed').map(s => (
                    <button key={s.key} onClick={() => onStageChange(f, s.key)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary hover:text-primary-foreground transition-colors">
                      → {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {grouped[stage.key].length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-3 italic">empty</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LaunchDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (v: any) => void }) {
  const [budget, setBudget] = useState<string>('');
  const [industry, setIndustry] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Rocket className="w-5 h-5 text-primary" /> Launch your campaign</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Daily budget ($)</Label>
            <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 15" />
          </div>
          <div>
            <Label>Industry</Label>
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. local gyms" />
          </div>
          <Button
            onClick={() => onSubmit({ daily_budget: Number(budget) || 0, starting_followers: 0, ad_hook: industry, offer_summary: industry })}
            className="w-full gap-2" size="lg" disabled={!budget || !industry}>
            <Rocket className="w-4 h-4" /> Launch — go all guns blazing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FollowerDialog({ follower, templates, campaign, onClose, onUpdate, onStageChange }: any) {
  const [reply, setReply] = useState('');
  const [draft, setDraft] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ angle: string; message: string }[]>([]);
  const [notes, setNotes] = useState(follower.notes || '');

  useEffect(() => { setNotes(follower.notes || ''); }, [follower.id]);

  const personalise = (body: string) => body.replace(/{handle}/g, `@${follower.handle}`).replace(/{niche}/g, 'your niche').replace(/{business}/g, 'your business');

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const logMessage = async (role: 'me' | 'them', text: string) => {
    if (!text.trim()) return;
    const newHistory = [...follower.dm_history, { role, text: text.trim(), at: new Date().toISOString() }];
    onUpdate({ dm_history: newHistory, stage: role === 'me' && follower.stage === 'qualified' ? 'dmd' : role === 'them' ? 'replied' : follower.stage });
  };

  const askAI = async () => {
    if (!reply.trim()) return;
    setAiLoading(true); setAiSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke('dm-reply-suggester', {
        body: {
          handle: follower.handle,
          dmHistory: follower.dm_history,
          prospectReply: reply,
          offerSummary: campaign?.offer_summary,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAiSuggestions((data as any)?.suggestions ?? []);
    } catch (e: any) {
      toast({ title: 'AI failed', description: e.message, variant: 'destructive' });
    } finally { setAiLoading(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            @{follower.handle}
            <Badge className={STAGES.find(s => s.key === follower.stage)?.color}>{STAGES.find(s => s.key === follower.stage)?.label}</Badge>
            <a href={`https://instagram.com/${follower.handle}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline ml-auto">Open IG ↗</a>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="flex gap-2 flex-wrap">
            {STAGES.map(s => (
              <button key={s.key} onClick={() => onStageChange(s.key)}
                className={`text-xs px-2.5 py-1 rounded ${follower.stage === s.key ? s.color + ' ring-1 ring-current' : 'bg-muted hover:bg-muted/70'}`}>
                {s.label}
              </button>
            ))}
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Script library</Label>
            <div className="grid gap-2 mt-2">
              {templates.map((t: DmTemplate) => (
                <div key={t.id} className="bg-muted/30 border border-border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium">{t.label}</span>
                    <Button size="sm" variant="ghost" onClick={() => copy(personalise(t.body), t.id)} className="h-7 gap-1">
                      {copiedKey === t.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedKey === t.id ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{personalise(t.body)}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">DM history ({follower.dm_history.length})</Label>
            <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto">
              {follower.dm_history.length === 0 && <p className="text-xs text-muted-foreground italic">No messages logged yet.</p>}
              {follower.dm_history.map((m: any, i: number) => (
                <div key={i} className={`text-sm p-2 rounded ${m.role === 'me' ? 'bg-primary/15 ml-6' : 'bg-muted mr-6'}`}>
                  <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">{m.role === 'me' ? 'You' : 'Them'}</div>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Log message YOU sent..." rows={2} className="text-xs" />
                <Button size="sm" variant="outline" className="w-full mt-1" onClick={() => { logMessage('me', draft); setDraft(''); }}>Log my message</Button>
              </div>
              <div>
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Paste THEIR reply..." rows={2} className="text-xs" />
                <Button size="sm" variant="outline" className="w-full mt-1" onClick={() => { logMessage('them', reply); }}>Log their reply</Button>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-card border border-primary/30 rounded-md p-3">
            <Label className="text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> AI reply suggester
            </Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">Paste their reply above, then let AI craft 3 next-message options.</p>
            <Button size="sm" onClick={askAI} disabled={!reply.trim() || aiLoading} className="gap-2">
              <Sparkles className="w-3.5 h-3.5" /> {aiLoading ? 'Thinking...' : 'Suggest replies'}
            </Button>
            {aiSuggestions.length > 0 && (
              <div className="mt-3 space-y-2">
                {aiSuggestions.map((s, i) => (
                  <div key={i} className="bg-card border border-border rounded p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{s.angle}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => copy(s.message, `ai-${i}`)} className="h-6 gap-1">
                        {copiedKey === `ai-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <p className="text-xs whitespace-pre-wrap">{s.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => onUpdate({ notes })} rows={2} className="mt-2 text-sm" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
