import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import App from './App';
import './index.css';

const mutationCache = new MutationCache({
  onSuccess: (_data, _variables, _context, mutation) => {
    const msg = (mutation.meta as Record<string, unknown>)?.successMessage;
    if (typeof msg === 'string') toast.success(msg);
  },
  onError: (error, _variables, _context, mutation) => {
    const msg = (mutation.meta as Record<string, unknown>)?.errorMessage;
    if (typeof msg === 'string') {
      toast.error(msg);
    } else {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  },
});

const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
