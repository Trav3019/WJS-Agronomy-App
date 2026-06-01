import type { ReactNode } from 'react';
import type { PageAccessMode } from '../access';

interface Props {
  mode: PageAccessMode;
  children: ReactNode;
}

export default function AccessModeShell({ mode, children }: Props) {
  if (mode !== 'view') {
    return <>{children}</>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
        You have view-only access to this page. Editing actions are disabled.
      </div>
      <div className="read-only-page">{children}</div>
    </div>
  );
}