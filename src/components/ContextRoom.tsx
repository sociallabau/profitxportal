import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Loader2, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useContextRoom } from '@/hooks/useContextRoom';
import { useGoal } from '@/hooks/useGoal';
import { buildContextMarkdown, contextCompleteness, contextSections, isFilled, sectionAge, type ContextAnswers, type ContextField } from '@/lib/contextRoom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';

function ContextFieldInput({ field, value, onChange, prefix }: { field: ContextField; value: string | string[]; onChange: (value: string | string[]) => void; prefix: string }) {
  const id = `${prefix}-${field.key}`;
  return <div className={field.type === 'textarea' || field.type === 'multi' || field.type === 'radio' ? 'sm:col-span-2 space-y-2' : 'space-y-2'}>
    <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground">{field.label}{field.optional && ' (optional)'}</label>
    {field.type === 'select' ? <Select value={typeof value === 'string' ? value : ''} onValueChange={onChange}>
      <SelectTrigger id={id} className="bg-input"><SelectValue placeholder={field.placeholder} /></SelectTrigger>
      <SelectContent>{field.options?.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
    </Select> : field.type === 'multi' ? <div className="flex flex-wrap gap-x-5 gap-y-3">
      {field.options?.map(option => <label key={option} className="flex items-center gap-2 text-sm">
        <Checkbox checked={Array.isArray(value) && value.includes(option)} onCheckedChange={checked => {
          const current = Array.isArray(value) ? value : [];
          onChange(checked ? [...current, option] : current.filter(item => item !== option));
        }} />{option}
      </label>)}
    </div> : field.type === 'radio' ? <RadioGroup id={id} value={typeof value === 'string' ? value : ''} onValueChange={onChange} className="flex flex-wrap gap-x-5 gap-y-3">
      {field.options?.map(option => <label key={option} className="flex items-center gap-2 text-sm"><RadioGroupItem value={option} />{option}</label>)}
    </RadioGroup> : field.type === 'textarea' ? <Textarea id={id} rows={3} value={typeof value === 'string' ? value : ''} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} className="bg-input resize-y" /> :
      <Input id={id} type={field.type || 'text'} min={field.type === 'number' ? 0 : undefined} max={field.key === 'percent_recurring' ? 100 : undefined} value={typeof value === 'string' ? value : ''} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} className="bg-input" />}
    {field.key === 'anything_else' && <p className="text-xs text-muted-foreground">Only Dan and Emily see this, alongside you. Not included in AI context.</p>}
  </div>;
}

export default function ContextRoom({ userId, adminView = false }: { userId: string; adminView?: boolean }) {
  const qc = useQueryClient();
  const { room, save, confirm } = useContextRoom(userId);
  const { setGoal } = useGoal();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ContextAnswers>({});
  const [fullName, setFullName] = useState('');
  const [goalDraft, setGoalDraft] = useState<Record<string, string>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const editable = !adminView || editing;
  const { data: profile, error: profileError } = useQuery({ queryKey: ['context-profile', userId], queryFn: async () => {
    const { data, error } = await supabase.from('profiles').select('full_name, email').eq('id', userId).single();
    if (error) throw error;
    return data;
  } });
  const { data: goal, error: goalError } = useQuery({ queryKey: ['context-goal', userId], queryFn: async () => {
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  } });
  const { data: totals, error: totalsError } = useQuery({ queryKey: ['context-totals', userId], queryFn: async () => {
    const { data, error } = await supabase.from('monthly_totals').select('month, mrr, mrr_manual').eq('user_id', userId).order('month', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
  } });
  useEffect(() => { setFullName(profile?.full_name ?? ''); }, [profile?.full_name, userId]);
  useEffect(() => { setDraft({}); setGoalDraft({}); setEditing(false); }, [userId]);
  const savedAnswers = (room.data?.answers ?? {}) as ContextAnswers;
  const answers = { ...savedAnswers, ...draft };
  const completeness = contextCompleteness(savedAnswers);
  const timestamps = (room.data?.section_updated_at ?? {}) as Record<string, string>;
  const goalValue = (key: string) => goalDraft[key] ?? String(goal?.[key as keyof typeof goal] ?? '');
  const saveGoal = async () => {
    const target = Number(goalValue('target_mrr'));
    const starting = Number(goalValue('starting_mrr') || 0);
    const date = goalValue('target_date');
    if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(starting) || starting < 0 || !date) throw new Error('Enter a valid target MRR and target date.');
    const values = {
      target_mrr: target, starting_mrr: starting, target_date: date,
      retainer_tier_1: goalValue('retainer_tier_1') ? Number(goalValue('retainer_tier_1')) : null,
      retainer_tier_2: goalValue('retainer_tier_2') ? Number(goalValue('retainer_tier_2')) : null,
      retainer_tier_3: goalValue('retainer_tier_3') ? Number(goalValue('retainer_tier_3')) : null,
    };
    if ([values.retainer_tier_1, values.retainer_tier_2, values.retainer_tier_3].some(v => v !== null && (!Number.isFinite(v) || v < 0))) throw new Error('Retainer prices must be valid positive amounts.');
    if (adminView) {
      const { error } = await supabase.from('goals').upsert({ user_id: userId, ...values }, { onConflict: 'user_id' });
      if (error) throw error;
      await save.mutateAsync({ section: 'now', answers: {}, adminEdit: true });
    } else await setGoal.mutateAsync(values);
    await qc.invalidateQueries({ queryKey: ['context-goal', userId] });
    setGoalDraft({});
  };
  const saveSection = async (sectionKey: string) => {
    const section = contextSections.find(s => s.key === sectionKey);
    if (!section) return;
    setSavingSection(sectionKey);
    try {
      if (sectionKey === 'about') {
        const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', userId);
        if (error) throw error;
        await qc.invalidateQueries({ queryKey: ['profile'] });
        if (Object.keys(goalDraft).some(key => key.startsWith('retainer_tier'))) await saveGoal();
      }
      const sectionAnswers = Object.fromEntries(section.fields.map(f => [f.key, answers[f.key] ?? '']));
      await save.mutateAsync({ section: sectionKey, answers: sectionAnswers, adminEdit: adminView });
      setDraft(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !section.fields.some(f => f.key === key))));
      toast.success(`${section.title} saved`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save this section'); }
    finally { setSavingSection(null); }
  };
  const renderGoalInput = (key: string, label: string, type = 'number', placeholder = '0') => <div key={key} className="space-y-2">
    <label htmlFor={`${userId}-${key}`} className="block text-xs font-semibold text-muted-foreground">{label}</label>
    {editable ? <Input id={`${userId}-${key}`} type={type} min={type === 'number' ? 0 : undefined} value={goalValue(key)} placeholder={placeholder} onChange={e => setGoalDraft(previous => ({ ...previous, [key]: e.target.value }))} className="bg-input" /> : <p className="text-sm">{goalValue(key) || '—'}</p>}
  </div>;
  const error = room.error || profileError || goalError || totalsError;
  if (room.isLoading) return <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-primary" aria-label="Loading Context Room" /></div>;
  if (error) return <div role="alert" className="py-4 space-y-3"><p className="text-sm text-destructive">Unable to load this Context Room.</p><Button variant="outline" onClick={() => { room.refetch(); qc.invalidateQueries({ queryKey: ['context-profile', userId] }); qc.invalidateQueries({ queryKey: ['context-goal', userId] }); qc.invalidateQueries({ queryKey: ['context-totals', userId] }); }}>Try again</Button></div>;

  return <div className="space-y-5">
    {adminView && <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm"><Switch checked={editing} onCheckedChange={value => { setEditing(value); setDraft({}); setGoalDraft({}); }} />Edit for member</label>
      <Button variant="outline" size="sm" onClick={async () => {
        try { await navigator.clipboard.writeText(buildContextMarkdown(savedAnswers, totals, goal)); toast.success('Context copied'); }
        catch { toast.error('Could not copy context'); }
      }}><Copy />Copy as Markdown</Button>
    </div>}
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{completeness.percentage}% filled</span><span>{completeness.sections} of 7 sections complete</span></div>
      <Progress value={completeness.percentage} className="h-1.5" />
    </div>
    {!adminView && room.data?.prefilled_by_admin && !room.data.confirmed_at && <div className="border border-primary/30 bg-primary/10 rounded-lg p-4 flex flex-wrap items-center gap-3">
      <p className="text-sm flex-1 min-w-48">Dan has pre-filled some of this from your calls. Check it's right, edit anything that's off, then hit Confirm.</p>
      <Button disabled={confirm.isPending || Object.keys(draft).length > 0 || Object.keys(goalDraft).length > 0} onClick={async () => { try { await confirm.mutateAsync(); toast.success('Context confirmed'); } catch { toast.error('Could not confirm context'); } }}><ShieldCheck />Confirm</Button>
    </div>}
    <Accordion type="single" collapsible className="space-y-3">
      {contextSections.map(section => {
        const complete = section.fields.filter(f => !f.optional).every(f => isFilled(savedAnswers[f.key]));
        const age = sectionAge(timestamps[section.key]);
        const heading = <span className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 flex-1">
          <span className="font-semibold text-sm text-foreground flex items-center gap-2">{complete && <Check className="h-4 w-4 text-success" />}{section.title}</span>
          <span className="text-xs text-muted-foreground font-normal">{age.days === null ? 'Not updated yet' : age.days === 0 ? 'Updated today' : `Updated ${age.days} ${age.days === 1 ? 'day' : 'days'} ago`}</span>
          {age.needsRefresh && <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded">Due a refresh</span>}
        </span>;
        const renderFields = (fields: ContextField[]) => <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.filter(f => f.key !== 'lead_source_other' || answers.main_lead_source === 'Other').map(field => editable ? <ContextFieldInput key={field.key} field={field} value={answers[field.key] ?? ''} prefix={userId} onChange={value => setDraft(previous => ({ ...previous, [field.key]: value }))} /> : <div key={field.key} className="space-y-1 sm:col-span-2"><p className="text-xs text-muted-foreground">{field.label}</p><p className="text-sm whitespace-pre-wrap break-words">{Array.isArray(answers[field.key]) ? (answers[field.key] as string[]).join(', ') : answers[field.key] || '—'}</p></div>)}
        </div>;
        const content = <div className="space-y-5 pt-2">
            {section.key === 'about' && <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><label htmlFor={`${userId}-name`} className="block text-xs font-semibold text-muted-foreground">Full name</label>{editable ? <Input id={`${userId}-name`} value={fullName} onChange={e => setFullName(e.target.value)} className="bg-input" placeholder="Your name" /> : <p>{fullName || '—'}</p>}</div>
                <div className="space-y-2"><label htmlFor={`${userId}-email`} className="block text-xs font-semibold text-muted-foreground">Email</label><Input id={`${userId}-email`} value={profile?.email ?? ''} readOnly className="bg-input text-muted-foreground" /></div>
              </div>
            </>}
            {section.key === 'numbers' && <div className="border-b border-border pb-4 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">MRR</p><p className="font-semibold">{totals ? `$${Number(totals.mrr_manual ?? totals.mrr ?? 0).toLocaleString()}` : '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Active retainers</p><p className="font-semibold">Not recorded</p></div>
                <div><p className="text-xs text-muted-foreground">Month</p><p className="font-semibold">{totals?.month ? new Date(`${totals.month}T00:00:00`).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }) : '—'}</p></div>
              </div>
              {!adminView && <Link to="/submissions/monthly" className="text-xs text-primary underline underline-offset-4">Update these in Monthly Totals</Link>}
            </div>}
            {section.key === 'now' && <div className="border-b border-border pb-5 space-y-4">
              <h3 className="font-semibold text-sm">90-day MRR goal</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{renderGoalInput('starting_mrr', 'Starting MRR ($)')}{renderGoalInput('target_mrr', 'Target MRR ($)', 'number', '20000')}{renderGoalInput('target_date', 'Target date', 'date', '')}</div>
              {editable && <Button disabled={savingSection !== null} onClick={async () => {
                setSavingSection('goal');
                try { await saveGoal(); toast.success('Goal saved'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save goal'); }
                finally { setSavingSection(null); }
              }}><Save />Save goal</Button>}
            </div>}
            {renderFields(section.key === 'about' ? section.fields.filter(field => field.type !== 'textarea') : section.fields)}
            {section.key === 'about' && <div className="space-y-3"><h3 className="text-sm font-semibold">Your retainer prices ($ / month)</h3><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[1, 2, 3].map(tier => renderGoalInput(`retainer_tier_${tier}`, `Tier ${tier}`, 'number', tier === 1 ? '1500' : tier === 2 ? '3000' : 'Optional'))}</div></div>}
            {section.key === 'about' && <Accordion type="single" collapsible><AccordionItem value="offer-details" className="border-b border-border"><AccordionTrigger className="text-sm hover:no-underline">Offer details</AccordionTrigger><AccordionContent>{renderFields(section.fields.filter(field => field.type === 'textarea'))}</AccordionContent></AccordionItem></Accordion>}
            {editable && <div className="flex justify-end"><Button disabled={savingSection !== null} onClick={() => saveSection(section.key)}><Save />{savingSection === section.key ? 'Saving…' : 'Save'}</Button></div>}
          </div>;
        if (section.key === 'about') return <section key={section.key} className="space-y-4 pb-5 border-b border-border"><h2>{heading}</h2>{content}</section>;
        return <AccordionItem key={section.key} value={section.key} className="border border-border bg-card rounded-lg px-4 sm:px-5">
          <AccordionTrigger className="hover:no-underline gap-3 text-left">{heading}</AccordionTrigger>
          <AccordionContent>{content}</AccordionContent>
        </AccordionItem>;
      })}
    </Accordion>
  </div>;
}
