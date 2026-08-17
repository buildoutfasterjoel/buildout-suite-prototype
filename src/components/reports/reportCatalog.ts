import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBriefcaseClock,
  faCalculator,
  faCalendar,
  faChartSimple,
  faCodeCompare,
  faCreditCard,
  faDollarSign,
  faFileInvoiceDollar,
  faHandshake,
  faMoneyCheckDollar,
  faRankingStar,
  faSignHanging,
  faUsers,
} from "@fortawesome/pro-regular-svg-icons";

export type StandardReport = {
  /** Stable slug — the future `/reports/standard/$reportId` segment. */
  id: string;
  title: string;
  description: string;
  icon: IconDefinition;
};

export type ReportGroup = {
  label: string;
  reports: StandardReport[];
};

/**
 * The reports Buildout ships pre-built, grouped by the record they read from.
 * Grouping is the whole navigation here — eighteen flat rows is a wall, but
 * "which record am I reporting on" narrows it to two or three candidates.
 *
 * Data, not JSX, so the same catalog can back a future report-picker in the
 * New Report flow without lifting anything out of a rendered list.
 */
export const REPORT_GROUPS: ReportGroup[] = [
  {
    label: "Listings",
    reports: [
      {
        id: "inventory",
        title: "Inventory Report",
        description:
          "Generate a PDF report showcasing properties available for sale or for lease.",
        icon: faSignHanging,
      },
    ],
  },
  {
    label: "Comps",
    reports: [
      {
        id: "sale-comp",
        title: "Sale Comp Report",
        description: "Report on sale comparable properties.",
        icon: faCodeCompare,
      },
      {
        id: "lease-comp",
        title: "Lease Comp Report",
        description: "Report on lease comparable properties.",
        icon: faCodeCompare,
      },
    ],
  },
  {
    label: "Deals",
    reports: [
      {
        id: "critical-dates",
        title: "Critical Dates Report",
        description: "Report on upcoming critical dates such as lease expirations.",
        icon: faCalendar,
      },
      {
        id: "pipeline",
        title: "Pipeline Report",
        description: "Report on deals across all stages of your pipeline.",
        icon: faHandshake,
      },
    ],
  },
  {
    label: "Commissions",
    reports: [
      {
        id: "commissions",
        title: "Commissions Report",
        description:
          "Report on internal broker commissions from your deal pipeline and vouchers.",
        icon: faDollarSign,
      },
      {
        id: "broker-leaderboard",
        title: "Broker Leaderboard Report",
        description: "Compare your brokers' total commission earnings.",
        icon: faRankingStar,
      },
      {
        id: "office-leaderboard",
        title: "Office Leaderboard Report",
        description: "Compare total commission earnings across offices.",
        icon: faRankingStar,
      },
    ],
  },
  {
    label: "Back Office",
    reports: [
      {
        id: "vouchers",
        title: "Vouchers Report",
        description:
          "Report on transaction-level data from draft, submitted, and approved vouchers.",
        icon: faFileInvoiceDollar,
      },
      {
        id: "receivables",
        title: "Receivables Report",
        description:
          "Track open receivables, money that's due to be collected by the brokerage.",
        icon: faBriefcaseClock,
      },
      {
        id: "deposits",
        title: "Deposits Report",
        description:
          "Report on past deposits, money that's already been collected by the brokerage.",
        icon: faCreditCard,
      },
      {
        id: "other-credits",
        title: "Other Credits Report",
        description:
          "Report on other receivable credits, money that could not be collected.",
        icon: faCreditCard,
      },
      {
        id: "payables",
        title: "Payables Report",
        description:
          "Track open payables, money that's due to be paid out to brokers.",
        icon: faMoneyCheckDollar,
      },
      {
        id: "payments",
        title: "Payments Report",
        description:
          "Report on past payments, money that's already been paid out to brokers.",
        icon: faMoneyCheckDollar,
      },
      {
        id: "deductions",
        title: "Deductions Report",
        description:
          "Track open deductions, money that's due to be deducted from deposits or payments.",
        icon: faCalculator,
      },
      {
        id: "deduction-credits",
        title: "Deduction Credits Report",
        description:
          "Report on past deduction credits, money that's been applied to cover a deduction.",
        icon: faCalculator,
      },
    ],
  },
  {
    label: "Other",
    reports: [
      {
        id: "marketing-template",
        title: "Marketing Template Report",
        description:
          "Report on documents, emails, and grids created in the last year.",
        icon: faChartSimple,
      },
      {
        id: "user",
        title: "User Report",
        description: "Custom user report.",
        icon: faUsers,
      },
    ],
  },
];

/** Flat lookup for resolving a saved report back to the standard it extends. */
export const REPORTS_BY_ID = new Map<string, StandardReport>(
  REPORT_GROUPS.flatMap((group) => group.reports).map((r) => [r.id, r]),
);
