import { motion } from 'framer-motion';
import { AlertTriangle, Clock } from 'lucide-react';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';
import PriorityBadge from './PriorityBadge';
import type { TodoSummary } from '@networth/shared';

interface OverdueUpcomingProps {
  todos: TodoSummary[];
  onComplete: (id: string) => void;
}

export default function OverdueUpcoming({ todos, onComplete }: OverdueUpcomingProps) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const openTodos = todos.filter(t => t.status === 'open' && t.dueDate && !t.parentId);

  const overdue = openTodos
    .filter(t => isPast(parseISO(t.dueDate!)) && !isToday(parseISO(t.dueDate!)))
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  const upcoming = openTodos
    .filter(t => {
      const d = parseISO(t.dueDate!);
      return !isPast(d) || isToday(d);
    })
    .filter(t => differenceInDays(parseISO(t.dueDate!), today) <= 7)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-red-500" />
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">Overdue & Upcoming</h3>
      </div>

      {overdue.length === 0 && upcoming.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-400">No urgent tasks</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[250px] overflow-y-auto">
          {/* Overdue */}
          {overdue.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-red-500 font-semibold mb-2">
                Overdue ({overdue.length})
              </p>
              <div className="space-y-1.5">
                {overdue.slice(0, 5).map((todo, i) => (
                  <TodoChip key={todo.id} todo={todo} onComplete={onComplete} index={i} variant="overdue" />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-blue-500 font-semibold mb-2">
                Next 7 Days ({upcoming.length})
              </p>
              <div className="space-y-1.5">
                {upcoming.slice(0, 5).map((todo, i) => (
                  <TodoChip key={todo.id} todo={todo} onComplete={onComplete} index={i} variant="upcoming" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TodoChip({
  todo,
  onComplete,
  index,
  variant,
}: {
  todo: TodoSummary;
  onComplete: (id: string) => void;
  index: number;
  variant: 'overdue' | 'upcoming';
}) {
  const accent = variant === 'overdue' ? 'border-l-red-400' : 'border-l-blue-400';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border-l-2 ${accent} group`}
    >
      <button
        onClick={() => onComplete(todo.id)}
        className="w-4 h-4 rounded-full border-2 border-gray-300 hover:border-green-400 flex-shrink-0 transition-colors"
      />
      <span className="flex-1 text-xs text-gray-700 truncate">{todo.title}</span>
      <span className="text-[10px] text-gray-400 flex-shrink-0">
        {todo.dueDate && format(parseISO(todo.dueDate), 'MMM d')}
      </span>
      <PriorityBadge priority={todo.priority} size="xs" />
    </motion.div>
  );
}
