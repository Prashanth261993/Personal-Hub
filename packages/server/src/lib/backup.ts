import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import * as tar from 'tar';
import type { BackupReason, BackupResult, BackupStatus } from '@networth/shared';

/**
 * Encrypted backup / restore for all local-only data:
 *   data/networth.db (consistent online copy incl. WAL), research/, config/, .env files.
 *
 * Archive format (.phbk): "PHBK" | version(1) | salt(16) | iv(12) | gcmTag(16) | AES-256-GCM(tar.gz)
 * Key = scrypt(BACKUP_PASSPHRASE, salt). Without the passphrase a backup cannot be restored.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const DB_REL = 'data/networth.db';
const dbPath = path.join(repoRoot, DB_REL);
const FILE_SOURCES = ['research', 'config', '.env', 'packages/server/.env'];

const MAGIC = Buffer.from('PHBK');
const FORMAT_VERSION = 1;
const HEADER_LEN = MAGIC.length + 1 + 16 + 12 + 16;
const ARCHIVE_EXT = '.phbk';
const REGULAR_ARCHIVE = /^personalhub-\d{8}-\d{6}\.phbk$/;
const RELEASE_PREFIX = 'backup-';
const LOCK_STALE_MS = 15 * 60 * 1000;

const execFileAsync = promisify(execFile);

export interface BackupManifest {
  formatVersion: number;
  app: 'personal-hub';
  createdAt: string;
  reason: BackupReason;
  hostname: string;
  gitCommit: string | null;
  tables: Record<string, number>;
  files: { path: string; size: number; sha256: string }[];
}

interface BackupState {
  lastBackupAt?: string;
  lastBackupFile?: string;
  lastBackupSizeBytes?: number;
  lastUploadAt?: string;
  lastUploadUrl?: string;
  lastUploadError?: string | null;
  lastError?: string | null;
}

type Logger = (message: string) => void;

// ── Settings (read lazily: dotenv runs after module imports are evaluated) ──

function intEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function backupSettings() {
  return {
    passphrase: process.env.BACKUP_PASSPHRASE ?? '',
    backupDir: path.resolve(process.env.BACKUP_DIR || path.join(os.homedir(), 'PersonalHub-backups')),
    remoteRepo: process.env.BACKUP_GITHUB_REPO?.trim() ?? '',
    githubUser: process.env.BACKUP_GITHUB_USER?.trim() ?? '',
    githubToken: process.env.BACKUP_GITHUB_TOKEN?.trim() ?? '',
    keepLocal: intEnv('BACKUP_KEEP_LOCAL', 14),
    keepRemote: intEnv('BACKUP_KEEP_REMOTE', 30),
    autoEnabled: process.env.BACKUP_AUTO !== 'false',
    intervalHours: intEnv('BACKUP_INTERVAL_HOURS', 24),
  };
}

// ── Crypto ──

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

export function encryptBuffer(plain: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, Buffer.from([FORMAT_VERSION]), salt, iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptBuffer(data: Buffer, passphrase: string): Buffer {
  if (data.length < HEADER_LEN || !data.subarray(0, 4).equals(MAGIC)) {
    throw new Error('Not a Personal Hub backup file');
  }
  if (data[4] !== FORMAT_VERSION) throw new Error(`Unsupported backup format version ${data[4]}`);
  const salt = data.subarray(5, 21);
  const iv = data.subarray(21, 33);
  const tag = data.subarray(33, 49);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(data.subarray(HEADER_LEN)), decipher.final()]);
  } catch {
    throw new Error('Decryption failed — wrong passphrase or corrupted backup file');
  }
}

// ── Helpers ──

function sha256File(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function listFiles(root: string, rel = ''): string[] {
  const dir = path.join(root, rel);
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(root, childRel));
    else if (entry.isFile()) out.push(childRel);
  }
  return out;
}

function stampFor(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function gitCommit(): string | null {
  try {
    const head = fs.readFileSync(path.join(repoRoot, '.git', 'HEAD'), 'utf-8').trim();
    if (!head.startsWith('ref: ')) return head;
    const refFile = path.join(repoRoot, '.git', head.slice(5));
    return fs.existsSync(refFile) ? fs.readFileSync(refFile, 'utf-8').trim() : null;
  } catch {
    return null;
  }
}

/** Integrity-checks a standalone DB copy, converts it to a single self-contained file, and returns row counts. */
function inspectDbCopy(file: string): Record<string, number> {
  const db = new Database(file, { fileMustExist: true });
  try {
    db.pragma('journal_mode = DELETE');
    const integrity = db.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error(`Database integrity check failed: ${String(integrity)}`);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[];
    const counts: Record<string, number> = {};
    for (const { name } of tables) {
      const row = db.prepare(`SELECT COUNT(*) AS c FROM "${name.replace(/"/g, '""')}"`).get() as { c: number };
      counts[name] = row.c;
    }
    return counts;
  } finally {
    db.close();
  }
}

function readState(backupDir: string): BackupState {
  try {
    return JSON.parse(fs.readFileSync(path.join(backupDir, 'backup-state.json'), 'utf-8')) as BackupState;
  } catch {
    return {};
  }
}

function writeState(backupDir: string, patch: BackupState): void {
  fs.mkdirSync(backupDir, { recursive: true });
  const next = { ...readState(backupDir), ...patch };
  fs.writeFileSync(path.join(backupDir, 'backup-state.json'), JSON.stringify(next, null, 2) + '\n');
}

function acquireLock(backupDir: string): () => void {
  const lockFile = path.join(backupDir, '.backup.lock');
  if (fs.existsSync(lockFile)) {
    let stale = Date.now() - fs.statSync(lockFile).mtimeMs > LOCK_STALE_MS;
    if (!stale) {
      const pid = Number.parseInt(fs.readFileSync(lockFile, 'utf-8'), 10);
      try {
        process.kill(pid, 0);
      } catch {
        stale = true;
      }
    }
    if (!stale) throw new Error('Another backup is already in progress');
    fs.rmSync(lockFile, { force: true });
  }
  fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
  return () => fs.rmSync(lockFile, { force: true });
}

export function listLocalBackups(backupDir = backupSettings().backupDir): { file: string; sizeBytes: number; modifiedAt: string }[] {
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith(ARCHIVE_EXT))
    .sort()
    .reverse()
    .map((name) => {
      const stat = fs.statSync(path.join(backupDir, name));
      return { file: path.join(backupDir, name), sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString() };
    });
}

function pruneLocal(backupDir: string, keep: number): void {
  const regular = fs.readdirSync(backupDir).filter((name) => REGULAR_ARCHIVE.test(name)).sort().reverse();
  for (const name of regular.slice(keep)) fs.rmSync(path.join(backupDir, name), { force: true });
}

// ── GitHub (Releases on a private repo) ──

async function ghEnv(): Promise<NodeJS.ProcessEnv> {
  const s = backupSettings();
  if (s.githubToken) return { ...process.env, GH_TOKEN: s.githubToken };
  if (s.githubUser) {
    const { stdout } = await execFileAsync('gh', ['auth', 'token', '--user', s.githubUser]);
    return { ...process.env, GH_TOKEN: stdout.trim() };
  }
  return process.env;
}

async function gh(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('gh', args, { env: await ghEnv(), maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    const e = err as { stderr?: string; message: string };
    throw new Error(`gh ${args[0]} ${args[1] ?? ''} failed: ${(e.stderr || e.message).trim()}`);
  }
}

export async function listRemoteBackups(repo = backupSettings().remoteRepo): Promise<{ tag: string; createdAt: string }[]> {
  if (!repo) throw new Error('BACKUP_GITHUB_REPO is not set');
  const raw = await gh(['release', 'list', '--repo', repo, '--limit', '1000', '--json', 'tagName,publishedAt']);
  return (JSON.parse(raw) as { tagName: string; publishedAt: string }[])
    .filter((r) => r.tagName.startsWith(RELEASE_PREFIX))
    .map((r) => ({ tag: r.tagName, createdAt: r.publishedAt }))
    .sort((a, b) => b.tag.localeCompare(a.tag));
}

async function uploadBackup(file: string, manifest: BackupManifest, stamp: string): Promise<string> {
  const s = backupSettings();
  const tag = `${RELEASE_PREFIX}${stamp}`;
  const rows = Object.entries(manifest.tables).map(([t, c]) => `- ${t}: ${c}`).join('\n');
  const notes = [
    `Encrypted Personal Hub backup (${manifest.reason}).`,
    '',
    `- Created: ${manifest.createdAt}`,
    `- Host: ${manifest.hostname}`,
    `- App commit: ${manifest.gitCommit ?? 'unknown'}`,
    `- Files: ${manifest.files.length}`,
    '',
    'Row counts:',
    rows || '- (no database)',
    '',
    'Restore with `npm run restore -- --remote ' + tag + '`',
  ].join('\n');
  await gh(['release', 'create', tag, file, '--repo', s.remoteRepo, '--title', `Backup ${manifest.createdAt}`, '--notes', notes]);

  const releases = await listRemoteBackups(s.remoteRepo);
  for (const old of releases.slice(s.keepRemote)) {
    await gh(['release', 'delete', old.tag, '--repo', s.remoteRepo, '--yes', '--cleanup-tag']);
  }
  return `https://github.com/${s.remoteRepo}/releases/tag/${tag}`;
}

export async function downloadRemoteBackup(tag?: string, repo = backupSettings().remoteRepo): Promise<string> {
  const releases = await listRemoteBackups(repo);
  const target = tag ?? releases[0]?.tag;
  if (!target) throw new Error(`No backups found in ${repo}`);
  if (!releases.some((r) => r.tag === target)) throw new Error(`Backup ${target} not found in ${repo}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phbk-download-'));
  await gh(['release', 'download', target, '--repo', repo, '--pattern', `*${ARCHIVE_EXT}`, '--dir', dir]);
  const name = fs.readdirSync(dir).find((n) => n.endsWith(ARCHIVE_EXT));
  if (!name) throw new Error(`Release ${target} has no ${ARCHIVE_EXT} asset`);
  return path.join(dir, name);
}

// ── Open / verify an archive ──

export interface OpenedArchive {
  manifest: BackupManifest;
  payloadDir: string;
  cleanup: () => void;
}

/** Decrypts + extracts an archive to a temp dir and verifies every file hash and the DB integrity. */
export async function openArchive(file: string, passphrase: string): Promise<OpenedArchive> {
  const plain = decryptBuffer(fs.readFileSync(file), passphrase);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phbk-open-'));
  const cleanup = () => fs.rmSync(workDir, { recursive: true, force: true });
  try {
    const tgz = path.join(workDir, 'payload.tgz');
    fs.writeFileSync(tgz, plain);
    const payloadDir = path.join(workDir, 'payload');
    fs.mkdirSync(payloadDir);
    await tar.x({ file: tgz, cwd: payloadDir, strict: true });

    const manifest = JSON.parse(fs.readFileSync(path.join(payloadDir, 'manifest.json'), 'utf-8')) as BackupManifest;
    if (manifest.app !== 'personal-hub') throw new Error('Archive manifest is not a Personal Hub backup');
    for (const entry of manifest.files) {
      const target = path.join(payloadDir, entry.path);
      if (!fs.existsSync(target)) throw new Error(`Backup is missing ${entry.path}`);
      if (fs.statSync(target).size !== entry.size || sha256File(target) !== entry.sha256) {
        throw new Error(`Checksum mismatch for ${entry.path}`);
      }
    }
    const dbCopy = path.join(payloadDir, DB_REL);
    if (fs.existsSync(dbCopy)) {
      const scratch = path.join(workDir, 'verify.db');
      fs.copyFileSync(dbCopy, scratch);
      const counts = inspectDbCopy(scratch);
      for (const [table, count] of Object.entries(manifest.tables)) {
        if (counts[table] !== count) throw new Error(`Row count mismatch for ${table}: ${counts[table]} vs ${count}`);
      }
    }
    return { manifest, payloadDir, cleanup };
  } catch (err) {
    cleanup();
    throw err;
  }
}

// ── Create ──

let inFlight: Promise<BackupResult> | null = null;

export function isBackupRunning(): boolean {
  return inFlight !== null;
}

export function createBackup(opts: { reason: BackupReason; upload?: boolean; log?: Logger }): Promise<BackupResult> {
  if (!inFlight) {
    inFlight = runBackup(opts).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runBackup({ reason, upload = true, log = () => {} }: { reason: BackupReason; upload?: boolean; log?: Logger }): Promise<BackupResult> {
  const s = backupSettings();
  if (!s.passphrase) throw new Error('BACKUP_PASSPHRASE is not set in .env');
  fs.mkdirSync(s.backupDir, { recursive: true });
  const releaseLock = acquireLock(s.backupDir);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phbk-create-'));
  try {
    const createdAt = new Date();
    const stamp = stampFor(createdAt);
    const payloadDir = path.join(workDir, 'payload');
    fs.mkdirSync(payloadDir);

    let tables: Record<string, number> = {};
    if (fs.existsSync(dbPath)) {
      log('Copying database (SQLite online backup)…');
      const dest = path.join(payloadDir, DB_REL);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const source = new Database(dbPath, { fileMustExist: true });
      try {
        await source.backup(dest);
      } finally {
        source.close();
      }
      tables = inspectDbCopy(dest);
    }

    log('Copying research, config and .env files…');
    for (const rel of FILE_SOURCES) {
      const src = path.join(repoRoot, rel);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(payloadDir, rel), { recursive: true });
    }

    const files = listFiles(payloadDir).map((rel) => {
      const abs = path.join(payloadDir, rel);
      return { path: rel, size: fs.statSync(abs).size, sha256: sha256File(abs) };
    });
    const manifest: BackupManifest = {
      formatVersion: FORMAT_VERSION,
      app: 'personal-hub',
      createdAt: createdAt.toISOString(),
      reason,
      hostname: os.hostname(),
      gitCommit: gitCommit(),
      tables,
      files,
    };
    fs.writeFileSync(path.join(payloadDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    log('Compressing and encrypting…');
    const tgz = path.join(workDir, 'payload.tgz');
    await tar.c({ gzip: { level: 9 }, file: tgz, cwd: payloadDir, portable: true }, fs.readdirSync(payloadDir));
    const suffix = reason === 'pre-restore' ? '-pre-restore' : '';
    const outFile = path.join(s.backupDir, `personalhub-${stamp}${suffix}${ARCHIVE_EXT}`);
    fs.writeFileSync(`${outFile}.tmp`, encryptBuffer(fs.readFileSync(tgz), s.passphrase));
    fs.renameSync(`${outFile}.tmp`, outFile);

    log('Verifying archive (decrypt + checksums + DB integrity)…');
    try {
      (await openArchive(outFile, s.passphrase)).cleanup();
    } catch (err) {
      fs.rmSync(outFile, { force: true });
      throw new Error(`Backup verification failed: ${(err as Error).message}`);
    }

    const sizeBytes = fs.statSync(outFile).size;
    if (reason !== 'pre-restore') {
      writeState(s.backupDir, {
        lastBackupAt: manifest.createdAt,
        lastBackupFile: outFile,
        lastBackupSizeBytes: sizeBytes,
        lastError: null,
      });
      pruneLocal(s.backupDir, s.keepLocal);
    }

    let releaseUrl: string | null = null;
    let uploadError: string | null = null;
    if (upload && s.remoteRepo) {
      log(`Uploading to GitHub (${s.remoteRepo})…`);
      try {
        releaseUrl = await uploadBackup(outFile, manifest, stamp);
        writeState(s.backupDir, { lastUploadAt: new Date().toISOString(), lastUploadUrl: releaseUrl, lastUploadError: null });
      } catch (err) {
        uploadError = (err as Error).message;
        writeState(s.backupDir, { lastUploadError: uploadError });
      }
    }

    return {
      file: outFile,
      sizeBytes,
      createdAt: manifest.createdAt,
      reason,
      fileCount: files.length,
      tables,
      uploaded: releaseUrl !== null,
      releaseUrl,
      uploadError,
    };
  } catch (err) {
    writeState(s.backupDir, { lastError: (err as Error).message });
    throw err;
  } finally {
    releaseLock();
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

// ── Restore ──

export function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

export interface RestoreResult {
  manifest: BackupManifest;
  safetyBackup: string | null;
  restoredPaths: string[];
}

export async function restoreBackup(opts: { file: string; skipEnv?: boolean; log?: Logger }): Promise<RestoreResult> {
  const { file, skipEnv = false, log = () => {} } = opts;
  const s = backupSettings();
  if (!s.passphrase) throw new Error('BACKUP_PASSPHRASE is required to restore');
  const port = Number(process.env.PORT || 3001);
  if (await isPortInUse(port)) {
    throw new Error(`Something is running on port ${port} — stop the dev server before restoring.`);
  }

  log('Decrypting and verifying archive…');
  const archive = await openArchive(file, s.passphrase);
  try {
    let safetyBackup: string | null = null;
    const hasLocalData = fs.existsSync(dbPath) || fs.existsSync(path.join(repoRoot, 'research'));
    if (hasLocalData) {
      log('Creating pre-restore safety backup of current data…');
      safetyBackup = (await createBackup({ reason: 'pre-restore', upload: false })).file;
    }

    const restored: string[] = [];
    const srcDb = path.join(archive.payloadDir, DB_REL);
    if (fs.existsSync(srcDb)) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(`${dbPath}${suffix}`, { force: true });
      fs.copyFileSync(srcDb, dbPath);
      restored.push(DB_REL);
    }

    for (const rel of FILE_SOURCES) {
      const src = path.join(archive.payloadDir, rel);
      if (!fs.existsSync(src)) continue;
      if (skipEnv && rel.endsWith('.env')) continue;
      const dest = path.join(repoRoot, rel);
      // research/ is replaced wholesale so the result matches the backup exactly; config/ is merged.
      if (rel === 'research') fs.rmSync(dest, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
      restored.push(rel);
    }

    if (fs.existsSync(dbPath)) {
      const verify = path.join(os.tmpdir(), `phbk-postrestore-${process.pid}.db`);
      fs.copyFileSync(dbPath, verify);
      try {
        const counts = inspectDbCopy(verify);
        for (const [table, count] of Object.entries(archive.manifest.tables)) {
          if (counts[table] !== count) throw new Error(`Post-restore row count mismatch for ${table}`);
        }
      } finally {
        fs.rmSync(verify, { force: true });
      }
    }

    return { manifest: archive.manifest, safetyBackup, restoredPaths: restored };
  } finally {
    archive.cleanup();
  }
}

// ── Status + scheduler ──

export function getBackupStatus(): BackupStatus {
  const s = backupSettings();
  const state = readState(s.backupDir);
  return {
    passphraseConfigured: Boolean(s.passphrase),
    remoteRepo: s.remoteRepo || null,
    backupDir: s.backupDir,
    autoEnabled: s.autoEnabled,
    intervalHours: s.intervalHours,
    running: isBackupRunning(),
    lastBackupAt: state.lastBackupAt ?? null,
    lastBackupFile: state.lastBackupFile ?? null,
    lastBackupSizeBytes: state.lastBackupSizeBytes ?? null,
    lastUploadAt: state.lastUploadAt ?? null,
    lastUploadUrl: state.lastUploadUrl ?? null,
    lastUploadError: state.lastUploadError ?? null,
    lastError: state.lastError ?? null,
    localBackupCount: listLocalBackups(s.backupDir).length,
  };
}

/** Backs up shortly after startup (and re-checks hourly) whenever the last backup is older than the interval. */
export function startAutoBackup(): void {
  const s = backupSettings();
  if (!s.autoEnabled) return;
  if (!s.passphrase) {
    console.warn('[backup] BACKUP_PASSPHRASE not set — automatic backups are disabled.');
    return;
  }
  const check = () => {
    const last = readState(s.backupDir).lastBackupAt;
    const age = last ? Date.now() - Date.parse(last) : Infinity;
    if (age < s.intervalHours * 3600 * 1000 || isBackupRunning()) return;
    createBackup({ reason: 'auto' })
      .then((r) => {
        const remote = r.uploaded ? `, uploaded to ${r.releaseUrl}` : r.uploadError ? ` (upload failed: ${r.uploadError})` : '';
        console.log(`[backup] Auto backup saved ${path.basename(r.file)}${remote}`);
      })
      .catch((err) => console.error('[backup] Auto backup failed:', (err as Error).message));
  };
  setTimeout(check, 15_000).unref();
  setInterval(check, 60 * 60 * 1000).unref();
}
