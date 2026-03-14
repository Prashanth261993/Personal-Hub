import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  format,
  isSameMonth,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CalendarDay from './CalendarDay';
import type { CalendarTodo } from '@networth/shared';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarGridProps {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  todos: CalendarTodo[];
  onAddTodo: (date: string) => void;
  onClickTodo: (todo: CalendarTodo) => void;
}

export default function CalendarGrid({
  currentMonth,
  onMonthChange,
  todos,
  onAddTodo,
  onClickTodo,
}: CalendarGridProps) {
  const [direction, setDirection] = useState(0);

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Group todos by date
  const todosByDate = useMemo(() => {
    const map = new Map<string, CalendarTodo[]>();
    for (const todo of todos) {
      const list = map.get(todo.dueDate) || [];
      list.push(todo);
      map.set(todo.dueDate, list);
    }
    return map;
  }, [todos]);

  const goToPrev = () => {
    setDirection(-1);
    onMonthChange(subMonths(currentMonth, 1));
  };

  const goToNext = () => {
    setDirection(1);
    onMonthChange(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setDirection(0);
    onMonthChange(new Date());
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir * 50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir * -50, opacity: 0 }),
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={goToNext}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 ml-2">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
        </div>
        <button
          onClick={goToToday}
          className="px-3 py-1 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
        >
          Today
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {WEEKDAYS.map(day => (
          <div key={day} className="text-center py-2 text-[11px] font-semibold text-gray-400 uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={format(currentMonth, 'yyyy-MM')}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="grid grid-cols-7"
        >
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            return (
              <CalendarDay
                key={dateStr}
                date={day}
                isCurrentMonth={isSameMonth(day, currentMonth)}
                todos={todosByDate.get(dateStr) || []}
                onAddTodo={onAddTodo}
                onClickTodo={onClickTodo}
              />
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
