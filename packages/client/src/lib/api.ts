import axios from 'axios';

// Shared axios instance for platform-level API calls
const api = axios.create({ baseURL: '/api' });

export const fetchHealth = () => api.get<{ status: string; timestamp: string }>('/health').then((r) => r.data);

export default api;
