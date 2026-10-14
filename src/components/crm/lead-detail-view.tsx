import { Award, Info } from 'lucide-react';

import DetailList from '@/components/admin/detail-list';
import FollowUpBadge from '@/components/crm/follow-up-badge';
import LeadStatusBadge from '@/components/crm/lead-status-badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LOST_REASON_LABELS,
} from '@/lib/constants/enums';
import { ROLE_LABELS } from '@/types/auth';
import { formatDateTime, formatMoney } from '@/lib/utils/format';
import type { LeadDetail } from '@/lib/queries/leads';

export interface LeadDetailViewProps {
  lead: LeadDetail;
  /** Single render-time instant shared by every follow-up badge. */
  now: Date;
  /** Admin sees "Assigned marketing"; marketing sees it read-only. */
  showAssignment: boolean;
}

/**
 * Read-only lead detail shared by the admin and marketing detail pages:
 * contact information, lead information, notes and system information.
 */
export default function LeadDetailView({
  lead,
  now,
  showAssignment,
}: LeadDetailViewProps) {
  const isWon = lead.status === LEAD_STATUSES.WON;
  const isLost = lead.status === LEAD_STATUSES.LOST;

  const serviceNames =
    lead.serviceInterest.length > 0
      ? lead.serviceInterest.map((service) => service.name).join(', ')
      : null;

  return (
    <div className="flex flex-col gap-6">
      {isWon && (
        <div className="flex items-start gap-x-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <Award className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            This lead is won and ready for client conversion. Conversion is
            a separate controlled workflow — no client record has been
            created yet.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact information</CardTitle>
            <CardDescription>
              Who this enquiry is from and how to reach them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: 'Lead code', value: <span className="font-mono text-xs">{lead.leadCode}</span> },
                { label: 'Contact name', value: lead.name },
                { label: 'Company', value: lead.companyName || '—' },
                {
                  label: 'Email',
                  value: lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="hover:underline"
                    >
                      {lead.email}
                    </a>
                  ) : (
                    '—'
                  ),
                },
                { label: 'Phone', value: lead.phone || '—' },
                { label: 'Alternate phone', value: lead.alternatePhone || '—' },
                {
                  label: 'Website',
                  value: lead.website ? (
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="hover:underline"
                    >
                      {lead.website}
                    </a>
                  ) : (
                    '—'
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead information</CardTitle>
            <CardDescription>
              Pipeline position, commercial context and ownership.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: 'Source', value: LEAD_SOURCE_LABELS[lead.source] },
                { label: 'Service interest', value: serviceNames ?? '—' },
                {
                  label: 'Estimated budget',
                  value:
                    lead.estimatedBudget !== null
                      ? formatMoney(lead.estimatedBudget, lead.currency)
                      : '—',
                },
                { label: 'Currency', value: lead.currency },
                {
                  label: 'Status',
                  value: <LeadStatusBadge status={lead.status} />,
                },
                ...(showAssignment
                  ? [
                      {
                        label: 'Assigned marketing',
                        value: lead.assignedTo
                          ? `${lead.assignedTo.name}${
                              lead.assignedTo.marketingCode
                                ? ` · ${lead.assignedTo.marketingCode}`
                                : ''
                            }`
                          : 'Unassigned',
                      },
                    ]
                  : []),
                {
                  label: 'Next follow-up',
                  value: <FollowUpBadge nextFollowUpAt={lead.nextFollowUpAt} now={now} />,
                },
                ...(isLost
                  ? [
                      {
                        label: 'Lost reason',
                        value: lead.lostReason
                          ? `${LOST_REASON_LABELS[lead.lostReason]}${
                              lead.lostReasonNote
                                ? ` — ${lead.lostReasonNote}`
                                : ''
                            }`
                          : 'Not specified',
                      },
                    ]
                  : []),
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            General lead notes only. Calls, WhatsApp messages, emails and
            meetings are recorded as separate activity entries in a later
            phase, so this field is not a communication history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lead.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {lead.notes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No notes recorded for this lead yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System information</CardTitle>
          <CardDescription>Audit fields kept for traceability.</CardDescription>
        </CardHeader>
        <CardContent>
          <DetailList
            items={[
{
                  label: 'Created by',
                  value: lead.createdBy
                    ? `${lead.createdBy.name} · ${
                        ROLE_LABELS[lead.createdBy.role]
                      }`
                    : '—',
                },
              { label: 'Created at', value: formatDateTime(lead.createdAt) },
              {
                label: 'Last updated by',
                value: lead.updatedBy ? lead.updatedBy.name : '—',
              },
              { label: 'Updated at', value: formatDateTime(lead.updatedAt) },
              ...(lead.statusChangedAt
                ? [
                    {
                      label: 'Status changed at',
                      value: formatDateTime(lead.statusChangedAt),
                    },
                  ]
                : []),
              ...(lead.convertedClientId
                ? [
                    {
                      label: 'Converted client',
                      value: lead.convertedClientId,
                    },
                  ]
                : []),
            ]}
          />
          {lead.convertedClientId && (
            <p className="mt-4 flex items-start gap-x-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              This lead has already been converted into a client record.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}