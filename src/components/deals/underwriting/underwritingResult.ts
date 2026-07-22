import type { Property } from "#/data/types";

/** The deterministic figure model behind a deal's underwriting. */
export interface Ctx {
  price: number;
  sqft: number;
  cap: number;
  noi: number;
  egi: number;
  opex: number;
  pgi: number;
  vacancy: number;
  rentPerSf: number;
  loan: number;
  debtService: number;
}

/**
 * Back a full income + financing model out of a property's headline figures.
 * All values are FAKE but deterministic (no Math.random / Date) so repeated
 * builds are stable. Falls back to sensible constants for a bare property.
 */
export function buildCtx(property: Property | undefined): Ctx {
  const price = property && property.askingPrice > 0 ? property.askingPrice : 2_450_000;
  const sqft = property && property.buildingSqFt > 0 ? property.buildingSqFt : 42_000;
  const cap = property && property.capRate > 0 ? property.capRate : 0.062;
  const noi = Math.round(price * cap);
  const egi = Math.round(noi / 0.62);
  const opex = egi - noi;
  const pgi = Math.round(egi / 0.94);
  const vacancy = pgi - egi;
  const rentPerSf = Math.round((pgi / sqft) * 100) / 100;
  const loan = Math.round(price * 0.65);
  const debtService = Math.round(loan * 0.075);
  return { price, sqft, cap, noi, egi, opex, pgi, vacancy, rentPerSf, loan, debtService };
}
