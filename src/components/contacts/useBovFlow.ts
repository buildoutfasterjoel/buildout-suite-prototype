import { create } from "zustand";
import type { UnderwritingStrategyId } from "#/components/deals/underwriting/strategies";

/**
 * The underwriting → BOV flow: pick a strategy and depth, generate the Cactus
 * run, save it to a document, preview the assembled BOV, then email it — all in
 * modals, without leaving whatever page kicked it off. One flow runs at a time;
 * `listingId` null means the flow is closed.
 *
 * Rendered by `BovFlow`, hosted ONCE in the app shell. It used to be hosted on
 * the contact detail page with the setup dialog living inside the deal card
 * itself, which had two costs: the flow could only be started from a contact
 * (so the assistant rail couldn't offer it), and a modal rendered inside the
 * card's `onClick` handed every click in it back to the card — clicking the
 * dialog navigated to the deal. The flow owns its own modals now, at the top of
 * the tree, where nothing is underneath them.
 */
export type BovFlowStep = "setup" | "generating" | "placement" | "preview" | "email";

interface BovFlowState {
  listingId: string | null;
  /**
   * Who the BOV is for — the owner it gets emailed to, and whose timeline the
   * sent email lands on. Carried on the flow rather than read off the page,
   * because the page is no longer guaranteed to be a contact's.
   */
  contactId: string | null;
  step: BovFlowStep;
  /** The run config the generating step animates against. */
  strategy: UnderwritingStrategyId;
  selection: number[];
  /** The document the underwriting was saved into (set at placement). */
  documentName: string | null;

  /** Open the strategy/depth dialog for a deal with no run yet. */
  openSetup: (listingId: string, contactId: string) => void;
  /** Kick off generation (the underwriting record is already 'generating'). */
  start: (
    listingId: string,
    contactId: string,
    strategy: UnderwritingStrategyId,
    selection: number[],
  ) => void;
  /** Reopen at the save step for a deal whose run is generated-but-unsaved. */
  openPlacement: (listingId: string, contactId: string) => void;
  toPreview: (documentName: string) => void;
  toEmail: () => void;
  backToPreview: () => void;
  close: () => void;
}

export const useBovFlow = create<BovFlowState>((set) => ({
  listingId: null,
  contactId: null,
  step: "generating",
  strategy: "value-add",
  selection: [],
  documentName: null,

  openSetup: (listingId, contactId) =>
    set({ listingId, contactId, step: "setup", documentName: null }),
  start: (listingId, contactId, strategy, selection) =>
    set({ listingId, contactId, strategy, selection, step: "generating", documentName: null }),
  openPlacement: (listingId, contactId) =>
    set({ listingId, contactId, step: "placement", documentName: null }),
  toPreview: (documentName) => set({ step: "preview", documentName }),
  toEmail: () => set({ step: "email" }),
  backToPreview: () => set({ step: "preview" }),
  close: () => set({ listingId: null }),
}));
