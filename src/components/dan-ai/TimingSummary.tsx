export interface DanTiming {
  total_ms: number;
  steps: Record<string, number>;
  calls: { stage: string; model: string; ms: number; input_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number; output_tokens: number; retry: boolean; error?: string }[];
}

export default function TimingSummary({ timing }: { timing: DanTiming }) {
  return <details>
    <summary className="cursor-pointer"><b>Timing:</b> {(timing.total_ms / 1000).toFixed(1)}s</summary>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
      {Object.entries(timing.steps).map(([stage, ms]) => <div key={stage} className="contents"><dt className="capitalize">{stage.replace(/_/g, ' ')}</dt><dd>{(ms / 1000).toFixed(2)}s</dd></div>)}
    </dl>
    <div className="mt-2 space-y-2">
      {timing.calls.map((call, i) => <div key={i}>
        <p><b>{call.stage}</b> · {call.model} · {(call.ms / 1000).toFixed(2)}s{call.retry ? ' · retry' : ''}</p>
        <p>Input: {call.input_tokens.toLocaleString()} · Cache read: {call.cache_read_input_tokens.toLocaleString()} · Cache write: {call.cache_creation_input_tokens.toLocaleString()} · Output: {call.output_tokens.toLocaleString()}</p>
        {call.error && <p>{call.error}</p>}
      </div>)}
    </div>
  </details>;
}