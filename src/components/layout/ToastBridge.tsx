import { useEffect } from "react";
import { useToast } from "@buildoutinc/blueprint-react/ui/Toast";
import { setNotifier } from "#/lib/notify";

/**
 * Bridges the neutral `notify()` port (called from non-React code like data
 * actions) to Blueprint's toast. Renders nothing; mounts once under
 * `ToasterProvider`.
 */
export function ToastBridge() {
  const { toast, dismiss } = useToast();
  useEffect(() => {
    setNotifier({
      show: ({ variant = "success", action, ...item }) =>
        toast({
          ...item,
          variant,
          // The port's action lands in the toast's `cancel` slot, not `action`.
          // Base UI only renders `Toast.Action` when the toast carries
          // `actionProps.children`, and Blueprint's provider never forwards
          // those — so the `action` slot is dead on arrival. `cancel` renders,
          // and closing the toast on click is what we want here anyway.
          cancel: action && {
            label: action.label,
            buttonProps: {
              variant: "outline",
              onClick: action.onClick,
              // Base UI hides the close button from assistive tech until the
              // stack is hovered. This one carries a real action, so it stays.
              "aria-hidden": false,
            },
          },
        }),
      dismiss,
    });
    return () => setNotifier(null);
  }, [toast, dismiss]);
  return null;
}
