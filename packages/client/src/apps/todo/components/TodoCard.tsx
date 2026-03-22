import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Repeat, ChevronDown, ChevronRight, ListChecks } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import PriorityBadge from './PriorityBadge';
import StatusBadge from './StatusBadge';
import TodoDetail from './TodoDetail';
import type { TodoSummary, TodoGroup } from '@networth/shared';

interface TodoCardProps {
  todo: TodoSummary;
  groups: TodoGroup[];
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

export default function TodoCard({ todo, groups, onComplete, onReopen, onUpdate, onDelete }: TodoCardProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCompleted = todo.status === 'completed';

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleted) {
      onReopen(todo.id);
    } else {
      onComplete(todo.id);
    }
  };

  const group = groups.find(g => g.id === todo.groupId);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className={`relative bg-white rounded-xl border transition-all ${
        isDragging ? 'shadow-xl border-primary-300 z-50' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      } ${isCompleted ? 'opacity-60' : ''}`}
    >
      {/* Card */}
      <div
        className="flex items-start gap-2 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 p-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Checkbox */}
        <button
          onClick={handleCheck}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : todo.priority === 'high'
                ? 'border-red-300 hover:border-red-500 hover:bg-red-50'
                : todo.priority === 'medium'
                  ? 'border-amber-300 hover:border-amber-500 hover:bg-amber-50'
                  : 'border-green-300 hover:border-green-500 hover:bg-green-50'
          }`}
        >
          {isCompleted && (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              className="w-3 h-3"
              viewBox="0 0 12 12"
            >
              <path d="M2 6l3 3 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </motion.svg>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className="flex items-center gap-2 flex-wrap px-2 py-1 -mx-2 -mt-0.5 rounded-lg"
            style={group ? { backgroundColor: group.color + '08' } : undefined}
          >
            <span className={`text-sm font-medium ${isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {todo.title}
            </span>
            {todo.recurrence && <Repeat className="w-3 h-3 text-gray-400 flex-shrink-0" />}
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <PriorityBadge priority={todo.priority} size="xs" />
            <StatusBadge dueDate={todo.dueDate} />
            {todo.dueDate && (
              <span className="text-[10px] text-gray-400">
                {format(parseISO(todo.dueDate), 'MMM d')}
              </span>
            )}
            {todo.subtaskCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
                <ListChecks className="w-3 h-3" />
                {todo.subtaskCompletedCount}/{todo.subtaskCount}
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <div className="flex-shrink-0 mt-0.5">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-300" />
          )}
        </div>

        {/* Group color accent */}
        {group && (
          <div
            className="absolute top-0 left-0 w-1 h-full rounded-l-xl"
            style={{ backgroundColor: group.color }}
          />
        )}
      </div>

      {/* Inline Expand (TodoDetail) */}
      <AnimatePresence>
        {expanded && (
          <TodoDetail
            todoId={todo.id}
            groups={groups}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onClose={() => setExpanded(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
