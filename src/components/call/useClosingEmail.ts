import { create } from "zustand";

export interface ClosingEmail {
  dealId: string;
  from: string;
}

interface ClosingEmailState {
  pending: ClosingEmail | null;
  set: (e: ClosingEmail) => void;
  clear: () => void;
}

export const useClosingEmail = create<ClosingEmailState>((set) => ({
  pending: null,
  set: (pending) => set({ pending }),
  clear: () => set({ pending: null }),
}));
