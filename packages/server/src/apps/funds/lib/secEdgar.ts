import { XMLParser } from 'fast-xml-parser';

/**
 * SEC EDGAR client for fetching and parsing 13F-HR filings.
 *
 * SEC fair-access rules (https://www.sec.gov/os/webmaster-faq#developers):
 *  - A descriptive User-Agent header is REQUIRED on every request.
 *  - Stay under ~10 requests/second. We serialize requests with a small delay.
 *
 * 13F value-units note: modern filings report the `value` column in WHOLE DOLLARS
 * (post the 2023 rule change; older filings used thousands). Phase 1 only fetches the
 * latest filing, so we treat value as dollars → cents = value * 100.
 */

// Identify ourselves per SEC policy. Personal/local tool.
const USER_AGENT = 'PersonalHub/1.0 (personal finance tracker; contact: personal-hub@example.com)';
const MIN_REQUEST_INTERVAL_MS = 200; // ≤5 req/s, comfortably under SEC's ~10 req/s cap

let lastRequestAt = 0;
let chain: Promise<unknown> = Promise.resolve();

/** Serialize all SEC requests and space them out to respect rate limits. */
function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const now = Date.now();
    const wait = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - now);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return fn();
  };
  const result = chain.then(run, run);
  chain = result.catch(() => undefined);
  return result;
}

async function secFetch(url: string): Promise<Response> {
  return rateLimited(async () => {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/xml, */*' },
    });
    if (!res.ok) {
      throw new Error(`SEC request failed (${res.status}) for ${url}`);
    }
    return res;
  });
}

/** Zero-pad a CIK to the 10-digit form used by the submissions API. */
export function padCik(cik: string): string {
  const digits = cik.replace(/\D/g, '');
  return digits.padStart(10, '0');
}

/** CIK without leading zeros, used in the Archives folder path. */
function cikForArchives(cik: string): string {
  return String(parseInt(padCik(cik), 10));
}

/** Convert an accession number (with dashes) to the dash-less folder form. */
function accessionNoDashes(accession: string): string {
  return accession.replace(/-/g, '');
}

/** Derive a 'YYYY-Q#' quarter label from a YYYY-MM-DD period-of-report date. */
export function quarterFromPeriod(periodOfReport: string): string {
  const [year, month] = periodOfReport.split('-').map((p) => parseInt(p, 10));
  const q = Math.floor((month - 1) / 3) + 1;
  return `${year}-Q${q}`;
}

export interface LatestFilingInfo {
  accessionNumber: string;
  periodOfReport: string; // YYYY-MM-DD
  filedAt: string;        // YYYY-MM-DD
  companyName: string;
}

interface SubmissionsResponse {
  name?: string;
  filings?: {
    recent?: {
      form?: string[];
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
    };
  };
}

/** Fetch the most recent 13F-HR (or 13F-HR/A) filing metadata for a CIK. */
export async function getLatest13F(cik: string): Promise<LatestFilingInfo | null> {
  const url = `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`;
  const res = await secFetch(url);
  const data = (await res.json()) as SubmissionsResponse;
  const recent = data.filings?.recent;
  if (!recent?.form) return null;

  const forms = recent.form;
  const accessions = recent.accessionNumber ?? [];
  const filingDates = recent.filingDate ?? [];
  const reportDates = recent.reportDate ?? [];

  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === '13F-HR' || forms[i] === '13F-HR/A') {
      return {
        accessionNumber: accessions[i],
        periodOfReport: reportDates[i] || filingDates[i],
        filedAt: filingDates[i],
        companyName: data.name ?? '',
      };
    }
  }
  return null;
}

/**
 * Fetch up to `limit` recent 13F-HR (and 13F-HR/A) filings for a CIK, most recent first.
 * Used by the Phase 2 backfill so we can compute quarter-over-quarter deltas.
 */
export async function getRecent13Fs(cik: string, limit = 8): Promise<LatestFilingInfo[]> {
  const url = `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`;
  const res = await secFetch(url);
  const data = (await res.json()) as SubmissionsResponse;
  const recent = data.filings?.recent;
  if (!recent?.form) return [];

  const forms = recent.form;
  const accessions = recent.accessionNumber ?? [];
  const filingDates = recent.filingDate ?? [];
  const reportDates = recent.reportDate ?? [];

  const out: LatestFilingInfo[] = [];
  for (let i = 0; i < forms.length && out.length < limit; i++) {
    if (forms[i] === '13F-HR' || forms[i] === '13F-HR/A') {
      out.push({
        accessionNumber: accessions[i],
        periodOfReport: reportDates[i] || filingDates[i],
        filedAt: filingDates[i],
        companyName: data.name ?? '',
      });
    }
  }
  return out;
}

export interface ParsedHolding {
  issuerName: string;
  cusip: string;
  valueCents: number;
  shares: number;
  putCall: string | null;
}

interface FilingIndex {
  directory?: { item?: Array<{ name: string; type?: string }> };
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false, // keep raw strings; we parse numbers ourselves
});

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * 13F value-units rule: filings for periods before 2023-Q1 reported the `value`
 * column in THOUSANDS of dollars; from 2023-Q1 onward it is in whole dollars.
 * Returns the multiplier that converts the raw value to whole dollars.
 */
export function valueDollarMultiplier(periodOfReport: string): number {
  return periodOfReport && periodOfReport < '2023-01-01' ? 1000 : 1;
}

/** Locate and parse the 13F information-table XML for a given filing. */
export async function getInfoTableHoldings(
  cik: string,
  accessionNumber: string,
  periodOfReport?: string,
): Promise<ParsedHolding[]> {
  const multiplier = periodOfReport ? valueDollarMultiplier(periodOfReport) : 1;
  const folder = `https://www.sec.gov/Archives/edgar/data/${cikForArchives(cik)}/${accessionNoDashes(accessionNumber)}`;
  const indexRes = await secFetch(`${folder}/index.json`);
  const index = (await indexRes.json()) as FilingIndex;
  const items = index.directory?.item ?? [];

  // Candidate XML files, excluding the cover page (primary_doc.xml).
  const xmlFiles = items
    .map((it) => it.name)
    .filter((name) => name.toLowerCase().endsWith('.xml') && name.toLowerCase() !== 'primary_doc.xml');

  // Prefer files whose name hints at the info table to minimize requests.
  xmlFiles.sort((a, b) => {
    const score = (n: string) => (/info|table|13f/i.test(n) ? 0 : 1);
    return score(a) - score(b);
  });

  for (const name of xmlFiles) {
    const xmlRes = await secFetch(`${folder}/${name}`);
    const xml = await xmlRes.text();
    if (!/informationTable|infoTable/i.test(xml)) continue;

    const parsed = parser.parse(xml) as Record<string, unknown>;
    const holdings = extractHoldings(parsed, multiplier);
    if (holdings.length > 0) return holdings;
  }

  return [];
}

function extractHoldings(parsed: Record<string, unknown>, multiplier = 1): ParsedHolding[] {
  // Root may be `informationTable` (default ns stripped) containing `infoTable` entries.
  const root = (parsed.informationTable ?? parsed) as Record<string, unknown>;
  const rawTables = (root as { infoTable?: unknown }).infoTable;
  if (!rawTables) return [];

  const tables = Array.isArray(rawTables) ? rawTables : [rawTables];

  return tables.map((entry) => {
    const t = entry as Record<string, unknown>;
    const shrs = (t.shrsOrPrnAmt ?? {}) as Record<string, unknown>;
    const valueDollars = toNumber(t.value) * multiplier;
    return {
      issuerName: String(t.nameOfIssuer ?? '').trim(),
      cusip: String(t.cusip ?? '').trim(),
      valueCents: Math.round(valueDollars * 100),
      shares: Math.round(toNumber(shrs.sshPrnamt)),
      putCall: t.putCall ? String(t.putCall).trim() : null,
    } satisfies ParsedHolding;
  }).filter((h) => h.cusip || h.issuerName);
}

// ── Ticker resolution via SEC company_tickers.json ──

interface CompanyTickerEntry {
  cik_str?: number;
  ticker?: string;
  title?: string;
}

let tickerCache: { fetchedAt: number; byName: Map<string, string> } | null = null;
const TICKER_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // refresh at most once per day

/** Normalize an issuer/company name for best-effort matching. */
function normalizeName(name: string): string {
  let s = name.toUpperCase().replace(/&/g, ' AND ');
  s = s.replace(/[^A-Z0-9 ]/g, ' ');
  // Drop common corporate suffixes and share-class noise.
  s = s.replace(
    /\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LLC|LP|PLC|SA|NV|AG|HLDGS|HOLDINGS|HOLDING|GROUP|GRP|TRUST|FUND|THE|COM|CL|CLASS|A|B|C|ADR|ADS|NEW|SHS|ORD)\b/g,
    ' ',
  );
  return s.replace(/\s+/g, ' ').trim();
}

async function loadTickerMap(): Promise<Map<string, string>> {
  if (tickerCache && Date.now() - tickerCache.fetchedAt < TICKER_CACHE_TTL_MS) {
    return tickerCache.byName;
  }
  const byName = new Map<string, string>();
  try {
    const res = await secFetch('https://www.sec.gov/files/company_tickers.json');
    const data = (await res.json()) as Record<string, CompanyTickerEntry>;
    for (const entry of Object.values(data)) {
      if (!entry.ticker || !entry.title) continue;
      const key = normalizeName(entry.title);
      if (key && !byName.has(key)) byName.set(key, entry.ticker.toUpperCase());
    }
  } catch (err) {
    console.error('Failed to load SEC company_tickers.json', err);
  }
  tickerCache = { fetchedAt: Date.now(), byName };
  return byName;
}

/** Best-effort resolve a ticker symbol from a 13F issuer name. Returns null if no confident match. */
export async function resolveTickerByName(issuerName: string): Promise<string | null> {
  const map = await loadTickerMap();
  const key = normalizeName(issuerName);
  if (!key) return null;
  return map.get(key) ?? null;
}
