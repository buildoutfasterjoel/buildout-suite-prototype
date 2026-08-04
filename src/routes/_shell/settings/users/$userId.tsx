import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserSlash } from "@fortawesome/pro-regular-svg-icons";
import { useRoster } from "#/components/settings/users/useRoster";
import { UserDetailLayout } from "#/components/settings/users/UserDetailLayout";

export const Route = createFileRoute("/_shell/settings/users/$userId")({
  component: UserDetailRoute,
});

function UserDetailRoute() {
  const { userId } = Route.useParams();
  // Reactive: a profile save or a role change has to repaint the header.
  const user = useRoster((s) => s.users.find((u) => u.id === userId));

  if (!user) {
    return (
      <div className="d-flex justify-content-center py-8">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faUserSlash} aria-label="User not found" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>User not found</Empty.Title>
            This person isn&apos;t on the company roster.
          </Empty.Content>
          <Empty.Actions>
            <Button
              variant="primary"
              nativeButton={false}
              render={<Link to="/settings/users" />}
            >
              Back to Users
            </Button>
          </Empty.Actions>
        </Empty>
      </div>
    );
  }

  return (
    <UserDetailLayout user={user}>
      <Outlet />
    </UserDetailLayout>
  );
}
