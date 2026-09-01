/**
 * Contact ownership & privacy — the company-level ceilings and how they combine
 * with a person's permissions.
 *
 * Three rules, from docs/superpowers/specs/contact-ownership-settings.md:
 *
 *   1. A company switch decides what the company *allows* (the ceiling). When
 *      it is off, the matching permission is off for everyone and locked; role
 *      defaults and overrides are left alone underneath so re-opening the
 *      ceiling restores them exactly.
 *   2. Each open switch also carries the company's *default*: hand the grant to
 *      every Broker, or to nobody until an admin grants it per person. That is
 *      how one firm runs a broker-book shop and another runs an open database
 *      with a single protected rainmaker, on the same roles.
 *   3. Every contact has exactly one accountable person. When the company owns
 *      the record, assignment produces them; when a broker does, ownership
 *      does. Sharing hangs off that person in either case.
 *
 * Pure and React-free so the row table below can be pinned in Vitest. The
 * store that holds the live settings is `useContactAccessSettings`.
 */
import {
  PERMISSION_BY_ID,
  isPermissionOn,
  type CompanyGateId,
  type PermissionOverrides,
  type ResolvedPermission,
  type RoleId,
} from "#/data/permissions";

/**
 * Who a switch's grant reaches by default. `brokers`: every role that carries
 * the permission (Broker) gets it. `granted`: nobody, until an admin turns it on
 * for a specific person — the role default reads Off and each grant is Custom.
 */
export type GrantDefault = "brokers" | "granted";

/** The two account-level switches on the Company settings card. */
export interface ContactAccessSettings {
  /**
   * Off: the company owns every contact and Managing Directors assign them
   * (Model A — open-book, assignment is responsibility not access). On:
   * eligible brokers own the contacts they bring in.
   */
  brokersCanOwnContacts: boolean;
  ownDefault: GrantDefault;
  /**
   * Off: everything a broker owns stays visible across the firm — ownership is
   * attribution and control, not secrecy. On: an owner can mark a contact
   * private, hiding even its existence until shared. Moot while
   * `brokersCanOwnContacts` is off.
   */
  ownedContactsCanBePrivate: boolean;
  privateDefault: GrantDefault;
}

/**
 * Both on, both for every Broker: the prototype has always behaved as a
 * broker-book shop (the signed-in user owns what they create), so this default
 * changes nothing for anyone who never opens the card.
 */
export const DEFAULT_CONTACT_ACCESS_SETTINGS: ContactAccessSettings = {
  brokersCanOwnContacts: true,
  ownDefault: "brokers",
  ownedContactsCanBePrivate: true,
  privateDefault: "brokers",
};

/** Permission ids for the user-level grants. */
export const OWN_CONTACTS = "own-contacts";
export const PRIVATE_CONTACTS = "private-contacts";
export const VIEW_PRIVATE_CONTACTS = "view-private-contacts";

export const GRANT_DEFAULT_LABELS: Record<GrantDefault, string> = {
  brokers: "Every Broker, by default",
  granted: "Only people you grant it to",
};

/** How a gate stands for one permission, and the copy for a row under it. */
export interface GateState {
  id: CompanyGateId;
  /** The ceiling — false means Off and locked for everyone. */
  open: boolean;
  /** Which way the company hands the grant out. Meaningless when closed. */
  grantDefault: GrantDefault;
  /** The company setting's label, for "turn on X in Company settings". */
  settingLabel: string;
}

const GATE_LABELS: Record<CompanyGateId, string> = {
  "contact-ownership": "Brokers can own contacts",
  "contact-privacy": "Broker-owned contacts can be private",
};

function gateOpen(id: CompanyGateId, settings: ContactAccessSettings): boolean {
  switch (id) {
    case "contact-ownership":
      return settings.brokersCanOwnContacts;
    case "contact-privacy":
      // Privacy of broker-owned contacts has nothing to apply to when brokers
      // can't own contacts, so the ownership ceiling closes this one too.
      return settings.brokersCanOwnContacts && settings.ownedContactsCanBePrivate;
  }
}

function gateDefault(
  id: CompanyGateId,
  settings: ContactAccessSettings,
): GrantDefault {
  return id === "contact-ownership" ? settings.ownDefault : settings.privateDefault;
}

/**
 * The gate a permission sits under, or undefined for the ungated majority.
 * Callers treat a closed gate as "off, and not editable here".
 */
export function gateFor(
  permissionId: string,
  settings: ContactAccessSettings,
): GateState | undefined {
  const gate = PERMISSION_BY_ID.get(permissionId)?.gate;
  if (!gate) return undefined;
  return {
    id: gate,
    open: gateOpen(gate, settings),
    grantDefault: gateDefault(gate, settings),
    settingLabel: GATE_LABELS[gate],
  };
}

/**
 * Whether the company's default for a gated permission suppresses the role's
 * grant. Only the *grant* permissions are handed out per person; the MD
 * see-through permission keeps its role default whichever way privacy is
 * handed out, because it's about oversight, not book-building.
 */
function roleDefaultSuppressed(permissionId: string, gate: GateState): boolean {
  return (
    gate.grantDefault === "granted" &&
    (permissionId === OWN_CONTACTS || permissionId === PRIVATE_CONTACTS)
  );
}

/**
 * A resolved permission after the company ceilings are applied — what the
 * permissions page shows and what `useCan` enforces.
 */
export interface EffectivePermission extends ResolvedPermission {
  gate?: GateState;
  /** Under a closed ceiling: Off, not editable, override preserved underneath. */
  locked: boolean;
  /** The company hands this one out per person, so the role default reads Off. */
  perPerson: boolean;
}

/**
 * Apply the company ceilings to a role-resolved row set. Pure over the input:
 * the role/override resolution in `permissions.ts` stays company-agnostic and
 * this layer sits on top of it.
 */
export function applyCompanyCeilings(
  resolved: ResolvedPermission[],
  overrides: PermissionOverrides,
  settings: ContactAccessSettings,
): EffectivePermission[] {
  return resolved.map((row) => {
    const gate = gateFor(row.permission.id, settings);
    if (!gate) return { ...row, locked: false, perPerson: false };
    if (!gate.open) {
      return { ...row, gate, on: false, custom: false, locked: true, perPerson: false };
    }
    if (!roleDefaultSuppressed(row.permission.id, gate)) {
      return { ...row, gate, locked: false, perPerson: false };
    }
    // Per-person: the role default is treated as Off, and only an explicit
    // grant turns it on. An override of `false` agrees with that and is not
    // custom; an override of `true` is the grant and is.
    const override = overrides[row.permission.id];
    const on = override === true;
    return {
      ...row,
      gate,
      roleDefault: false,
      on,
      custom: on,
      locked: false,
      perPerson: true,
    };
  });
}

/**
 * The `can?` check with ceilings applied — one permission for one person.
 * Mirrors `applyCompanyCeilings` for callers that only need a boolean.
 */
export function isEffectivelyOn(
  roleIds: RoleId[],
  overrides: PermissionOverrides,
  permissionId: string,
  settings: ContactAccessSettings,
): boolean {
  const gate = gateFor(permissionId, settings);
  if (!gate) return isPermissionOn(roleIds, overrides, permissionId);
  if (!gate.open) return false;
  if (roleDefaultSuppressed(permissionId, gate)) {
    return overrides[permissionId] === true;
  }
  return isPermissionOn(roleIds, overrides, permissionId);
}

/**
 * Which row of George's table a company setting + person lands on. `undefined`
 * is the combination his table never spelled out: ownership and privacy both
 * allowed, this person may own but not mark private. It resolves to Row 2 for
 * that one person (decided 2026-09-01).
 */
export type OwnershipRow = 1 | 2 | 3 | 4 | "undefined";

export interface ResolvedContactAccess {
  row: OwnershipRow;
  /** Who owns a contact this person creates or imports. */
  owner: "company" | "broker";
  /** Whether this person can mark an owned contact private. */
  canMarkPrivate: boolean;
  /** Short name for the readout, e.g. "Model A". */
  title: string;
  /** One sentence for the settings card and the permissions page. */
  summary: string;
}

/**
 * Resolve the four switches for one person. `userOn` is the person's effective
 * answer to the two grant permissions with the ceilings already applied — see
 * `isEffectivelyOn`.
 */
export function resolveContactAccess(
  settings: ContactAccessSettings,
  userOn: { own: boolean; private: boolean },
): ResolvedContactAccess {
  if (!settings.brokersCanOwnContacts) {
    return {
      row: 1,
      owner: "company",
      canMarkPrivate: false,
      title: "Model A",
      summary:
        "The company owns every contact and anyone can find it. Managing Directors assign contacts to brokers to work them — assignment is responsibility, not access.",
    };
  }
  if (!userOn.own) {
    return {
      row: 4,
      owner: "company",
      canMarkPrivate: false,
      title: "Model A for this person",
      summary:
        "Their contacts belong to the company and stay visible to the whole firm, while colleagues with Own Contacts keep their own books.",
    };
  }
  if (!settings.ownedContactsCanBePrivate) {
    return {
      row: 2,
      owner: "broker",
      canMarkPrivate: false,
      title: "Own but transparent",
      summary:
        "Brokers own what they bring in, but every contact stays visible across the firm. Ownership is attribution and control, not secrecy.",
    };
  }
  if (!userOn.private) {
    return {
      row: "undefined",
      owner: "broker",
      canMarkPrivate: false,
      title: "Own but transparent, for this person",
      summary:
        "They own their contacts but can't mark any private, while colleagues with Mark Contacts Private can.",
    };
  }
  return {
    row: 3,
    owner: "broker",
    canMarkPrivate: true,
    title: "Model B",
    summary:
      "Brokers own what they bring in and can mark a contact private. A private contact is hidden — search included — until its owner shares it.",
  };
}

/**
 * The company-wide readout on the settings card: what a Broker with no
 * overrides gets under these switches and their defaults.
 */
export function resolveCompanyDefault(
  settings: ContactAccessSettings,
): ResolvedContactAccess {
  return resolveContactAccess(settings, {
    own: settings.ownDefault === "brokers",
    private: settings.privateDefault === "brokers",
  });
}
