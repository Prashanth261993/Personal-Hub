// ── Config Types (stored as JSON files) ──

export interface FamilyMember {
  id: string;
  name: string;
  color: string; // hex color for charts
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Lucide icon name
}

export interface CategoriesConfig {
  assetCategories: Category[];
  liabilityCategories: Category[];
}

export interface FamilyMembersConfig {
  members: FamilyMember[];
}

// ── Database Types (stored in SQLite) ──

export interface Snapshot {
  id: string;
  date: string;       // ISO date string (YYYY-MM-DD)
  note: string | null;
  createdAt: string;   // ISO datetime
}

export interface NetWorthEntry {
  id: string;
  snapshotId: string;
  memberId: string;    // references FamilyMember.id
  categoryId: string;  // references Category.id
  type: 'asset' | 'liability';
  name: string;        // line item label, e.g. "Chase Savings"
  value: number;       // in cents; positive for assets, negative for liabilities
}

// ── API Request/Response Types ──

export interface CreateSnapshotRequest {
  date: string;
  note?: string;
  entries: Omit<NetWorthEntry, 'id' | 'snapshotId'>[];
}

export interface UpdateSnapshotRequest {
  date?: string;
  note?: string;
  entries?: Omit<NetWorthEntry, 'id' | 'snapshotId'>[];
}

export interface SnapshotSummary {
  id: string;
  date: string;
  note: string | null;
  createdAt: string;
  totalAssets: number;       // cents
  totalLiabilities: number;  // cents (negative)
  netWorth: number;          // cents
}

export interface SnapshotDetail extends Snapshot {
  entries: NetWorthEntry[];
}

export interface MemberNetWorth {
  memberId: string;
  memberName: string;
  memberColor: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface TrendDataPoint {
  date: string;
  snapshotId: string;
  combined: number;
  byMember: Record<string, number>; // memberId → netWorth
  byCategory: Record<string, number>; // categoryId → total value
}

export interface InsightsSummary {
  currentNetWorth: number;
  previousNetWorth: number;
  change: number;
  changePercent: number;
  byMember: MemberNetWorth[];
  byCategory: { categoryId: string; categoryName: string; type: 'asset' | 'liability'; total: number }[];
}

export interface Goal {
  id: string;
  name: string;
  targetValue: number;   // cents
  targetDate: string;    // ISO date
  targetType?: 'netWorth' | 'category'; // defaults to 'netWorth'
  categoryId?: string;   // required when targetType === 'category'
  createdAt: string;
}

export interface GoalsConfig {
  goals: Goal[];
}

// ── Platform Types ──

export interface AppDefinition {
  id: string;
  name: string;
  icon: string;        // Lucide icon name
  basePath: string;    // e.g. '/networth'
  description: string;
}

// ── Utility ──

/** Convert dollars to cents */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Convert cents to dollars */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Format cents as a currency string */
export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}
