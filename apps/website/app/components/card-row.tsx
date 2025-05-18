import type { PropsWithChildren, ReactNode } from 'react';

export function CardRow({
  children,
  label = '',
  buttons = null,
  ...divProps
}: PropsWithChildren<
  {
    label?: ReactNode;
    buttons?: ReactNode;
  } & React.HTMLAttributes<HTMLDivElement>
>) {
  return (
    <div
      {...divProps}
      className={`py-3 px-3 flex items-center gap-2 ${
        divProps.className || ''
      }`}
    >
      <div className={`flex flex-col items-start gap-2 grow shrink`}>
        <p className="font-mono text-xs text-muted-foreground [&_em]:font-bold [&_em]:dark:font-normal [&_em]:text-foreground [&_em]:not-italic">
          {typeof label === 'string' ? <em>{label}</em> : label}
          {label && ':'}
        </p>
        {children}
      </div>
      {buttons && <div className="grow-0 shrink-0">{buttons}</div>}
    </div>
  );
}
