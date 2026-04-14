import axios from 'axios';
import type {
  AgentMessage,
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

// ── Agent streaming ──

export interface AgentSSECallbacks {
  onToken: (content: string) => void;
  onStatus: (status: { type: string; tool?: string; args?: Record<string, unknown>; message?: string; count?: number }) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

export async function streamAgentChat(messages: AgentMessage[], callbacks: AgentSSECallbacks, signal?: AbortSignal) {
  const response = await fetch('/api/stocks/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Unknown error' }));
    callbacks.onError(body.error || `HTTP ${response.status}`);
    callbacks.onDone();
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('No response stream');
    callbacks.onDone();
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let event = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        event = line.slice(7);
      } else if (line.startsWith('data: ') && event) {
        try {
          const data = JSON.parse(line.slice(6));
          switch (event) {
            case 'token':
              callbacks.onToken(data.content);
              break;
            case 'status':
              callbacks.onStatus(data);
              break;
            case 'error':
              callbacks.onError(data.message);
              break;
            case 'done':
              callbacks.onDone();
              break;
          }
        } catch {
          // skip malformed JSON
        }
        event = '';
      }
    }
  }
  callbacks.onDone();
}