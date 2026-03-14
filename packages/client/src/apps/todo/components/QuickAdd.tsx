import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, CalendarDays, Flag, ChevronDown } from 'lucide-react';
import type { TodoGroup, TodoPriority } from '@networth/shared';

interface QuickAddProps {
  groups: TodoGroup[];
  defaultGroupId?: string;
  defaultDate?: string;
  onAdd: (data: { title: string; groupId: string; priority: TodoPriority; dueDate?: string }) => void;
}

export default function QuickAdd({ groups, defaultGroupId, defaultDate, onAdd }: QuickAddProps) {
  const [title, setTitle] = useState('');
  const [groupId, setGroupId] = useState(defaultGroupId || groups[0]?.id || '');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueDate, setDueDate] = useState(defaultDate || '');
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !groupId) return;
    onAdd({ title: title.trim(), groupId, priority, dueDate: dueDate || undefined });
    setTitle('');
    setDueDate(defaultDate || '');
    setPriority('medium');
    setExpanded(false);
  };

  const priorityColors: Record<TodoPriority, string> = {
    high: 'text-red-500 bg-red-50 border-red-200',
    medium: 'text-amber-500 bg-amber-50 border-amber-200',
    low: 'text-green-500 bg-green-50 border-green-200',
  };

  const priorities: TodoPriority[] = ['high', 'medium', 'low'];

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onFocus={() => setExpanded(true)}
          placeholder="Add a new task..."
          className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-transparent"
        />
        <button
          type="submit"
          disabled={!title.trim() || !groupId}
          className="px-3 py-1 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50/50">
              {/* Group selector */}
              <div className="relative">
                <select
                  value={groupId}
                  onChange={e => setGroupId(e.target.value)}
                  className="appearance-none text-xs bg-white border border-gray-200 rounded-lg pl-2 pr-6 py-1.5 text-gray-700 cursor-pointer hover:border-gray-300 transition-colors"
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>

              {/* Priority toggle */}
              <div className="flex items-center gap-1">
                {priorities.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`p-1 rounded-md border transition-all ${
                      priority === p ? priorityColors[p] : 'text-gray-300 border-transparent hover:text-gray-400'
                    }`}
                    title={p}
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              {/* Due date */}
              <div className="flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="text-xs text-gray-600 bg-transparent outline-none cursor-pointer"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  );
}
