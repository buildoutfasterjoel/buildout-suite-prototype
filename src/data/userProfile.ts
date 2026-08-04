/**
 * Per-user profile settings — the Profile tab of a user's page.
 *
 * Mirrors the fields Buildout's Profile Settings page carries today, in the
 * admin context (an admin editing a teammate) rather than the self-serve one.
 * A few fields are deliberately absent here because they're self-only: setting a
 * password and enrolling MFA belong to the person, not to an admin, so the
 * admin view offers a reset instead.
 *
 * The identity fields an admin can change — name, title, office, email — write
 * back to the roster so the header and the Users table stay in step. Everything
 * else lives in local form state for the session, matching the other prototype
 * settings screens.
 */
import type { RosterUser } from "#/data/roster";

/** Where a user lands after signing in. Chosen per user today. */
export type HomepageRoute = "pipeline" | "listings" | "vouchers";

export const HOMEPAGE_ROUTES: { value: HomepageRoute; label: string; hint: string }[] = [
  {
    value: "pipeline",
    label: "Pipeline",
    hint: "Deals in flight, grouped by stage.",
  },
  { value: "listings", label: "Listings", hint: "The listing index." },
  {
    value: "vouchers",
    label: "Vouchers",
    hint: "Back-office commission vouchers.",
  },
];

export interface UserProfile {
  /** Login identifier — distinct from the contact email below. */
  login: string;
  email: string;
  /** Mobile number used for the MFA one-time passcode. */
  mfaNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneExtension: string;
  cellPhone: string;
  fax: string;
  country: string;
  state: string;
  city: string;
  zip: string;
  showVcard: boolean;
  showPrintButton: boolean;
  designations: string[];
  showDesignations: boolean;
  specialties: string[];
  showSpecialties: boolean;
  subSpecialties: string[];
  showSubSpecialties: boolean;
  organizations: string[];
  showOrganizations: boolean;
  homepageRoute: HomepageRoute;
  primaryOffice: string;
  secondaryOffices: string[];
  jobTitle: string;
  hideTitleOnPlugin: boolean;
  facebookUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  instagramUrl: string;
  brokerProfileUrl: string;
  biography: string;
}

export const DESIGNATION_OPTIONS = [
  "CCIM",
  "SIOR",
  "CPM",
  "MAI",
  "CRE",
  "ALC",
];

export const ORGANIZATION_OPTIONS = [
  "CCIM Institute",
  "SIOR",
  "ULI",
  "NAIOP",
  "ICSC",
  "BOMA",
  "Local Board of Realtors",
];

export const COUNTRY_OPTIONS = ["United States", "Canada", "Mexico"];

/** Enough states to exercise the control without shipping a gazetteer. */
export const STATE_OPTIONS = [
  "IL",
  "CO",
  "TX",
  "GA",
  "NY",
  "CA",
  "FL",
  "WA",
];

/**
 * A user's starting profile. Contact details are seeded per person where the
 * roster knows them and left blank otherwise — blank fields are honest here,
 * since a half-filled profile is the normal state of this page.
 */
export function seedProfile(user: RosterUser): UserProfile {
  const [firstName, ...rest] = user.name.split(" ");
  return {
    login: user.email,
    email: user.email,
    mfaNumber: "",
    firstName,
    lastName: rest.join(" "),
    phone: "312.555.0148",
    phoneExtension: "",
    cellPhone: "",
    fax: "",
    country: "United States",
    state: user.office.startsWith("Chicago")
      ? "IL"
      : user.office === "Denver"
        ? "CO"
        : user.office === "Austin"
          ? "TX"
          : user.office === "Atlanta"
            ? "GA"
            : "",
    city: user.office.startsWith("Chicago") ? "Chicago" : user.office,
    zip: "",
    showVcard: false,
    showPrintButton: false,
    designations: [],
    showDesignations: true,
    specialties: [],
    showSpecialties: true,
    subSpecialties: [],
    showSubSpecialties: false,
    organizations: [],
    showOrganizations: true,
    homepageRoute: "pipeline",
    primaryOffice: user.office,
    secondaryOffices: [],
    jobTitle: user.title,
    hideTitleOnPlugin: false,
    facebookUrl: "",
    twitterUrl: "",
    linkedinUrl: "",
    instagramUrl: "",
    brokerProfileUrl: "",
    biography: "",
  };
}
