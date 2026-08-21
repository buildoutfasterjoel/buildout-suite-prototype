/**
 * Human labels for the tools that surface as chips — "Drafting email", not
 * `draft_email`. Present participle, which is the tense they're read in: while
 * running. A tool missing from every map falls back to a de-snaked version of
 * its own name, so a new tool reads as prose rather than as code.
 */
export const SUITE_TOOL_LABELS: Record<string, string> = {
  draft_email: "Drafting email",
  send_email: "Sending email",
  create_email_draft: "Creating draft",
  searchAll: "Searching your book",
  find_contact: "Finding contact",
  get_contact_detail: "Reading the record",
  list_deals: "Pulling deals",
  list_contacts: "Pulling contacts",
  list_deals_for_contact: "Pulling their deals",
  list_deals_for_property: "Pulling deals",
  list_contacts_for_deal: "Pulling contacts",
  get_property: "Reading the property",
  get_listing: "Reading the deal",
  create_deal: "Creating deal",
  update_deal_stage: "Updating stage",
  link_contact_to_deal: "Linking contact",
  create_contact: "Adding contact",
  create_call_list: "Saving call list",
  build_call_list: "Building call list",
  build_marketing_package: "Building package",
  generate_doc: "Generating document",
  filter_listings: "Filtering deals",
  research_contact: "Researching contact",
  answer_about_contact: "Looking that up",
  analyze_book: "Reviewing your book",
  add_note: "Logging note",
  create_task: "Setting reminder",
  start_call: "Starting call",
  plan_my_day: "Planning your day",
  navigate_to: "Taking you there",
};

/**
 * Label a tool call. `extra` is a per-surface map that wins over the shared one,
 * so the editor's Otto can say "Adding a page" without the suite rail's
 * vocabulary leaking into the editor or vice versa.
 */
export function toolLabel(name: string, extra?: Record<string, string>): string {
  const known = extra?.[name] ?? SUITE_TOOL_LABELS[name];
  if (known) return known;
  const words = name.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
