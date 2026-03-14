import { motion } from 'framer-motion';
import type { TodoPriority } from '@networth/shared';

const config: Record<TodoPriority, { label: string; bg: string; text: string; dot: string }> = {
  high: { label: 'High', bg: 'bg-priority-high-bg', text: 'text-priority-high', dot: 'bg-priority-high' },
  medium: { label: 'Medium', bg: 'bg-priority-medium-bg', text: 'text-priority-medium', dot: 'bg-priority-medium' },
  low: { label: 'Low', bg: 'bg-priority-low-bg', text: 'text-priority-low', dot: 'bg-priority-low' },
};

export default function PriorityBadge({ priority, size = 'sm' }: { priority: TodoPriority; size?: 'sm' | 'xs' }) {
  const c = config[priority];
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1 ${c.bg} ${c.text} rounded-full font-medium ${
        size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </motion.span>
  );
}
