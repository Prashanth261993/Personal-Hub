import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MoreHorizontal } from 'lucide-react';
import { getIcon } from './IconSuggest';
import TodoCard from './TodoCard';
import type { TodoSummary, TodoGroup } from '@networth/shared';

interface KanbanColumnProps {
  group: TodoGroup;
  todos: TodoSummary[];
  allGroups: TodoGroup[];
  onAddTodo: (groupId: string) => void;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onEditGroup: (group: TodoGroup) => void;
}

export default function KanbanColumn({
  group,
  todos,
  allGroups,
  onAddTodo,
  onComplete,
  onReopen,
  onUpdate,
  onDelete,
  onEditGroup,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id });
  const GroupIcon = getIcon(group.icon);

  const openTodos = todos.filter(t => t.status === 'open');
  const completedTodos = todos.filter(t => t.status === 'completed');

  return (
    <div
      className={`flex flex-col bg-gray-50/80 rounded-2xl min-w-[300px] w-[300px] flex-shrink-0 transition-colors ${
        isOver ? 'bg-primary-50/50 ring-2 ring-primary-200' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: group.color + '20', color: group.color }}
        >
          {GroupIcon && <GroupIcon className="w-4 h-4" />}
        </div>
        <span className="font-semibold text-sm text-gray-900 flex-1 truncate">{group.name}</span>
        <span className="text-xs text-gray-400 bg-gray-200/60 px-1.5 py-0.5 rounded-full">
          {openTodos.length}
        </span>
        <button
          onClick={() => onEditGroup(group)}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-lg transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Add button */}
      <div className="px-3 pb-2">
        <button
          onClick={() => onAddTodo(group.id)}
          className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-gray-500 hover:text-primary-600 hover:bg-white rounded-lg border border-dashed border-gray-300 hover:border-primary-300 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add task
        </button>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 px-3 pb-3 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-thin"
      >
        <SortableContext items={openTodos.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence mode="popLayout">
            {openTodos.map(todo => (
              <TodoCard
                key={todo.id}
                todo={todo}
                groups={allGroups}
                onComplete={onComplete}
                onReopen={onReopen}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </AnimatePresence>
        </SortableContext>

        {/* Empty state */}
        {openTodos.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-2">
              <span className="text-lg">✨</span>
            </div>
            <p className="text-xs text-gray-400">No tasks yet</p>
          </motion.div>
        )}

        {/* Completed section */}
        {completedTodos.length > 0 && (
          <div className="pt-2 mt-2 border-t border-gray-200/60">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1.5 px-1">
              Completed ({completedTodos.length})
            </p>
            <AnimatePresence mode="popLayout">
              {completedTodos.slice(0, 3).map(todo => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  groups={allGroups}
                  onComplete={onComplete}
                  onReopen={onReopen}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
