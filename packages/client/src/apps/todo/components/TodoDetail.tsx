import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Flag, CalendarDays, ChevronDown, Plus, X } from 'lucide-react';
import TiptapEditor from './TiptapEditor';
import RecurrenceEditor from './RecurrenceEditor';
import ConfirmModal from '../../../components/ConfirmModal';
import { fetchTodo, updateTodo, createTodo, deleteTodo as deleteTodoApi } from '../api';
import type { TodoGroup, TodoPriority, RecurrenceRule } from '@networth/shared';

interface TodoDetailProps {
  todoId: string;
  groups: TodoGroup[];
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function TodoDetail({ todoId, groups, onUpdate, onDelete, onClose }: TodoDetailProps) {
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');

  const { data: todoDetail } = useQuery({
    queryKey: ['todo', todoId],
    queryFn: () => fetchTodo(todoId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateTodo(todoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo', todoId] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const createSubtaskMutation = useMutation({
    mutationFn: (title: string) => createTodo({ groupId: todoDetail!.groupId, title, parentId: todoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo', todoId] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: (id: string) => deleteTodoApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo', todoId] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateTodo(id, { status: status === 'completed' ? 'open' : 'completed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todo', todoId] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const handleFieldUpdate = useCallback(
    (field: string, value: unknown) => {
      updateMutation.mutate({ [field]: value });
      onUpdate(todoId, { [field]: value });
    },
    [todoId, updateMutation, onUpdate]
  );

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    createSubtaskMutation.mutate(newSubtask.trim());
    setNewSubtask('');
  };

  const handleDelete = () => {
    onDelete(todoId);
    setShowDeleteConfirm(false);
    onClose();
  };

  if (!todoDetail) return null;

  const priorityConfig: { value: TodoPriority; label: string; color: string; activeColor: string }[] = [
    { value: 'high', label: 'High', color: 'text-red-400', activeColor: 'text-red-500 bg-red-50 border-red-200 ring-1 ring-red-100' },
    { value: 'medium', label: 'Medium', color: 'text-amber-400', activeColor: 'text-amber-500 bg-amber-50 border-amber-200 ring-1 ring-amber-100' },
    { value: 'low', label: 'Low', color: 'text-green-400', activeColor: 'text-green-500 bg-green-50 border-green-200 ring-1 ring-green-100' },
  ];

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="overflow-hidden"
    >
      <div className="border-t border-gray-100 p-4 space-y-4">
        {/* Title edit */}
        <input
          type="text"
          defaultValue={todoDetail.title}
          onBlur={e => {
            if (e.target.value !== todoDetail.title) {
              handleFieldUpdate('title', e.target.value);
            }
          }}
          className="w-full text-sm font-medium text-gray-900 outline-none bg-transparent border-b border-transparent hover:border-gray-200 focus:border-primary-300 pb-1 transition-colors"
        />

        {/* Notes (Tiptap editor) */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Notes</label>
          <TiptapEditor
            content={todoDetail.description || ''}
            onChange={html => handleFieldUpdate('description', html)}
            placeholder="Add notes, checklists, or any context..."
          />
        </div>

        {/* Subtasks */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">Subtasks</label>
          <div className="space-y-1">
            {todoDetail.subtasks?.map(st => (
              <div key={st.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => toggleSubtaskMutation.mutate({ id: st.id, status: st.status })}
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    st.status === 'completed'
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-primary-400'
                  }`}
                >
                  {st.status === 'completed' && (
                    <svg className="w-2.5 h-2.5" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
                <span className={`flex-1 text-sm ${st.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {st.title}
                </span>
                <button
                  onClick={() => deleteSubtaskMutation.mutate(st.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2">
            <Plus className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              placeholder="Add subtask..."
              className="flex-1 text-sm text-gray-600 placeholder:text-gray-400 outline-none bg-transparent"
            />
          </form>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-gray-100">
          {/* Priority */}
          <div className="flex items-center gap-0.5">
            {priorityConfig.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => handleFieldUpdate('priority', p.value)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition-all ${
                  todoDetail.priority === p.value ? p.activeColor : `${p.color} border-transparent hover:bg-gray-100`
                }`}
              >
                <Flag className="w-3 h-3" />
                {p.label}
              </button>
            ))}
          </div>

          {/* Due date */}
          <div className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="date"
              value={todoDetail.dueDate || ''}
              onChange={e => handleFieldUpdate('dueDate', e.target.value || null)}
              className="text-xs text-gray-600 bg-transparent outline-none cursor-pointer"
            />
          </div>

          {/* Recurrence */}
          <RecurrenceEditor
            value={todoDetail.recurrence}
            onChange={rule => handleFieldUpdate('recurrence', rule)}
          />

          {/* Group selector */}
          <div className="relative">
            <select
              value={todoDetail.groupId}
              onChange={e => handleFieldUpdate('groupId', e.target.value)}
              className="appearance-none text-xs bg-white border border-gray-200 rounded-lg pl-2 pr-6 py-1.5 text-gray-700 cursor-pointer hover:border-gray-300 transition-colors"
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>

          <div className="flex-1" />

          {/* Delete */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete Todo"
        message="Are you sure you want to delete this todo? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </motion.div>
  );
}
