import { create } from "zustand";

export interface InboundEmail {
  dealId: string;
  from: string;
  subject: string;
  body: string;
  tone: "interested" | "open" | "decline";
  attachments: string[];
  canUnderwrite: boolean;
}

interface InboundEmailState {
  inbound: InboundEmail | null;
  setInbound: (e: InboundEmail) => void;
  clearInbound: () => void;
}

export const useInboundEmail = create<InboundEmailState>((set) => ({
  inbound: null,
  setInbound: (inbound) => set({ inbound }),
  clearInbound: () => set({ inbound: null }),
}));
