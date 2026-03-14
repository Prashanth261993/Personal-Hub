import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, X } from 'lucide-react';
import { format } from 'date-fns';
import CalendarGrid from '../components/CalendarGrid';
import QuickAdd from '../components/QuickAdd';
import TodoDetail from '../components/TodoDetail';
import { fetchCalendarTodos, fetchGroups, createTodo, completeTodo, reopenTodo, updateTodo, deleteTodo } from '../api';
import type { CalendarTodo, TodoPriority, RecurrenceRule } from '@networth/shared';

export default function Calendar() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);

  const monthKey = format(currentMonth, 'yyyy-MM');

  const { data: calendarTodos = [] } = useQuery({
    queryKey: ['todo-calendar', monthKey],
    queryFn: () => fetchCalendarTodos(monthKey),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['todo-groups'],
    queryFn: fetchGroups,
  });

  const createTodoMutation = useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['todo-stats'] });
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['todo-calendar'] });
    queryClient.invalidateQueries({ queryKey: ['todos'] });
    queryClient.invalidateQueries({ queryKey: ['todo-stats'] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateTodo(id, data),
    onSuccess: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTodo(id),
    onSuccess: () => {
      setSelectedTodoId(null);
      invalidateAll();
    },
  });

  const handleAddTodo = (date: string) => {
    setQuickAddDate(date);
  };

  const handleClickTodo = (todo: CalendarTodo) => {
    // For recurring instances, the id is `todoId_date` — extract the real todoId
    const realId = todo.isRecurringInstance ? todo.id.split('_')[0] : todo.id;
    setSelectedTodoId(realId);
  };

  const handleQuickAdd = (data: { title: string; groupId: string; priority: TodoPriority; dueDate?: string; recurrence?: RecurrenceRule }) => {
    createTodoMutation.mutate({
      groupId: data.groupId,
      title: data.title,
      priority: data.priority,
      dueDate: data.dueDate,
      recurrence: data.recurrence,
    });
    setQuickAddDate(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500">See your tasks across the month</p>
        </div>
      </motion.div>

      {/* Quick Add (shown when date clicked) */}
      {quickAddDate && groups.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <QuickAdd
            groups={groups}
            defaultDate={quickAddDate}
            onAdd={handleQuickAdd}
          />
        </motion.div>
      )}

      {/* Calendar */}
      <CalendarGrid
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        todos={calendarTodos}
        onAddTodo={handleAddTodo}
        onClickTodo={handleClickTodo}
      />

      {/* Todo Detail Modal */}
      <AnimatePresence>
        {selectedTodoId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedTodoId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Task Details</h3>
                <button
                  onClick={() => setSelectedTodoId(null)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <TodoDetail
                todoId={selectedTodoId}
                groups={groups}
                onUpdate={(id, data) => updateMutation.mutate({ id, data })}
                onDelete={id => deleteMutation.mutate(id)}
                onClose={() => setSelectedTodoId(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
