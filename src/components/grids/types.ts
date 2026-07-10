export interface Grid {
  id: string;
  name: string;
  type: "Sale" | "Lease";
  compCount: number;
  createdBy: string;
  updatedDate: string;
}

export interface SaleComp {
  id: string;
  propertyName: string;
  address: string;
  saleDate: string;
  salePrice: number;
  pricePerSf: number;
  capRate: number;
  buyer: string;
  seller: string;
}

export interface LeaseComp {
  id: string;
  propertyName: string;
  address: string;
  leaseDate: string;
  tenantName: string;
  leaseType: string;
  rentPsf: number;
  termMonths: number;
  sf: number;
}
