import { create } from "zustand";
import type { UnderwritingStrategyId } from "#/components/deals/underwriting/strategies";

/**
 * The contact-page BOV flow: generate the Cactus underwriting in a modal on
 * the contact, save it to a document, preview the assembled BOV, then email
 * it — all without leaving the contact. One flow runs at a time; `listingId`
 * null means the flow is closed. Driven by the deal card's Build Underwriting
 * button and rendered by `ContactBovFlow` on the contact detail page.
 */
export type BovFlowStep = "generating" | "placement" | "preview" | "email";

interface BovFlowState {
  listingId: string | null;
  step: BovFlowStep;
  /** The run config the generating step animates against. */
  strategy: UnderwritingStrategyId;
  selection: number[];
  /** The document the underwriting was saved into (set at placement). */
  documentName: string | null;

  /** Kick off generation (the underwriting record is already 'generating'). */
  start: (
    listingId: string,
    strategy: UnderwritingStrategyId,
    selection: number[],
  ) => void;
  /** Reopen at the save step for a deal whose run is generated-but-unsaved. */
  openPlacement: (listingId: string) => void;
  toPreview: (documentName: string) => void;
  toEmail: () => void;
  backToPreview: () => void;
  close: () => void;
}

export const useBovFlow = create<BovFlowState>((set) => ({
  listingId: null,
  step: "generating",
  strategy: "value-add",
  selection: [],
  documentName: null,

  start: (listingId, strategy, selection) =>
    set({ listingId, strategy, selection, step: "generating", documentName: null }),
  openPlacement: (listingId) =>
    set({ listingId, step: "placement", documentName: null }),
  toPreview: (documentName) => set({ step: "preview", documentName }),
  toEmail: () => set({ step: "email" }),
  backToPreview: () => set({ step: "preview" }),
  close: () => set({ listingId: null }),
}));
