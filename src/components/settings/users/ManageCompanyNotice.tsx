import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/pro-duotone-svg-icons";
import { useCompanyAdmins } from "./useViewer";

/**
 * Shown in place of the edit controls when the viewer lacks Manage Company.
 *
 * Names who to ask rather than which permission is missing: "you need
 * `can_manage_company`" is true but useless, while "Diana Reyes or Priya Nair
 * can do this" is the next step. The list is computed from the roster, so it
 * stays right as roles change.
 */
export function ManageCompanyNotice({ what }: { what: string }) {
  const admins = useCompanyAdmins();
  const names = admins.map((a) => a.name);

  return (
    <Alert severity="warning" withIcon>
      <FontAwesomeIcon icon={faLock} />
      <div>
        <div className="fw-semibold">You can&apos;t {what}</div>
        <div>
          That needs <span className="fw-semibold">Manage Company</span>, which
          your role doesn&apos;t include.{" "}
          {names.length === 0 ? (
            <>No one currently has it.</>
          ) : (
            <>
              Ask{" "}
              <span className="fw-semibold">
                {names.length === 1
                  ? names[0]
                  : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`}
              </span>
              .
            </>
          )}
        </div>
      </div>
    </Alert>
  );
}
