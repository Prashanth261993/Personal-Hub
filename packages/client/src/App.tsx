import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './apps/networth/pages/Dashboard';
import Admin from './apps/networth/pages/Admin';
import Snapshots from './apps/networth/pages/Snapshots';
import NewSnapshot from './apps/networth/pages/NewSnapshot';
import EditSnapshot from './apps/networth/pages/EditSnapshot';
import Insights from './apps/networth/pages/Insights';
import Help from './apps/networth/pages/Help';

export default function App() {
  return (
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

        {/* Platform */}
        <Route path="/help" element={<Help />} />
      </Route>
    </Routes>
  );
}
