import Link from 'next/link';
import { MessageSquarePlus } from 'lucide-react';

import Pagination from '@/components/admin/pagination';
import CommunicationDialog from '@/components/crm/communication-dialog';
import CommunicationItem from '@/components/crm/communication-item';
import EmptyState from '@/components/ui/empty-state';
import {
  COMMUNICATION_SORT_LABELS,
  COMMUNICATION_SORTS,
  COMMUNICATION_TYPE_FILTERS,
  COMMUNICATION_TYPE_LABELS,
  COMMUNICATION_TYPES,
} from '@/lib/constants/enums';
import {
  COMMUNICATION_PAGE_SIZES,
  parseCommunicationTimelineParams,
  type CommunicationTimelineParams,
} from '@/lib/queries/communications';
import { cn } from '@/lib/utils/cn';

export interface CommunicationTimelineProps {
  leadId: string;
  leadCode: string;
  leadName: string;
  /** Raw URL search params of the page. */
  searchParams: Record<string, string | string[] | undefined>;
  /**
   * Restrict the timeline to a preset type (used by the
   * Follow-ups tab). The user can still widen it afterwards.
   */
  presetType?: string;
  /** Hide the "Log Communication" button (read-only contexts). */
  showLogAction?: boolean;
  /** Fetched by the page, passed in so the header and list share
   * one query. */
  timeline: import('@/lib/queries/communications').LeadCommunicationTimeline;
}

const chipClasses =
  'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Lead communication timeline.
 *
 * Server-rendered with server-backed pagination (?page=, ?limit=)
 * and type/sort filters carried in the URL, so the list never
 * loads the whole collection and every filter state is shareable.
 * Newest first by default.
 *
 * The page fetches the data (it owns the lead and scope) and
 * passes it in, so the timeline itself stays a pure view.
 */
export default function CommunicationTimeline({
  leadId,
  leadCode,
  leadName,
  searchParams,
  presetType,
  showLogAction = true,
  timeline,
}: CommunicationTimelineProps) {
  const params: CommunicationTimelineParams =
    parseCommunicationTimelineParams({
      ...searchParams,
      ...(presetType ? { type: presetType } : {}),
    });

  /** URL for a filter change, preserving the other filters. */
  const href = (overrides: Record<string, string>) => {
    const query = new URLSearchParams();
    const merged = {
      type: params.type,
      sort: params.sort,
      limit: String(params.limit),
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) {
        query.set(key, value);
      }
    }
    const queryString = query.toString();
    return queryString ? `?${queryString}` : '';
  };

  const activeType = presetType ?? params.type;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav
          aria-label="Filter by communication type"
          className="flex flex-wrap items-center gap-1.5"
        >
          <Link
            href={href({ type: '' })}
            aria-current={activeType === '' ? 'page' : undefined}
            className={cn(
              chipClasses,
              activeType === ''
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-muted-foreground hover:bg-accent'
            )}
          >
            All
          </Link>
          {COMMUNICATION_TYPE_FILTERS.map((type) => (
            <Link
              key={type}
              href={href({ type })}
              aria-current={activeType === type ? 'page' : undefined}
              className={cn(
                chipClasses,
                activeType === type
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-muted-foreground hover:bg-accent'
              )}
            >
              {COMMUNICATION_TYPE_LABELS[type]}
            </Link>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-1.5">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="sr-only">Sort timeline</span>
            <select
              aria-label="Sort timeline"
              onChange={(event) => {
                window.location.href = href({ sort: event.target.value });
              }}
              defaultValue={params.sort}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Object.values(COMMUNICATION_SORTS).map((sort) => (
                <option key={sort} value={sort}>
                  {COMMUNICATION_SORT_LABELS[sort]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="sr-only">Rows per page</span>
            <select
              aria-label="Rows per page"
              onChange={(event) => {
                window.location.href = href({ limit: event.target.value });
              }}
              defaultValue={String(params.limit)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {COMMUNICATION_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </label>
          {showLogAction && (
            <CommunicationDialog
              leadId={leadId}
              leadCode={leadCode}
              leadName={leadName}
              initialType={
                activeType === COMMUNICATION_TYPES.CALL ||
                activeType === COMMUNICATION_TYPES.WHATSAPP ||
                activeType === COMMUNICATION_TYPES.EMAIL ||
                activeType === COMMUNICATION_TYPES.INTERNAL_NOTE
                  ? activeType
                  : COMMUNICATION_TYPES.CALL
              }
            />
          )}
        </div>
      </div>

      {timeline.items.length === 0 ? (
        <EmptyState
          title="No communication has been recorded for this lead yet."
          description="Log the first call, WhatsApp message, email or internal note to start the timeline."
          icon={
            <MessageSquarePlus className="h-8 w-8" aria-hidden="true" />
          }
          action={
            showLogAction ? (
              <CommunicationDialog
                leadId={leadId}
                leadCode={leadCode}
                leadName={leadName}
              />
            ) : undefined
          }
        />
      ) : (
        <>
          <ol className="flex flex-col">
            {timeline.items.map((item) => (
              <CommunicationItem key={item.id} item={item} />
            ))}
          </ol>
          <Pagination
            baseUrl=""
            page={timeline.page}
            limit={timeline.limit}
            total={timeline.total}
            filters={{
              type: activeType,
              sort: params.sort,
              limit: String(params.limit),
            }}
          />
        </>
      )}
    </div>
  );
}
