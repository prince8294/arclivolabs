'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { LeadListItem } from '@/lib/queries/leads';

/**
 * Page-scoped lead selection state for the admin lead list.
 *
 * The selection lives in a client context so the table row
 * checkboxes and the bulk action bar stay in sync without
 * lifting state into every consumer. Only the ids of the
 * currently visible page are ever "select all"-able; a selection
 * survives pagination because the id set is not cleared on
 * page change (the caller clears it when the filters change).
 */

interface LeadSelectionContextValue {
  selectedIds: ReadonlySet<string>;
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clear: () => void;
  toggleAll: (items: LeadListItem[]) => void;
}

const LeadSelectionContext = createContext<LeadSelectionContextValue | null>(
  null
);

export function LeadSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectMany = useCallback((ids: string[]) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const id of ids) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleAll = useCallback((items: LeadListItem[]) => {
    setSelectedIds((previous) => {
      const pageIds = items.map((item) => item.id);
      const everyOnPage =
        pageIds.length > 0 && pageIds.every((id) => previous.has(id));
      const next = new Set(previous);
      for (const id of pageIds) {
        if (everyOnPage) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      selectedIds,
      count: selectedIds.size,
      isSelected,
      toggle,
      selectMany,
      clear,
      toggleAll,
    }),
    [selectedIds, isSelected, toggle, selectMany, clear, toggleAll]
  );

  return (
    <LeadSelectionContext.Provider value={value}>
      {children}
    </LeadSelectionContext.Provider>
  );
}

export function useLeadSelection(): LeadSelectionContextValue {
  const context = useContext(LeadSelectionContext);
  if (!context) {
    throw new Error(
      'useLeadSelection must be used within a LeadSelectionProvider.'
    );
  }
  return context;
}

const checkboxClasses =
  'h-4 w-4 rounded border-border text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Row-level selection checkbox (renders inside the table). */
export function LeadRowCheckbox({ leadId }: { leadId: string }) {
  const { isSelected, toggle } = useLeadSelection();
  const checked = isSelected(leadId);

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => toggle(leadId)}
      aria-label={`Select lead ${leadId}`}
      className={checkboxClasses}
    />
  );
}

/**
 * Header checkbox that selects / deselects every lead on the
 * current page. Reflects a mixed state when only some rows are
 * selected.
 */
export function LeadSelectAllCheckbox({
  items,
}: {
  items: LeadListItem[];
}) {
  const { selectedIds, toggleAll } = useLeadSelection();

  const pageIds = items.map((item) => item.id);
  const selectedOnPage =
    pageIds.length > 0 ? pageIds.filter((id) => selectedIds.has(id)).length : 0;
  const allSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

  return (
    <input
      type="checkbox"
      checked={allSelected}
      ref={(input) => {
        if (input) {
          input.indeterminate = someSelected;
        }
      }}
      onChange={() => toggleAll(items)}
      aria-label="Select all leads on this page"
      className={checkboxClasses}
    />
  );
}
