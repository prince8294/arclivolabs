import Link from 'next/link';

import { LEAD_STATUSES } from '@/lib/constants/enums';
import type { LeadStatus } from '@/lib/constants/enums';
import type { PipelineStage } from '@/lib/constants/leads';
import { cn } from '@/lib/utils/cn';

export interface PipelineBoardProps {
  stages: PipelineStage[];
  /** Route the stage links point at (with the status filter appended). */
  basePath: string;
  /** Terminal stages are reported separately from the funnel. */
  lostCount?: number;
}

const STAGE_ACCENTS: Record<LeadStatus, string> = {
  [LEAD_STATUSES.NEW]: 'bg-info',
  [LEAD_STATUSES.CONTACTED]: 'bg-primary',
  [LEAD_STATUSES.INTERESTED]: 'bg-primary',
  [LEAD_STATUSES.MEETING]: 'bg-warning',
  [LEAD_STATUSES.PROPOSAL_SENT]: 'bg-warning',
  [LEAD_STATUSES.NEGOTIATION]: 'bg-warning',
  [LEAD_STATUSES.WON]: 'bg-success',
  [LEAD_STATUSES.LOST]: 'bg-destructive',
};

/**
 * Read-only pipeline summary: one card per stage with the real count,
 * linking straight into the filtered lead list.
 *
 * Intentionally a static board — drag-and-drop Kanban editing is a later
 * CRM UX phase, and every change in Part 5 goes through a validated
 * server action.
 */
export default function PipelineBoard({
  stages,
  basePath,
  lostCount,
}: PipelineBoardProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {stages.map((stage) => (
        <Link
          key={stage.status}
          href={`${basePath}?status=${stage.status}`}
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                STAGE_ACCENTS[stage.status]
              )}
              aria-hidden="true"
            />
            {stage.label}
          </span>
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            {stage.count}
          </span>
          <span className="text-xs text-muted-foreground">
            {stage.count === 1 ? 'lead' : 'leads'}
          </span>
        </Link>
      ))}

      {typeof lostCount === 'number' && (
        <Link
          href={`${basePath}?status=${LEAD_STATUSES.LOST}`}
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                STAGE_ACCENTS[LEAD_STATUSES.LOST]
              )}
              aria-hidden="true"
            />
            Lost
          </span>
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            {lostCount}
          </span>
          <span className="text-xs text-muted-foreground">
            {lostCount === 1 ? 'lead' : 'leads'}
          </span>
        </Link>
      )}
    </div>
  );
}