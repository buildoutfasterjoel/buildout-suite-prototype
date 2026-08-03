/**
 * Every leaf route under the suite panel. Each slug is **identical to the slug that
 * section already has** under `$listingId/`, which is what lets a legacy suite URL be
 * rewritten with one rule instead of a mapping table (see suitePanelPath.ts).
 */
export type SpacePanelLeaf =
  | 'overview'
  | 'terms'
  | 'leads'
  | 'media'
  | 'financials'
  | 'financial-documents'
  | 'notes'

/**
 * The major sections. Deliberately no "Marketing" tab: Leads and Media are
 * unit-filtered views of the *property's* store, so that word would rebuild the
 * ambiguity the panel exists to remove — they get their own plainly-named tabs
 * instead.
 */
export type SpacePanelTab =
  | 'deal'
  | 'terms'
  | 'leads'
  | 'media'
  | 'back-office'

export interface SpacePanelTabDef {
  id: SpacePanelTab
  label: string
  leaves: { leaf: SpacePanelLeaf; label: string }[]
}

export const SPACE_PANEL_TABS: SpacePanelTabDef[] = [
  // Activity and History are absent on purpose: a suite has no per-space activity
  // feed or audit trail to show. The building keeps both.
  {
    id: 'deal',
    label: 'Deal',
    leaves: [{ leaf: 'overview', label: 'Details' }],
  },
  {
    id: 'terms',
    label: 'Terms',
    leaves: [{ leaf: 'terms', label: 'Terms' }],
  },
  {
    id: 'leads',
    label: 'Leads',
    leaves: [{ leaf: 'leads', label: 'Leads' }],
  },
  {
    id: 'media',
    label: 'Media',
    leaves: [{ leaf: 'media', label: 'Media' }],
  },
  {
    id: 'back-office',
    label: 'Back Office',
    leaves: [
      { leaf: 'financials', label: 'Voucher' },
      { leaf: 'financial-documents', label: 'Invoices' },
      { leaf: 'notes', label: 'Notes' },
    ],
  },
]

/** Flat leaf list in tab order. */
export const SPACE_PANEL_LEAVES: SpacePanelLeaf[] = SPACE_PANEL_TABS.flatMap((t) =>
  t.leaves.map((l) => l.leaf),
)

/** The leaf a suite panel opens on. */
export const DEFAULT_SPACE_PANEL_LEAF: SpacePanelLeaf = 'overview'

const LEAF_TO_TAB = new Map<SpacePanelLeaf, SpacePanelTab>(
  SPACE_PANEL_TABS.flatMap((t) => t.leaves.map((l) => [l.leaf, t.id] as const)),
)

export function tabForLeaf(leaf: SpacePanelLeaf): SpacePanelTab {
  return LEAF_TO_TAB.get(leaf) ?? 'deal'
}

/**
 * The active leaf, read from the URL's last segment. The panel derives both tab bars
 * from this rather than holding tab state, so a deep link and a click land in the same
 * place — the same approach PropertyDetailSidebar uses to compute activeInGroup.
 */
export function leafFromPathname(pathname: string): SpacePanelLeaf | null {
  const last = pathname.split('/').filter(Boolean).pop()
  if (!last) return null
  return LEAF_TO_TAB.has(last as SpacePanelLeaf) ? (last as SpacePanelLeaf) : null
}
