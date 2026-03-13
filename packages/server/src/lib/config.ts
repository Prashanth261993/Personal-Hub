import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FamilyMembersConfig, CategoriesConfig, GoalsConfig } from '@networth/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configDir = path.resolve(__dirname, '..', '..', '..', '..', 'config', 'networth');

function readJson<T>(filename: string): T {
  const filePath = path.join(configDir, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function writeJson<T>(filename: string, data: T): void {
  const filePath = path.join(configDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function getMembers(): FamilyMembersConfig {
  return readJson<FamilyMembersConfig>('family-members.json');
}

export function saveMembers(config: FamilyMembersConfig): void {
  writeJson('family-members.json', config);
}

export function getCategories(): CategoriesConfig {
  return readJson<CategoriesConfig>('categories.json');
}

export function saveCategories(config: CategoriesConfig): void {
  writeJson('categories.json', config);
}

export function getGoals(): GoalsConfig {
  return readJson<GoalsConfig>('goals.json');
}

export function saveGoals(config: GoalsConfig): void {
  writeJson('goals.json', config);
}
