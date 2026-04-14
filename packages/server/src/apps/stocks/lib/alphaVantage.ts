interface AlphaVantageOverviewResponse {
  Symbol?: string;
  Name?: string;
  Exchange?: string;
  Sector?: string;
  Industry?: string;
  PERatio?: string;
  PriceToBookRatio?: string;
  PriceToSalesRatioTTM?: string;
  EPS?: string;
  AnalystTargetPrice?: string;
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
  pbRatio: number | null;
  psRatio: number | null;
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

function deriveEpsGrowthPercent(epsValue: number | null, peRatio: number | null): number | null {
  if (epsValue === null || epsValue <= 0 || peRatio === null || peRatio <= 0) {
    return null;
  }

  return Number(((1 / peRatio) * 100).toFixed(2));
}

async function fetchAlphaVantageFunction<T>(symbol: string, fn: string, apiKey: string): Promise<T> {
  const params = new URLSearchParams({
    function: fn,
    symbol,
    apikey: apiKey,
  });

  const response = await fetch(`https://www.alphavantage.co/query?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed with ${response.status}`);
  }

  const payload = await response.json() as Record<string, unknown>;

  if (typeof payload.Note === 'string') {
    throw new Error(payload.Note);
  }

  if (typeof payload.Information === 'string') {
    throw new Error(payload.Information);
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

export async function fetchAlphaVantageMetrics(symbol: string): Promise<AlphaVantageMetricsResult> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    throw new Error('ALPHA_VANTAGE_API_KEY is not configured');
  }

  const normalizedSymbol = symbol.trim().toUpperCase();
  const overview = await fetchAlphaVantageFunction<AlphaVantageOverviewResponse>(normalizedSymbol, 'OVERVIEW', apiKey);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const quote = await fetchAlphaVantageFunction<AlphaVantageQuoteResponse>(normalizedSymbol, 'GLOBAL_QUOTE', apiKey);

  const peRatio = parseNumber(overview.PERatio);
  const epsValue = parseNumber(overview.EPS);

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
    pbRatio: parseNumber(overview.PriceToBookRatio),
    psRatio: parseNumber(overview.PriceToSalesRatioTTM),
    epsGrowth: deriveEpsGrowthPercent(epsValue, peRatio),
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
    analystRating: overview.AnalystTargetPrice ? 'target-available' : null,
  };
}