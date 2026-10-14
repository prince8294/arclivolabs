import type { ReactNode } from 'react';

export interface DetailItem {
  label: string;
  value: ReactNode;
}

/**
 * Simple definition list for detail pages: label on the left, value on
 * the right, stacked in two columns on wide screens.
 */
export default function DetailList({ items }: { items: DetailItem[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-1 truncate text-sm text-foreground" title={typeof item.value === 'string' ? item.value : undefined}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
