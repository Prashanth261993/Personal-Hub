import { motion, AnimatePresence } from 'framer-motion';
import { Repeat, X } from 'lucide-react';
import type { RecurrenceRule, RecurrenceFrequency } from '@networth/shared';

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const WEEKDAYS = [
  { short: 'Su', index: 0 },
  { short: 'Mo', index: 1 },
  { short: 'Tu', index: 2 },
  { short: 'We', index: 3 },
  { short: 'Th', index: 4 },
  { short: 'Fr', index: 5 },
  { short: 'Sa', index: 6 },
];

interface RecurrenceEditorProps {
  value: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
}

export default function RecurrenceEditor({ value, onChange }: RecurrenceEditorProps) {
  const enabled = !!value;
  const rule = value || { frequency: 'weekly' as RecurrenceFrequency, interval: 1 };

  const toggle = () => {
    if (enabled) {
      onChange(null);
    } else {
      onChange({ frequency: 'weekly', interval: 1 });
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
    <div className="space-y-2">
      {/* Toggle button */}
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
          enabled
            ? 'bg-primary-50 text-primary-600 border border-primary-200'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 border border-transparent'
        }`}
      >
        <Repeat className="w-3.5 h-3.5" />
        {enabled ? formatRecurrence(rule) : 'Add recurrence'}
      </button>

      {/* Inline settings (no popover — renders in flow) */}
      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50 rounded-xl p-3 space-y-3 border border-gray-100">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Recurrence</span>
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove recurrence"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Frequency */}
              <div className="flex gap-1 flex-wrap">
                {FREQUENCIES.map(f => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => updateRule({ frequency: f.value })}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                      rule.frequency === f.value
                        ? 'bg-primary-600 text-white shadow-sm font-medium'
                        : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
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
                  className="w-14 px-2 py-1 text-xs border border-gray-200 rounded-lg text-center outline-none focus:ring-1 focus:ring-primary-300 focus:border-primary-300 bg-white"
                />
                <span className="text-xs text-gray-500">
                  {rule.frequency === 'daily' ? 'day(s)' :
                   rule.frequency === 'weekly' ? 'week(s)' :
                   rule.frequency === 'monthly' ? 'month(s)' : 'year(s)'}
                </span>
              </div>

              {/* Weekdays (only for weekly) */}
              {rule.frequency === 'weekly' && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5 font-medium">Repeat on</p>
                  <div className="flex gap-1">
                    {WEEKDAYS.map(day => (
                      <button
                        key={day.index}
                        type="button"
                        onClick={() => toggleWeekday(day.index)}
                        className={`w-8 h-8 rounded-lg text-[11px] font-semibold transition-all ${
                          (rule.weekdays || []).includes(day.index)
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'bg-white text-gray-400 hover:bg-gray-100 hover:text-gray-600 border border-gray-200'
                        }`}
                      >
                        {day.short}
                      </button>
                    ))}
                  </div>
                  {(rule.weekdays || []).length === 0 && (
                    <p className="text-[10px] text-amber-500 mt-1">Select at least one day</p>
                  )}
                </div>
              )}

              {/* End date */}
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5 font-medium">Ends</p>
                <div className="flex items-center gap-2">
                  <select
                    value={rule.endDate ? 'date' : 'never'}
                    onChange={e => {
                      if (e.target.value === 'never') {
                        updateRule({ endDate: undefined });
                      } else {
                        updateRule({ endDate: '' });
                      }
                    }}
                    className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 outline-none focus:ring-1 focus:ring-primary-300 focus:border-primary-300"
                  >
                    <option value="never">Never</option>
                    <option value="date">On date</option>
                  </select>
                  {rule.endDate !== undefined && rule.endDate !== null && (
                    <input
                      type="date"
                      value={rule.endDate}
                      onChange={e => updateRule({ endDate: e.target.value || undefined })}
                      className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-300 focus:border-primary-300"
                    />
                  )}
                </div>
              </div>
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
  let label: string;

  if (interval === 1) {
    if (freq === 'weekly' && rule.weekdays?.length) {
      const dayLetters = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      label = rule.weekdays.map(d => dayLetters[d]).join(', ');
    } else {
      label = freq.charAt(0).toUpperCase() + freq.slice(1);
    }
  } else {
    label = `Every ${interval} ${freq === 'daily' ? 'days' : freq === 'weekly' ? 'wks' : freq === 'monthly' ? 'mos' : 'yrs'}`;
  }

  if (rule.endDate) {
    label += ` until ${rule.endDate}`;
  }

  return label;
}
