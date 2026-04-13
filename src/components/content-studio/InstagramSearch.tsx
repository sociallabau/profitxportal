import { useState } from 'react';
import { Search, Loader2, ExternalLink, Sparkles, Bookmark, AlertTriangle, X, Copy, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface InstagramPost {
  id: string;
  shortCode: string;
  url: string;
  thumbnailUrl: string;
  videoUrl: string;
  caption: string;
  hashtags: string[];
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  timestamp: string;
  ownerUsername: string;
  ownerFullName: string;
  ownerProfilePicUrl: string;
  ownerFollowersCount: number;
  outlierScore: number;
  outlierLabel: string;
  isBoosted: boolean;
}

const QUICK_FILTERS = ['Construction', 'Real Estate', 'Mortgage Brokers'];

const MODES = [
  { id: 'handle', label: 'Search by @Handle' },
  { id: 'keyword', label: 'Search by Niche / Keyword' },
] as const;

const SORT_OPTIONS = [
  { id: 'outlier_score', label: 'Outlier Score' },
  { id: 'most_views', label: 'Most Views' },
  { id: 'most_recent', label: 'Most Recent' },
] as const;

const getBadgeStyle = (label: string) => {
  const base: Record<string, string> = {
    "Normal": "bg-muted text-muted-foreground border border-border",
    "Strong": "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    "Viral": "bg-orange-500/20 text-orange-300 border border-orange-500/30",
    "Mega Viral": "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.4)]",
  };
  return base[label] || base["Normal"];
};

const formatNumber = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

export default function InstagramSearch() {
  const { user } = useRequireAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'handle' | 'keyword'>('handle');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('outlier_score');
  const [results, setResults] = useState<InstagramPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remix panel state
  const [remixOpen, setRemixOpen] = useState(false);
  const [remixPost, setRemixPost] = useState<InstagramPost | null>(null);
  const [remixLoading, setRemixLoading] = useState(false);
  const [remixScript, setRemixScript] = useState('');
  const [remixError, setRemixError] = useState<string | null>(null);

  const searchInstagram = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setResults([]);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("fetch-instagram-content", {
        body: { mode, query: query.trim(), sort_by: sortBy },
      });
      if (fnError) throw fnError;
      if (data?.error) {
        if (data.error.includes("APIFY_API_TOKEN")) {
          setError("Content search is not configured yet. Contact your admin.");
        } else {
          throw new Error(data.error);
        }
        return;
      }
      setResults(data?.results || []);
      if ((data?.results || []).length === 0) {
        setError("No results found. Try a different handle or keyword.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFilter = (filter: string) => {
    setQuery(filter.toLowerCase());
    // Trigger search after setting
    setTimeout(() => {
      const btn = document.getElementById('ig-search-btn');
      btn?.click();
    }, 50);
  };

  const remixContent = async (post: InstagramPost) => {
    setRemixPost(post);
    setRemixOpen(true);
    setRemixLoading(true);
    setRemixScript('');
    setRemixError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("remix-content", {
        body: {
          caption: post.caption,
          hashtags: post.hashtags,
          views: post.views,
          likes: post.likes,
          comments: post.comments,
          username: post.ownerUsername,
        },
      });
      if (fnError) throw fnError;
      if (data?.error === "NO_BUSINESS_OVERVIEW") {
        setRemixError("NO_BUSINESS_OVERVIEW");
        return;
      }
      if (data?.error) throw new Error(data.error);
      setRemixScript(data?.script || "");
    } catch (err: any) {
      setRemixError(err.message || "Something went wrong.");
    } finally {
      setRemixLoading(false);
    }
  };

  const saveIdea = async (post: InstagramPost, script?: string) => {
    if (!user) return;
    const { error } = await supabase.from("saved_ideas").insert({
      user_id: user.id,
      source_handle: post.ownerUsername,
      source_url: post.url,
      source_thumbnail_url: post.thumbnailUrl,
      source_caption: post.caption,
      views: post.views,
      likes: post.likes,
      outlier_score: post.outlierScore,
      outlier_label: post.outlierLabel,
      is_boosted: post.isBoosted,
      ai_script: script || null,
    });
    if (error) {
      toast.error("Failed to save idea");
    } else {
      toast.success("Idea saved!");
    }
  };

  const copyScript = () => {
    navigator.clipboard.writeText(remixScript);
    toast.success("Script copied!");
  };

  return (
    <div>
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as 'handle' | 'keyword')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchInstagram()}
            placeholder={
              mode === 'handle'
                ? 'Enter an Instagram handle (e.g. @localbuilder)'
                : 'Enter a niche or topic (e.g. home renovation)'
            }
            className="w-full pl-10 pr-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          id="ig-search-btn"
          onClick={searchInstagram}
          disabled={isLoading || !query.trim()}
          className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </div>

      {/* Quick Filters (keyword mode) */}
      {mode === 'keyword' && (
        <div className="flex gap-2 flex-wrap mb-4">
          {QUICK_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => handleQuickFilter(f)}
              className="px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Sort (when results exist) */}
      {results.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">Sort:</span>
          {SORT_OPTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                sortBy === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="flex gap-2 mt-3">
                  <div className="h-5 bg-muted rounded-full w-16" />
                  <div className="h-5 bg-muted rounded-full w-12" />
                  <div className="h-5 bg-muted rounded-full w-14" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results Grid */}
      {!isLoading && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(post => (
            <div key={post.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              {/* Thumbnail */}
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-video bg-muted group">
                {post.thumbnailUrl ? (
                  <img src={post.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">No thumbnail</div>
                )}
                <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ExternalLink className="w-6 h-6 text-foreground" />
                </div>
              </a>

              <div className="p-4 flex-1 flex flex-col">
                {/* Username + Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {post.ownerProfilePicUrl && (
                      <img src={post.ownerProfilePicUrl} alt="" className="w-6 h-6 rounded-full" />
                    )}
                    <span className="text-sm font-medium text-foreground">@{post.ownerUsername}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getBadgeStyle(post.outlierLabel)}`}>
                    {post.outlierScore}x · {post.outlierLabel}
                    {post.isBoosted && ' ⚠️'}
                  </span>
                </div>

                {/* Caption */}
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {post.caption || '(no caption)'}
                </p>

                {/* Stats */}
                <div className="flex gap-3 text-[10px] text-muted-foreground mb-4">
                  <span>👁 {formatNumber(post.views)}</span>
                  <span>❤️ {formatNumber(post.likes)}</span>
                  <span>💬 {formatNumber(post.comments)}</span>
                </div>

                {/* Actions */}
                <div className="mt-auto flex gap-2">
                  <button
                    onClick={() => remixContent(post)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Remix
                  </button>
                  <button
                    onClick={() => saveIdea(post)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-muted text-muted-foreground rounded-lg text-xs font-medium hover:text-foreground transition-colors"
                  >
                    <Bookmark className="w-3.5 h-3.5" /> Save
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty / Error State */}
      {!isLoading && results.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            {error ? <AlertTriangle className="w-7 h-7 text-muted-foreground" /> : <Search className="w-7 h-7 text-muted-foreground" />}
          </div>
          <p className="text-sm text-muted-foreground">
            {error || 'Search for an Instagram handle or keyword to discover top-performing content.'}
          </p>
          {!error && (
            <p className="text-xs text-muted-foreground mt-1">
              Results will appear here with outlier scores and remix options.
            </p>
          )}
        </div>
      )}

      {/* Remix Panel */}
      {remixOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-background/70" onClick={() => setRemixOpen(false)} />
          <div className="fixed right-0 top-0 z-50 w-full max-w-md h-screen bg-card border-l border-border overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">✨ Remix for My Business</h2>
              <button onClick={() => setRemixOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {remixPost && (
              <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
                <span>Original: @{remixPost.ownerUsername}</span>
                <span className={`px-2 py-0.5 rounded-full ${getBadgeStyle(remixPost.outlierLabel)}`}>
                  {remixPost.outlierScore}x
                </span>
              </div>
            )}

            {remixLoading && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Analysing content and writing your script...</p>
              </div>
            )}

            {remixError === "NO_BUSINESS_OVERVIEW" && (
              <div className="text-center py-12">
                <AlertTriangle className="w-10 h-10 text-orange-400 mx-auto mb-4" />
                <p className="text-sm font-semibold text-foreground mb-2">Add your Business Overview first</p>
                <p className="text-xs text-muted-foreground mb-6">
                  To get a personalised script, tell us about your business in Settings.
                </p>
                <button
                  onClick={() => navigate('/settings')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90"
                >
                  Go to Settings →
                </button>
              </div>
            )}

            {remixError && remixError !== "NO_BUSINESS_OVERVIEW" && (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground mb-4">Something went wrong generating your script.</p>
                <button
                  onClick={() => remixPost && remixContent(remixPost)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold"
                >
                  Try Again
                </button>
              </div>
            )}

            {!remixLoading && !remixError && remixScript && (
              <div>
                <div className="prose prose-invert prose-sm max-w-none text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                  {remixScript}
                </div>

                <div className="flex gap-2 mt-6">
                  <button onClick={copyScript} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-muted text-foreground rounded-lg text-xs font-semibold hover:bg-muted/80">
                    <Copy className="w-3.5 h-3.5" /> Copy Script
                  </button>
                  <button
                    onClick={() => remixPost && remixContent(remixPost)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-muted text-muted-foreground rounded-lg text-xs font-medium hover:text-foreground"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                  </button>
                  <button
                    onClick={() => { if (remixPost) saveIdea(remixPost, remixScript); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90"
                  >
                    <Bookmark className="w-3.5 h-3.5" /> Save
                  </button>
                </div>

                <p className="text-[10px] text-muted-foreground text-center mt-4">
                  AI-generated inspiration — make it your own.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
