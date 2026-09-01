import { afterEach, describe, expect, it } from "vitest";
import { currentUser, useCurrentUser, viewerId } from "#/data/currentUser";
import { resolveContactOwnership, viewerOwns } from "#/data/contactOwnership";
import { canSeeContact, resolveViewerRights } from "#/data/contactViewerAccess";
import { SEED_ROSTER } from "#/data/roster";
import { DEFAULT_CONTACT_ACCESS_SETTINGS } from "#/data/contactAccess";
import { CURRENT_USER } from "#/data/teammates";

const COMPANY = "Buse Built Investments";
const sarahsPrivate = () =>
  resolveContactOwnership(
    { assignedTo: "Sarah Chen", isPrivate: true },
    SEED_ROSTER,
    DEFAULT_CONTACT_ACCESS_SETTINGS,
    COMPANY,
  );

describe("the viewer seat", () => {
  afterEach(() => useCurrentUser.setState({ id: CURRENT_USER.id }));

  it("defaults to the protagonist", () => {
    expect(viewerId()).toBe("you");
    expect(currentUser().name).toBe("Ethan Thompson");
  });

  it("ignores an unknown id", () => {
    useCurrentUser.getState().setId("nobody");
    expect(viewerId()).toBe("you");
  });

  it("flips ownership, rights and visibility when the seat changes", () => {
    const o = sarahsPrivate();
    expect(viewerOwns(o)).toBe(false);
    expect(canSeeContact(o, [], false)).toBe(false);
    expect(resolveViewerRights(o, []).relationship).toBe("none");

    useCurrentUser.getState().setId("sarah-chen");
    expect(currentUser().name).toBe("Sarah Chen");
    expect(viewerOwns(o)).toBe(true);
    expect(canSeeContact(o, [], false)).toBe(true);
    expect(resolveViewerRights(o, []).relationship).toBe("owner");
  });
});
