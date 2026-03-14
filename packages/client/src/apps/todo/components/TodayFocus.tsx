import { motion, AnimatePresence } from 'framer-motion';
import { useSpring, animated } from '@react-spring/web';
import { Sun, Check } from 'lucide-react';
import PriorityBadge from './PriorityBadge';
import StatusBadge from './StatusBadge';
import type { TodoSummary } from '@networth/shared';

interface TodayFocusProps {
  todos: TodoSummary[];
  onComplete: (id: string) => void;
}

export default function TodayFocus({ todos, onComplete }: TodayFocusProps) {
  // Use local date (not UTC) so timezone doesn't shift the "today" boundary
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayTodos = todos
    .filter(t => t.dueDate === today && t.status === 'open' && !t.parentId)
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 5);

  const allDone = todayTodos.length === 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
          <Sun className="w-4 h-4 text-amber-500" />
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">Today's Focus</h3>
        {!allDone && (
          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {todayTodos.length}
          </span>
        )}
      </div>

      {allDone ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center py-6 text-center"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-3xl mb-2"
          >
            🎉
          </motion.div>
          <p className="text-sm font-medium text-gray-700">All done for today!</p>
          <p className="text-xs text-gray-400 mt-1">Enjoy your free time</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {todayTodos.map((todo, i) => (
              <motion.div
                key={todo.id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30, scale: 0.9 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 group"
              >
                <button
                  onClick={() => onComplete(todo.id)}
                  className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-400 flex-shrink-0 flex items-center justify-center transition-all group-hover:border-green-400"
                >
                  <Check className="w-3 h-3 text-gray-300 group-hover:text-green-400 transition-colors" />
                </button>
                <span className="flex-1 text-sm text-gray-700 truncate">{todo.title}</span>
                <PriorityBadge priority={todo.priority} size="xs" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
