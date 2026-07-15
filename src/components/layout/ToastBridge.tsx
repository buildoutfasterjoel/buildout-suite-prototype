import { useEffect } from "react";
import { useToast } from "@buildoutinc/blueprint-react/ui/Toast";
import { setNotifier } from "#/lib/notify";

/**
 * Bridges the neutral `notify()` port (called from non-React code like data
 * actions) to Blueprint's toast. Renders nothing; mounts once under
 * `ToasterProvider`.
 */
export function ToastBridge() {
  const { toast } = useToast();
  useEffect(() => {
    setNotifier((item) => toast.success(item));
    return () => setNotifier(null);
  }, [toast]);
  return null;
}
