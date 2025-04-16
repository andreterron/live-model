export function Bit({
  value,
  onClick,
}: {
  value: boolean;
  onClick: React.MouseEventHandler;
}) {
  return (
    <div
      className={`w-8 h-8 rounded-full border-2 border-current cursor-pointer
    flex items-center justify-center font-mono select-none
    ${value ? 'bg-current/30' : 'bg-transparent'}`}
      onClick={onClick}
    >
      <span className={`${value ? 'text-current/80' : 'text-current/50'}`}>
        {value === true ? '1' : '0'}
      </span>
    </div>
  );
}

export function LabeledBit({
  value,
  onClick,
  label,
}: {
  value: boolean;
  onClick: React.MouseEventHandler;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 w-11">
      <Bit value={value} onClick={onClick} />
      <span className="text-xs font-mono">{label}</span>
    </div>
  );
}
