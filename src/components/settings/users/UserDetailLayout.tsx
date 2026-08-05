import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBell,
  faEnvelope,
  faGear,
  faPlug,
  faShieldHalved,
  faUser,
} from "@fortawesome/pro-regular-svg-icons";
import type { RosterUser } from "#/data/roster";
import { RoleBadge, StatusIndicator } from "./roleDisplay";

type UserTab = { label: string; slug: string; icon: IconDefinition };

/**
 * A horizontal track rather than a second sidebar.
 *
 * Company settings already owns the left rail; nesting another vertical nav
 * inside the content card would put two verticals at the same level with
 * nothing to say which contains which. Splitting the three navigational jobs
 * keeps them legible: the rail says where you are in settings, the breadcrumb
 * says which person, the tabs say which facet of that person.
 *
 * Today's Profile Settings ships nine sections; these five fold them together.
 * Two of those merges are still open — Syndication sits under Email because
 * per-user it's mostly sending identity, and AI Settings sits under
 * Integrations. If the track outgrows six, add an overflow menu rather than
 * reaching for a rail.
 */
export const USER_TABS: UserTab[] = [
  { label: "Profile", slug: "profile", icon: faUser },
  { label: "Roles & Permissions", slug: "permissions", icon: faShieldHalved },
  { label: "Email", slug: "email", icon: faEnvelope },
  { label: "Notifications", slug: "notifications", icon: faBell },
  { label: "Integrations", slug: "integrations", icon: faPlug },
];

/** Active tab slug from a `/settings/users/:id/:tab` pathname. */
function activeSlug(pathname: string): string {
  return pathname.split("/").filter(Boolean).pop() ?? "profile";
}

/**
 * Identity header + tab track, wrapping every tab of one user's settings.
 *
 * The header sits above the tabs and stays put, so who you're editing never
 * scrolls away as you move between facets. Per-tab actions (Edit permissions,
 * Save profile) belong to their tab, not here.
 */
export function UserDetailLayout({
  user,
  children,
}: {
  user: RosterUser;
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = activeSlug(pathname);
  const activeLabel =
    USER_TABS.find((tab) => tab.slug === current)?.label ?? "Profile";

  function handleTabChange(value: string) {
    const tab = USER_TABS.find((t) => t.label === value);
    if (!tab) return;
    void navigate({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to: `/settings/users/${user.id}/${tab.slug}` as any,
    });
  }

  return (
    <div className="p-4 d-flex flex-column gap-4">
      <Breadcrumb>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link render={<Link to="/settings/company" />}>
              <FontAwesomeIcon icon={faGear} />
              Company settings
            </Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Link render={<Link to="/settings/users" />}>
              Users
            </Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page>{user.name}</Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb>

      {/* Identity — persistent across tabs */}
      <div className="d-flex align-items-center gap-3 flex-wrap">
        <Avatar style={{ width: 48, height: 48 }}>
          {user.avatarUrl && <Avatar.Image src={user.avatarUrl} alt="" />}
          <Avatar.Fallback>{user.initials}</Avatar.Fallback>
        </Avatar>
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h2 className="fs-5 fw-semibold mb-0">{user.name}</h2>
            {user.roleIds.map((roleId) => (
              <RoleBadge key={roleId} roleId={roleId} />
            ))}
          </div>
          <div className="text-muted d-flex align-items-center gap-2 flex-wrap">
            <span>
              {user.title} · {user.office}
            </span>
            <span aria-hidden>·</span>
            <StatusIndicator status={user.status} />
          </div>
        </div>
      </div>

      <Tabs value={activeLabel} onValueChange={handleTabChange}>
        <Tabs.List>
          {USER_TABS.map((tab) => (
            <Tabs.Tab
              key={tab.slug}
              value={tab.label}
              icon={<FontAwesomeIcon icon={tab.icon} />}
            >
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {children}
    </div>
  );
}
