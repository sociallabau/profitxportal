import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, ExternalLink, Sparkles, Bookmark, AlertTriangle, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';

interface InstagramPost {
  id: string;
  shortCode: string;
  thumbnail: string;
  videoUrl: string | null;
  postUrl: string;
  caption: string;
  likes: number;
  comments: number;
  views: number;
  timestamp: string;
  ownerUsername: string;
  type: string;
  outlierScore: number;
}

// Keyword/niche search removed — handle-only.

const formatNumber = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

const getOutlierBadge = (score: number) => {
  if (score >= 3) return 'bg-green-500 text-white';
  if (score >= 1.5) return 'bg-amber-400 text-black';
  return 'bg-muted text-muted-foreground';
};

const proxyImage = (url: string): string => {
  if (!url) return '/placeholder.svg';
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image`;
  return `${base}?url=${encodeURIComponent(url)}`;
};

export default function InstagramSearch() {
  const { user } = useRequireAuth();
  const navigate = useNavigate();
  const mode = 'handle' as const;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InstagramPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline remix state per post
  const [remixingId, setRemixingId] = useState<string | null>(null);
  const [remixResults, setRemixResults] = useState<Record<string, string>>({});
  const [remixSummaries, setRemixSummaries] = useState<Record<string, string>>({});
  const [remixErrors, setRemixErrors] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSummaryId, setShowSummaryId] = useState<string | null>(null);

  // Fake-progress bar while remixing (gives perceived progress for the 5-15s call)
  const [remixProgress, setRemixProgress] = useState(0);
  const [remixStage, setRemixStage] = useState<string>('');
  const progressTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
    };
  }, []);

  const searchInstagram = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setResults([]);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("fetch-instagram-content", {
        body: { mode, query: query.trim(), limit: 20 },
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
      const posts = data?.posts || [];
      setResults(posts);
      if (posts.length === 0) {
        setError("No results found. Try a different handle or keyword.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // quick filters removed with keyword mode

  const remixContent = async (post: InstagramPost, format: 'reel' | 'carousel') => {
    setRemixingId(post.id);
    setExpandedId(post.id);
    setRemixErrors(prev => ({ ...prev, [post.id]: '' }));

    try {
      const { data, error: fnError } = await supabase.functions.invoke("remix-content", {
        body: {
          postCaption: post.caption,
          postUrl: post.postUrl,
          videoUrl: post.videoUrl,
          platform: 'instagram',
          format,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) {
        if (data.error === 'Unauthorized') throw new Error('Please log in again.');
        throw new Error(data.error);
      }
      setRemixResults(prev => ({ ...prev, [post.id]: data?.remix || '' }));
    } catch (err: any) {
      setRemixErrors(prev => ({ ...prev, [post.id]: err.message || 'Something went wrong.' }));
    } finally {
      setRemixingId(null);
    }
  };

  const saveIdea = async (post: InstagramPost, script?: string) => {
    if (!user) return;
    const { error } = await supabase.from("saved_ideas").insert({
      user_id: user.id,
      source_handle: post.ownerUsername,
      source_url: post.postUrl,
      source_thumbnail_url: post.thumbnail,
      source_caption: post.caption,
      views: post.views,
      likes: post.likes,
      outlier_score: post.outlierScore,
      outlier_label: post.outlierScore >= 3 ? 'High' : post.outlierScore >= 1.5 ? 'Medium' : 'Low',
      ai_script: script || null,
    });
    if (error) {
      toast.error("Failed to save idea");
    } else {
      toast.success("Idea saved!");
    }
  };

  return (
    <div>
      {/* Search Bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchInstagram()}
            placeholder="Enter an Instagram handle (e.g. @localbuilder)"
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
              <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="relative block aspect-video bg-muted group">
                {post.thumbnail ? (
                  <img
                    src={proxyImage(post.thumbnail)}
                    alt={post.caption?.substring(0, 50)}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                  />
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
                  <span className="text-sm font-medium text-foreground">@{post.ownerUsername}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getOutlierBadge(post.outlierScore)}`}>
                    {post.outlierScore}x
                  </span>
                </div>

                {/* Caption */}
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {post.caption || '(no caption)'}
                </p>

                {/* Stats */}
                <div className="flex gap-3 text-[10px] text-muted-foreground mb-4">
                  {post.views > 0 && <span>👁 {formatNumber(post.views)}</span>}
                  <span>❤️ {formatNumber(post.likes)}</span>
                  <span>💬 {formatNumber(post.comments)}</span>
                </div>

                {/* Actions */}
                <div className="mt-auto space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => remixContent(post, 'reel')}
                      disabled={remixingId === post.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {remixingId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Remix as Reel
                    </button>
                    <button
                      onClick={() => remixContent(post, 'carousel')}
                      disabled={remixingId === post.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/80 text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/70 transition-colors disabled:opacity-50"
                    >
                      {remixingId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Remix as Carousel
                    </button>
                  </div>
                  <button
                    onClick={() => saveIdea(post, remixResults[post.id])}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-muted text-muted-foreground rounded-lg text-xs font-medium hover:text-foreground transition-colors"
                  >
                    <Bookmark className="w-3.5 h-3.5" /> Save
                  </button>
                </div>

                {/* Inline Remix Result */}
                {(remixResults[post.id] || remixErrors[post.id]) && (
                  <div className="mt-3 border-t border-border pt-3">
                    <button
                      onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
                      className="flex items-center gap-1 text-xs font-medium text-primary mb-2"
                    >
                      {expandedId === post.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      Remix Ideas
                    </button>
                    {expandedId === post.id && (
                      <>
                        {remixErrors[post.id] ? (
                          <p className="text-xs text-destructive">{remixErrors[post.id]}</p>
                        ) : (
                          <p className="text-xs text-foreground/80 whitespace-pre-wrap">{remixResults[post.id]}</p>
                        )}
                      </>
                    )}
                  </div>
                )}
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
    </div>
  );
}
