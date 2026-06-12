/**
 * IMPORTANT!
 * If you do not need to update this file for any reason, leave it as-is.
 * This file will get overriten by the bo-spark cli. To make sure that the login and others are working correctly,
 */
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { faLock } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { getAuthSession, loginFn } from "#/lib/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const { authenticated } = await getAuthSession();
    if (authenticated) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginFn({ data: { password } });
      await router.navigate({ to: "/" });
    } catch {
      setError("Incorrect password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div style={{ width: "100%", maxWidth: 400 }} className="px-3">
        <Card className="shadow">
          <Card.Body className="p-4">
            <div className="text-center mb-4">
              <div
                className="d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 rounded-circle mb-3"
                style={{ width: 48, height: 48 }}
              >
                <FontAwesomeIcon icon={faLock} className="text-primary" />
              </div>
              <h1 className="fs-large fw-semibold mb-1">Protected Prototype</h1>
              <p className="text-muted fs-small mb-0">
                Enter the password to continue.
              </p>
            </div>

            {error && (
              <Alert severity="destructive" className="mb-3">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label" htmlFor="proto-password">
                  Password
                </label>
                <Input
                  id="proto-password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onValueChange={setPassword}
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                className="w-100"
                disabled={loading || !password}
              >
                {loading ? "Verifying…" : "Continue"}
              </Button>
            </form>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
