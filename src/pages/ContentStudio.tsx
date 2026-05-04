import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '@/components/PageLayout';
import { useRequireAuth } from '@/hooks/useAuth';
import ContentCalendar from '@/components/content-studio/ContentCalendar';
import InstagramSearch from '@/components/content-studio/InstagramSearch';
import SavedIdeas from '@/components/content-studio/SavedIdeas';
import { ContentGeneratorView } from './ContentGenerator';

const TABS = ['Content Calendar', 'Instagram', 'Saved Ideas', 'Content Generator'] as const;

export default function ContentStudio() {
  const { loading } = useRequireAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Content Calendar');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && (TABS as readonly string[]).includes(t)) {
      setActiveTab(t as typeof TABS[number]);
    }
  }, [searchParams]);

  if (loading) return null;

  return (
    <PageLayout>
      <h1 className="text-2xl font-bold text-foreground mb-1">Content Studio</h1>
      <p className="text-sm text-muted-foreground mb-6">Plan, research, and remix content for your business.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Content Calendar' && <ContentCalendar />}
      {activeTab === 'Instagram' && <InstagramSearch />}
      {activeTab === 'Saved Ideas' && <SavedIdeas />}
      {activeTab === 'Content Generator' && <ContentGeneratorView hideHeader />}
    </PageLayout>
  );
}
