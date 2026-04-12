import { useState } from 'react';
import { Search } from 'lucide-react';

const QUICK_FILTERS = ['Construction', 'Real Estate', 'Mortgage Brokers'];

const MODES = [
  { id: 'handle', label: 'Search by @Handle' },
  { id: 'keyword', label: 'Search by Niche / Keyword' },
] as const;

export default function InstagramSearch() {
  const [mode, setMode] = useState<'handle' | 'keyword'>('handle');
  const [query, setQuery] = useState('');

  return (
    <div>
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
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
            placeholder={
              mode === 'handle'
                ? 'Enter an Instagram handle (e.g. @localbuilder)'
                : 'Enter a niche or topic (e.g. home renovation, property investment)'
            }
            className="w-full pl-10 pr-4 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors">
          Search
        </button>
      </div>

      {/* Quick Filters (keyword mode) */}
      {mode === 'keyword' && (
        <div className="flex gap-2 flex-wrap mb-6">
          {QUICK_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setQuery(f.toLowerCase())}
              className="px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Search className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Search for an Instagram handle or keyword to discover top-performing content.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Results will appear here with outlier scores and remix options.
        </p>
      </div>
    </div>
  );
}
