/**
 * Pure, deterministic round-robin distribution algorithm.
 *
 * No randomness, no external state — given N leads and M assignees,
 * each lead i goes to assignee i % M. The order of `assigneeIds`
 * determines the sequence.
 *
 * Client-safe (no server imports) so it can be used in the preview
 * panel and the server action without divergence.
 */

export interface RoundRobinAllocation {
  userId: string;
  count: number;
}

/**
 * Generate the assignment array for N leads across the given assignees.
 * Returns an array of length `totalLeads` where each entry is the
 * assignee id that lead gets.
 */
export function distributeRoundRobin(
  totalLeads: number,
  assigneeIds: string[]
): string[] {
  if (totalLeads <= 0) return [];
  if (assigneeIds.length === 0) return new Array(totalLeads).fill('');

  const assignments = new Array<string>(totalLeads);
  for (let i = 0; i < totalLeads; i++) {
    assignments[i] = assigneeIds[i % assigneeIds.length];
  }
  return assignments;
}

/**
 * Summarise the allocation without building the full array.
 * Returns per-user counts — used by the preview panel.
 */
export function summariseRoundRobin(
  totalLeads: number,
  assigneeIds: string[]
): RoundRobinAllocation[] {
  if (totalLeads <= 0 || assigneeIds.length === 0) {
    return assigneeIds.map((id) => ({ userId: id, count: 0 }));
  }

  const base = Math.floor(totalLeads / assigneeIds.length);
  const remainder = totalLeads % assigneeIds.length;

  return assigneeIds.map((id, index) => ({
    userId: id,
    count: base + (index < remainder ? 1 : 0),
  }));
}

/**
 * Single-user allocation (mode = SINGLE_USER).
 */
export function summariseSingleUser(
  totalLeads: number,
  assigneeId: string
): RoundRobinAllocation[] {
  return [{ userId: assigneeId, count: totalLeads }];
}

/**
 * Unassigned allocation (mode = UNASSIGNED).
 */
export function summariseUnassigned(
  totalLeads: number
): RoundRobinAllocation[] {
  return [{ userId: '', count: totalLeads }];
}