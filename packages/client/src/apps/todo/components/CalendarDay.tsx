import { isToday } from 'date-fns';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { CalendarTodo } from '@networth/shared';

interface CalendarDayProps {
  date: Date;
  isCurrentMonth: boolean;
  todos: CalendarTodo[];
  onAddTodo: (date: string) => void;
  onClickTodo: (todo: CalendarTodo) => void;
  isDraggingActive?: boolean;
}

const priorityDot: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-green-400',
};

function DraggableTodoChip({ todo, onClickTodo }: { todo: CalendarTodo; onClickTodo: (t: CalendarTodo) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cal_${todo.id}`,
    data: { todo },
  });

  return (
    <motion.button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClickTodo(todo); }}
      whileHover={{ scale: 1.02 }}
      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate flex items-center gap-1 transition-colors touch-none ${
        isDragging ? 'opacity-40' : ''
      } ${
        todo.status === 'completed'
          ? 'bg-gray-100 text-gray-400 line-through'
          : 'hover:brightness-95'
      }`}
      style={!isDragging && todo.status !== 'completed' ? {
        backgroundColor: todo.groupColor + '15',
        color: todo.groupColor,
      } : undefined}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        todo.status === 'completed' ? 'bg-gray-300' : priorityDot[todo.priority]
      }`} />
      {todo.title}
    </motion.button>
  );
}

export default function CalendarDay({ date, isCurrentMonth, todos, onAddTodo, onClickTodo, isDraggingActive }: CalendarDayProps) {
  const today = isToday(date);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const maxVisible = 3;
  const visible = todos.slice(0, maxVisible);
  const overflow = todos.length - maxVisible;

  const { setNodeRef, isOver } = useDroppable({
    id: `day_${dateStr}`,
    data: { date: dateStr },
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative min-h-[100px] border-b border-r border-gray-100 p-1.5 group transition-all duration-200 ${
        isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'
      } ${today ? 'ring-2 ring-inset ring-primary-200 bg-primary-50/20' : ''} ${
        isOver && isDraggingActive ? 'bg-primary-50 ring-2 ring-inset ring-primary-300 scale-[1.02]' : ''
      }`}
    >
      {/* Date number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={`text-xs font-medium leading-none ${
            today
              ? 'w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center'
              : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
          }`}
        >
          {date.getDate()}
        </span>
        <button
          onClick={() => onAddTodo(dateStr)}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-primary-500 transition-all"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Todo chips */}
      <div className="space-y-0.5">
        {visible.map(todo => (
          <DraggableTodoChip key={todo.id} todo={todo} onClickTodo={onClickTodo} />
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-gray-400 px-1">+{overflow} more</span>
        )}
      </div>
    </div>
  );
}
