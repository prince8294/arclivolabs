import FollowUpBadge from '@/components/crm/follow-up-badge';
import LeadRowActions from '@/components/crm/lead-row-actions';
import LeadStatusBadge from '@/components/crm/lead-status-badge';
import {
  LeadRowCheckbox,
  LeadSelectAllCheckbox,
} from '@/components/crm/lead-selection';
import {
  LEAD_SOURCE_LABELS,
  type LeadSource,
  type LeadStatus,
} from '@/lib/constants/enums';
import {
  formatDate,
  formatMoney,
} from '@/lib/utils/format';
import type { AssignableMarketingUser } from '@/lib/constants/leads';
import type { LeadListItem } from '@/lib/queries/leads';

export interface LeadTableProps {
  items: LeadListItem[];
  /** Route prefix for the detail/edit links. */
  basePath: string;
  variant: 'admin' | 'marketing';
  /** Single render-time instant shared by every follow-up badge. */
  now: Date;
  /** Admin-only assignee options for the assign action. */
  marketingUsers?: AssignableMarketingUser[];
  /** Admin-only: render the selection checkbox column. */
  selectable?: boolean;
}

/**
 * Lead data table.
 *
 * Deliberately not every lead field: the admin view shows code, contact,
 * company, phone/email, service, source, owner, status, follow-up and
 * created date; the marketing view drops owner, source and budget.
 * Horizontally scrollable on small screens rather than allowed to break
 * the viewport.
 */
export default function LeadTable({
  items,
  basePath,
  variant,
  now,
  marketingUsers = [],
  selectable = false,
}: LeadTableProps) {
  const isAdmin = variant === 'admin';

  function ownerLabel(item: LeadListItem): string | null {
    if (!item.assignedToName) {
      return null;
    }
    return item.assignedToMarketingCode
      ? `${item.assignedToName} · ${item.assignedToMarketingCode}`
      : item.assignedToName;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {selectable && (
              <th scope="col" className="w-10 px-4 py-3">
                <span className="sr-only">Select</span>
                <LeadSelectAllCheckbox items={items} />
              </th>
            )}
            <th scope="col" className="px-4 py-3">
              Lead Code
            </th>
            <th scope="col" className="px-4 py-3">
              Contact
            </th>
            <th scope="col" className="hidden px-4 py-3 lg:table-cell">
              Company
            </th>
            {isAdmin && (
              <>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">
                  Phone / Email
                </th>
                <th scope="col" className="hidden px-4 py-3 lg:table-cell">
                  Service
                </th>
                <th scope="col" className="hidden px-4 py-3 xl:table-cell">
                  Source
                </th>
                <th scope="col" className="px-4 py-3">
                  Assigned To
                </th>
              </>
            )}
            <th scope="col" className="px-4 py-3">
              Status
            </th>
            <th scope="col" className="px-4 py-3">
              Next Follow-up
            </th>
            <th scope="col" className="hidden px-4 py-3 lg:table-cell">
              {isAdmin ? 'Created' : 'Last Updated'}
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => {
            const label = ownerLabel(item);
            return (
              <tr
                key={item.id}
                className="transition-colors hover:bg-muted/30"
              >
                {selectable && (
                  <td className="px-4 py-3">
                    <LeadRowCheckbox leadId={item.id} />
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  {item.leadCode}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                  {item.name}
                  {isAdmin && item.estimatedBudget !== null && (
                    <span className="ml-2 block text-xs font-normal text-muted-foreground">
                      Budget {formatMoney(item.estimatedBudget, item.currency)}
                    </span>
                  )}
                </td>
                <td className="hidden max-w-48 truncate px-4 py-3 text-muted-foreground lg:table-cell">
                  {item.companyName || '—'}
                </td>
                {isAdmin && (
                  <>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {item.phone || '—'}
                      <span className="block text-xs">{item.email || '—'}</span>
                    </td>
                    <td className="hidden max-w-48 truncate px-4 py-3 text-muted-foreground lg:table-cell">
                      {item.serviceNames.length > 0
                        ? item.serviceNames.join(', ')
                        : '—'}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground xl:table-cell">
                      {LEAD_SOURCE_LABELS[item.source as LeadSource]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {label ? (
                        <span className="text-foreground">{label}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          Unassigned
                        </span>
                      )}
                    </td>
                  </>
                )}
                <td className="whitespace-nowrap px-4 py-3">
                  <LeadStatusBadge status={item.status as LeadStatus} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <FollowUpBadge nextFollowUpAt={item.nextFollowUpAt} now={now} />
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                  {formatDate(isAdmin ? item.createdAt : item.updatedAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <LeadRowActions
                    leadId={item.id}
                    leadCode={item.leadCode}
                    status={item.status}
                    assignedToUserId={item.assignedToUserId}
                    assignedToLabel={label}
                    detailHref={`${basePath}/${item.id}`}
                    editHref={`${basePath}/${item.id}/edit`}
                    marketingUsers={marketingUsers}
                    canAssign={isAdmin}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}