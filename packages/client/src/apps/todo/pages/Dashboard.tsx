import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ListTodo } from 'lucide-react';
import QuickAdd from '../components/QuickAdd';
import KanbanBoard from '../components/KanbanBoard';
import TodayFocus from '../components/TodayFocus';
import OverdueUpcoming from '../components/OverdueUpcoming';
import CompletionStats from '../components/CompletionStats';
import GroupManager from '../components/GroupManager';
import {
  fetchGroups,
  fetchTodos,
  fetchStats,
  createTodo,
  createGroup,
  updateGroup,
  deleteGroup as deleteGroupApi,
  completeTodo,
  reopenTodo,
  updateTodo,
  deleteTodo,
  moveTodo,
} from '../api';
import type { TodoGroup, TodoPriority, CreateGroupRequest, UpdateGroupRequest, RecurrenceRule } from '@networth/shared';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TodoGroup | undefined>();

  const { data: groups = [] } = useQuery({ queryKey: ['todo-groups'], queryFn: fetchGroups });
  const { data: todos = [] } = useQuery({ queryKey: ['todos'], queryFn: () => fetchTodos() });
  const { data: stats } = useQuery({ queryKey: ['todo-stats'], queryFn: fetchStats });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
    queryClient.invalidateQueries({ queryKey: ['todo-groups'] });
    queryClient.invalidateQueries({ queryKey: ['todo-stats'] });
  };

  const createTodoMutation = useMutation({
    mutationFn: createTodo,
    meta: { successMessage: 'Task created' },
    onSuccess: invalidateAll,
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeTodo(id),
    meta: { successMessage: 'Task completed' },
    onSuccess: invalidateAll,
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => reopenTodo(id),
    meta: { successMessage: 'Task reopened' },
    onSuccess: invalidateAll,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateTodo(id, data),
    onSuccess: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTodo(id),
    meta: { successMessage: 'Task deleted' },
    onSuccess: invalidateAll,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, groupId, sortOrder }: { id: string; groupId: string; sortOrder: number }) =>
      moveTodo(id, { groupId, sortOrder }),
    onSuccess: invalidateAll,
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: CreateGroupRequest) => createGroup(data),
    meta: { successMessage: 'Group created' },
    onSuccess: invalidateAll,
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGroupRequest }) => updateGroup(id, data),
    meta: { successMessage: 'Group updated' },
    onSuccess: invalidateAll,
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => deleteGroupApi(id),
    meta: { successMessage: 'Group deleted' },
    onSuccess: invalidateAll,
  });

  const handleQuickAdd = (data: { title: string; groupId: string; priority: TodoPriority; dueDate?: string; recurrence?: RecurrenceRule }) => {
    createTodoMutation.mutate({
      groupId: data.groupId,
      title: data.title,
      priority: data.priority,
      dueDate: data.dueDate,
      recurrence: data.recurrence,
    });
  };

  const handleAddTodo = (groupId: string) => {
    // Quick-create a placeholder todo in the group
    createTodoMutation.mutate({ groupId, title: 'New task', priority: 'medium' });
  };

  const handleNewGroup = () => {
    setEditingGroup(undefined);
    setGroupModalOpen(true);
  };

  const handleEditGroup = (group: TodoGroup) => {
    setEditingGroup(group);
    setGroupModalOpen(true);
  };

  const handleSaveGroup = (data: CreateGroupRequest | UpdateGroupRequest) => {
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, data });
    } else {
      createGroupMutation.mutate(data as CreateGroupRequest);
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
          <ListTodo className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planning</h1>
          <p className="text-sm text-gray-500">Organize your tasks and stay on track</p>
        </div>
      </motion.div>

      {/* Quick Add */}
      <QuickAdd groups={groups} onAdd={handleQuickAdd} />

      {/* Widgets row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TodayFocus
          todos={todos}
          onComplete={id => completeMutation.mutate(id)}
        />
        <OverdueUpcoming
          todos={todos}
          onComplete={id => completeMutation.mutate(id)}
        />
        <CompletionStats stats={stats} />
      </div>

      {/* Kanban Board */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Board</h2>
        <KanbanBoard
          groups={groups}
          todos={todos}
          onAddTodo={handleAddTodo}
          onComplete={id => completeMutation.mutate(id)}
          onReopen={id => reopenMutation.mutate(id)}
          onUpdate={(id, data) => updateMutation.mutate({ id, data })}
          onDelete={id => deleteMutation.mutate(id)}
          onMoveTodo={(id, groupId, sortOrder) => moveMutation.mutate({ id, groupId, sortOrder })}
          onNewGroup={handleNewGroup}
          onEditGroup={handleEditGroup}
        />
      </div>

      {/* Group Manager Modal */}
      <GroupManager
        group={editingGroup}
        open={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        onSave={handleSaveGroup}
        onDelete={id => deleteGroupMutation.mutate(id)}
      />
    </div>
  );
}
