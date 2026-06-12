export type StageStatus = 'complete' | 'active' | 'future'
export type SubStageStatus = 'complete' | 'active' | 'future'

export interface SubStage {
  id: string
  label: string
  status: SubStageStatus
  dealCount: number
}

export interface PipelineStage {
  id: string
  number: number
  label: string
  color: string
  status: StageStatus
  dealCount: number
  totalValue: number
  subStages: SubStage[]
}

export interface MockDeal {
  id: string
  propertyName: string
  address: string
  askingPrice: number
  propertyType: string
  assignedTo: string
  daysInStage: number
  subStageId: string
  stageId: string
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'prospect',
    number: 1,
    label: 'Prospect',
    color: '#6366f1',
    status: 'complete',
    dealCount: 24,
    totalValue: 87_500_000,
    subStages: [
      { id: 'prospect-lead', label: 'Lead capture', status: 'complete', dealCount: 10 },
      { id: 'prospect-qualifying', label: 'Qualifying', status: 'complete', dealCount: 8 },
      { id: 'prospect-meeting', label: 'Meeting set', status: 'complete', dealCount: 4 },
      { id: 'prospect-proposal', label: 'Proposal sent', status: 'complete', dealCount: 2 },
    ],
  },
  {
    id: 'bov-pitch',
    number: 2,
    label: 'BOV & Pitch',
    color: '#4f46e5',
    status: 'complete',
    dealCount: 8,
    totalValue: 32_000_000,
    subStages: [
      { id: 'bov-draft', label: 'BOV draft', status: 'complete', dealCount: 3 },
      { id: 'bov-delivered', label: 'BOV delivered', status: 'complete', dealCount: 2 },
      { id: 'pitch-scheduled', label: 'Pitch scheduled', status: 'active', dealCount: 2 },
      { id: 'pitch-presented', label: 'Pitch presented', status: 'future', dealCount: 1 },
    ],
  },
  {
    id: 'listing-mktg',
    number: 3,
    label: 'Listing & Mktg',
    color: '#0d9488',
    status: 'active',
    dealCount: 15,
    totalValue: 78_500_000,
    subStages: [
      { id: 'listing-agreement', label: 'Agreement signed', status: 'complete', dealCount: 4 },
      { id: 'listing-listed', label: 'Property listed', status: 'active', dealCount: 5 },
      { id: 'listing-mktg-active', label: 'Marketing active', status: 'future', dealCount: 4 },
      { id: 'listing-price-reduction', label: 'Price reduction', status: 'future', dealCount: 2 },
    ],
  },
  {
    id: 'negotiate',
    number: 4,
    label: 'Negotiate',
    color: '#7c3aed',
    status: 'future',
    dealCount: 5,
    totalValue: 24_000_000,
    subStages: [
      { id: 'offer-received', label: 'Offer received', status: 'future', dealCount: 2 },
      { id: 'counter-offer', label: 'Counter offer', status: 'future', dealCount: 2 },
      { id: 'best-final', label: 'Best & final', status: 'future', dealCount: 1 },
      { id: 'loi-accepted', label: 'LOI accepted', status: 'future', dealCount: 0 },
    ],
  },
  {
    id: 'contract-exec',
    number: 5,
    label: 'Contract / Exec.',
    color: '#6b7280',
    status: 'future',
    dealCount: 3,
    totalValue: 18_200_000,
    subStages: [
      { id: 'psa-draft', label: 'PSA draft', status: 'future', dealCount: 2 },
      { id: 'due-diligence', label: 'Due diligence', status: 'future', dealCount: 1 },
      { id: 'executed', label: 'Executed', status: 'future', dealCount: 0 },
    ],
  },
  {
    id: 'finance-ti',
    number: 6,
    label: 'Finance / TI',
    color: '#b45309',
    status: 'future',
    dealCount: 2,
    totalValue: 14_500_000,
    subStages: [
      { id: 'financing-approval', label: 'Financing approval', status: 'future', dealCount: 1 },
      { id: 'ti-negotiation', label: 'TI negotiation', status: 'future', dealCount: 1 },
      { id: 'ti-agreed', label: 'TI agreed', status: 'future', dealCount: 0 },
    ],
  },
  {
    id: 'close-press',
    number: 7,
    label: 'Close & Press',
    color: '#0f766e',
    status: 'future',
    dealCount: 1,
    totalValue: 8_750_000,
    subStages: [
      { id: 'closing-scheduled', label: 'Closing scheduled', status: 'future', dealCount: 1 },
      { id: 'closed', label: 'Closed', status: 'future', dealCount: 0 },
      { id: 'press-release', label: 'Press release', status: 'future', dealCount: 0 },
    ],
  },
]

export const MOCK_DEALS: MockDeal[] = [
  // Prospect – Lead capture
  { id: 'd001', propertyName: 'Riverwalk Commerce Center', address: '1200 River Pkwy, Chicago, IL', askingPrice: 12_500_000, propertyType: 'Office', assignedTo: 'M. Thompson', daysInStage: 5, subStageId: 'prospect-lead', stageId: 'prospect' },
  { id: 'd002', propertyName: 'Oakwood Industrial Park', address: '850 Industrial Dr, Aurora, IL', askingPrice: 8_200_000, propertyType: 'Industrial', assignedTo: 'K. Nguyen', daysInStage: 3, subStageId: 'prospect-lead', stageId: 'prospect' },
  // Prospect – Qualifying
  { id: 'd003', propertyName: 'Lakeshore Plaza', address: '420 N Lake Shore Dr, Chicago, IL', askingPrice: 22_000_000, propertyType: 'Retail', assignedTo: 'M. Thompson', daysInStage: 12, subStageId: 'prospect-qualifying', stageId: 'prospect' },
  { id: 'd004', propertyName: 'Downtown Mixed Use', address: '601 W Madison St, Chicago, IL', askingPrice: 15_800_000, propertyType: 'Mixed Use', assignedTo: 'S. Patel', daysInStage: 8, subStageId: 'prospect-qualifying', stageId: 'prospect' },
  // BOV – BOV draft
  { id: 'd005', propertyName: 'Northgate Business Park', address: '2100 N Halsted St, Chicago, IL', askingPrice: 9_500_000, propertyType: 'Office', assignedTo: 'K. Nguyen', daysInStage: 7, subStageId: 'bov-draft', stageId: 'bov-pitch' },
  { id: 'd006', propertyName: 'Westfield Commerce Tower', address: '355 W Grand Ave, Chicago, IL', askingPrice: 18_000_000, propertyType: 'Office', assignedTo: 'M. Thompson', daysInStage: 14, subStageId: 'bov-draft', stageId: 'bov-pitch' },
  { id: 'd007', propertyName: 'Southside Logistics Hub', address: '9800 S Torrence Ave, Chicago, IL', askingPrice: 6_800_000, propertyType: 'Industrial', assignedTo: 'J. Rivera', daysInStage: 4, subStageId: 'bov-draft', stageId: 'bov-pitch' },
  // BOV – BOV delivered
  { id: 'd008', propertyName: 'Prairie Business Center', address: '1750 Prairie Ave, Evanston, IL', askingPrice: 11_200_000, propertyType: 'Office', assignedTo: 'S. Patel', daysInStage: 21, subStageId: 'bov-delivered', stageId: 'bov-pitch' },
  { id: 'd009', propertyName: 'Harbor View Retail', address: '3200 N Milwaukee Ave, Chicago, IL', askingPrice: 7_400_000, propertyType: 'Retail', assignedTo: 'K. Nguyen', daysInStage: 18, subStageId: 'bov-delivered', stageId: 'bov-pitch' },
  // BOV – Pitch scheduled
  { id: 'd010', propertyName: 'Lincoln Park Medical', address: '551 W Diversey Pkwy, Chicago, IL', askingPrice: 14_500_000, propertyType: 'Medical Office', assignedTo: 'M. Thompson', daysInStage: 9, subStageId: 'pitch-scheduled', stageId: 'bov-pitch' },
  { id: 'd011', propertyName: 'Gold Coast Residences', address: '1200 N Lake Shore Dr, Chicago, IL', askingPrice: 28_000_000, propertyType: 'Multifamily', assignedTo: 'J. Rivera', daysInStage: 6, subStageId: 'pitch-scheduled', stageId: 'bov-pitch' },
  // BOV – Pitch presented
  { id: 'd012', propertyName: 'Merchandise Mart Office', address: '222 W Merchandise Mart Plz, Chicago, IL', askingPrice: 42_000_000, propertyType: 'Office', assignedTo: 'S. Patel', daysInStage: 3, subStageId: 'pitch-presented', stageId: 'bov-pitch' },
  // Listing & Mktg – Agreement signed
  { id: 'd013', propertyName: 'Navy Pier Retail Space', address: '600 E Grand Ave, Chicago, IL', askingPrice: 5_800_000, propertyType: 'Retail', assignedTo: 'K. Nguyen', daysInStage: 30, subStageId: 'listing-agreement', stageId: 'listing-mktg' },
  { id: 'd014', propertyName: 'Bucktown Mixed Use', address: '1600 N Milwaukee Ave, Chicago, IL', askingPrice: 8_900_000, propertyType: 'Mixed Use', assignedTo: 'M. Thompson', daysInStage: 22, subStageId: 'listing-agreement', stageId: 'listing-mktg' },
  // Listing & Mktg – Property listed
  { id: 'd015', propertyName: 'River North Lofts', address: '420 W Huron St, Chicago, IL', askingPrice: 16_500_000, propertyType: 'Multifamily', assignedTo: 'J. Rivera', daysInStage: 45, subStageId: 'listing-listed', stageId: 'listing-mktg' },
  { id: 'd016', propertyName: 'Wicker Park Retail Strip', address: '1900 N Damen Ave, Chicago, IL', askingPrice: 4_200_000, propertyType: 'Retail', assignedTo: 'S. Patel', daysInStage: 38, subStageId: 'listing-listed', stageId: 'listing-mktg' },
  { id: 'd017', propertyName: 'Logan Square Industrial', address: '2800 N Kedzie Ave, Chicago, IL', askingPrice: 12_000_000, propertyType: 'Industrial', assignedTo: 'K. Nguyen', daysInStage: 29, subStageId: 'listing-listed', stageId: 'listing-mktg' },
  // Listing & Mktg – Marketing active
  { id: 'd018', propertyName: 'Pilsen Arts District', address: '1900 S Halsted St, Chicago, IL', askingPrice: 7_800_000, propertyType: 'Mixed Use', assignedTo: 'M. Thompson', daysInStage: 15, subStageId: 'listing-mktg-active', stageId: 'listing-mktg' },
  { id: 'd019', propertyName: 'Hyde Park Academic', address: '5400 S Hyde Park Blvd, Chicago, IL', askingPrice: 19_200_000, propertyType: 'Office', assignedTo: 'J. Rivera', daysInStage: 11, subStageId: 'listing-mktg-active', stageId: 'listing-mktg' },
  // Listing & Mktg – Price reduction
  { id: 'd020', propertyName: 'Chinatown Retail Center', address: '2200 S Wentworth Ave, Chicago, IL', askingPrice: 6_100_000, propertyType: 'Retail', assignedTo: 'S. Patel', daysInStage: 62, subStageId: 'listing-price-reduction', stageId: 'listing-mktg' },
]

export function formatValue(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}
