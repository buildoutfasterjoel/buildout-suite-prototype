import type { DealDocument, Listing, Property } from './types'
import { fieldSatisfied, REQUIRED_FIELD_LABEL, type GateFormState, type RequiredField } from './stageGates'
import { listingGallery } from '#/components/properties/propertyDisplay'

export type PreviewRowStatus = 'ok' | 'missing'

export interface PreviewRow {
  label: string
  /** Display value, or null when not set. */
  value: string | null
  status: PreviewRowStatus
  /** Set when this row corresponds to a gating publish requirement. */
  field?: RequiredField
}

/** Row-based sections only. Photos and documents are separate model fields. */
export interface PreviewSection {
  id: 'deal' | 'content'
  title: string
  rows: PreviewRow[]
}

export interface PublishPreviewModel {
  sections: PreviewSection[]
  /** Resolved photo URLs for the gallery strip. */
  photos: string[]
  documents: DealDocument[]
}

/** A row for a gating requirement — status and value both derive from the form. */
function gatedRow(
  field: RequiredField,
  form: GateFormState,
  value: string | null,
  label = REQUIRED_FIELD_LABEL[field],
): PreviewRow {
  const ok = fieldSatisfied(field, form)
  return { label, value: ok ? value : null, status: ok ? 'ok' : 'missing', field }
}

/** A plain context row — never gates. */
function infoRow(label: string, value: string | null): PreviewRow {
  return { label, value, status: 'ok' }
}

function money(value: number | null): string | null {
  return value == null ? null : `$${value.toLocaleString()}`
}

/**
 * The listing as it will appear once published: the deal context, the marketing
 * content that gates the publish, the derived photo gallery, and the documents
 * on the deal. Row status uses `stageGates.fieldSatisfied`, so "missing" here
 * and "missing" in the gate are the same rule.
 */
export function buildPublishPreview(
  deal: Listing,
  property: Property | undefined,
  form: GateFormState,
): PublishPreviewModel {
  const isLease = deal.dealType === 'Lease'

  const address = property
    ? [property.street, property.city, property.state].filter(Boolean).join(', ')
    : deal.name

  const dealSection: PreviewSection = {
    id: 'deal',
    title: 'Deal',
    rows: [
      infoRow('Property', address),
      infoRow('Side', deal.dealSide === 'seller' ? 'Sell-side' : 'Buy-side'),
      infoRow('Deal type', deal.dealType),
    ],
  }

  const contentRows: PreviewRow[] = [
    gatedRow('saleTitle', form, form.saleTitle || null),
    gatedRow('saleDescription', form, form.saleDescription || null),
  ]

  if (isLease) {
    contentRows.push(
      gatedRow(
        'leaseRate',
        form,
        form.leaseRate == null ? null : `$${form.leaseRate.toLocaleString()} ${form.leaseRateUnits}`,
      ),
      gatedRow(
        'availableSqFt',
        form,
        form.availableSqFt == null ? null : `${form.availableSqFt.toLocaleString()} SF`,
      ),
    )
  } else {
    contentRows.push(gatedRow('askingPrice', form, money(form.askingPrice)))
  }

  contentRows.push(infoRow('Property use', deal.marketing.propertyUse ?? null))

  return {
    sections: [dealSection, { id: 'content', title: 'Listing content', rows: contentRows }],
    photos: listingGallery(deal.id, 5, 480, 280),
    documents: deal.documents ?? [],
  }
}
