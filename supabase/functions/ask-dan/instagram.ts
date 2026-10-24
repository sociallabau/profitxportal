// A member's own recent Instagram posts, pulled through Apify (same actor as
// fetch-instagram-content). Fetched during the memory refresh at most once a
// day and cached on member_memory, so answers never wait on a scrape.

export type IgPost = { date: string | null; type: "reel" | "post"; caption: string; likes: number; views: number; comments: number; url: string };

export const IG_REFRESH_MS = 2 * 24 * 60 * 60 * 1000;

/** "@Agency", "instagram.com/agency/", "agency" → "agency". Null if it doesn't look like a handle. */
export function cleanHandle(raw: unknown): string | null {
  const text = String(raw ?? "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?]/)[0];
  return /^[a-z0-9._]{1,30}$/i.test(text) ? text.toLowerCase() : null;
}

export async function fetchRecentPosts(handle: string, limit = 12): Promise<IgPost[] | null> {
  const token = Deno.env.get("APIFY_API_TOKEN");
  if (!token) return null;
  const res = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=90&memory=512`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ directUrls: [`https://www.instagram.com/${handle}/`], resultsType: "posts", resultsLimit: limit, addParentData: false }),
  });
  if (!res.ok) throw new Error(`Apify ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) return [];
  // deno-lint-ignore no-explicit-any
  return raw.filter((p: any) => p && (p.shortCode || p.id)).map((p: any) => {
    const kind = `${p.productType ?? ""} ${p.type ?? ""}`.toLowerCase();
    const reel = /clips|reel|video/.test(kind) || !!p.videoUrl;
    return {
      date: p.timestamp ? String(p.timestamp).slice(0, 10) : null,
      type: reel ? "reel" : "post",
      caption: String(p.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 180),
      likes: Number(p.likesCount ?? 0) || 0,
      views: Number(p.videoViewCount ?? p.videoPlayCount ?? 0) || 0,
      comments: Number(p.commentsCount ?? 0) || 0,
      url: p.url || `https://www.instagram.com/p/${p.shortCode}/`,
    } satisfies IgPost;
  }).sort((a: IgPost, b: IgPost) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** Plain-English lines for the model: cadence, what's performing, the latest captions. */
export function instagramLines(handle: string, posts: IgPost[], fetchedAt: string | null, today = new Date()): string[] {
  if (!posts.length) return [`Instagram @${handle}: no public posts found${fetchedAt ? ` (checked ${fetchedAt.slice(0, 10)})` : ""}.`];
  const since = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const last30 = posts.filter(p => p.date && p.date >= since);
  const best = [...posts].sort((a, b) => (b.views || b.likes) - (a.views || a.likes))[0];
  const L = [
    `THEIR INSTAGRAM @${handle} (pulled ${fetchedAt?.slice(0, 10) ?? "recently"}): ${last30.length} posts in the last 30 days (${last30.filter(p => p.type === "reel").length} reels); last post ${posts[0].date ?? "unknown"}.`,
    `Best recent: ${best.type} ${best.date ?? ""} — ${best.views ? `${best.views} views, ` : ""}${best.likes} likes — "${best.caption.slice(0, 90)}"`,
    "Latest posts:",
    ...posts.slice(0, 6).map(p => `- ${p.date ?? "?"} ${p.type}: ${p.views ? `${p.views} views, ` : ""}${p.likes} likes — "${p.caption.slice(0, 110)}"`),
  ];
  return L;
}
