import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/authorization';
import { PROPOSAL_STATUSES, type ProposalStatus } from '@/lib/constants/proposals';
import connectDB from '@/lib/db/mongoose';
import { buildPdfModel, renderQuotationPdf } from '@/lib/proposals/pdf';
import { getProposalDetail, resolveClientIdForUser } from '@/lib/queries/proposals';
import { ProposalVersion } from '@/models/ProposalVersion';
import { USER_ROLES } from '@/types/auth';

/**
 * PDF rendering is Node-only (pdfkit) and always depends on the request, so
 * the route is forced dynamic. `force-dynamic` also guarantees the
 * authorization checks below run on EVERY request instead of being served
 * from the Router Cache.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Statuses that only admin may render (never issued to a customer). */
const ADMIN_ONLY_STATUSES: ProposalStatus[] = [
  PROPOSAL_STATUSES.DRAFT,
  PROPOSAL_STATUSES.PENDING_APPROVAL,
];

/** Statuses a logged-in client user may download. */
const CLIENT_VISIBLE_STATUSES: ProposalStatus[] = [
  PROPOSAL_STATUSES.SENT,
  PROPOSAL_STATUSES.ACCEPTED,
  PROPOSAL_STATUSES.REJECTED,
  PROPOSAL_STATUSES.EXPIRED,
];

/**
 * GET /api/proposals/[proposalId]/versions/[versionId]/pdf
 *
 * Downloads (or inlines) the branded quotation PDF for one version.
 *
 * Authorization is enforced here, per request, for every role:
 *
 * - ADMIN     any version, including their own drafts (preview only).
 * - MARKETING only proposals assigned to them, and only versions that
 *              reached at least internal approval - never a raw draft.
 * - CLIENT    only versions issued against their own Client record.
 * - EMPLOYEE  no commercial access at all.
 *
 * The document is always built from the immutable `ProposalVersion`
 * snapshot, which is why internal notes and later revisions can never
 * appear in it. A 404 (not a 403) is returned for out-of-scope records so
 * the endpoint cannot be used to probe for existing proposal ids.
 */
export async function GET(
  _request: Request,
  context: RouteContext<'/api/proposals/[proposalId]/versions/[versionId]/pdf'>
) {
  const user = await requireAuth();

  const { proposalId, versionId } = await context.params;

  if (!/^[a-f\d]{24}$/i.test(proposalId) || !/^[a-f\d]{24}$/i.test(versionId)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  if (user.role === USER_ROLES.EMPLOYEE) {
    return NextResponse.json(
      { error: 'Commercial documents are not available to employees.' },
      { status: 403 }
    );
  }

  await connectDB();

  const scope =
    user.role === USER_ROLES.ADMIN
      ? ({ kind: 'admin' } as const)
      : user.role === USER_ROLES.MARKETING
        ? ({ kind: 'marketing', userId: user.id } as const)
        : ({ kind: 'client', userId: user.id } as const);

  // `getProposalDetail` returns null for anything outside the caller's scope,
  // which is what makes cross-role access impossible.
  const detail = await getProposalDetail(proposalId, scope);
  if (!detail) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  if (scope.kind === 'client') {
    const clientId = await resolveClientIdForUser(user.id);
    if (!clientId || detail.clientId !== clientId.toString()) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
  }

  const stored = await ProposalVersion.findById(versionId)
    .select('proposalId')
    .lean()
    .exec();
  if (!stored || stored.proposalId.toString() !== proposalId) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const version = detail.versions.find((item) => item.id === versionId);
  if (!version) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  if (scope.kind !== 'admin' && ADMIN_ONLY_STATUSES.includes(version.status)) {
    return NextResponse.json(
      { error: 'This quotation has not been issued yet.' },
      { status: 403 }
    );
  }
  if (scope.kind === 'client' && !CLIENT_VISIBLE_STATUSES.includes(version.status)) {
    return NextResponse.json(
      { error: 'This document is not available.' },
      { status: 403 }
    );
  }

  const pdf = await renderQuotationPdf(buildPdfModel(detail, version));

  // The PDF is generated per request from the stored snapshot and is never
  // written to disk, so an ephemeral (serverless) filesystem is fine.
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.byteLength),
      'Content-Disposition': `inline; filename="${detail.proposalCode}-v${version.version}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}