import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import KanbanColumn from './KanbanColumn';
import PriorityBadge from './PriorityBadge';
import type { TodoSummary, TodoGroup } from '@networth/shared';

interface KanbanBoardProps {
  groups: TodoGroup[];
  todos: TodoSummary[];
  onAddTodo: (groupId: string) => void;
  onComplete: (id: string) => void;
  onReopen: (id: string) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onMoveTodo: (todoId: string, groupId: string, sortOrder: number) => void;
  onNewGroup: () => void;
  onEditGroup: (group: TodoGroup) => void;
}

export default function KanbanBoard({
  groups,
  todos,
  onAddTodo,
  onComplete,
  onReopen,
  onUpdate,
  onDelete,
  onMoveTodo,
  onNewGroup,
  onEditGroup,
}: KanbanBoardProps) {
  const [activeTodo, setActiveTodo] = useState<TodoSummary | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Group todos by groupId (only parent-level)
  const todosByGroup = new Map<string, TodoSummary[]>();
  for (const group of groups) {
    todosByGroup.set(group.id, []);
  }
  for (const todo of todos) {
    if (todo.parentId) continue; // skip subtasks
    const list = todosByGroup.get(todo.groupId) || [];
    list.push(todo);
    todosByGroup.set(todo.groupId, list);
  }

  // Sort each group's todos by sortOrder
  for (const [, list] of todosByGroup) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const findTodoContainer = (todoId: string): string | undefined => {
    for (const [groupId, groupTodos] of todosByGroup) {
      if (groupTodos.some(t => t.id === todoId)) return groupId;
    }
    return undefined;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const todo = todos.find(t => t.id === event.active.id);
    if (todo) setActiveTodo(todo);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Visual feedback handled by droppable isOver
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTodo(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Determine target group
    let targetGroupId: string;
    const overGroup = groups.find(g => g.id === overId);
    if (overGroup) {
      targetGroupId = overGroup.id;
    } else {
      // Over a todo — find its group
      targetGroupId = findTodoContainer(overId) || '';
    }

    if (!targetGroupId) return;

    const sourceGroupId = findTodoContainer(activeId);
    if (!sourceGroupId) return;

    // Calculate new sortOrder
    const targetTodos = todosByGroup.get(targetGroupId) || [];
    const overIndex = targetTodos.findIndex(t => t.id === overId);
    let newSortOrder: number;

    if (overGroup) {
      // Dropped on column (empty space) — put at the end
      newSortOrder = targetTodos.length;
    } else if (overIndex >= 0) {
      newSortOrder = overIndex;
    } else {
      newSortOrder = targetTodos.length;
    }

    if (sourceGroupId === targetGroupId) {
      const activeIndex = targetTodos.findIndex(t => t.id === activeId);
      if (activeIndex === newSortOrder) return;
    }

    onMoveTodo(activeId, targetGroupId, newSortOrder);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
        {groups.map(group => (
          <KanbanColumn
            key={group.id}
            group={group}
            todos={todosByGroup.get(group.id) || []}
            allGroups={groups}
            onAddTodo={onAddTodo}
            onComplete={onComplete}
            onReopen={onReopen}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onEditGroup={onEditGroup}
          />
        ))}

        {/* Add Group Column */}
        <motion.button
          onClick={onNewGroup}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex flex-col items-center justify-center min-w-[200px] h-40 bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:text-primary-500 hover:border-primary-300 hover:bg-primary-50/20 transition-colors flex-shrink-0"
        >
          <Plus className="w-6 h-6 mb-1" />
          <span className="text-sm font-medium">Add Group</span>
        </motion.button>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTodo && (
          <motion.div
            initial={{ scale: 1, rotate: 0 }}
            animate={{ scale: 1.05, rotate: 2 }}
            className="bg-white rounded-xl border border-primary-200 shadow-xl p-3 w-[280px] opacity-90"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{activeTodo.title}</span>
            </div>
            <div className="mt-1">
              <PriorityBadge priority={activeTodo.priority} size="xs" />
            </div>
          </motion.div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
