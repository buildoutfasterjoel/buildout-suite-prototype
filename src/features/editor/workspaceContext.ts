import { createContext, useContext, type RefObject } from "react";

/**
 * The canvas's scrolling workspace element.
 *
 * Overlays anchored to a page (the page toolbar popover) portal into this
 * instead of `document.body`, so the workspace's `overflow` clips them and they
 * scroll under the toolbars rather than floating over them.
 *
 * Null outside the canvas — `PagePreview` renders pages for gallery thumbnails
 * with no workspace around them, and portals there fall back to the body.
 */
export const WorkspaceContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function useWorkspaceRef(): RefObject<HTMLDivElement | null> | null {
  return useContext(WorkspaceContext);
}
