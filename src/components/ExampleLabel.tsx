export default function ExampleLabel({ show = true }: { show?: boolean }) {
  return show ? <em className="example-label text-[10px] font-medium normal-case whitespace-nowrap">example data only</em> : null;
}