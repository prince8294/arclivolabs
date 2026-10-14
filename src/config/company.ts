/**
 * Company details used on customer-facing documents.
 *
 * The quotation PDF prints only what is actually configured here. Arclivo
 * Labs has no verified registered address or tax registration in this
 * repository, so those fields default to empty and the PDF OMITS the tax id
 * / registered-address lines entirely rather than inventing them.
 *
 * Adding a real address or GSTIN later is a config change only - no code
 * change, and no document ever claims details we do not have.
 */

export interface CompanyProfile {
  legalName: string;
  displayName: string;
  tagline: string;
  email: string;
  phone: string;
  website: string;
  /** Full registered address. Empty -> not printed. */
  registeredAddress: string;
  /** GSTIN / VAT / EIN or equivalent. Empty -> not printed. */
  taxId: string;
  taxIdLabel: string;
  /** Short thank-you line printed in the PDF footer. */
  footerNote: string;
}

export const companyProfile: CompanyProfile = {
  legalName: 'Arclivo Labs',
  displayName: 'ARCLIVO LABS',
  tagline: 'Digital Product Studio',
  email: process.env.COMPANY_EMAIL ?? '',
  phone: process.env.COMPANY_PHONE ?? '',
  website: process.env.COMPANY_WEBSITE ?? process.env.NEXT_PUBLIC_APP_URL ?? '',
  registeredAddress: process.env.COMPANY_ADDRESS ?? '',
  taxId: process.env.COMPANY_TAX_ID ?? '',
  taxIdLabel: 'GSTIN',
  footerNote: 'Thank you for considering Arclivo Labs.',
};