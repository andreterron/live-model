import type { PropsWithChildren, ReactNode } from 'react';

export function CardRow({
  children,
  label = '',
}: PropsWithChildren<{ label?: ReactNode }>) {
  return (
    <div className="py-3 px-3 flex flex-col items-start gap-2">
      <p className="font-mono text-xs text-muted-foreground [&_em]:font-bold [&_em]:dark:font-normal [&_em]:text-foreground [&_em]:not-italic">
        {label}
        {label && ':'}
      </p>
      <div>{children}</div>
    </div>
  );
}
