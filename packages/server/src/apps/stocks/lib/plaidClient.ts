import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import crypto from 'crypto';

// ── Plaid API singleton ──

let client: PlaidApi | null = null;

function getClient(): PlaidApi {
  if (client) return client;

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV || 'sandbox';

  if (!clientId || !secret) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set in .env');
  }

  const basePath = env === 'production'
    ? PlaidEnvironments.production
    : PlaidEnvironments.sandbox;

  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });

  client = new PlaidApi(configuration);
  return client;
}

export async function createLinkToken(): Promise<string> {
  const plaid = getClient();
  const response = await plaid.linkTokenCreate({
    user: { client_user_id: 'personal-hub-user' },
    client_name: 'Personal Hub',
    products: [Products.Investments],
    country_codes: [CountryCode.Us],
    language: 'en',
  });
  return response.data.link_token;
}

export async function exchangePublicToken(publicToken: string) {
  const plaid = getClient();
  const response = await plaid.itemPublicTokenExchange({ public_token: publicToken });
  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}

export async function getInstitutionName(institutionId: string): Promise<string> {
  try {
    const plaid = getClient();
    const response = await plaid.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    });
    return response.data.institution.name;
  } catch {
    return institutionId;
  }
}

export async function getAccounts(accessToken: string) {
  const plaid = getClient();
  const response = await plaid.accountsGet({ access_token: accessToken });
  return response.data.accounts;
}

export async function getInvestmentHoldings(accessToken: string) {
  const plaid = getClient();
  const response = await plaid.investmentsHoldingsGet({ access_token: accessToken });
  return {
    accounts: response.data.accounts,
    holdings: response.data.holdings,
    securities: response.data.securities,
  };
}

export async function getInvestmentTransactions(accessToken: string, startDate: string, endDate: string) {
  const plaid = getClient();
  const response = await plaid.investmentsTransactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
  });
  return {
    investmentTransactions: response.data.investment_transactions,
    securities: response.data.securities,
  };
}

// ── Token encryption (AES-256-GCM) ──

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.PLAID_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('PLAID_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  if (!ivHex || !tagHex || !encHex) {
    throw new Error('Invalid encrypted token format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
