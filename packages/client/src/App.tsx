import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './apps/networth/pages/Dashboard';
import Admin from './apps/networth/pages/Admin';
import Snapshots from './apps/networth/pages/Snapshots';
import NewSnapshot from './apps/networth/pages/NewSnapshot';
import EditSnapshot from './apps/networth/pages/EditSnapshot';
import Insights from './apps/networth/pages/Insights';
import Help from './apps/networth/pages/Help';
import TodoDashboard from './apps/todo/pages/Dashboard';
import TodoCalendar from './apps/todo/pages/Calendar';
import StocksDashboard from './apps/stocks/pages/Dashboard';
import NewStock from './apps/stocks/pages/NewStock';
import StockDetail from './apps/stocks/pages/StockDetail';
import StocksAgent from './apps/stocks/pages/Agent';

export default function App() {
  return (
    <>
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: '#1a1f36',
          color: '#e2e8f0',
          border: '1px solid rgba(99, 122, 167, 0.2)',
          borderRadius: '12px',
          fontSize: '0.875rem',
          padding: '12px 16px',
        },
        success: {
          iconTheme: { primary: '#53f2c8', secondary: '#1a1f36' },
        },
        error: {
          iconTheme: { primary: '#f87171', secondary: '#1a1f36' },
          duration: 5000,
        },
      }}
    />
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />

        {/* Net Worth App */}
        <Route path="/networth" element={<Dashboard />} />
        <Route path="/networth/admin" element={<Admin />} />
        <Route path="/networth/snapshots" element={<Snapshots />} />
        <Route path="/networth/snapshots/new" element={<NewSnapshot />} />
        <Route path="/networth/snapshots/:id" element={<EditSnapshot />} />
        <Route path="/networth/insights" element={<Insights />} />

        {/* Todo App */}
        <Route path="/todo" element={<TodoDashboard />} />
        <Route path="/todo/calendar" element={<TodoCalendar />} />

        {/* Stocks App */}
        <Route path="/stocks" element={<StocksDashboard />} />
        <Route path="/stocks/agent" element={<StocksAgent />} />
        <Route path="/stocks/new" element={<NewStock />} />
        <Route path="/stocks/:id" element={<StockDetail />} />

        {/* Platform */}
        <Route path="/help" element={<Help />} />
      </Route>
    </Routes>
    </>
  );
}
