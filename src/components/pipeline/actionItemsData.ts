export type ActionItemCategory =
  | 'closing-soon'
  | 'stalled-deal'
  | 'offer-response'
  | 'price-reduction'
  | 'listing-expiring'
  | 'stale-prospect'

export type ActionItemUrgency = 'critical' | 'high' | 'medium'

export interface ActionItem {
  id: string
  category: ActionItemCategory
  urgency: ActionItemUrgency
  propertyName: string
  address: string
  askingPrice: number
  assignedBroker: string
  headline: string
  detail: string
  ctaLabel: string
  daysOverdue: number
}

// Pre-sorted: critical first, then high, then medium; descending daysOverdue within tier
export const ACTION_ITEMS: ActionItem[] = [
  {
    id: 'ai001',
    category: 'closing-soon',
    urgency: 'critical',
    propertyName: 'River North Retail Strip',
    address: '734 N Clark St, Chicago, IL',
    askingPrice: 8_750_000,
    assignedBroker: 'Marcus Webb',
    headline: 'Closing in 4 days',
    detail: 'Wire instructions not yet confirmed — title company needs final figures from buyer lender.',
    ctaLabel: 'Confirm wires',
    daysOverdue: 0,
  },
  {
    id: 'ai002',
    category: 'offer-response',
    urgency: 'critical',
    propertyName: '222 W Adams Office Tower',
    address: '222 W Adams St, Chicago, IL',
    askingPrice: 24_000_000,
    assignedBroker: 'Sarah Chen',
    headline: 'Offer unanswered for 18 days',
    detail: 'Buyer submitted a $21.5M all-cash offer 18 days ago — standard response window is 10 days.',
    ctaLabel: 'Respond to offer',
    daysOverdue: 8,
  },
  {
    id: 'ai003',
    category: 'stalled-deal',
    urgency: 'high',
    propertyName: 'Wacker Drive Corporate Center',
    address: '233 S Wacker Dr, Chicago, IL',
    askingPrice: 42_000_000,
    assignedBroker: 'James Thornton',
    headline: 'Due diligence stalled at 52 days',
    detail: "Buyer's environmental review is 22 days past the 30-day target — attorney contact overdue.",
    ctaLabel: 'Nudge attorney',
    daysOverdue: 22,
  },
  {
    id: 'ai004',
    category: 'price-reduction',
    urgency: 'high',
    propertyName: 'Clark & Division Mixed Use',
    address: '1201 N Clark St, Chicago, IL',
    askingPrice: 9_800_000,
    assignedBroker: 'Priya Nair',
    headline: 'No showings in 45 days',
    detail: 'Listed at $9.8M with zero showing requests in 45 days — market comps suggest 8–10% reduction.',
    ctaLabel: 'Review pricing',
    daysOverdue: 15,
  },
  {
    id: 'ai005',
    category: 'listing-expiring',
    urgency: 'high',
    propertyName: 'Chinatown Retail Center',
    address: '2160 S China Pl, Chicago, IL',
    askingPrice: 6_400_000,
    assignedBroker: 'Marcus Webb',
    headline: 'Listing agreement expires in 12 days',
    detail: 'Exclusive listing agreement ends June 24 — renewal conversation not yet scheduled with seller.',
    ctaLabel: 'Review listing',
    daysOverdue: 0,
  },
  {
    id: 'ai006',
    category: 'stalled-deal',
    urgency: 'medium',
    propertyName: 'Wicker Park Retail Strip',
    address: '1440 N Milwaukee Ave, Chicago, IL',
    askingPrice: 4_200_000,
    assignedBroker: 'Sarah Chen',
    headline: 'Listed 38 days, below activity target',
    detail: '2 showings total — typical properties at this price point see 6+ in the first 30 days.',
    ctaLabel: 'Follow up',
    daysOverdue: 8,
  },
  {
    id: 'ai007',
    category: 'stale-prospect',
    urgency: 'medium',
    propertyName: 'Lincoln Park Medical Office',
    address: '2350 N Lincoln Ave, Chicago, IL',
    askingPrice: 5_100_000,
    assignedBroker: 'James Thornton',
    headline: 'Lead dark for 31 days',
    detail: 'Qualified buyer went silent after initial BOV — no outreach logged in 31 days.',
    ctaLabel: 'Re-engage',
    daysOverdue: 11,
  },
]
