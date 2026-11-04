import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import {
  backupSettings,
  createBackup,
  downloadRemoteBackup,
  getBackupStatus,
  listLocalBackups,
  listRemoteBackups,
  openArchive,
  repoRoot,
  restoreBackup,
} from '../lib/backup.js';

dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });
dotenv.config({ path: path.join(repoRoot, 'packages', 'server', '.env'), quiet: true });

const USAGE = `Personal Hub backup tool

  npm run backup                       Create an encrypted backup (+ upload to GitHub if configured)
  npm run backup -- --no-upload        Local backup only
  npm run backup:list                  List local and remote backups
  npm run backup:status                Show backup configuration and last run
  npm run backup:verify -- <file>      Decrypt and verify an archive without restoring
  npm run restore -- --remote [tag]    Restore the latest (or a specific) GitHub backup
  npm run restore -- --latest-local    Restore the newest local backup
  npm run restore -- <file>            Restore a specific .phbk file

Restore options: --yes (skip confirmation), --skip-env (keep current .env files), --repo owner/name
The passphrase comes from BACKUP_PASSPHRASE in .env, or you are prompted for it.`;

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const log = (message: string) => console.log(`  ${message}`);

function resolveUserPath(p: string): string {
  return path.resolve(process.env.INIT_CWD || process.cwd(), p);
}

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  const next = i >= 0 ? args[i + 1] : undefined;
  return next && !next.startsWith('--') ? next : undefined;
}

function ask(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    const rlAny = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    rlAny._writeToOutput = (s: string) => {
      if (s.startsWith(question)) rlAny.output.write(question);
      else if (s.includes('\n') || s.includes('\r')) rlAny.output.write('\n');
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

async function ensurePassphrase(): Promise<void> {
  if (process.env.BACKUP_PASSPHRASE) return;
  const entered = await ask('Backup passphrase: ', true);
  if (!entered) throw new Error('A passphrase is required');
  process.env.BACKUP_PASSPHRASE = entered;
}

function printTables(tables: Record<string, number>): void {
  const entries = Object.entries(tables);
  if (entries.length === 0) {
    console.log('  (no database in backup)');
    return;
  }
  for (const [table, count] of entries) console.log(`    ${table.padEnd(26)} ${count}`);
}

async function cmdBackup(args: string[]) {
  console.log('Creating backup…');
  const result = await createBackup({ reason: 'cli', upload: !args.includes('--no-upload'), log });
  console.log(`\n✔ Backup saved: ${result.file} (${mb(result.sizeBytes)}, ${result.fileCount} files)`);
  printTables(result.tables);
  if (result.releaseUrl) console.log(`✔ Uploaded: ${result.releaseUrl}`);
  else if (result.uploadError) {
    console.error(`✖ Upload failed: ${result.uploadError}`);
    process.exitCode = 2;
  } else if (!backupSettings().remoteRepo) console.log('ℹ BACKUP_GITHUB_REPO not set — local backup only.');
}

async function cmdRestore(args: string[]) {
  const repo = flagValue(args, '--repo');
  if (repo) process.env.BACKUP_GITHUB_REPO = repo;
  await ensurePassphrase();

  let file: string;
  if (args.includes('--remote')) {
    const tag = flagValue(args, '--remote');
    console.log(`Downloading ${tag ?? 'latest backup'} from ${backupSettings().remoteRepo}…`);
    file = await downloadRemoteBackup(tag);
  } else if (args.includes('--latest-local')) {
    const latest = listLocalBackups().find((b) => !b.file.includes('pre-restore'));
    if (!latest) throw new Error(`No local backups in ${backupSettings().backupDir}`);
    file = latest.file;
  } else {
    const positional = args.find((a) => !a.startsWith('--') && a !== repo);
    if (!positional) throw new Error('Specify a backup file, --latest-local, or --remote [tag]');
    file = resolveUserPath(positional);
  }

  const preview = await openArchive(file, process.env.BACKUP_PASSPHRASE!);
  preview.cleanup();
  const m = preview.manifest;
  console.log(`\nBackup: ${file}`);
  console.log(`  Created ${m.createdAt} on ${m.hostname} (${m.reason}), ${m.files.length} files`);
  printTables(m.tables);
  const envNote = args.includes('--skip-env') ? '' : ' and .env';
  console.log(`\nThis REPLACES data/networth.db and research/, and overwrites config/${envNote}.`);
  console.log('Your current data is saved to a pre-restore backup first.');
  if (!args.includes('--yes')) {
    const answer = await ask('Type "restore" to continue: ');
    if (answer !== 'restore') {
      console.log('Aborted.');
      return;
    }
  }

  const result = await restoreBackup({ file, skipEnv: args.includes('--skip-env'), log });
  if (result.safetyBackup) console.log(`\n✔ Previous data saved to ${result.safetyBackup}`);
  console.log(`✔ Restored: ${result.restoredPaths.join(', ')}`);
  console.log('Start the app with `npm run dev`.');
}

async function cmdList() {
  const s = backupSettings();
  console.log(`Local (${s.backupDir}):`);
  const local = listLocalBackups();
  if (local.length === 0) console.log('  (none)');
  for (const b of local) console.log(`  ${path.basename(b.file).padEnd(48)} ${mb(b.sizeBytes)}`);
  if (s.remoteRepo) {
    console.log(`\nRemote (github.com/${s.remoteRepo} releases):`);
    try {
      const remote = await listRemoteBackups();
      if (remote.length === 0) console.log('  (none)');
      for (const r of remote) console.log(`  ${r.tag.padEnd(48)} ${r.createdAt}`);
    } catch (err) {
      console.error(`  ✖ ${(err as Error).message}`);
    }
  }
}

async function cmdVerify(args: string[]) {
  const target = args.find((a) => !a.startsWith('--'));
  if (!target) throw new Error('Usage: npm run backup:verify -- <file>');
  await ensurePassphrase();
  const archive = await openArchive(resolveUserPath(target), process.env.BACKUP_PASSPHRASE!);
  archive.cleanup();
  console.log(`✔ ${target} is valid — ${archive.manifest.files.length} files, created ${archive.manifest.createdAt}`);
  printTables(archive.manifest.tables);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'backup':
      return cmdBackup(args);
    case 'restore':
      return cmdRestore(args);
    case 'list':
      return cmdList();
    case 'verify':
      return cmdVerify(args);
    case 'status':
      console.log(JSON.stringify(getBackupStatus(), null, 2));
      return;
    default:
      console.log(USAGE);
  }
}

main().catch((err) => {
  console.error(`\n✖ ${(err as Error).message}`);
  process.exit(1);
});
