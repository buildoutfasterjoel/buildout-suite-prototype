/**
 * The demo brand — single source of truth for the editor's designer templates,
 * on-brand blank page, and brand-aware pickers. In production this comes from
 * the company-settings brand kit; here it is seeded for the prototype.
 *
 * Font constants live here (not blockFactory) so brand typography has one home;
 * blockFactory re-exports them for backward compatibility.
 */
export const SERIF = "'PT Serif', Georgia, serif";
export const SANS = "'proxima-nova', system-ui, sans-serif";

export const BRAND = {
  name: "Meridian Point Real Estate",
  logoSrc: "/assets/branding/gemini-logo.png",
  fonts: { heading: SERIF, body: SANS },
  palette: {
    primary: "#7422ce", // editor primary
    secondary: "#4b1a8f", // darker brand purple
    accent: "#00bc7d", // editor success/accent green
    ink: "#22262f", // editor ink
    neutral: "#506079", // editor muted
    surface: "#f9f5ff", // editor primarySoft
  },
} as const;

/** Brand palette as an ordered swatch list for the color pickers. */
export const BRAND_SWATCHES: string[] = Object.values(BRAND.palette);
