import { useState, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
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
  const lastOverId = useRef<UniqueIdentifier | null>(null);

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

  const groupIds = groups.map(g => g.id);
  const allItemIds = todos.filter(t => !t.parentId).map(t => t.id);

  const findContainer = (id: UniqueIdentifier): string | undefined => {
    // Check if the id is a group id (droppable column)
    if (groupIds.includes(id as string)) return id as string;
    // Otherwise it's a todo id — find which group it belongs to
    for (const [groupId, groupTodos] of todosByGroup) {
      if (groupTodos.some(t => t.id === id)) return groupId;
    }
    return undefined;
  };

  /**
   * Custom collision detection:
   * First try pointerWithin (precise), then fall back to rectIntersection.
   * Always prefer droppable columns over sortable items when the pointer is
   * clearly inside a column.
   */
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      // If dragging over a column header, prefer that
      const pointerCollisions = pointerWithin(args);
      const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);

      let overId = getFirstCollision(collisions, 'id');

      if (overId != null) {
        // If the collision is with a group (column), find the closest item within
        if (groupIds.includes(overId as string)) {
          const containerItems = (todosByGroup.get(overId as string) || [])
            .filter(t => t.status === 'open');
          if (containerItems.length > 0) {
            // Use closestCenter among items in the container
            const closestInContainer = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (c) => c.id !== overId && containerItems.some(t => t.id === c.id)
              ),
            });
            if (closestInContainer.length > 0) {
              overId = closestInContainer[0].id;
            }
          }
        }
        lastOverId.current = overId;
      }

      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [groupIds, todosByGroup]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const todo = todos.find(t => t.id === event.active.id);
    if (todo) setActiveTodo(todo);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    // Moving between columns — do an optimistic move via the API
    // (the actual reorder happens in onDragEnd)
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTodo(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) return;

    // Determine target group
    let targetGroupId = overContainer;

    // Calculate new sortOrder
    const targetTodos = (todosByGroup.get(targetGroupId) || []).filter(t => t.status === 'open');
    const overIndex = targetTodos.findIndex(t => t.id === overId);
    let newSortOrder: number;

    if (groupIds.includes(overId)) {
      // Dropped on column itself — put at the end
      newSortOrder = targetTodos.length;
    } else if (overIndex >= 0) {
      newSortOrder = overIndex;
    } else {
      newSortOrder = targetTodos.length;
    }

    // Skip if same position
    if (activeContainer === targetGroupId) {
      const activeIndex = targetTodos.findIndex(t => t.id === activeId);
      if (activeIndex === newSortOrder) return;
    }

    onMoveTodo(activeId, targetGroupId, newSortOrder);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
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
