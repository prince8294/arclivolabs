import {
  ACTIVE_PROJECT_STATUSES,
  MILESTONE_DEADLINE_STATES,
  MILESTONE_DUE_SOON_DAYS,
  PROJECT_MILESTONE_STATUSES,
  PROJECT_STATUSES,
  PROGRESS_COUNTED_MILESTONE_STATUSES,
  type MilestoneDeadlineState,
} from '@/lib/constants/enums';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The minimum shape needed to derive progress - keeps this testable. */
export interface ProgressableMilestone {
  status: string;
  progressPercentage: number;
}

/**
 * Project progress = rounded average of counted milestone progress (§29).
 *
 * Rules:
 *  - CANCELLED milestones are excluded entirely.
 *  - A COMPLETED milestone always contributes 100 regardless of its stored
 *    number, so an approved milestone can never drag progress down.
 *  - No milestones (or only cancelled ones) => 0%.
 *
 * Progress reaching 100% NEVER implies the project is complete: completion is
 * an explicit Admin decision, never a side effect of this calculation.
 */
export function calculateProjectProgress(
  milestones: readonly ProgressableMilestone[]
): number {
  const counted = milestones.filter((milestone) =>
    (PROGRESS_COUNTED_MILESTONE_STATUSES as readonly string[]).includes(milestone.status)
  );

  if (counted.length === 0) return 0;

  const total = counted.reduce((sum, milestone) => {
    if (milestone.status === PROJECT_MILESTONE_STATUSES.COMPLETED) return sum + 100;
    const clamped = Math.min(100, Math.max(0, Number(milestone.progressPercentage) || 0));
    return sum + clamped;
  }, 0);

  return Math.round(total / counted.length);
}

/**
 * Deadline badge for a milestone, derived from status + dueDate + today (§47).
 * Computed rather than stored so a duplicate, contradictory status field
 * cannot exist.
 */
export function deriveMilestoneDeadlineState(
  input: {
    status: string;
    dueDate?: Date | string | null;
  },
  now: Date = new Date()
): MilestoneDeadlineState {
  if (input.status === PROJECT_MILESTONE_STATUSES.COMPLETED) {
    return MILESTONE_DEADLINE_STATES.COMPLETED;
  }
  if (input.status === PROJECT_MILESTONE_STATUSES.BLOCKED) {
    return MILESTONE_DEADLINE_STATES.BLOCKED;
  }
  if (!input.dueDate) return MILESTONE_DEADLINE_STATES.NO_DATE;

  const due = toDate(input.dueDate);
  if (!due) return MILESTONE_DEADLINE_STATES.NO_DATE;

  const daysUntilDue = Math.round(
    (startOfDay(due).getTime() - startOfDay(now).getTime()) / MS_PER_DAY
  );

  if (daysUntilDue < 0) return MILESTONE_DEADLINE_STATES.OVERDUE;
  if (daysUntilDue <= MILESTONE_DUE_SOON_DAYS) return MILESTONE_DEADLINE_STATES.DUE_SOON;
  return MILESTONE_DEADLINE_STATES.ON_TIME;
}

/**
 * Overdue is derived, never stored (§46). A COMPLETED or CANCELLED project is
 * never overdue regardless of its deadline.
 */
export function deriveProjectOverdue(
  input: { expectedEndDate?: Date | string | null; status: string },
  now: Date = new Date()
): { isOverdue: boolean; daysOverdue: number } {
  if (!input.expectedEndDate) return { isOverdue: false, daysOverdue: 0 };
  if (
    input.status === PROJECT_STATUSES.COMPLETED ||
    input.status === PROJECT_STATUSES.CANCELLED
  ) {
    return { isOverdue: false, daysOverdue: 0 };
  }

  const end = toDate(input.expectedEndDate);
  if (!end) return { isOverdue: false, daysOverdue: 0 };

  const daysOverdue = Math.floor(
    (startOfDay(now).getTime() - startOfDay(end).getTime()) / MS_PER_DAY
  );

  return daysOverdue > 0
    ? { isOverdue: true, daysOverdue }
    : { isOverdue: false, daysOverdue: 0 };
}

export function isActiveProjectStatus(status: string): boolean {
  return (ACTIVE_PROJECT_STATUSES as readonly string[]).includes(status);
}

/** Whole days until a date; negative when already past, null when unset. */
export function daysUntil(
  date: Date | string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!date) return null;
  const target = toDate(date);
  if (!target) return null;
  return Math.round(
    (startOfDay(target).getTime() - startOfDay(now).getTime()) / MS_PER_DAY
  );
}

/** Exclusive upper bound for the "Due This Week" list preset (§35). */
export function dueThisWeekUpperBound(now: Date = new Date()): Date {
  const end = startOfDay(now);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfDay(value: Date): Date {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toDate(value: Date | string): Date | null {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
