/**
 * IMPORTANT!
 * If you do not need to update this file for any reason, leave it as-is.
 * This file will get overriten by the bo-spark cli. To make sure that the login and others are working correctly,
 */
import {
  HeadContent,
  Scripts,
  createRootRoute,
  redirect,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";

import mainCSS from "../main.scss?url";
import { getAuthSession } from "#/lib/auth";

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/login") return;
    const { authenticated } = await getAuthSession();
    if (!authenticated) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Buildout",
      },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://use.typekit.net",
        crossOrigin: "anonymous",
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://use.typekit.net/jrm1vtm.css",
      },
      {
        rel: "stylesheet",
        href: mainCSS,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Tooltip.Provider>{children}</Tooltip.Provider>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
