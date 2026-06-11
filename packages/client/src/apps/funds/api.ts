import axios from 'axios';
import type {
  CreateFundRequest,
  Fund,
  FundDeltasResponse,
  FundDetailResponse,
  FundHolding,
  FundsDashboardRow,
  FundsHomeSummary,
  FundsScreenerResponse,
  LinkHoldingRequest,
  RefreshFundResponse,
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
export const createFund = (data: CreateFundRequest) =>
  api.post<Fund>('/', data).then((r) => r.data);
export const refreshFund = (id: string) =>
  api.post<RefreshFundResponse>(`/${id}/refresh`).then((r) => r.data);
export const deleteFund = (id: string) =>
  api.delete(`/${id}`).then((r) => r.data);
