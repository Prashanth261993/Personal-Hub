import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CloudUpload, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { fetchBackupStatus, runBackup } from '../lib/api';

function formatSize(bytes: number | null): string {
  return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '';
}

export default function BackupStatusBar() {
  const queryClient = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ['backup-status'],
    queryFn: fetchBackupStatus,
    refetchInterval: (query) => (query.state.data?.running ? 3000 : 60_000),
  });

  const backup = useMutation({
    mutationFn: runBackup,
    meta: { successMessage: 'Backup complete' },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['backup-status'] }),
  });

  if (!status) return null;

  const busy = backup.isPending || status.running;
  const lastBackupMs = status.lastBackupAt ? Date.parse(status.lastBackupAt) : null;
  const stale = lastBackupMs === null || Date.now() - lastBackupMs > status.intervalHours * 2 * 3600 * 1000;
  const uploadFailed = Boolean(status.remoteRepo && status.lastUploadError);
  const healthy = status.passphraseConfigured && !stale && !uploadFailed && !status.lastError;

  let detail: string;
  if (!status.passphraseConfigured) {
    detail = 'Backups are off — set BACKUP_PASSPHRASE in .env and restart the server.';
  } else if (lastBackupMs === null) {
    detail = 'No backup yet.';
  } else {
    const remote = status.remoteRepo
      ? uploadFailed
        ? ' · GitHub upload failed'
        : status.lastUploadAt
          ? ' · synced to GitHub'
          : ' · not yet uploaded'
      : ' · local only';
    detail = `Last backup ${formatDistanceToNow(lastBackupMs, { addSuffix: true })} (${formatSize(status.lastBackupSizeBytes)})${remote}`;
  }
  const error = status.lastError || (uploadFailed ? status.lastUploadError : null);

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3 ${
        healthy ? 'bg-white border-gray-200' : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {healthy ? (
          <ShieldCheck className="w-5 h-5 text-success-600 shrink-0 mt-0.5" />
        ) : status.passphraseConfigured ? (
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">Data backup</p>
          <p className="text-xs text-gray-500">{detail}</p>
          {error && <p className="text-xs text-amber-700 mt-0.5 truncate" title={error}>{error}</p>}
        </div>
      </div>
      {status.passphraseConfigured && (
        <button
          type="button"
          onClick={() => backup.mutate()}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
          {busy ? 'Backing up…' : 'Back up now'}
        </button>
      )}
    </div>
  );
}
