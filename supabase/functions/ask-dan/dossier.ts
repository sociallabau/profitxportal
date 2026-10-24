// Everything else the portal knows about a member, beyond the Context Room and
// monthly numbers: their gate build list, Dan's approvals, wins, pipeline,
// audits, reviews, coaching notes and what they've been asking Dan AI.
// Loaded with the service role; privacy is enforced by only ever loading the
// member who is asking (or the one Dan picked in admin mode).

import type { IgPost } from "./instagram.ts";

// deno-lint-ignore no-explicit-any
type DB = any;

export type BuildTask = {
  title: string; kind: "kickoff" | "once" | "monthly"; training: string | null;
  status: "approved" | "submitted" | "needs_changes" | "open"; review_note: string | null;
};
export type CheckIn = {
  month: string; biggest_win: string | null; needs_this_month: string | null;
  business_confidence: number | null; nps: number | null; meetings: number | null;
};
export type MemberExtras = {
  gate_number: number | null;
  fast_track_lead_gen: boolean;
  extra_modules: string[];
  build: BuildTask[];
  check_ins: CheckIn[];
  clients: { count: number; last_signed: string | null; avg_value: number | null };
  pipeline: { total: number; by_stage: Record<string, number>; open_value: number };
  wins: string[];
  content_30d: { posts: number; best: string | null };
  ads: string[];
  audit: string | null;
  weak_modules: string[];
  review_focus: string | null;
  coach_notes: string[];
  health: string | null;
  recent_questions: string[];
  memory: { summary: string; refreshed_at: string | null; stale: boolean } | null;
  instagram: { handle: string; posts: IgPost[]; fetched_at: string | null } | null;
  journey: { joined: string | null; starting_mrr: number | null; first_month: string | null; first_mrr: number | null };
  modules_done: string[];
  training_viewed: string[];
  financial_audit: string | null;
  prospects: { total: number; by_stage: Record<string, number> };
  dm_campaign: { total: number; by_stage: Record<string, number>; qualified: number };
  cash_menu_done: string[];
  saved_ideas: number;
};

const GATE_NAMES: Record<string, number> = { fix: 1, fuel: 2, scale: 3, supercharge: 4 };

/** "Gate 2 — Fuel", "2", "Fuel" → 2. */
export function gateNumber(gate: string | null | undefined): number | null {
  if (!gate) return null;
  const n = gate.match(/[1-4]/);
  if (n) return Number(n[0]);
  const named = Object.keys(GATE_NAMES).find(k => gate.toLowerCase().includes(k));
  return named ? GATE_NAMES[named] : null;
}

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
const clip = (s: unknown, n = 220) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export async function loadExtras(admin: DB, memberId: string, gate: string | null, today = new Date()): Promise<MemberExtras> {
  const g = gateNumber(gate);
  const since30 = new Date(today.getTime() - 30 * 86400000).toISOString();
  const thisMonth = monthKey(today);
  // A missing table (migration not run yet) or a failed query just means less context.
  const q = (p: PromiseLike<{ data: unknown }>) => Promise.resolve(p).then(r => r.data).catch(() => null);

  const [
    settings, tasks, progress, checkIns, clients, hot, weekly, monday, posts, ads,
    audit, scores, review, notes, health, questions, memory, joined, start, first,
    checklist, views, finAudit, journeyRows, followers, cashMenu, ideas, chats,
  ] = await Promise.all([
    q(admin.from("member_playbook").select("fast_track_lead_gen, extra_modules").eq("user_id", memberId).maybeSingle()),
    g ? q(admin.from("playbook_tasks").select("id, title, kind, training_label, module_codes, position").eq("gate", g).eq("active", true).order("position")) : null,
    q(admin.from("member_task_progress").select("task_id, period, status, review_note").eq("user_id", memberId)),
    q(admin.from("monthly_totals").select("month, biggest_win, needs_this_month, business_confidence, nps, meetings").eq("user_id", memberId).order("month", { ascending: false }).limit(6)),
    q(admin.from("new_clients").select("signed_date, monthly_value").eq("user_id", memberId).order("signed_date", { ascending: false }).limit(50)),
    q(admin.from("hot_list").select("column_id, deal_value").eq("user_id", memberId).limit(500)),
    q(admin.from("weekly_wins").select("win_text, cash_amount, week_ending").eq("user_id", memberId).order("week_ending", { ascending: false }).limit(4)),
    q(admin.from("monday_wins").select("win_text, new_client, deal_value, occurred_on").eq("user_id", memberId).order("occurred_on", { ascending: false }).limit(4)),
    q(admin.from("content_posts").select("title, hook, views, leads, created_at").eq("user_id", memberId).gte("created_at", since30).limit(100)),
    q(admin.from("ad_campaigns").select("status, daily_budget, ad_hook, launched_at").eq("user_id", memberId).order("created_at", { ascending: false }).limit(3)),
    q(admin.from("roadmap_audits").select("focus, issue, created_at").eq("user_id", memberId).order("created_at", { ascending: false }).limit(1).maybeSingle()),
    q(admin.from("roadmap_scores").select("module_number, pillar, score").eq("user_id", memberId)),
    q(admin.from("monthly_reviews").select("month, focus").eq("user_id", memberId).order("month", { ascending: false }).limit(1).maybeSingle()),
    q(admin.from("client_notes").select("note, created_at").eq("client_id", memberId).order("created_at", { ascending: false }).limit(5)),
    q(admin.from("client_health").select("health_status, notes").eq("client_user_id", memberId).maybeSingle()),
    q(admin.from("client_questions").select("question, created_at").eq("user_id", memberId).order("created_at", { ascending: false }).limit(8)),
    q(admin.from("member_memory").select("summary, refreshed_at, dirty_at, instagram, instagram_handle, instagram_fetched_at").eq("user_id", memberId).maybeSingle()),
    q(admin.from("profiles").select("created_at").eq("id", memberId).maybeSingle()),
    q(admin.from("goals").select("starting_mrr").eq("user_id", memberId).maybeSingle()),
    q(admin.from("monthly_totals").select("month, mrr, mrr_manual").eq("user_id", memberId).order("month", { ascending: true }).limit(1).maybeSingle()),
    q(admin.from("checklist_progress").select("task_key").eq("user_id", memberId).eq("completed", true).limit(300)),
    q(admin.from("page_views").select("page").eq("user_id", memberId).gte("viewed_at", since30).limit(1000)),
    q(admin.from("financial_audits").select("kind, period, audit, created_at").eq("user_id", memberId).order("created_at", { ascending: false }).limit(1).maybeSingle()),
    q(admin.from("client_journey").select("stage").eq("user_id", memberId).limit(500)),
    q(admin.from("campaign_followers").select("stage, qualified").eq("user_id", memberId).limit(1000)),
    q(admin.from("cash_menu_actions").select("action_key, completed_at").eq("user_id", memberId).not("completed_at", "is", null).limit(50)),
    Promise.resolve(admin.from("saved_ideas").select("id", { count: "exact", head: true }).eq("user_id", memberId)).then((r: { count: number | null }) => r.count ?? 0).catch(() => 0),
    q(admin.from("dan_ai_messages").select("content, created_at").eq("user_id", memberId).eq("role", "user").order("created_at", { ascending: false }).limit(8)),
  ]);

  // Build list: the current gate's tasks with this member's status for the right period.
  type P = { task_id: string; period: string; status: BuildTask["status"]; review_note: string | null };
  const prog = (progress ?? []) as P[];
  const build: BuildTask[] = ((tasks ?? []) as { id: string; title: string; kind: BuildTask["kind"]; training_label: string | null; module_codes: string[] }[]).map(t => {
    const period = t.kind === "monthly" ? thisMonth : "once";
    const row = prog.find(p => p.task_id === t.id && p.period === period);
    const training = t.module_codes?.length ? t.module_codes.join(" + ") : t.training_label;
    return { title: t.title, kind: t.kind, training: training || null, status: row?.status ?? "open", review_note: row?.review_note ?? null };
  });

  const cl = (clients ?? []) as { signed_date: string | null; monthly_value: number | null }[];
  const values = cl.map(c => c.monthly_value).filter((v): v is number => typeof v === "number" && v > 0);

  const hotRows = (hot ?? []) as { column_id: string | null; deal_value: number | null }[];
  const byStage: Record<string, number> = {};
  for (const h of hotRows) byStage[h.column_id ?? "unsorted"] = (byStage[h.column_id ?? "unsorted"] ?? 0) + 1;
  const openValue = hotRows.filter(h => !/won|lost|closed|signed/i.test(h.column_id ?? "")).reduce((n, h) => n + (h.deal_value ?? 0), 0);

  const wins = [
    ...((weekly ?? []) as { win_text: string | null; cash_amount: number | null; week_ending: string }[])
      .filter(w => w.win_text).map(w => `${w.week_ending}: ${clip(w.win_text, 140)}${w.cash_amount ? ` ($${w.cash_amount})` : ""}`),
    ...((monday ?? []) as { win_text: string | null; occurred_on: string; new_client: boolean | null }[])
      .filter(w => w.win_text).map(w => `${w.occurred_on}: ${clip(w.win_text, 140)}${w.new_client ? " (new client)" : ""}`),
  ].slice(0, 6);

  const postRows = (posts ?? []) as { title: string | null; hook: string | null; views: number | null; leads: number | null }[];
  const best = [...postRows].sort((a, b) => (b.leads ?? 0) - (a.leads ?? 0) || (b.views ?? 0) - (a.views ?? 0))[0];

  const scoreRows = (scores ?? []) as { module_number: number | string; pillar: string | null; score: number | null }[];
  const weak = scoreRows.filter(s => typeof s.score === "number" && s.score <= 2)
    .map(s => `${s.pillar ?? ""} ${s.module_number}`.trim()).slice(0, 6);

  const mem = memory as { summary: string; refreshed_at: string | null; dirty_at: string; instagram: IgPost[] | null; instagram_handle: string | null; instagram_fetched_at: string | null } | null;
  const s = settings as { fast_track_lead_gen: boolean; extra_modules: string[] } | null;
  const a = audit as { focus: string | null; issue: string | null } | null;
  const h = health as { health_status: string | null; notes: string | null } | null;

  return {
    gate_number: g,
    fast_track_lead_gen: !!s?.fast_track_lead_gen,
    extra_modules: s?.extra_modules ?? [],
    build,
    check_ins: (checkIns ?? []) as CheckIn[],
    clients: { count: cl.length, last_signed: cl[0]?.signed_date ?? null, avg_value: values.length ? Math.round(values.reduce((x, y) => x + y, 0) / values.length) : null },
    pipeline: { total: hotRows.length, by_stage: byStage, open_value: openValue },
    wins,
    content_30d: { posts: postRows.length, best: best ? clip(best.title || best.hook, 90) + (best.leads ? ` (${best.leads} leads)` : best.views ? ` (${best.views} views)` : "") : null },
    ads: ((ads ?? []) as { status: string | null; daily_budget: number | null; ad_hook: string | null }[])
      .map(x => `${x.status ?? "unknown"}${x.daily_budget ? ` $${x.daily_budget}/day` : ""}${x.ad_hook ? ` — "${clip(x.ad_hook, 60)}"` : ""}`),
    audit: a ? clip([a.focus, a.issue].filter(Boolean).join(" — "), 260) || null : null,
    weak_modules: weak,
    review_focus: review ? clip((review as { focus: string | null }).focus, 260) || null : null,
    coach_notes: ((notes ?? []) as { note: string }[]).map(n => clip(n.note, 200)),
    health: h ? clip([h.health_status, h.notes].filter(Boolean).join(" — "), 200) || null : null,
    recent_questions: [...new Set([
      ...((chats ?? []) as { content: string }[]).map(x => clip(x.content, 120)),
      ...((questions ?? []) as { question: string }[]).map(x => clip(x.question, 120)),
    ])].slice(0, 8),
    modules_done: [...new Set(((checklist ?? []) as { task_key: string }[]).map(c => c.task_key.split(/[:/]/)[0]))].slice(0, 30),
    training_viewed: topCounts(((views ?? []) as { page: string }[]).map(v => v.page), 8),
    financial_audit: finAudit ? clip(`${(finAudit as { kind: string }).kind}${(finAudit as { period: string | null }).period ? ` (${(finAudit as { period: string }).period})` : ""}: ${(finAudit as { audit: string | null }).audit ?? ""}`, 400) : null,
    prospects: stageCounts(((journeyRows ?? []) as { stage: string }[]).map(r => r.stage)),
    dm_campaign: { ...stageCounts(((followers ?? []) as { stage: string }[]).map(r => r.stage)), qualified: ((followers ?? []) as { qualified: boolean | null }[]).filter(r => r.qualified).length },
    cash_menu_done: ((cashMenu ?? []) as { action_key: string }[]).map(c => c.action_key).slice(0, 20),
    saved_ideas: typeof ideas === "number" ? ideas : 0,
    instagram: mem?.instagram_handle && Array.isArray(mem.instagram) ? { handle: mem.instagram_handle, posts: mem.instagram, fetched_at: mem.instagram_fetched_at } : null,
    journey: {
      joined: (joined as { created_at: string } | null)?.created_at?.slice(0, 10) ?? null,
      starting_mrr: (start as { starting_mrr: number | null } | null)?.starting_mrr ?? null,
      first_month: (first as { month: string } | null)?.month?.slice(0, 7) ?? null,
      first_mrr: (first as { mrr: number | null; mrr_manual: number | null } | null)?.mrr ?? (first as { mrr_manual: number | null } | null)?.mrr_manual ?? null,
    },
    memory: mem?.summary ? { summary: mem.summary, refreshed_at: mem.refreshed_at, stale: !mem.refreshed_at || mem.dirty_at > mem.refreshed_at } : null,
  };
}

function stageCounts(stages: string[]) {
  const by_stage: Record<string, number> = {};
  for (const s of stages) by_stage[s || "unsorted"] = (by_stage[s || "unsorted"] ?? 0) + 1;
  return { total: stages.length, by_stage };
}

function topCounts(items: string[], n: number): string[] {
  const c = new Map<string, number>();
  for (const i of items) c.set(i, (c.get(i) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} (${v})`);
}

/** The next build task to work on: needs-changes first, then the first open one. */
export function nextBuildTask(build: BuildTask[]): BuildTask | null {
  return build.find(t => t.status === "needs_changes")
    ?? build.find(t => t.status === "open" && t.kind !== "kickoff")
    ?? build.find(t => t.status === "open")
    ?? null;
}
