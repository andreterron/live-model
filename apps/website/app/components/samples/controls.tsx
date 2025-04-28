import { cn } from '../../lib/utils';
import { Switch } from '../ui/switch';

export function BooleanControl({
  value,
  onChange,
}: {
  value: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="font-mono flex items-center text-xs gap-2">
      <Switch checked={value} onCheckedChange={onChange} />
      <span className="relative inline-flex items-center h-[1ch] w-[5ch]">
        <span
          className={cn(
            'absolute left-0 transition-all text-foreground',
            value ? 'opacity-100' : 'opacity-0 -translate-x-2'
          )}
        >
          true
        </span>
        <span
          className={cn(
            'absolute left-0 transition-all text-muted-foreground',
            !value ? 'opacity-100' : 'opacity-0 translate-x-2'
          )}
        >
          false
        </span>
      </span>
    </div>
  );
}
