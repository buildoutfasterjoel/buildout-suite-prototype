import { describe, expect, it } from "vitest";
import { accountableName, resolveViewerRights } from "#/data/contactViewerAccess";
import { resolveContactOwnership } from "#/data/contactOwnership";
import { SEED_ROSTER } from "#/data/roster";
import { DEFAULT_CONTACT_ACCESS_SETTINGS } from "#/data/contactAccess";
import { CURRENT_USER, TEAMMATES, type ContactShare } from "#/data/teammates";

const COMPANY = "Buse Built Investments";
const MODEL_A = { ...DEFAULT_CONTACT_ACCESS_SETTINGS, brokersCanOwnContacts: false };
const own = (assignedTo: string, settings = DEFAULT_CONTACT_ACCESS_SETTINGS) =>
  resolveContactOwnership({ assignedTo }, SEED_ROSTER, settings, COMPANY);
const me = (tier: ContactShare["tier"]): ContactShare => ({ member: CURRENT_USER, tier });
const marcus = TEAMMATES.find((t) => t.id === "marcus-patel")!;

describe("resolveViewerRights", () => {
  it("the owner can do everything", () => {
    const r = resolveViewerRights(own("Ethan Thompson"), []);
    expect(r).toMatchObject({
      relationship: "owner",
      canLog: true,
      canEdit: true,
      canReachOut: true,
      canShare: true,
    });
  });

  it("the assignee of a company-owned record gets the full working set", () => {
    const r = resolveViewerRights(own("Ethan Thompson", MODEL_A), []);
    expect(r.relationship).toBe("assignee");
    expect(r).toMatchObject({ canLog: true, canEdit: true, canReachOut: true, canShare: true });
  });

  it("a visible record the viewer has no relationship with is read-only", () => {
    // Andreane Daugherty: Sarah's, no collaborators, visible to the firm.
    const r = resolveViewerRights(own("Sarah Chen"), [{ member: marcus, tier: "outreach" }]);
    expect(r).toMatchObject({
      relationship: "none",
      label: "View only",
      canLog: false,
      canEdit: false,
      canReachOut: false,
      canShare: false,
    });
  });

  it("share tiers map onto the sharing rules table", () => {
    const view = resolveViewerRights(own("Sarah Chen"), [me("view")]);
    expect(view).toMatchObject({ relationship: "collaborator", tier: "view", canLog: false, canEdit: false, canReachOut: false });

    const contributor = resolveViewerRights(own("Sarah Chen"), [me("contributor")]);
    expect(contributor).toMatchObject({ canLog: true, canEdit: true, canReachOut: false, canShare: false });

    const outreach = resolveViewerRights(own("Sarah Chen"), [me("outreach")]);
    expect(outreach).toMatchObject({ canLog: true, canEdit: true, canReachOut: true, canShare: false });
  });

  it("names who to ask", () => {
    expect(accountableName(own("Sarah Chen"))).toBe("Sarah Chen");
    expect(accountableName(own("Sarah Chen", MODEL_A))).toBe("Sarah Chen");
    expect(accountableName(own("J. Whitfield", MODEL_A))).toBe("a Managing Director");
  });
});
