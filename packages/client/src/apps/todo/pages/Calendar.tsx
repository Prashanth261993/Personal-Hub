import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, X } from 'lucide-react';
import { format } from 'date-fns';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import CalendarGrid from '../components/CalendarGrid';
import QuickAdd from '../components/QuickAdd';
import TodoDetail from '../components/TodoDetail';
import PriorityBadge from '../components/PriorityBadge';
import {
  fetchCalendarTodos,
  fetchGroups,
  createTodo,
  updateTodo,
  deleteTodo,
  detachRecurringInstance,
} from '../api';
import type { CalendarTodo, TodoPriority, RecurrenceRule } from '@networth/shared';

export default function Calendar() {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<CalendarTodo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

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
    meta: { successMessage: 'Task created' },
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
    meta: { successMessage: 'Task deleted' },
    onSuccess: () => {
      setSelectedTodoId(null);
      invalidateAll();
    },
  });

  const detachMutation = useMutation({
    mutationFn: ({ id, originalDate, newDate }: { id: string; originalDate: string; newDate: string }) =>
      detachRecurringInstance(id, originalDate, newDate),
    onSuccess: invalidateAll,
  });

  const handleAddTodo = (date: string) => setQuickAddDate(date);

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

  const handleDragStart = (event: DragStartEvent) => {
    const todo = event.active.data.current?.todo as CalendarTodo | undefined;
    if (todo) setActiveDrag(todo);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDrag(null);

    if (!over) return;

    const todo = active.data.current?.todo as CalendarTodo | undefined;
    if (!todo) return;

    const targetDate = over.data.current?.date as string | undefined;
    if (!targetDate || targetDate === todo.dueDate) return;

    if (todo.isRecurringInstance) {
      // Detach: create standalone copy on new date, add exception to parent
      const realId = todo.id.split('_')[0];
      const originalDate = todo.dueDate;
      detachMutation.mutate({ id: realId, originalDate, newDate: targetDate });
    } else {
      // Simple move: update due date
      updateMutation.mutate({ id: todo.id, data: { dueDate: targetDate } });
    }
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
          <p className="text-sm text-gray-500">Drag tasks between days to reschedule</p>
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

      {/* Calendar with DnD */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <CalendarGrid
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          todos={calendarTodos}
          onAddTodo={handleAddTodo}
          onClickTodo={handleClickTodo}
          isDraggingActive={!!activeDrag}
        />

        <DragOverlay>
          {activeDrag && (
            <motion.div
              initial={{ scale: 1, rotate: 0 }}
              animate={{ scale: 1.08, rotate: 1 }}
              className="bg-white rounded-lg border border-primary-200 shadow-xl px-2.5 py-1.5 w-[180px] opacity-95"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-900 truncate">{activeDrag.title}</span>
              </div>
              <div className="mt-0.5">
                <PriorityBadge priority={activeDrag.priority} size="xs" />
              </div>
              {activeDrag.isRecurringInstance && (
                <p className="text-[9px] text-primary-500 mt-0.5 font-medium">Will detach from series</p>
              )}
            </motion.div>
          )}
        </DragOverlay>
      </DndContext>

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
