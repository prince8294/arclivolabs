'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

import Button from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TAX_TREATMENTS, type TaxTreatment } from '@/lib/constants/enums';
import { saveBillingSettingsAction } from '@/lib/actions/invoices';

interface BillingSettingsFormProps {
  initialSettings: any;
}

export function BillingSettingsForm({ initialSettings }: BillingSettingsFormProps) {
  const router = useRouter();
  const idPrefix = useId();

  const [companyName, setCompanyName] = useState(initialSettings?.companyName || 'Arclivo Labs');
  const [legalName, setLegalName] = useState(initialSettings?.legalName || 'Arclivo Labs');
  const [address, setAddress] = useState(initialSettings?.address || '');
  const [email, setEmail] = useState(initialSettings?.email || '');
  const [phone, setPhone] = useState(initialSettings?.phone || '');
  const [website, setWebsite] = useState(initialSettings?.website || '');

  const [taxEnabled, setTaxEnabled] = useState(initialSettings?.taxEnabled || false);
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState(initialSettings?.taxRegistrationNumber || '');
  const [taxLabel, setTaxLabel] = useState(initialSettings?.taxLabel || 'GSTIN');
  const [defaultTaxRate, setDefaultTaxRate] = useState(initialSettings?.defaultTaxRate ?? 0);
  const [defaultTaxTreatment, setDefaultTaxTreatment] = useState<TaxTreatment>(
    initialSettings?.defaultTaxTreatment || TAX_TREATMENTS.NONE
  );
  const [sellerState, setSellerState] = useState(initialSettings?.sellerState || '');

  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState(
    initialSettings?.defaultPaymentTerms ||
      'Payment is due within 15 days of invoice date. Payment via verified UPI or bank transfer.'
  );
  const [invoiceFooterNote, setInvoiceFooterNote] = useState(
    initialSettings?.invoiceFooterNote || 'Thank you for choosing Arclivo Labs.'
  );
  const [bankAccountDetails, setBankAccountDetails] = useState(
    initialSettings?.bankAccountDetails || ''
  );
  const [upiPaymentInstructions, setUpiPaymentInstructions] = useState(
    initialSettings?.upiPaymentInstructions || ''
  );

  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const res = await saveBillingSettingsAction({
        companyName,
        legalName,
        address,
        email,
        phone,
        website,
        taxEnabled,
        taxRegistrationNumber,
        taxLabel,
        defaultTaxRate: Number(defaultTaxRate) || 0,
        defaultTaxTreatment,
        sellerState,
        defaultPaymentTerms,
        invoiceFooterNote,
        bankAccountDetails,
        upiPaymentInstructions,
      });

      if (!res.success) {
        setError(res.error || 'Failed to save billing settings.');
      } else {
        setSuccessMessage('Billing and tax settings saved successfully.');
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 1. Seller / Company Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Company Billing Profile</CardTitle>
          <CardDescription>
            These business details are copied into immutable seller snapshots whenever an invoice is issued.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${idPrefix}-companyName`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Display Company Name <span className="text-destructive">*</span>
            </label>
            <input
              id={`${idPrefix}-companyName`}
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor={`${idPrefix}-legalName`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Legal Business Name <span className="text-destructive">*</span>
            </label>
            <input
              id={`${idPrefix}-legalName`}
              type="text"
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor={`${idPrefix}-address`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Registered Business Address
            </label>
            <textarea
              id={`${idPrefix}-address`}
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 101 Innovation Plaza, Tech Park, Pune, Maharashtra 411001"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor={`${idPrefix}-email`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Billing Email
            </label>
            <input
              id={`${idPrefix}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="billing@arclivolabs.com"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor={`${idPrefix}-phone`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Billing Phone
            </label>
            <input
              id={`${idPrefix}-phone`}
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor={`${idPrefix}-website`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Website
            </label>
            <input
              id={`${idPrefix}-website`}
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://arclivolabs.com"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Tax Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Tax & GST Configuration</CardTitle>
          <CardDescription>
            Configure legal tax registrations. Do not enable tax unless registered. Invoices default to tax-exempt unless explicitly configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              id={`${idPrefix}-taxEnabled`}
              type="checkbox"
              checked={taxEnabled}
              onChange={(e) => setTaxEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
            />
            <label htmlFor={`${idPrefix}-taxEnabled`} className="text-sm font-medium">
              Enable Tax on New Invoices by Default
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            <div>
              <label htmlFor={`${idPrefix}-taxRegistrationNumber`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Tax Registration Number (e.g. GSTIN)
              </label>
              <input
                id={`${idPrefix}-taxRegistrationNumber`}
                type="text"
                value={taxRegistrationNumber}
                onChange={(e) => setTaxRegistrationNumber(e.target.value)}
                placeholder="27AAAAA0000A1Z5"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary font-mono"
              />
            </div>

            <div>
              <label htmlFor={`${idPrefix}-taxLabel`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Tax Label (e.g. GSTIN / VAT)
              </label>
              <input
                id={`${idPrefix}-taxLabel`}
                type="text"
                value={taxLabel}
                onChange={(e) => setTaxLabel(e.target.value)}
                placeholder="GSTIN"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor={`${idPrefix}-sellerState`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Seller State / Jurisdiction
              </label>
              <input
                id={`${idPrefix}-sellerState`}
                type="text"
                value={sellerState}
                onChange={(e) => setSellerState(e.target.value)}
                placeholder="Maharashtra"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor={`${idPrefix}-defaultTaxRate`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Default Tax Rate (%)
              </label>
              <input
                id={`${idPrefix}-defaultTaxRate`}
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                placeholder="18"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor={`${idPrefix}-defaultTaxTreatment`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                Default Tax Treatment
              </label>
              <select
                id={`${idPrefix}-defaultTaxTreatment`}
                value={defaultTaxTreatment}
                onChange={(e) => setDefaultTaxTreatment(e.target.value as TaxTreatment)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
              >
                <option value={TAX_TREATMENTS.NONE}>No Tax / Tax Exempt</option>
                <option value={TAX_TREATMENTS.IGST}>IGST (Integrated GST / Inter-State)</option>
                <option value={TAX_TREATMENTS.CGST_SGST}>CGST + SGST (Intra-State GST)</option>
                <option value={TAX_TREATMENTS.EXPORT_NON_TAXABLE}>Export / Zero-Rated</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Instructions & Payment Details */}
      <Card>
        <CardHeader>
          <CardTitle>Default Terms & Instructions</CardTitle>
          <CardDescription>
            Approved payment instructions shown to clients on the portal and printed on PDF documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor={`${idPrefix}-defaultPaymentTerms`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Default Payment Terms
            </label>
            <textarea
              id={`${idPrefix}-defaultPaymentTerms`}
              rows={2}
              value={defaultPaymentTerms}
              onChange={(e) => setDefaultPaymentTerms(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor={`${idPrefix}-invoiceFooterNote`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Invoice Footer Note
            </label>
            <input
              id={`${idPrefix}-invoiceFooterNote`}
              type="text"
              value={invoiceFooterNote}
              onChange={(e) => setInvoiceFooterNote(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor={`${idPrefix}-bankAccountDetails`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Approved Bank Account Details (Displayed for Wire / NEFT / IMPS)
            </label>
            <textarea
              id={`${idPrefix}-bankAccountDetails`}
              rows={3}
              value={bankAccountDetails}
              onChange={(e) => setBankAccountDetails(e.target.value)}
              placeholder="Bank: HDFC Bank&#10;Account Name: Arclivo Labs&#10;Account No: 502000...&#10;IFSC: HDFC000..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor={`${idPrefix}-upiInstructions`} className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
              Approved UPI Instructions
            </label>
            <textarea
              id={`${idPrefix}-upiInstructions`}
              rows={2}
              value={upiPaymentInstructions}
              onChange={(e) => setUpiPaymentInstructions(e.target.value)}
              placeholder="UPI ID: arclivolabs@okaxis or QR code instructions"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" variant="primary" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Settings...
            </>
          ) : (
            'Save Billing Settings'
          )}
        </Button>
      </div>
    </form>
  );
}
