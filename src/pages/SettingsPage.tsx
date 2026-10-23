import PageLayout from '@/components/PageLayout';
import ContextRoom from '@/components/ContextRoom';
import { useRequireAuth } from '@/hooks/useAuth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { LockKeyhole } from 'lucide-react';

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  if (loading || !user) return null;
  return <PageLayout>
    <div className="max-w-4xl">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Context Room</h1>
        <p className="text-sm text-muted-foreground">The more Dan AI knows about your business, the more specific its answers. Keep this current.</p>
        <p className="text-xs text-muted-foreground flex items-center gap-2"><LockKeyhole className="w-3.5 h-3.5" />Private to you, Dan and Emily.</p>
      </div>
      <ContextRoom key={user.id} userId={user.id} />
      <Accordion type="single" collapsible className="mt-5">
        <AccordionItem value="notifications" className="border border-border bg-card rounded-lg px-5">
          <AccordionTrigger className="text-sm hover:no-underline">Notifications</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {['Weekly win submission reminder', 'Monthly data submission reminder'].map(label => <label key={label} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{label}</span><Checkbox defaultChecked /></label>)}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </PageLayout>;
}
