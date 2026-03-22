import { isToday, isPast, isTomorrow, differenceInDays, parseISO } from 'date-fns';
import { motion } from 'framer-motion';

type DueStatus = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'none';

function getDueStatus(dueDate: string | null): DueStatus {
  if (!dueDate) return 'none';
  const date = parseISO(dueDate);
  if (isToday(date)) return 'today';
  if (isPast(date)) return 'overdue';
  if (isTomorrow(date)) return 'tomorrow';
  const days = differenceInDays(date, new Date());
  if (days <= 7) return 'upcoming';
  return 'none';
}

const config: Record<DueStatus, { label: string; classes: string; pulse?: boolean }> = {
  overdue: { label: 'Overdue', classes: 'bg-red-50 text-red-600 border-red-200', pulse: true },
  today: { label: 'Today', classes: 'bg-amber-50 text-amber-600 border-amber-200' },
  tomorrow: { label: 'Tomorrow', classes: 'bg-blue-50 text-blue-600 border-blue-200' },
  upcoming: { label: 'Upcoming', classes: 'bg-sky-50 text-sky-600 border-sky-200' },
  none: { label: '', classes: '' },
};

export default function StatusBadge({ dueDate }: { dueDate: string | null }) {
  const status = getDueStatus(dueDate);
  if (status === 'none') return null;

  const c = config[status];
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full border ${c.classes}`}
    >
      {c.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
      )}
      {c.label}
    </motion.span>
  );
}

export { getDueStatus, type DueStatus };
