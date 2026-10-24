import PageLayout from '@/components/PageLayout';
import { Card } from '@/components/ui/card';
import { PlayCircle, ExternalLink, BookOpen, FileSpreadsheet, FileText, Sparkles } from 'lucide-react';

import vaultQaMarch from '@/assets/vault-qa-march.jpg';
import vaultOrganic from '@/assets/vault-organic-content.jpg';
import vaultQaApril from '@/assets/vault-qa-april.jpg';
import vaultPaidAds from '@/assets/vault-paid-ads.jpg';
import vaultQaMay from '@/assets/vault-qa-may.jpg';
import vaultQaJune from '@/assets/vault-qa-june.jpg';
import vaultMomentumPaidAds from '@/assets/vault-momentum-paid-ads.jpg';
import vaultProfitByDesign from '@/assets/vault-profit-by-design.jpg';
import vaultMomentumJun23 from '@/assets/vault-momentum-jun23.jpg';
import vaultMomentumTeamBuilding from '@/assets/vault-momentum-team-building.jpg';
import vaultMomentumEditingTeamBuilding from '@/assets/vault-momentum-editing-team-building.jpg';
import vaultContentStrategy from '@/assets/vault-workshop-content-strategy.jpg';
import vaultPaidAdPowerup from '@/assets/vault-paid-ad-powerup.jpg';
import vaultOrganicContentSnowball from '@/assets/vault-organic-content-snowball.jpg';
import vaultSpringPlanning from '@/assets/vault-spring-planning.jpg';
import vaultDeliveryMagic from '@/assets/vault-delivery-magic.jpg';
import hotSeatElijahThumb from '@/assets/hot-seat-elijah-thumb.png';
import payToPlayThumb from '@/assets/pay-to-play-thumb.png';
import vaultTheSystem from '@/assets/the-system-thumb.png';
import vaultAdMetrics101 from '@/assets/ad-metrics-thumb.png';

import { VAULT_ITEMS, type VaultItem } from '@/data/vault';

const THUMBS: Record<string, string> = {
  vaultQaMarch,
  vaultOrganic,
  vaultQaApril,
  vaultPaidAds,
  vaultQaMay,
  vaultQaJune,
  vaultMomentumPaidAds,
  vaultProfitByDesign,
  vaultMomentumJun23,
  vaultMomentumTeamBuilding,
  vaultMomentumEditingTeamBuilding,
  vaultContentStrategy,
  vaultPaidAdPowerup,
  vaultOrganicContentSnowball,
  vaultSpringPlanning,
  vaultDeliveryMagic,
  hotSeatElijahThumb,
  payToPlayThumb,
  vaultTheSystem,
  vaultAdMetrics101,
};

const categoryStyles: Record<VaultItem['category'], string> = {
  'Q&A': 'bg-primary/15 text-primary border-primary/30',
  Workshop: 'bg-warning/15 text-warning border-warning/30',
  Lesson: 'bg-success/15 text-success border-success/30',
  'Momentum Call': 'bg-accent/15 text-accent-foreground border-accent/40',
  'Hot Seat': 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function Vault() {
  return (
    <PageLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold italic text-foreground">Vault</h1>
        <p className="text-muted-foreground mt-1">Recordings of momentum calls, Q&As and workshops — watch any time.</p>
      </div>
      <p className="text-[11px] italic text-muted-foreground/70 mb-3">
        Alee made me put these in chronological order haha
      </p>

      {/* One timeline, newest first. Bars on desktop, centred tiles on mobile. */}
      <div className="flex flex-col gap-4">
         {[...VAULT_ITEMS]
           .sort((a, b) => (b.sortDate ?? '9999').localeCompare(a.sortDate ?? '9999'))
          .map((item) => (
            <Card
               key={item.title}
              className="w-full max-w-md mx-auto md:max-w-none overflow-hidden hover:border-primary/50 hover:shadow-md hover:shadow-primary/10 transition-all flex flex-col md:flex-row group"
            >
               <div className="block md:w-72 lg:w-80 shrink-0">
                <div className="relative aspect-video md:h-full overflow-hidden bg-muted">
                   {item.url ? (
                     <a href={item.url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                       <img src={THUMBS[item.thumb]} alt={item.title} width={1024} height={576} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                       <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <PlayCircle className="w-12 h-12 text-white drop-shadow-lg" />
                       </div>
                     </a>
                   ) : (
                     <img src={THUMBS[item.thumb]} alt={item.title} width={1024} height={576} loading="lazy" className="w-full h-full object-cover" />
                   )}
                </div>
               </div>

              <div className="p-5 flex flex-col gap-2 flex-1 min-w-0 md:justify-center">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${categoryStyles[item.category]}`}
                  >
                    {item.category}
                  </span>
                  {item.date && (
                    <span className="text-xs text-muted-foreground">{item.date}</span>
                  )}
                </div>
                <h3 className="font-semibold text-foreground leading-snug md:text-lg">{item.title}</h3>

                <div className="pt-1 flex flex-col md:flex-row md:flex-wrap gap-x-5 gap-y-1.5">
                   {item.url && (
                     <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                       <ExternalLink className="w-3 h-3" />
                       {item.url.includes('drive.google.com') ? 'Watch recording' : 'Watch on Fathom'}
                     </a>
                   )}
                  {item.workbookUrl && (
                    <a href={item.workbookUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <BookOpen className="w-3 h-3" />
                      {item.workbookLabel ?? 'Workbook'}
                    </a>
                  )}
                  {item.transcriptUrl && (
                    <a href={item.transcriptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <FileText className="w-3 h-3" />
                      {item.transcriptLabel ?? 'Transcript & summary'}
                    </a>
                  )}
                  {item.gptUrl && (
                    <a href={item.gptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <Sparkles className="w-3 h-3" />
                      {item.gptLabel ?? 'Custom GPT'}
                    </a>
                  )}
                  {item.templates?.map((tpl) => (
                    <a key={tpl.url} href={tpl.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <FileSpreadsheet className="w-3 h-3" />
                      {tpl.label}
                    </a>
                  ))}
                </div>
              </div>
            </Card>
          ))}
      </div>
    </PageLayout>
  );
}

