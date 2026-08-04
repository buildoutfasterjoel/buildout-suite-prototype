/**
 * Company-settings seed data.
 *
 * Prototype-only: the settings screens hold their edits in component state for
 * the length of a session (same convention as the listing website settings).
 * Nothing here is persisted, so a reload returns to these defaults.
 */

export interface CompanySettings {
  name: string;
  emailAddress: string;
  salesforceId: string;
  adminEmailAddresses: string;
  website: string;
  specialties: string[];
  subSpecialties: string[];
  facebookUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  youtubeUrl: string;
  disclaimer: string;
  shareOnMarketListings: boolean;
  shareClosedListings: boolean;
}

/** The boilerplate Buildout ships as a company's starting disclaimer. */
const DEFAULT_DISCLAIMER =
  "We obtained the information above from sources we believe to be reliable. However, we have not verified its accuracy and make no guarantee, warranty or representation about it. It is submitted subject to the possibility of errors, omissions, change of price, rental or other conditions, prior sale, lease or financing, or withdrawal without notice. We include projections, opinions, assumptions or estimates for example only, and they may not represent current or future performance of the property. You and your tax and legal advisors should conduct your own investigation of the property and transaction.";

export const COMPANY_SETTINGS: CompanySettings = {
  name: "Buse Built Investments",
  emailAddress: "",
  salesforceId: "",
  adminEmailAddresses: "ethan.thompson@buildout.com",
  website: "https://buildout.com",
  specialties: [],
  subSpecialties: [],
  facebookUrl: "",
  linkedinUrl: "",
  twitterUrl: "",
  youtubeUrl: "",
  disclaimer: DEFAULT_DISCLAIMER,
  shareOnMarketListings: false,
  shareClosedListings: false,
};

/** Top-level practice areas a company can claim. */
export const SPECIALTY_OPTIONS = [
  "Office",
  "Retail",
  "Industrial",
  "Multifamily",
  "Land",
  "Hospitality",
  "Medical",
  "Self Storage",
  "Special Purpose",
];

/** Narrower focuses, offered alongside the specialties above. */
export const SUB_SPECIALTY_OPTIONS = [
  "Investment Sales",
  "Landlord Representation",
  "Tenant Representation",
  "Owner/User Sales",
  "Net Lease",
  "Development Sites",
  "Property Management",
  "Debt & Equity",
  "Valuation & Advisory",
];

/** Brand style settings for company documents and the listing website. */
export interface CompanyStyles {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  documentAccent: "primary" | "secondary" | "accent";
}

export const COMPANY_STYLES: CompanyStyles = {
  primaryColor: "#3D2E7C",
  secondaryColor: "#1D1B45",
  accentColor: "#7A5AF8",
  headingFont: "Inter",
  bodyFont: "Inter",
  documentAccent: "primary",
};

export const FONT_OPTIONS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Source Serif Pro",
  "Playfair Display",
];
