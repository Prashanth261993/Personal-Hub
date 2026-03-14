import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Repeat, X } from 'lucide-react';
import type { RecurrenceRule, RecurrenceFrequency } from '@networth/shared';

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface RecurrenceEditorProps {
  value: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
}

export default function RecurrenceEditor({ value, onChange }: RecurrenceEditorProps) {
  const [open, setOpen] = useState(false);

  const enabled = !!value;
  const rule = value || { frequency: 'weekly' as RecurrenceFrequency, interval: 1, weekdays: [] };

  const toggle = () => {
    if (enabled) {
      onChange(null);
    } else {
      onChange({ frequency: 'weekly', interval: 1, weekdays: [1, 3, 5] }); // M/W/F default
      setOpen(true);
    }
  };

  const updateRule = (updates: Partial<RecurrenceRule>) => {
    onChange({ ...rule, ...updates });
  };

  const toggleWeekday = (day: number) => {
    const current = rule.weekdays || [];
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort();
    updateRule({ weekdays: updated });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
          enabled
            ? 'bg-primary-50 text-primary-600 border border-primary-200'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Repeat className="w-3.5 h-3.5" />
        {enabled ? formatRecurrence(rule) : 'Repeat'}
      </button>

      {enabled && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="ml-1 text-gray-400 hover:text-gray-600 text-xs underline"
        >
          {open ? 'close' : 'edit'}
        </button>
      )}

      <AnimatePresence>
        {open && enabled && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-lg p-4 space-y-3 z-20 min-w-[260px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Recurrence</span>
              <button type="button" onClick={() => setOpen(false)} className="p-0.5 hover:bg-gray-100 rounded">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>

            {/* Frequency */}
            <div className="flex gap-1">
              {FREQUENCIES.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => updateRule({ frequency: f.value })}
                  className={`px-2 py-1 text-xs rounded-lg transition-all ${
                    rule.frequency === f.value
                      ? 'bg-primary-100 text-primary-700 font-medium'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Interval */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Every</span>
              <input
                type="number"
                min={1}
                max={99}
                value={rule.interval}
                onChange={e => updateRule({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-14 px-2 py-1 text-xs border border-gray-200 rounded-lg text-center outline-none focus:border-primary-300"
              />
              <span className="text-xs text-gray-500">
                {rule.frequency === 'daily' ? 'day(s)' : rule.frequency === 'weekly' ? 'week(s)' : rule.frequency === 'monthly' ? 'month(s)' : 'year(s)'}
              </span>
            </div>

            {/* Weekdays (only for weekly) */}
            {rule.frequency === 'weekly' && (
              <div className="flex gap-1">
                {WEEKDAYS.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleWeekday(i)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                      (rule.weekdays || []).includes(i)
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {day.charAt(0)}
                  </button>
                ))}
              </div>
            )}

            {/* End date */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Ends</span>
              <input
                type="date"
                value={rule.endDate || ''}
                onChange={e => updateRule({ endDate: e.target.value || undefined })}
                className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-primary-300"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatRecurrence(rule: RecurrenceRule): string {
  const freq = rule.frequency;
  const interval = rule.interval;

  if (interval === 1) {
    if (freq === 'weekly' && rule.weekdays?.length) {
      const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      return rule.weekdays.map(d => days[d]).join('/');
    }
    return freq.charAt(0).toUpperCase() + freq.slice(1);
  }
  return `Every ${interval} ${freq === 'daily' ? 'days' : freq === 'weekly' ? 'weeks' : freq === 'monthly' ? 'months' : 'years'}`;
}
