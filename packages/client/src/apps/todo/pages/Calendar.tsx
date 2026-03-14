import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import CalendarGrid from '../components/CalendarGrid';
import QuickAdd from '../components/QuickAdd';
import { fetchCalendarTodos, fetchGroups, createTodo } from '../api';
import type { CalendarTodo, TodoPriority } from '@networth/shared';

export default function Calendar() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);

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

  const handleAddTodo = (date: string) => {
    setQuickAddDate(date);
  };

  const handleClickTodo = (todo: CalendarTodo) => {
    // For now, log the clicked todo - in future, could open detail panel
    console.log('Clicked calendar todo:', todo);
  };

  const handleQuickAdd = (data: { title: string; groupId: string; priority: TodoPriority; dueDate?: string }) => {
    createTodoMutation.mutate({
      groupId: data.groupId,
      title: data.title,
      priority: data.priority,
      dueDate: data.dueDate,
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
    </div>
  );
}
