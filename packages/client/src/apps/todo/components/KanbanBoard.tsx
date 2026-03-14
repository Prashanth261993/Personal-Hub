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
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import KanbanColumn from './KanbanColumn';
import PriorityBadge from './PriorityBadge';
import ConfirmModal from '../../../components/ConfirmModal';
import type { TodoSummary, TodoGroup } from '@networth/shared';

const TRASH_ID = '__trash__';

function TrashZone() {
  const { setNodeRef, isOver } = useDroppable({ id: TRASH_ID });

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`flex items-center justify-center gap-3 mx-auto w-full max-w-sm py-5 rounded-2xl border-2 border-dashed transition-all duration-200 ${
        isOver
          ? 'border-red-400 bg-red-50 shadow-lg shadow-red-100/50 scale-105'
          : 'border-gray-300 bg-gray-50/80'
      }`}
    >
      <Trash2 className={`w-6 h-6 transition-colors ${isOver ? 'text-red-500' : 'text-gray-400'}`} />
      <span className={`text-sm font-medium transition-colors ${isOver ? 'text-red-600' : 'text-gray-500'}`}>
        Drop here to delete
      </span>
    </motion.div>
  );
}

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
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);

  const isDragging = !!activeTodo;

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
    if (id === TRASH_ID) return TRASH_ID;
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
        if (overId !== TRASH_ID && groupIds.includes(overId as string)) {
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

    // Dropped on trash zone
    if (overId === TRASH_ID || findContainer(overId) === TRASH_ID) {
      setPendingDelete(activeId);
      return;
    }

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

  const handleConfirmDelete = () => {
    if (pendingDelete) {
      onDelete(pendingDelete);
      setPendingDelete(null);
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Overlay that greys out non-board areas */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/5 backdrop-blur-[1px] z-10 pointer-events-none"
            />
          )}
        </AnimatePresence>

        <div className={`relative ${isDragging ? 'z-20' : ''}`}>
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

            {/* Add Group Column — hidden while dragging */}
            {!isDragging && (
              <motion.button
                onClick={onNewGroup}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-col items-center justify-center min-w-[200px] h-40 bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:text-primary-500 hover:border-primary-300 hover:bg-primary-50/20 transition-colors flex-shrink-0"
              >
                <Plus className="w-6 h-6 mb-1" />
                <span className="text-sm font-medium">Add Group</span>
              </motion.button>
            )}
          </div>

          {/* Trash zone — appears at bottom during drag */}
          <AnimatePresence>
            {isDragging && (
              <div className="mt-4">
                <TrashZone />
              </div>
            )}
          </AnimatePresence>
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

      <ConfirmModal
        open={!!pendingDelete}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
