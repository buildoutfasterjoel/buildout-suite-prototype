import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faMagnifyingGlass,
  faPlus,
  faUsersSlash,
} from "@fortawesome/pro-regular-svg-icons";
import { ROLES, type RoleId } from "#/data/permissions";
import { OFFICES, rosterCounts, type RosterUser } from "#/data/roster";
import { useRoster } from "./useRoster";
import { useCan } from "./useViewer";
import { ManageCompanyNotice } from "./ManageCompanyNotice";
import { notify } from "#/lib/notify";
import { NeutralBadge, RoleBadge, StatusIndicator } from "./roleDisplay";

const ALL_ROLES = "all";
const ALL_OFFICES = "all";
const ANY_STATUS = "any";

type StatusFilter = "active" | "deactivated" | typeof ANY_STATUS;

/** Trigger labels. Select renders the raw value unless given a formatter. */
const ROLE_FILTER_LABELS: Record<string, string> = {
  [ALL_ROLES]: "All roles",
  ...Object.fromEntries(ROLES.map((role) => [role.id, role.name])),
};

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  active: "Active",
  deactivated: "Deactivated",
  [ANY_STATUS]: "Any status",
};

/**
 * Company settings → Users. The roster is the entry point to the roles &
 * permissions model: pick a person to see exactly what they can do today.
 */
export function UsersRoster() {
  const navigate = useNavigate();
  const users = useRoster((s) => s.users);
  // Anyone may browse the roster; only Manage Company may add to it.
  const canManage = useCan("manage-company");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleId | typeof ALL_ROLES>(
    ALL_ROLES,
  );
  const [officeFilter, setOfficeFilter] = useState<string>(ALL_OFFICES);
  // Defaults to Active, matching the mocks — a deactivated user is rarely what
  // an admin came here for, but the count line always reports the whole roster.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== ALL_ROLES && !user.roleIds.includes(roleFilter)) {
        return false;
      }
      if (officeFilter !== ALL_OFFICES && user.office !== officeFilter) {
        return false;
      }
      if (statusFilter !== ANY_STATUS && user.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, officeFilter, statusFilter]);

  const counts = rosterCounts(users);

  function openUser(user: RosterUser) {
    void navigate({
      to: "/settings/users/$userId",
      params: { userId: user.id },
    });
  }

  return (
    <div className="p-4 d-flex flex-column gap-4">
      {/* Header */}
      <div className="d-flex align-items-start gap-3">
        <div className="flex-grow-1">
          <h2 className="fs-5 fw-semibold mb-1">Users</h2>
          <p className="text-muted mb-0">
            Everyone at Buildout. Select a person to view or change what they
            can do.
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            className="flex-shrink-0"
            onClick={() =>
              notify({
                title: "Invite user",
                description:
                  "Inviting teammates isn't wired up in this prototype.",
              })
            }
          >
            <FontAwesomeIcon icon={faPlus} />
            Invite user
          </Button>
        )}
      </div>

      {!canManage && <ManageCompanyNotice what="invite or change teammates" />}

      {/* Toolbar */}
      <div className="d-flex align-items-center gap-3 flex-wrap">
        <div style={{ minWidth: 260 }}>
          <InputGroup>
            <InputGroup.Addon>
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </InputGroup.Addon>
            <Input
              type="search"
              placeholder="Search people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search people"
            />
          </InputGroup>
        </div>

        <Select
          value={roleFilter}
          onValueChange={(v) => v && setRoleFilter(v as RoleId | typeof ALL_ROLES)}
        >
          <Select.Trigger
            className="w-auto"
            style={{ minWidth: 170 }}
            aria-label="Filter by role"
          >
            <Select.Value>
              {(value: string) => ROLE_FILTER_LABELS[value] ?? value}
            </Select.Value>
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={ALL_ROLES}>All roles</Select.Item>
            {ROLES.map((role) => (
              <Select.Item key={role.id} value={role.id}>
                {role.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>

        <Select
          value={officeFilter}
          onValueChange={(v) => v && setOfficeFilter(v as string)}
        >
          <Select.Trigger
            className="w-auto"
            style={{ minWidth: 190 }}
            aria-label="Filter by office"
          >
            <Select.Value>
              {(value: string) =>
                value === ALL_OFFICES ? "All offices" : value
              }
            </Select.Value>
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={ALL_OFFICES}>All offices</Select.Item>
            {OFFICES.map((office) => (
              <Select.Item key={office} value={office}>
                {office}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}
        >
          <Select.Trigger
            className="w-auto"
            style={{ minWidth: 140 }}
            aria-label="Filter by status"
          >
            <Select.Value>
              {(value: StatusFilter) => STATUS_FILTER_LABELS[value] ?? value}
            </Select.Value>
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="active">Active</Select.Item>
            <Select.Item value="deactivated">Deactivated</Select.Item>
            <Select.Item value={ANY_STATUS}>Any status</Select.Item>
          </Select.Content>
        </Select>
      </div>

      {/* Roster */}
      {filtered.length === 0 ? (
        <div className="d-flex justify-content-center py-6">
          <Empty>
            <Empty.Media>
              <FontAwesomeIcon icon={faUsersSlash} aria-hidden />
            </Empty.Media>
            <Empty.Content>
              <Empty.Title>No people match</Empty.Title>
              Try a different search, role, or status.
            </Empty.Content>
          </Empty>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Name</Table.Head>
              <Table.Head>Role</Table.Head>
              <Table.Head>Office</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head aria-label="Open" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filtered.map((user) => {
              const dimmed = user.status === "deactivated";
              return (
                <Table.Row
                  key={user.id}
                  className="users-roster__row"
                  onClick={() => openUser(user)}
                >
                  <Table.Cell>
                    <div
                      className="d-flex align-items-center gap-3"
                      style={dimmed ? { opacity: 0.6 } : undefined}
                    >
                      <Avatar style={{ width: 32, height: 32 }}>
                        {user.avatarUrl && (
                          <Avatar.Image src={user.avatarUrl} alt="" />
                        )}
                        <Avatar.Fallback>{user.initials}</Avatar.Fallback>
                      </Avatar>
                      <div style={{ minWidth: 0 }}>
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-semibold text-truncate">
                            {user.name}
                          </span>
                          {user.isYou && <NeutralBadge>YOU</NeutralBadge>}
                        </div>
                        <div className="text-muted small text-truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="d-flex align-items-center gap-1 flex-wrap">
                      {user.roleIds.map((roleId) => (
                        <RoleBadge key={roleId} roleId={roleId} dimmed={dimmed} />
                      ))}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className={dimmed ? "text-muted" : undefined}>
                      {user.office}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusIndicator status={user.status} />
                  </Table.Cell>
                  <Table.Cell className="text-end">
                    <FontAwesomeIcon
                      icon={faChevronRight}
                      className="text-muted"
                    />
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      )}

      <div className="text-muted small">
        {counts.total} people · {counts.active} active ·{" "}
        {counts.deactivated} deactivated
      </div>
    </div>
  );
}
