import type { ReactNode } from 'react';

export interface ExplorerLayoutProps {
  children: ReactNode;
}

export function ExplorerLayout({ children }: ExplorerLayoutProps) {
  return (
    <div className="live-model-explorer min-h-screen p-8">{children}</div>
  );
}
