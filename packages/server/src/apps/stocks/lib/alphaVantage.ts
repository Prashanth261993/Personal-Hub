interface AlphaVantageOverviewResponse {
  Symbol?: string;
  Name?: string;
  Exchange?: string;
  Sector?: string;
  Industry?: string;
  PERatio?: string;
  ForwardPE?: string;
  PEGRatio?: string;
  PriceToBookRatio?: string;
  PriceToSalesRatioTTM?: string;
  EVToEBITDA?: string;
  EVToRevenue?: string;
  EBITDA?: string;
  BookValue?: string;
  EPS?: string;
  DilutedEPSTTM?: string;
  DividendPerShare?: string;
  ExDividendDate?: string;
  DividendDate?: string;
  AnalystTargetPrice?: string;
  AnalystRatingStrongBuy?: string;
  AnalystRatingBuy?: string;
  AnalystRatingHold?: string;
  AnalystRatingSell?: string;
  AnalystRatingStrongSell?: string;
  Beta?: string;
  MarketCapitalization?: string;
  '52WeekHigh'?: string;
  '52WeekLow'?: string;
  '50DayMovingAverage'?: string;
  '200DayMovingAverage'?: string;
  DividendYield?: string;
  ProfitMargin?: string;
  OperatingMarginTTM?: string;
  ReturnOnAssetsTTM?: string;
  ReturnOnEquityTTM?: string;
  QuarterlyEarningsGrowthYOY?: string;
  QuarterlyRevenueGrowthYOY?: string;
  SharesOutstanding?: string;
  RevenueTTM?: string;
  GrossProfitTTM?: string;
}

interface AlphaVantageQuoteResponse {
  'Global Quote'?: {
    '02. open'?: string;
    '03. high'?: string;
    '04. low'?: string;
    '05. price'?: string;
    '06. volume'?: string;
    '07. latest trading day'?: string;
    '08. previous close'?: string;
    '09. change'?: string;
    '10. change percent'?: string;
  };
}

export interface AlphaVantageMetricsResult {
  companyName: string | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  currentPrice: number | null;
  previousClosePrice: number | null;
  priceChange: number | null;
  priceChangePercent: number | null;
  analystTargetPrice: number | null;
  volume: number | null;
  latestTradingDay: string | null;
  peRatio: number | null;
  forwardPe: number | null;
  pegRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  evToEbitda: number | null;
  evToRevenue: number | null;
  ebitda: number | null;
  bookValue: number | null;
  dilutedEpsTtm: number | null;
  dividendPerShare: number | null;
  exDividendDate: string | null;
  dividendDate: string | null;
  epsGrowth: number | null;
  marketCap: number | null;
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyDayMovingAverage: number | null;
  twoHundredDayMovingAverage: number | null;
  dividendYield: number | null;
  profitMargin: number | null;
  operatingMarginTtm: number | null;
  returnOnAssetsTtm: number | null;
  returnOnEquityTtm: number | null;
  quarterlyEarningsGrowthYoy: number | null;
  quarterlyRevenueGrowthYoy: number | null;
  sharesOutstanding: number | null;
  revenueTtm: number | null;
  grossProfitTtm: number | null;
  analystRatingStrongBuy: number | null;
  analystRatingBuy: number | null;
  analystRatingHold: number | null;
  analystRatingSell: number | null;
  analystRatingStrongSell: number | null;
  analystRating: string | null;
}

function parseNumber(value: string | undefined): number | null {
  if (!value || value === 'None' || value === '-') {
    return null;
  }

  const normalized = value.replaceAll(',', '').replace('%', '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRatioPercentage(value: string | undefined): number | null {
  const parsed = parseNumber(value);

  if (parsed === null) {
    return null;
  }

  return Number((parsed * 100).toFixed(2));
}

function dollarsToCentsValue(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100);
}

// ── Multi-key rotation ──────────────────────────────────────────────
// Alpha Vantage free-tier keys are capped at 25 requests/day. Configure a pool
// via ALPHA_VANTAGE_API_KEYS (comma-separated); ALPHA_VANTAGE_API_KEY is still
// honored as a single-key fallback. When a key reports its daily limit it is
// marked exhausted for the rest of the day (US Eastern, when AV resets) and
// requests transparently fall through to the next available key.

interface AlphaVantageKeyState {
  key: string;
  /** ET date (YYYY-MM-DD) on which this key hit its daily limit, or null. */
  exhaustedOn: string | null;
}

let keyPool: AlphaVantageKeyState[] | null = null;

function etDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function loadKeyPool(): AlphaVantageKeyState[] {
  if (keyPool) return keyPool;
  const raw = process.env.ALPHA_VANTAGE_API_KEYS ?? process.env.ALPHA_VANTAGE_API_KEY ?? '';
  const keys = Array.from(new Set(raw.split(',').map((k) => k.trim()).filter(Boolean)));
  keyPool = keys.map((key) => ({ key, exhaustedOn: null }));
  return keyPool;
}

/** Rate-limit signal that should trigger rotation to another key. */
class AlphaVantageRateLimitError extends Error {
  constructor(message: string, readonly daily: boolean) {
    super(message);
    this.name = 'AlphaVantageRateLimitError';
  }
}

/** Thrown when every configured key has hit its daily limit. */
export class AlphaVantageAllKeysExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlphaVantageAllKeysExhaustedError';
  }
}

async function rawAlphaVantageCall<T>(symbol: string, fn: string, apiKey: string): Promise<T> {
  const params = new URLSearchParams({ function: fn, symbol, apikey: apiKey });
  const response = await fetch(`https://www.alphavantage.co/query?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed with ${response.status}`);
  }

  const payload = await response.json() as Record<string, unknown>;

  // Daily cap (e.g. "...25 requests per day...") → mark this key exhausted.
  if (typeof payload.Information === 'string') {
    throw new AlphaVantageRateLimitError(payload.Information, true);
  }

  // Per-minute throttle → transient; rotate but keep the key usable later.
  if (typeof payload.Note === 'string') {
    throw new AlphaVantageRateLimitError(payload.Note, false);
  }

  if (typeof payload['Error Message'] === 'string') {
    throw new Error(payload['Error Message']);
  }

  const keys = Object.keys(payload);
  if (keys.length === 0) {
    console.warn(`Alpha Vantage ${fn} returned empty response for ${symbol}`);
  } else {
    console.log(`Alpha Vantage ${fn} for ${symbol}: ${keys.length} fields (${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''})`);
  }

  return payload as T;
}

async function fetchAlphaVantageFunction<T>(symbol: string, fn: string): Promise<T> {
  const pool = loadKeyPool();
  if (pool.length === 0) {
    throw new Error('No Alpha Vantage API key configured (set ALPHA_VANTAGE_API_KEYS or ALPHA_VANTAGE_API_KEY)');
  }

  const today = etDateString();
  let lastRateLimit: AlphaVantageRateLimitError | null = null;

  for (const state of pool) {
    // Auto-reset a key that was exhausted on a previous day.
    if (state.exhaustedOn && state.exhaustedOn !== today) {
      state.exhaustedOn = null;
    }
    if (state.exhaustedOn === today) continue;

    try {
      return await rawAlphaVantageCall<T>(symbol, fn, state.key);
    } catch (err) {
      if (err instanceof AlphaVantageRateLimitError) {
        lastRateLimit = err;
        const masked = `...${state.key.slice(-4)}`;
        if (err.daily) {
          state.exhaustedOn = today;
          console.warn(`Alpha Vantage key ${masked} hit its daily limit; rotating to the next key.`);
        } else {
          console.warn(`Alpha Vantage key ${masked} throttled (per-minute); trying the next key.`);
        }
        continue;
      }
      throw err;
    }
  }

  throw new AlphaVantageAllKeysExhaustedError(
    lastRateLimit?.message
      ?? 'All Alpha Vantage API keys have hit their daily limit. Add more keys or retry after midnight ET.',
  );
}

export async function fetchAlphaVantageMetrics(symbol: string): Promise<AlphaVantageMetricsResult> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const overview = await fetchAlphaVantageFunction<AlphaVantageOverviewResponse>(normalizedSymbol, 'OVERVIEW');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const quote = await fetchAlphaVantageFunction<AlphaVantageQuoteResponse>(normalizedSymbol, 'GLOBAL_QUOTE');

  const peRatio = parseNumber(overview.PERatio);

  return {
    companyName: overview.Name ?? null,
    exchange: overview.Exchange ?? null,
    sector: overview.Sector ?? null,
    industry: overview.Industry ?? null,
    openPrice: dollarsToCentsValue(parseNumber(quote['Global Quote']?.['02. open'])),
    highPrice: dollarsToCentsValue(parseNumber(quote['Global Quote']?.['03. high'])),
    lowPrice: dollarsToCentsValue(parseNumber(quote['Global Quote']?.['04. low'])),
    currentPrice: dollarsToCentsValue(parseNumber(quote['Global Quote']?.['05. price'])),
    previousClosePrice: dollarsToCentsValue(parseNumber(quote['Global Quote']?.['08. previous close'])),
    priceChange: dollarsToCentsValue(parseNumber(quote['Global Quote']?.['09. change'])),
    priceChangePercent: parseNumber(quote['Global Quote']?.['10. change percent']),
    analystTargetPrice: dollarsToCentsValue(parseNumber(overview.AnalystTargetPrice)),
    volume: parseNumber(quote['Global Quote']?.['06. volume']),
    latestTradingDay: quote['Global Quote']?.['07. latest trading day'] ?? null,
    peRatio,
    forwardPe: parseNumber(overview.ForwardPE),
    pegRatio: parseNumber(overview.PEGRatio),
    pbRatio: parseNumber(overview.PriceToBookRatio),
    psRatio: parseNumber(overview.PriceToSalesRatioTTM),
    evToEbitda: parseNumber(overview.EVToEBITDA),
    evToRevenue: parseNumber(overview.EVToRevenue),
    ebitda: parseNumber(overview.EBITDA),
    bookValue: dollarsToCentsValue(parseNumber(overview.BookValue)),
    dilutedEpsTtm: dollarsToCentsValue(parseNumber(overview.DilutedEPSTTM)),
    dividendPerShare: dollarsToCentsValue(parseNumber(overview.DividendPerShare)),
    exDividendDate: overview.ExDividendDate && overview.ExDividendDate !== 'None' ? overview.ExDividendDate : null,
    dividendDate: overview.DividendDate && overview.DividendDate !== 'None' ? overview.DividendDate : null,
    // EPS growth: Alpha Vantage has no direct field, so use quarterly earnings
    // growth YoY as the closest proxy (percentage). Previously this derived
    // earnings yield (1/PE), which was mislabeled as growth.
    epsGrowth: parseRatioPercentage(overview.QuarterlyEarningsGrowthYOY),
    marketCap: parseNumber(overview.MarketCapitalization),
    beta: parseNumber(overview.Beta),
    fiftyTwoWeekHigh: dollarsToCentsValue(parseNumber(overview['52WeekHigh'])),
    fiftyTwoWeekLow: dollarsToCentsValue(parseNumber(overview['52WeekLow'])),
    fiftyDayMovingAverage: dollarsToCentsValue(parseNumber(overview['50DayMovingAverage'])),
    twoHundredDayMovingAverage: dollarsToCentsValue(parseNumber(overview['200DayMovingAverage'])),
    dividendYield: parseRatioPercentage(overview.DividendYield),
    profitMargin: parseRatioPercentage(overview.ProfitMargin),
    operatingMarginTtm: parseRatioPercentage(overview.OperatingMarginTTM),
    returnOnAssetsTtm: parseRatioPercentage(overview.ReturnOnAssetsTTM),
    returnOnEquityTtm: parseRatioPercentage(overview.ReturnOnEquityTTM),
    quarterlyEarningsGrowthYoy: parseRatioPercentage(overview.QuarterlyEarningsGrowthYOY),
    quarterlyRevenueGrowthYoy: parseRatioPercentage(overview.QuarterlyRevenueGrowthYOY),
    sharesOutstanding: parseNumber(overview.SharesOutstanding),
    revenueTtm: parseNumber(overview.RevenueTTM),
    grossProfitTtm: parseNumber(overview.GrossProfitTTM),
    analystRatingStrongBuy: parseNumber(overview.AnalystRatingStrongBuy),
    analystRatingBuy: parseNumber(overview.AnalystRatingBuy),
    analystRatingHold: parseNumber(overview.AnalystRatingHold),
    analystRatingSell: parseNumber(overview.AnalystRatingSell),
    analystRatingStrongSell: parseNumber(overview.AnalystRatingStrongSell),
    analystRating: overview.AnalystTargetPrice ? 'target-available' : null,
  };
}