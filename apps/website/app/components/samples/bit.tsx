import { Switch } from '../ui/switch';

export function Bit({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return <Switch checked={value} onCheckedChange={(v) => onChange(v)} />;
}

export function LabeledBit({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 w-11">
      <Bit value={value} onChange={onChange} />
      <span className="text-xs font-mono">{label}</span>
    </div>
  );
}
