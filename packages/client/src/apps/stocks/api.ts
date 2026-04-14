import axios from 'axios';
import type {
  CreateStockRequest,
  RefreshStockResponse,
  Stock,
  StockDetail,
  StockLookupResponse,
  StockPreset,
  StockVersion,
  StocksDashboardResponse,
  StocksHomeSummary,
  UpdateStockRequest,
} from '@networth/shared';

const api = axios.create({ baseURL: '/api/stocks' });

export const fetchStocksDashboard = () => api.get<StocksDashboardResponse>('/').then((r) => r.data);
export const fetchStocksSummary = () => api.get<StocksHomeSummary>('/summary').then((r) => r.data);
export const fetchStock = (id: string) => api.get<StockDetail>(`/${id}`).then((r) => r.data);
export const fetchStockHistory = (id: string) => api.get<StockVersion[]>(`/${id}/history`).then((r) => r.data);
export const lookupStock = (symbol: string) => api.post<StockLookupResponse>('/lookup', { symbol }).then((r) => r.data);
export const createStock = (data: CreateStockRequest) => api.post<Stock>('/', data).then((r) => r.data);
export const updateStock = (id: string, data: UpdateStockRequest) => api.put<Stock>(`/${id}`, data).then((r) => r.data);
export const deleteStock = (id: string) => api.delete(`/${id}`).then((r) => r.data);
export const refreshStock = (id: string) => api.post<RefreshStockResponse>(`/${id}/refresh`).then((r) => r.data);
export const fetchStockPresets = () => api.get<StockPreset[]>('/presets').then((r) => r.data);
export const createStockPreset = (data: Omit<StockPreset, 'id' | 'createdAt' | 'builtIn'>) => api.post<StockPreset>('/presets', data).then((r) => r.data);
export const updateStockPreset = (id: string, data: Partial<StockPreset>) => api.put<StockPreset>(`/presets/${id}`, data).then((r) => r.data);
export const deleteStockPreset = (id: string) => api.delete(`/presets/${id}`).then((r) => r.data);