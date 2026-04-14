import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FamilyMembersConfig, CategoriesConfig, GoalsConfig, StockPresetsConfig } from '@networth/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configDir = path.resolve(__dirname, '..', '..', '..', '..', 'config', 'networth');
const stocksConfigDir = path.resolve(__dirname, '..', '..', '..', '..', 'config', 'stocks');

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function writeJson<T>(filePath: string, data: T): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function networthFile(filename: string): string {
  return path.join(configDir, filename);
}

function stocksFile(filename: string): string {
  return path.join(stocksConfigDir, filename);
}

export function getMembers(): FamilyMembersConfig {
  return readJson<FamilyMembersConfig>(networthFile('family-members.json'));
}

export function saveMembers(config: FamilyMembersConfig): void {
  writeJson(networthFile('family-members.json'), config);
}

export function getCategories(): CategoriesConfig {
  return readJson<CategoriesConfig>(networthFile('categories.json'));
}

export function saveCategories(config: CategoriesConfig): void {
  writeJson(networthFile('categories.json'), config);
}

export function getGoals(): GoalsConfig {
  return readJson<GoalsConfig>(networthFile('goals.json'));
}

export function saveGoals(config: GoalsConfig): void {
  writeJson(networthFile('goals.json'), config);
}

export function getStockPresets(): StockPresetsConfig {
  return readJson<StockPresetsConfig>(stocksFile('presets.json'));
}

export function saveStockPresets(config: StockPresetsConfig): void {
  writeJson(stocksFile('presets.json'), config);
}
