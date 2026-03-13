import axios from 'axios';
import type {
  FamilyMembersConfig,
  CategoriesConfig,
  GoalsConfig,
  SnapshotSummary,
  SnapshotDetail,
  CreateSnapshotRequest,
  UpdateSnapshotRequest,
  TrendDataPoint,
  InsightsSummary,
} from '@networth/shared';

const api = axios.create({ baseURL: '/api/networth' });

// ── Members ──
export const fetchMembers = () => api.get<FamilyMembersConfig>('/members').then((r) => r.data);
export const updateMembers = (data: FamilyMembersConfig) => api.put<FamilyMembersConfig>('/members', data).then((r) => r.data);

// ── Categories ──
export const fetchCategories = () => api.get<CategoriesConfig>('/categories').then((r) => r.data);
export const updateCategories = (data: CategoriesConfig) => api.put<CategoriesConfig>('/categories', data).then((r) => r.data);

// ── Goals ──
export const fetchGoals = () => api.get<GoalsConfig>('/goals').then((r) => r.data);
export const updateGoals = (data: GoalsConfig) => api.put<GoalsConfig>('/goals', data).then((r) => r.data);

// ── Snapshots ──
export const fetchSnapshots = () => api.get<SnapshotSummary[]>('/snapshots').then((r) => r.data);
export const fetchSnapshot = (id: string) => api.get<SnapshotDetail>(`/snapshots/${id}`).then((r) => r.data);
export const createSnapshot = (data: CreateSnapshotRequest) => api.post<SnapshotDetail>('/snapshots', data).then((r) => r.data);
export const updateSnapshot = (id: string, data: UpdateSnapshotRequest) => api.put<SnapshotDetail>(`/snapshots/${id}`, data).then((r) => r.data);
export const deleteSnapshot = (id: string) => api.delete(`/snapshots/${id}`).then((r) => r.data);
export const carryForward = (id: string, data: { date: string; note?: string }) => api.post<SnapshotDetail>(`/snapshots/${id}/carry-forward`, data).then((r) => r.data);

// ── Insights ──
export const fetchTrends = () => api.get<TrendDataPoint[]>('/insights/trends').then((r) => r.data);
export const fetchInsightsSummary = () => api.get<InsightsSummary>('/insights/summary').then((r) => r.data);
