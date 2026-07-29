import {
  hash,
  oneIn,
  pickFor,
  spread,
} from "#/components/properties/propertyDisplay";
import { getLeadsForProperty } from "#/data/store";
import { leadStatusFor } from "#/data/leadFacts";
import type { Property } from "#/data/types";

/** Ordered stages shown in the Activity Funnel, top (widest) to bottom (narrowest). */
export const FUNNEL_STAGES = [
  "Emails Sent",
  "Opened Email",
  "Visited Website",
  "Viewed Public Docs",
  "Viewed CA",
  "Signed CA",
  "Viewed Locked",
  "Downloads",
] as const;

export type FunnelStageLabel = (typeof FUNNEL_STAGES)[number];

export interface FunnelStageMetric {
  stage: FunnelStageLabel;
  count: number;
}

export interface ClientReportLead {
  id: string;
  company: string;
  name: string;
  leadStatus: string;
  pageViews: number;
  lastAction: FunnelStageLabel;
  /** Whether this lead has executed a Confidentiality Agreement — feeds the "CAs Signed" KPI. */
  caSigned: boolean;
}

/**
 * Leads for the report, synthesized from real Contact records tied to this
 * property. The report goes to the seller, so they're excluded — see
 * {@link getLeadsForProperty}.
 */
export function getClientReportLeads(property: Property): ClientReportLead[] {
  return getLeadsForProperty(property.id)
    .map((contact) => {
      // One salt per column. Taken off a single `h = hash(contact.id)` these
      // moved together — `h % 8` fixes `h % 4`, so CA Signed landed on exactly
      // the "Emails Sent" and "Viewed CA" rows.
      return {
        id: contact.id,
        company: contact.company || "—",
        name: `${contact.firstName} ${contact.lastName}`,
        leadStatus: leadStatusFor(contact.id),
        pageViews: 1 + spread(hash(`${contact.id}#page-views`), 60),
        lastAction: pickFor(FUNNEL_STAGES, contact.id, "last-action"),
        caSigned: oneIn(4, contact.id, "ca-signed"),
      };
    });
}

export interface ClientReportKpis {
  totalDaysOnMarket: number;
  casSigned: number;
  leadsCount: number;
}

/** KPI tile values — `totalDaysOnMarket` matches the Dashboard's formula so the two pages agree. */
export function getClientReportKpis(property: Property): ClientReportKpis {
  const leads = getClientReportLeads(property);
  return {
    totalDaysOnMarket: 100 + (hash(property.id) % 900),
    casSigned: leads.filter((l) => l.caSigned).length,
    leadsCount: leads.length,
  };
}

/**
 * Deterministic funnel counts, anchored on `casSigned` so the "Signed CA" bar always
 * matches the CAs Signed KPI. Each stage moving away from "Signed CA" — earlier
 * (more emails/visits) or later (locked views/downloads) — only ever adds or removes
 * a bounded, hash-derived amount, so the sequence stays monotonically non-increasing
 * top to bottom.
 */
export function getActivityFunnel(
  listingId: string,
  casSigned: number,
): FunnelStageMetric[] {
  const signedIdx = FUNNEL_STAGES.indexOf("Signed CA");

  const counts: number[] = new Array(FUNNEL_STAGES.length);
  counts[signedIdx] = Math.max(casSigned, 1);

  // Walk backward from "Signed CA" to "Emails Sent" — each earlier stage adds a
  // hash-derived increment on top of the stage after it.
  for (let i = signedIdx - 1; i >= 0; i--) {
    const step = 4 + (hash(`${listingId}-funnel-up-${i}`) % 20);
    counts[i] = counts[i + 1] + step;
  }

  // Walk forward from "Signed CA" to "Downloads" — each later stage is a fraction
  // of the stage before it.
  for (let i = signedIdx + 1; i < FUNNEL_STAGES.length; i++) {
    const pct = 55 + (hash(`${listingId}-funnel-down-${i}`) % 30); // 55–84%
    counts[i] = Math.max(1, Math.round((counts[i - 1] * pct) / 100));
  }

  return FUNNEL_STAGES.map((stage, i) => ({ stage, count: counts[i] }));
}

/** Canned "AI-generated" summary text used by the Activity Summary mock. */
export function buildActivitySummaryText(
  listingName: string,
  kpis: ClientReportKpis,
): string {
  return (
    `${listingName} has been on the market for ${kpis.totalDaysOnMarket} days and has generated ` +
    `${kpis.leadsCount} leads to date. Of those, ${kpis.casSigned} have executed a Confidentiality ` +
    `Agreement, indicating strong buyer interest and continued engagement with the marketing ` +
    `package. Outreach and website activity remain steady, with prospective buyers progressing ` +
    `through document review toward offer stage.`
  );
}
