import { HelpCircle, LayoutDashboard, Camera, TrendingUp, Settings, Copy, Target, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const sections = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    route: '/',
    description: 'Your financial overview at a glance.',
    details: [
      'View combined family net worth and per-member breakdown',
      'See change indicators (▲/▼) compared to the previous snapshot',
      'Net worth trend line chart shows progress over time (needs 2+ snapshots)',
      'Asset and liability pie charts show how your money is distributed by category',
      'Quick link to create a new snapshot',
    ],
  },
  {
    icon: Camera,
    title: 'Snapshots',
    route: '/snapshots',
    description: 'A snapshot captures everyone\'s assets and liabilities at a point in time.',
    details: [
      'Create a new snapshot whenever you want — monthly works well for most people',
      'Each snapshot contains line items grouped by family member',
      'For each line item, pick a category (e.g., "Investments"), enter a name (e.g., "Vanguard 401k"), and a dollar amount',
      'Assets are stored as positive values, liabilities as negative — net worth = total of everything',
      'Use "Carry Forward" (copy icon) to clone a previous snapshot and update only what changed — saves tons of data entry',
      'You can edit or delete any snapshot from the list',
    ],
  },
  {
    icon: TrendingUp,
    title: 'Insights & Analytics',
    route: '/insights',
    description: 'Deep-dive into your financial trends and projections.',
    details: [
      'Net Worth Trend — line chart showing each member + combined net worth across all snapshots',
      'Period-over-Period Change — bar chart of how much net worth changed between consecutive snapshots (green = growth, red = decline)',
      'Asset Allocation — pie chart showing what percentage of your assets are in each category',
      'Category Breakdown — horizontal bar chart ranking all categories by size',
      '12-Month Projection — dashed line showing where you\'re headed based on average growth rate',
      'Goal Tracking — set financial targets (e.g., "Reach $500k by Dec 2027"), see progress bars and projected completion dates',
    ],
  },
  {
    icon: Settings,
    title: 'Admin / Configuration',
    route: '/admin',
    description: 'Customize the app to match your family and financial situation.',
    details: [
      'Family Members — add, rename, or remove members. Pick a color for each (used in charts)',
      'Asset Categories — define buckets like "Cash & Savings", "Investments", "Real Estate", etc.',
      'Liability Categories — define buckets like "Mortgage", "Student Loans", "Credit Cards", etc.',
      'Changes are saved to JSON config files in the repo — they\'re version-controlled',
      'Deleting a member or category doesn\'t remove existing snapshot data referencing it',
    ],
  },
];

const tips = [
  {
    title: 'Getting Started',
    content: 'Go to Admin first to set up your family members and customize categories. Then create your first snapshot from the Snapshots page.',
  },
  {
    title: 'Carry Forward = Less Work',
    content: 'After your first snapshot, always use "Carry Forward" to create the next one. It copies all your previous entries so you only need to update what changed (e.g., new bank balance, paid-off loan).',
  },
  {
    title: 'How Often to Snapshot',
    content: 'Monthly is the sweet spot for most people — frequent enough to see trends, infrequent enough not to be a chore. But you can do it weekly, quarterly, or whenever you like.',
  },
  {
    title: 'Values in Dollars, Stored in Cents',
    content: 'Enter dollar amounts normally ($15,000). Behind the scenes, values are stored as integers in cents to avoid floating-point rounding issues.',
  },
  {
    title: 'Liabilities Are Subtracted Automatically',
    content: 'When you add a liability, just enter the positive number (e.g., $200,000 mortgage). The app automatically stores it as negative and subtracts it from your net worth.',
  },
  {
    title: 'Data Storage',
    content: 'Config (members, categories, goals) is saved as JSON files in the config/ folder — checked into git. Actual snapshot data lives in a local SQLite database (data/networth.db) which is gitignored. Back up the .db file if needed.',
  },
];

export default function Help() {
  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <HelpCircle className="w-7 h-7 text-primary-600" />
          <h2 className="text-2xl font-bold text-gray-900">Help & Guide</h2>
        </div>
        <p className="text-gray-500">Everything you need to know about using the Net Worth Tracker.</p>
      </div>

      {/* Quick start */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-primary-900 mb-3">Quick Start</h3>
        <ol className="space-y-2 text-sm text-primary-800">
          <li className="flex items-start gap-2">
            <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <span>Go to <Link to="/networth/admin" className="underline font-medium">Admin</Link> and set up your family members & categories</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <span>Go to <Link to="/networth/snapshots/new" className="underline font-medium">New Snapshot</Link> and add your assets & liabilities for each person</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <span>View your <Link to="/" className="underline font-medium">Dashboard</Link> — create more snapshots over time to see trends</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">4</span>
            <span>Explore <Link to="/networth/insights" className="underline font-medium">Insights</Link> for projections, goal tracking, and detailed analytics</span>
          </li>
        </ol>
      </div>

      {/* Page sections */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">Pages</h3>
        {sections.map((section) => (
          <div key={section.route} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{section.title}</h4>
                  <p className="text-sm text-gray-500">{section.description}</p>
                </div>
              </div>
              <Link
                to={section.route}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
              >
                Go <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <ul className="space-y-1.5 ml-13">
              {section.details.map((detail, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-primary-400 mt-1">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Tips & Notes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tips.map((tip) => (
            <div key={tip.title} className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-medium text-gray-900 mb-1">{tip.title}</h4>
              <p className="text-sm text-gray-500 leading-relaxed">{tip.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Keyboard shortcut / version info */}
      <div className="text-center text-xs text-gray-400 py-4">
        Net Worth Tracker v1.0.0 — Data stored locally on your machine
      </div>
    </div>
  );
}
