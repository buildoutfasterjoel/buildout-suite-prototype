/**
 * Human labels for the tools that surface as chips — "Drafting email", not
 * `draft_email`. Present participle, which is the tense they're read in: while
 * running. A tool missing from every map falls back to a de-snaked version of
 * its own name, so a new tool reads as prose rather than as code.
 */
export const SUITE_TOOL_LABELS: Record<string, string> = {
  draft_email: "Drafting email",
  send_email: "Sending email",
  createEmailDraft: "Creating draft",
  searchAll: "Searching your book",
  find_contact: "Finding contact",
  getContactDetail: "Getting contact detail",
  listDeals: "Pulling deals",
  listContacts: "Pulling contacts",
  listDealsForContact: "Pulling their deals",
  listDealsForProperty: "Pulling deals",
  listContactsForDeal: "Pulling contacts",
  getProperty: "Reading the property",
  getListing: "Reading the deal",
  createDeal: "Creating deal",
  updateDealStage: "Updating stage",
  linkContactToDeal: "Linking contact",
  create_contact: "Adding contact",
  createCallList: "Saving call list",
  build_call_list: "Building call list",
  build_marketing_package: "Building package",
  generateDoc: "Generating document",
  filter_listings: "Filtering deals",
  research_contact: "Researching contact",
  answer_about_contact: "Looking that up",
  analyze_book: "Reviewing your book",
  add_activity: "Logging activity",
  log_call: "Logging call",
  create_task: "Setting reminder",
  start_call: "Starting call",
  plan_my_day: "Planning your day",
  navigateTo: "Taking you there",
  task_search: "Checking your tasks",
  task_load: "Reading the task",
  activity_search: "Reading the timeline",
  activity_load: "Reading the activity",
  attachment_list: "Checking the files",
  attachment_load: "Reading the file",
  voucher_search: "Pulling vouchers",
  voucher_load: "Reading the voucher",
  research_property_search: "Searching Insights",
  research_property_load: "Reading the record",
  deal_pipeline_totals: "Totalling the pipeline",
  update_contact: "Updating contact",
  contact_tags: "Reading tags",
  add_contact_tags: "Adding tags",
  assign_contact: "Assigning the contact",
  remove_contact_tags: "Removing tags",
  brief: "Reading the record",
  support: "Handing you off",
};

/**
 * The same vocabulary in the past tense, for a call that has landed.
 *
 * A separate map rather than a rule applied to the one above, because English
 * doesn't take one: "Setting reminder" → "Set reminder", "Totalling" →
 * "Totalled", "Handing you off" → "Handed you off". Every mechanical version of
 * this produces a handful of sentences no broker would write.
 *
 * The tense is the whole point of the settled state. A finished call is a fact
 * about what Otto did, and reading it in the present participle — "Reading the
 * record", under a paragraph that has clearly finished reading it — is the
 * sentence a spinner was standing in for.
 */
export const SUITE_TOOL_LABELS_DONE: Record<string, string> = {
  draft_email: "Drafted email",
  send_email: "Sent email",
  createEmailDraft: "Created draft",
  searchAll: "Searched your book",
  find_contact: "Found contact",
  getContactDetail: "Got contact detail",
  listDeals: "Pulled deals",
  listContacts: "Pulled contacts",
  listDealsForContact: "Pulled their deals",
  listDealsForProperty: "Pulled deals",
  listContactsForDeal: "Pulled contacts",
  getProperty: "Read the property",
  getListing: "Read the deal",
  createDeal: "Created deal",
  updateDealStage: "Updated stage",
  linkContactToDeal: "Linked contact",
  create_contact: "Added contact",
  createCallList: "Saved call list",
  build_call_list: "Built call list",
  build_marketing_package: "Built package",
  generateDoc: "Generated document",
  filter_listings: "Filtered deals",
  research_contact: "Researched contact",
  answer_about_contact: "Looked that up",
  analyze_book: "Reviewed your book",
  add_activity: "Logged activity",
  log_call: "Logged call",
  create_task: "Set reminder",
  start_call: "Started call",
  plan_my_day: "Planned your day",
  navigateTo: "Took you there",
  task_search: "Checked your tasks",
  task_load: "Read the task",
  activity_search: "Read the timeline",
  activity_load: "Read the activity",
  attachment_list: "Checked the files",
  attachment_load: "Read the file",
  voucher_search: "Pulled vouchers",
  voucher_load: "Read the voucher",
  research_property_search: "Searched Insights",
  research_property_load: "Read the record",
  deal_pipeline_totals: "Totalled the pipeline",
  update_contact: "Updated contact",
  contact_tags: "Read tags",
  add_contact_tags: "Added tags",
  assign_contact: "Assigned the contact",
  remove_contact_tags: "Removed tags",
  brief: "Read the record",
  support: "Handed you off",
};

/** De-snake a raw tool name into something that reads as prose. */
function humanize(name: string): string {
  const words = name.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Label a running tool call. `extra` is a per-surface map that wins over the
 * shared one, so the editor's Otto can say "Adding a page" without the suite
 * rail's vocabulary leaking into the editor or vice versa.
 */
export function toolLabel(name: string, extra?: Record<string, string>): string {
  return extra?.[name] ?? SUITE_TOOL_LABELS[name] ?? humanize(name);
}

/**
 * Label a *finished* tool call. Falls all the way back through the present-tense
 * maps before humanizing: a surface that has only named its tools in one tense
 * should still read as its own vocabulary rather than as a raw identifier, and a
 * slightly-off tense beats "Get contact detail".
 */
export function toolDoneLabel(
  name: string,
  done?: Record<string, string>,
  running?: Record<string, string>,
): string {
  return (
    done?.[name] ??
    SUITE_TOOL_LABELS_DONE[name] ??
    running?.[name] ??
    SUITE_TOOL_LABELS[name] ??
    humanize(name)
  );
}
