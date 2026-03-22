import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import IconSuggest, { suggestIcons, getIcon } from './IconSuggest';
import ConfirmModal from '../../../components/ConfirmModal';
import type { TodoGroup, CreateGroupRequest, UpdateGroupRequest } from '@networth/shared';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#f97316', '#84cc16',
  '#14b8a6', '#a855f7', '#e11d48', '#0ea5e9', '#d946ef',
];

interface GroupManagerProps {
  group?: TodoGroup;   // undefined = create mode, defined = edit mode
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateGroupRequest | UpdateGroupRequest) => void;
  onDelete?: (id: string) => void;
}

export default function GroupManager({ group, open, onClose, onSave, onDelete }: GroupManagerProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('list-todo');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setColor(group.color);
      setIcon(group.icon);
    } else {
      setName('');
      setColor('#6366f1');
      setIcon('list-todo');
    }
  }, [group, open]);

  // Auto-suggest icon when name changes (create mode only)
  useEffect(() => {
    if (!group && name.length > 2) {
      const suggestions = suggestIcons(name);
      if (suggestions.length > 0 && icon === 'list-todo') {
        setIcon(suggestions[0]);
      }
    }
  }, [name, group, icon]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), color, icon });
    onClose();
  };

  const SelectedIcon = getIcon(icon);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                {group ? 'Edit Group' : 'New Group'}
              </h3>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Preview */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: color + '20', color }}
                >
                  {SelectedIcon && <SelectedIcon className="w-5 h-5" />}
                </div>
                <span className="font-medium text-gray-900">{name || 'Group Name'}</span>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Work, Personal, Fitness..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-all"
                  autoFocus
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${
                        color === c ? 'ring-2 ring-offset-2' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c, ...(color === c ? { '--tw-ring-color': c } as React.CSSProperties : {}) }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Icon</label>
                <IconSuggest name={name} value={icon} onChange={setIcon} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                {group && onDelete && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete group"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40"
                >
                  {group ? 'Save Changes' : 'Create Group'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        title="Delete Group"
        message={`Are you sure you want to delete "${group?.name}"? All todos in this group will also be deleted. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (group && onDelete) {
            onDelete(group.id);
            setShowDeleteConfirm(false);
            onClose();
          }
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </AnimatePresence>
  );
}
