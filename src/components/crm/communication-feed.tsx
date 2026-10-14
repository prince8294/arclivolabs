import Link from 'next/link';

import Pagination from '@/components/admin/pagination';
import CommunicationItem from '@/components/crm/communication-item';
import EmptyState from '@/components/ui/empty-state';
import {
  COMMUNICATION_TYPE_FILTERS,
  COMMUNICATION_TYPE_LABELS,
} from '@/lib/constants/enums';
import type {
  CommunicationFeedItem,
  CommunicationFeedParams,
} from '@/lib/queries/communications';

export default function CommunicationFeed({
  items,
  total,
  params,
  baseUrl,
  leadBasePath,
}: {
  items: CommunicationFeedItem[];
  total: number;
  params: CommunicationFeedParams;
  baseUrl: string;
  leadBasePath?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <form className="flex flex-wrap gap-3 rounded-lg border border-border bg-card p-4">
        <input
          name="search"
          defaultValue={params.search}
          placeholder="Search lead, code or company"
          className="h-10 min-w-60 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          name="type"
          defaultValue={params.type}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All activity types</option>
          {COMMUNICATION_TYPE_FILTERS.map((type) => (
            <option key={type} value={type}>
              {COMMUNICATION_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Apply
        </button>
        {(params.search || params.type) && (
          <Link
            href={baseUrl}
            className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm font-medium"
          >
            Clear
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="No communication found"
          description="No timeline entries match the selected filters."
        />
      ) : (
        <ol className="flex flex-col rounded-lg border border-border bg-card p-5">
          {items.map((item) => (
            <li key={item.id} className="border-b border-border py-4 first:pt-0 last:border-0 last:pb-0">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {leadBasePath ? (
                  <Link
                    href={`${leadBasePath}/${item.leadId}?tab=communication`}
                    className="font-mono font-semibold text-primary hover:underline"
                  >
                    {item.leadCode}
                  </Link>
                ) : (
                  <span className="font-mono font-semibold">{item.leadCode}</span>
                )}
                <span>{item.leadName}</span>
                {item.companyName && <span>· {item.companyName}</span>}
              </div>
              <ol>
                <CommunicationItem item={item} />
              </ol>
            </li>
          ))}
        </ol>
      )}

      <Pagination
        baseUrl={baseUrl}
        page={params.page}
        limit={params.limit}
        total={total}
        filters={{ search: params.search, type: params.type }}
      />
    </div>
  );
}
