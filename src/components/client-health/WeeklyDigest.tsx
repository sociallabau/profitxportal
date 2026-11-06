import { useState } from 'react';
import { Copy, Newspaper } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

/**
 * The Monday list as plain text, for pasting into WhatsApp. The same text goes
 * out automatically each Monday if a digest webhook is set up.
 */
export default function WeeklyDigest() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setOpen(true);
    setLoading(true);
    setText('');
    try {
      const { data, error } = await supabase.functions.invoke('weekly-digest', { body: {} });
      if (error || !data?.text) throw new Error(data?.error ?? 'Could not build the digest');
      setText(data.text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not build the digest');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Digest copied');
    } catch {
      toast.error('Could not copy — select the text to copy it');
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={load}>
        <Newspaper /> Weekly digest
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>This week's list</DialogTitle>
            <DialogDescription>Who to talk to and which quarterly calls are due. Sent to you automatically each Monday once a digest webhook is set.</DialogDescription>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-muted-foreground">Building the list…</p>
          ) : (
            <>
              <textarea readOnly value={text} rows={14} aria-label="Weekly digest" className="w-full rounded-md border border-input bg-background p-3 text-sm leading-relaxed" />
              <Button type="button" onClick={copy}><Copy /> Copy</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
