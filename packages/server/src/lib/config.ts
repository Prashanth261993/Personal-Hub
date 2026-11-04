import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FamilyMembersConfig, CategoriesConfig, GoalsConfig, StockPresetsConfig, FundSeedConfig, FundScreenerPresetsConfig } from '@networth/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configDir = path.resolve(__dirname, '..', '..', '..', '..', 'config', 'networth');
const stocksConfigDir = path.resolve(__dirname, '..', '..', '..', '..', 'config', 'stocks');
const fundsConfigDir = path.resolve(__dirname, '..', '..', '..', '..', 'config', 'funds');

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

/**
 * Personal Net Worth configs are gitignored; on a fresh checkout seed them from the
 * committed *.example.json templates (or restore real ones with `npm run restore`).
 */
function localNetworthFile(filename: string): string {
  const filePath = networthFile(filename);
  if (!fs.existsSync(filePath)) {
    const example = networthFile(filename.replace(/\.json$/, '.example.json'));
    if (fs.existsSync(example)) fs.copyFileSync(example, filePath);
  }
  return filePath;
}

function stocksFile(filename: string): string {
  return path.join(stocksConfigDir, filename);
}

function fundsFile(filename: string): string {
  return path.join(fundsConfigDir, filename);
}

export function getMembers(): FamilyMembersConfig {
  return readJson<FamilyMembersConfig>(localNetworthFile('family-members.json'));
}

export function saveMembers(config: FamilyMembersConfig): void {
  writeJson(networthFile('family-members.json'), config);
}

export function getCategories(): CategoriesConfig {
  return readJson<CategoriesConfig>(localNetworthFile('categories.json'));
}

export function saveCategories(config: CategoriesConfig): void {
  writeJson(networthFile('categories.json'), config);
}

export function getGoals(): GoalsConfig {
  return readJson<GoalsConfig>(localNetworthFile('goals.json'));
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

export function getFundSeed(): FundSeedConfig {
  return readJson<FundSeedConfig>(fundsFile('seed.json'));
}

export function getFundScreenerPresets(): FundScreenerPresetsConfig {
  return readJson<FundScreenerPresetsConfig>(fundsFile('screener-presets.json'));
}

export function saveFundScreenerPresets(config: FundScreenerPresetsConfig): void {
  writeJson(fundsFile('screener-presets.json'), config);
}
