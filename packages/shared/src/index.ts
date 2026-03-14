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

// ── Todo App Types ──

export type TodoPriority = 'high' | 'medium' | 'low';
export type TodoStatus = 'open' | 'completed';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;            // every N units
  weekdays?: number[];         // 0=Sun..6=Sat (for weekly)
  endDate?: string;            // optional YYYY-MM-DD
  exceptions?: string[];       // dates to skip (YYYY-MM-DD) — used when a recurring instance is detached
}

export interface TodoGroup {
  id: string;
  name: string;
  color: string;               // hex color
  icon: string;                // Lucide icon name
  sortOrder: number;
  createdAt: string;           // ISO datetime
}

export interface Todo {
  id: string;
  groupId: string;
  title: string;
  description: string | null;  // markdown
  priority: TodoPriority;
  status: TodoStatus;
  dueDate: string | null;      // YYYY-MM-DD
  recurrence: RecurrenceRule | null;
  parentId: string | null;     // subtask parent
  sortOrder: number;
  completedAt: string | null;  // ISO datetime
  createdAt: string;
  updatedAt: string;
}

export interface TodoSummary {
  id: string;
  groupId: string;
  title: string;
  priority: TodoPriority;
  status: TodoStatus;
  dueDate: string | null;
  recurrence: RecurrenceRule | null;
  parentId: string | null;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  subtaskCount: number;
  subtaskCompletedCount: number;
}

export interface CreateTodoRequest {
  groupId: string;
  title: string;
  description?: string;
  priority?: TodoPriority;
  dueDate?: string;
  recurrence?: RecurrenceRule;
  parentId?: string;
}

export interface UpdateTodoRequest {
  groupId?: string;
  title?: string;
  description?: string | null;
  priority?: TodoPriority;
  status?: TodoStatus;
  dueDate?: string | null;
  recurrence?: RecurrenceRule | null;
  sortOrder?: number;
}

export interface MoveTodoRequest {
  groupId: string;
  sortOrder: number;
}

export interface BatchReorderRequest {
  todos: { id: string; sortOrder: number; groupId?: string }[];
}

export interface CreateGroupRequest {
  name: string;
  color: string;
  icon: string;
}

export interface UpdateGroupRequest {
  name?: string;
  color?: string;
  icon?: string;
}

export interface RecurringCompletion {
  id: string;
  todoId: string;
  completionDate: string;     // YYYY-MM-DD
  completedAt: string;        // ISO datetime
}

export interface TodoStats {
  totalOpen: number;
  totalCompleted: number;
  completedToday: number;
  completedThisWeek: number;
  currentStreak: number;
  longestStreak: number;
  completionsByDay: { date: string; count: number }[];
}

export interface CalendarTodo {
  id: string;
  title: string;
  priority: TodoPriority;
  status: TodoStatus;
  dueDate: string;
  groupColor: string;
  groupName: string;
  isRecurring: boolean;
  isRecurringInstance?: boolean;  // true when expanded from recurrence
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
