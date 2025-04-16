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
