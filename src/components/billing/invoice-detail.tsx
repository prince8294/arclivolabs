'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Download,
  Eye,
  Pencil,
  ShieldCheck,
  Ban,
  Trash2,
  FileText,
  Building,
  User,
  Calendar,
  CreditCard,
  History,
  AlertTriangle,
} from 'lucide-react';

import Button from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  InvoicePaymentStatusBadge,
  InvoiceStatusBadge,
  InvoiceTypeBadge,
} from './invoice-badges';
import { IssueInvoiceDialog } from './issue-invoice-dialog';
import { VoidInvoiceDialog } from './void-invoice-dialog';
import { deleteInvoiceDraftAction } from '@/lib/actions/invoices';
import { INVOICE_STATUSES, TAX_TREATMENTS } from '@/lib/constants/enums';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import { formatMinor } from '@/lib/utils/money';

interface InvoiceDetailViewProps {
  invoice: any;
  isAdmin?: boolean;
}

export function InvoiceDetailView({ invoice, isAdmin = true }: InvoiceDetailViewProps) {
  const router = useRouter();
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const displayCode = invoice.invoiceNumber || invoice.invoiceCode;
  const isDraft = invoice.status === INVOICE_STATUSES.DRAFT;
  const isIssued = invoice.status === INVOICE_STATUSES.ISSUED;
  const isVoid = invoice.status === INVOICE_STATUSES.VOID;
  const isOverdue = isIssued && new Date(invoice.dueDate) < new Date() && invoice.amountDueMinor > 0;

  async function handleDeleteDraft() {
    if (!confirm('Are you sure you want to delete this draft invoice?')) return;
    setIsDeleting(true);
    try {
      const res = await deleteInvoiceDraftAction(invoice._id.toString());
      if (res.success) {
        router.push('/admin/invoices');
      } else {
        alert(res.error || 'Failed to delete draft.');
      }
    } catch (e: any) {
      alert(e?.message || 'Error deleting draft.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border rounded-xl p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xl font-bold font-mono tracking-tight text-foreground">
            {displayCode}
          </span>
          <InvoiceStatusBadge status={invoice.status} />
          <InvoicePaymentStatusBadge status={invoice.paymentStatus} isOverdue={isOverdue} />
          <InvoiceTypeBadge type={invoice.invoiceType} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download PDF */}
          <a
            href={`/api/invoices/${invoice._id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors shadow-2xs"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>

          {/* Preview PDF */}
          <Link
            href={isAdmin ? `/admin/invoices/${invoice._id}/preview` : `/client/invoices/${invoice._id}/preview`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors shadow-2xs"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Link>

          {/* Admin Draft Controls */}
          {isAdmin && isDraft && (
            <>
              <Link
                href={`/admin/invoices/${invoice._id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition-colors shadow-2xs"
              >
                <Pencil className="h-4 w-4" />
                Edit Draft
              </Link>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setShowIssueDialog(true)}
              >
                <ShieldCheck className="h-4 w-4 mr-1" />
                Issue Invoice
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={handleDeleteDraft}
                className="text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </>
          )}

          {/* Admin Issued Controls (Voiding) */}
          {isAdmin && isIssued && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowVoidDialog(true)}
              className="text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <Ban className="h-4 w-4 mr-1" />
              Void Invoice
            </Button>
          )}
        </div>
      </div>

      {isVoid && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">This invoice has been VOIDED</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reason: {invoice.voidReason || 'No explicit reason provided.'} · Voided on{' '}
              {invoice.voidedAt ? formatDateTime(invoice.voidedAt) : 'N/A'}
            </p>
          </div>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Total Invoice Amount</CardDescription>
            <CardTitle className="text-2xl font-mono text-primary">
              {formatMinor(invoice.totalMinor, invoice.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Subtotal: {formatMinor(invoice.subtotalMinor, invoice.currency)} · Tax: {formatMinor(invoice.taxMinor, invoice.currency)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Recorded Payments</CardDescription>
            <CardTitle className="text-2xl font-mono text-foreground">
              {formatMinor(invoice.amountPaidMinor, invoice.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {invoice.amountPaidMinor > 0 ? 'Verified receipts recorded' : 'No payments verified yet'}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Amount Due / Outstanding</CardDescription>
            <CardTitle className={`text-2xl font-mono ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
              {formatMinor(invoice.amountDueMinor, invoice.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {isOverdue ? 'Past due date' : `Due by ${formatDate(invoice.dueDate)}`}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Key Dates</CardDescription>
            <CardTitle className="text-sm font-medium text-foreground pt-1">
              Issued: {formatDate(invoice.issueDate)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Due: {formatDate(invoice.dueDate)}
          </CardContent>
        </Card>
      </div>

      {/* Bill From & Bill To */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <Building className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Seller Information (Bill From)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-semibold text-foreground">
              {invoice.sellerSnapshot?.legalName || invoice.sellerSnapshot?.companyName || 'Arclivo Labs'}
            </p>
            {invoice.sellerSnapshot?.address && (
              <p className="text-muted-foreground text-xs whitespace-pre-line">
                {invoice.sellerSnapshot.address}
              </p>
            )}
            {invoice.sellerSnapshot?.email && (
              <p className="text-muted-foreground text-xs">Email: {invoice.sellerSnapshot.email}</p>
            )}
            {invoice.sellerSnapshot?.phone && (
              <p className="text-muted-foreground text-xs">Phone: {invoice.sellerSnapshot.phone}</p>
            )}
            {invoice.sellerSnapshot?.taxId && (
              <p className="text-muted-foreground text-xs">
                {invoice.sellerSnapshot.taxLabel || 'GSTIN'}: {invoice.sellerSnapshot.taxId}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Customer Information (Bill To)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-semibold text-foreground">
              {invoice.customerSnapshot?.clientName || invoice.clientId?.name}
            </p>
            {invoice.customerSnapshot?.companyName && (
              <p className="text-xs text-muted-foreground">{invoice.customerSnapshot.companyName}</p>
            )}
            {invoice.customerSnapshot?.billingAddress && (
              <p className="text-muted-foreground text-xs">
                {[
                  invoice.customerSnapshot.billingAddress.line1,
                  invoice.customerSnapshot.billingAddress.line2,
                  invoice.customerSnapshot.billingAddress.city,
                  invoice.customerSnapshot.billingAddress.state,
                  invoice.customerSnapshot.billingAddress.postalCode,
                  invoice.customerSnapshot.billingAddress.country,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            {invoice.customerSnapshot?.email && (
              <p className="text-muted-foreground text-xs">Email: {invoice.customerSnapshot.email}</p>
            )}
            {invoice.customerSnapshot?.phone && (
              <p className="text-muted-foreground text-xs">Phone: {invoice.customerSnapshot.phone}</p>
            )}
            {invoice.customerSnapshot?.taxId && (
              <p className="text-muted-foreground text-xs">Tax ID: {invoice.customerSnapshot.taxId}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commercial Links (Deal & Project) */}
      {(invoice.dealId || invoice.projectId) && (
        <Card className="bg-muted/30">
          <CardContent className="p-4 flex flex-wrap items-center gap-6 text-sm">
            {invoice.dealId && (
              <div>
                <span className="text-xs text-muted-foreground uppercase font-semibold">Agreed Deal: </span>
                {isAdmin ? (
                  <Link
                    href={`/admin/deals/${typeof invoice.dealId === 'object' ? invoice.dealId._id : invoice.dealId}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {typeof invoice.dealId === 'object' ? invoice.dealId.dealCode : 'Deal'}
                  </Link>
                ) : (
                  <span className="font-mono">
                    {typeof invoice.dealId === 'object' ? invoice.dealId.dealCode : 'Deal'}
                  </span>
                )}
              </div>
            )}
            {invoice.projectId && (
              <div>
                <span className="text-xs text-muted-foreground uppercase font-semibold">Project: </span>
                {isAdmin ? (
                  <Link
                    href={`/admin/projects/${typeof invoice.projectId === 'object' ? invoice.projectId._id : invoice.projectId}`}
                    className="text-primary hover:underline"
                  >
                    {typeof invoice.projectId === 'object' && invoice.projectId.projectCode
                      ? `[${invoice.projectId.projectCode}] `
                      : ''}
                    {typeof invoice.projectId === 'object' ? invoice.projectId.title : 'Project'}
                  </Link>
                ) : (
                  <span>
                    {typeof invoice.projectId === 'object' && invoice.projectId.projectCode
                      ? `[${invoice.projectId.projectCode}] `
                      : ''}
                    {typeof invoice.projectId === 'object' ? invoice.projectId.title : 'Project'}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Line Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Itemized Services & Charges</CardTitle>
          <CardDescription>Itemized billing items, unit rates, discounts, and line totals.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="p-3">#</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3 text-right">Unit Rate</th>
                  <th className="p-3 text-right">Discount</th>
                  <th className="p-3 text-right">Tax</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.lineItems.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-muted/10">
                    <td className="p-3 text-muted-foreground text-xs">{idx + 1}</td>
                    <td className="p-3 font-medium text-foreground">{item.description}</td>
                    <td className="p-3 text-center">
                      {item.quantity} {item.unit || 'unit'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {formatMinor(item.unitPriceMinor, invoice.currency)}
                    </td>
                    <td className="p-3 text-right font-mono text-muted-foreground">
                      {item.discountMinor > 0 ? `-${formatMinor(item.discountMinor, invoice.currency)}` : '—'}
                    </td>
                    <td className="p-3 text-right font-mono text-muted-foreground">
                      {item.taxMinor > 0 ? `+${formatMinor(item.taxMinor, invoice.currency)}` : '—'}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-foreground">
                      {formatMinor(item.lineTotalMinor, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pricing Totals Box */}
          <div className="flex justify-end pt-6">
            <div className="w-full sm:w-80 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="font-mono">{formatMinor(invoice.subtotalMinor, invoice.currency)}</span>
              </div>
              {invoice.discountMinor > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Discount:</span>
                  <span className="font-mono text-destructive">
                    -{formatMinor(invoice.discountMinor, invoice.currency)}
                  </span>
                </div>
              )}
              {invoice.taxMinor > 0 && invoice.taxDetails && (
                <>
                  {invoice.taxDetails.taxTreatment === TAX_TREATMENTS.CGST_SGST ? (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>CGST:</span>
                        <span className="font-mono">
                          +{formatMinor(invoice.taxDetails.cgstMinor, invoice.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>SGST:</span>
                        <span className="font-mono">
                          +{formatMinor(invoice.taxDetails.sgstMinor, invoice.currency)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{invoice.taxDetails.taxLabel || 'Tax'}:</span>
                      <span className="font-mono">
                        +{formatMinor(invoice.taxMinor, invoice.currency)}
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between pt-2 border-t border-border font-bold text-base text-foreground">
                <span>Total Amount Due:</span>
                <span className="font-mono text-primary">
                  {formatMinor(invoice.totalMinor, invoice.currency)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Instructions & Terms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Terms</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {invoice.terms || 'Payment as per standard agency milestones agreement.'}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-line">
            {invoice.billingInstructions ||
              'Payment will be made directly via Arclivo Labs’ approved UPI or bank transfer.'}
          </CardContent>
        </Card>
      </div>

      {/* Audit History (Admin Only) */}
      {isAdmin && invoice.activities && invoice.activities.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Billing Audit History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoice.activities.map((act: any) => (
                <div key={act._id} className="flex items-start justify-between border-b border-border/50 pb-2 text-xs">
                  <div>
                    <p className="font-semibold text-foreground">{act.description}</p>
                    <p className="text-muted-foreground">
                      By {act.performerName} ({act.performerRole})
                    </p>
                  </div>
                  <span className="text-muted-foreground shrink-0">{formatDateTime(act.createdAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {isAdmin && (
        <>
          <IssueInvoiceDialog
            invoiceId={invoice._id.toString()}
            invoiceCode={displayCode}
            isOpen={showIssueDialog}
            onClose={() => setShowIssueDialog(false)}
          />

          <VoidInvoiceDialog
            invoiceId={invoice._id.toString()}
            invoiceCode={displayCode}
            isOpen={showVoidDialog}
            onClose={() => setShowVoidDialog(false)}
          />
        </>
      )}
    </div>
  );
}
