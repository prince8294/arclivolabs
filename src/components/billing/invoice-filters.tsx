'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, Filter, X } from 'lucide-react';

import Button from '@/components/ui/button';
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUSES,
  INVOICE_TYPE_LABELS,
  INVOICE_TYPES,
} from '@/lib/constants/enums';

interface InvoiceFiltersProps {
  isAdmin?: boolean;
}

export function InvoiceFilters({ isAdmin = true }: InvoiceFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const idPrefix = useId();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [invoiceType, setInvoiceType] = useState(searchParams.get('type') || '');
  const [overdue, setOverdue] = useState(searchParams.get('overdue') === 'true');

  function applyFilters(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const params = new URLSearchParams();

    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    if (invoiceType) params.set('type', invoiceType);
    if (overdue) params.set('overdue', 'true');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function clearFilters() {
    setSearch('');
    setStatus('');
    setInvoiceType('');
    setOverdue(false);
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasActiveFilters = Boolean(
    searchParams.get('search') ||
      searchParams.get('status') ||
      searchParams.get('type') ||
      searchParams.get('overdue')
  );

  return (
    <form onSubmit={applyFilters} className="bg-card border border-border rounded-xl p-4 shadow-2xs space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search Input */}
        <div className="lg:col-span-2 relative">
          <label htmlFor={`${idPrefix}-search`} className="sr-only">Search invoices</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            id={`${idPrefix}-search`}
            type="text"
            placeholder="Search invoice number, client, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Status Filter (Admin only or restricted for Client) */}
        {isAdmin && (
          <div>
            <label htmlFor={`${idPrefix}-status`} className="sr-only">Status</label>
            <select
              id={`${idPrefix}-status`}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              <option value={INVOICE_STATUSES.DRAFT}>{INVOICE_STATUS_LABELS.DRAFT}</option>
              <option value={INVOICE_STATUSES.ISSUED}>{INVOICE_STATUS_LABELS.ISSUED}</option>
              <option value={INVOICE_STATUSES.VOID}>{INVOICE_STATUS_LABELS.VOID}</option>
            </select>
          </div>
        )}

        {/* Type Filter */}
        <div>
          <label htmlFor={`${idPrefix}-type`} className="sr-only">Invoice Type</label>
          <select
            id={`${idPrefix}-type`}
            value={invoiceType}
            onChange={(e) => setInvoiceType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
          >
            <option value="">All Types</option>
            <option value={INVOICE_TYPES.STANDARD}>{INVOICE_TYPE_LABELS.STANDARD}</option>
            <option value={INVOICE_TYPES.MILESTONE}>{INVOICE_TYPE_LABELS.MILESTONE}</option>
            <option value={INVOICE_TYPES.FINAL}>{INVOICE_TYPE_LABELS.FINAL}</option>
          </select>
        </div>

        {/* Overdue checkbox & Actions */}
        <div className="flex items-center justify-between sm:justify-start gap-3">
          {isAdmin && (
            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={overdue}
                onChange={(e) => setOverdue(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
              />
              Overdue Only
            </label>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            <Button type="submit" variant="primary" size="sm" disabled={isPending}>
              <Filter className="h-3.5 w-3.5 mr-1" />
              Filter
            </Button>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
