import axios from 'axios';
import type {
  CreateFundRequest,
  Fund,
  FundDeltasResponse,
  FundDetailResponse,
  FundHolding,
  FundScreenerPreset,
  FundsDashboardRow,
  FundsHomeSummary,
  FundsInsightsResponse,
  FundsMappingsResponse,
  FundsScreenerResponse,
  LinkHoldingRequest,
  RefreshFundResponse,
  UpdateFundRequest,
  UpsertMappingRequest,
} from '@networth/shared';

const api = axios.create({ baseURL: '/api/funds' });

export const fetchFunds = () =>
  api.get<{ rows: FundsDashboardRow[] }>('/').then((r) => r.data.rows);
export const fetchFundsSummary = () =>
  api.get<FundsHomeSummary>('/summary').then((r) => r.data);
export const fetchFund = (id: string) =>
  api.get<FundDetailResponse>(`/${id}`).then((r) => r.data);
export const fetchFundHoldings = (id: string, filingId?: string) =>
  api
    .get<FundHolding[]>(`/${id}/holdings`, { params: filingId ? { filingId } : undefined })
    .then((r) => r.data);
export const fetchFundDeltas = (id: string, from?: string, to?: string) =>
  api
    .get<FundDeltasResponse>(`/${id}/deltas`, {
      params: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
    })
    .then((r) => r.data);
export const linkHolding = (holdingId: string, data: LinkHoldingRequest) =>
  api.post<FundHolding>(`/holdings/${holdingId}/link`, data).then((r) => r.data);
export const fetchScreener = () =>
  api.get<FundsScreenerResponse>('/screener').then((r) => r.data.rows);
export const fetchInsights = () =>
  api.get<FundsInsightsResponse>('/insights').then((r) => r.data);
export const fetchFundPresets = () =>
  api.get<FundScreenerPreset[]>('/presets').then((r) => r.data);
export const createFundPreset = (
  data: Pick<FundScreenerPreset, 'label' | 'description' | 'filters' | 'sortKey'>,
) => api.post<FundScreenerPreset>('/presets', data).then((r) => r.data);
export const updateFundPreset = (
  id: string,
  data: Partial<Pick<FundScreenerPreset, 'label' | 'description' | 'filters' | 'sortKey'>>,
) => api.put<FundScreenerPreset>(`/presets/${id}`, data).then((r) => r.data);
export const deleteFundPreset = (id: string) =>
  api.delete(`/presets/${id}`).then((r) => r.data);
export const fetchMappings = () =>
  api.get<FundsMappingsResponse>('/mappings').then((r) => r.data);
export const upsertMapping = (data: UpsertMappingRequest) =>
  api.post('/mappings', data).then((r) => r.data);
export const deleteMapping = (cusip: string) =>
  api.delete(`/mappings/${encodeURIComponent(cusip)}`).then((r) => r.data);
export const createFund = (data: CreateFundRequest) =>
  api.post<Fund>('/', data).then((r) => r.data);
export const updateFund = (id: string, data: UpdateFundRequest) =>
  api.patch<Fund>(`/${id}`, data).then((r) => r.data);
export const refreshFund = (id: string) =>
  api.post<RefreshFundResponse>(`/${id}/refresh`).then((r) => r.data);
export const deleteFund = (id: string) =>
  api.delete(`/${id}`).then((r) => r.data);
