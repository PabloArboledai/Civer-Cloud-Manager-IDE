import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { desc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  buildOpenAIProviderApiKeyPreview,
  createDefaultOpenAIProviderState,
  OpenAIProviderCreateInput,
  OpenAIProviderCredential,
  OpenAIProviderHealthSnapshot,
  OpenAIProviderSecret,
  OpenAIProviderSecretSchema,
  OpenAIProviderStateSnapshot,
  OpenAIProviderStateSnapshotSchema,
  OpenAIProviderUpdateInput,
  StoredOpenAIProviderCredential,
} from '../../types/openai-provider';
import { decryptWithMigration, encrypt, type KeySource } from '../../utils/security';
import { logger } from '../../utils/logger';
import { getCloudAccountsDbPath } from '../../utils/paths';
import { configureDatabase, openDrizzleConnection } from './dbConnection';
import { openaiProviders } from './schema';
import * as drizzleSchema from './schema';

type OpenAIDrizzleExecutor = Pick<
  BetterSQLite3Database<typeof drizzleSchema>,
  'insert' | 'update' | 'delete' | 'select'
>;

function ensureOpenAIProvidersDatabaseInitialized(dbPath: string): void {
  const directoryPath = path.dirname(dbPath);
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath);
    configureDatabase(db);
    db.exec(`
      CREATE TABLE IF NOT EXISTS openai_providers (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        label TEXT NOT NULL,
        api_key_preview TEXT NOT NULL,
        organization_id TEXT,
        project_id TEXT,
        base_url TEXT,
        secret_json TEXT NOT NULL,
        state_json TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_used_at INTEGER
      );
    `);
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_openai_providers_enabled ON openai_providers(enabled);',
    );
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_openai_providers_last_used_at ON openai_providers(last_used_at);',
    );
  } catch (error) {
    logger.error('Failed to initialize OpenAI providers database schema', error);
    throw error;
  } finally {
    if (db) {
      db.close();
    }
  }
}

function getOpenAIProvidersDb(): {
  raw: Database.Database;
  orm: BetterSQLite3Database<typeof drizzleSchema>;
} {
  const dbPath = getCloudAccountsDbPath();
  ensureOpenAIProvidersDatabaseInitialized(dbPath);
  return openDrizzleConnection(dbPath, { readonly: false, fileMustExist: false });
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  return normalizedValue;
}

function normalizeSecret(secret: OpenAIProviderSecret): OpenAIProviderSecret {
  return OpenAIProviderSecretSchema.parse({
    apiKey: secret.apiKey.trim(),
  });
}

async function decryptAndMigrateProviderField(
  orm: OpenAIDrizzleExecutor,
  providerId: string,
  field: 'secretJson' | 'stateJson',
  value: string,
): Promise<{ value: string; migrated: boolean; usedFallback?: KeySource }> {
  const result = await decryptWithMigration(value);
  if (result.reencrypted) {
    if (field === 'secretJson') {
      orm
        .update(openaiProviders)
        .set({ secretJson: result.reencrypted })
        .where(eq(openaiProviders.id, providerId))
        .run();
    } else {
      orm
        .update(openaiProviders)
        .set({ stateJson: result.reencrypted })
        .where(eq(openaiProviders.id, providerId))
        .run();
    }

    logger.info(
      `Migrated ${field} for OpenAI provider ${providerId} from ${result.usedFallback ?? 'unknown'} key`,
    );
  }

  return {
    value: result.value,
    migrated: Boolean(result.reencrypted),
    usedFallback: result.usedFallback,
  };
}

function sanitizeHealthForEnabledFlag(
  health: OpenAIProviderHealthSnapshot,
  enabled: boolean,
): OpenAIProviderHealthSnapshot {
  if (!enabled) {
    return {
      ...health,
      status: 'disabled',
      cooldownUntil: null,
    };
  }

  if (health.status !== 'disabled') {
    return health;
  }

  return {
    ...health,
    status: 'unknown',
    cooldownUntil: null,
  };
}

function sanitizeStateForEnabledFlag(
  state: OpenAIProviderStateSnapshot,
  enabled: boolean,
): OpenAIProviderStateSnapshot {
  return {
    ...state,
    health: sanitizeHealthForEnabledFlag(state.health, enabled),
  };
}

function mapStoredProviderToPublic(
  provider: StoredOpenAIProviderCredential,
): OpenAIProviderCredential {
  return {
    id: provider.id,
    provider: provider.provider,
    label: provider.label,
    api_key_preview: provider.api_key_preview,
    organization_id: provider.organization_id,
    project_id: provider.project_id,
    base_url: provider.base_url,
    enabled: provider.enabled,
    created_at: provider.created_at,
    updated_at: provider.updated_at,
    last_used_at: provider.last_used_at,
    state: provider.state,
  };
}

export class OpenAIProviderRepo {
  static async init(): Promise<void> {
    const dbPath = getCloudAccountsDbPath();
    ensureOpenAIProvidersDatabaseInitialized(dbPath);
    await this.migrateToEncrypted();
  }

  static async migrateToEncrypted(): Promise<void> {
    const { raw, orm } = getOpenAIProvidersDb();
    try {
      const rows = orm
        .select({
          id: openaiProviders.id,
          secretJson: openaiProviders.secretJson,
          stateJson: openaiProviders.stateJson,
        })
        .from(openaiProviders)
        .all();

      for (const row of rows) {
        let nextSecretJson = row.secretJson;
        let nextStateJson = row.stateJson;
        let changed = false;

        if (nextSecretJson.startsWith('{')) {
          nextSecretJson = await encrypt(nextSecretJson);
          changed = true;
        }

        if (nextStateJson.startsWith('{')) {
          nextStateJson = await encrypt(nextStateJson);
          changed = true;
        }

        if (changed) {
          orm
            .update(openaiProviders)
            .set({
              secretJson: nextSecretJson,
              stateJson: nextStateJson,
            })
            .where(eq(openaiProviders.id, row.id))
            .run();
          logger.info(`Migrated OpenAI provider ${row.id} to encrypted storage`);
        }
      }
    } finally {
      raw.close();
    }
  }

  private static async parseStoredProvider(
    orm: OpenAIDrizzleExecutor,
    row: typeof openaiProviders.$inferSelect,
  ): Promise<StoredOpenAIProviderCredential> {
    const secretResult = await decryptAndMigrateProviderField(
      orm,
      row.id,
      'secretJson',
      row.secretJson,
    );
    const stateResult = await decryptAndMigrateProviderField(
      orm,
      row.id,
      'stateJson',
      row.stateJson,
    );

    const secret = normalizeSecret(
      OpenAIProviderSecretSchema.parse(JSON.parse(secretResult.value)),
    );
    const state = OpenAIProviderStateSnapshotSchema.parse(JSON.parse(stateResult.value));

    return {
      id: row.id,
      provider: 'openai',
      label: row.label,
      api_key_preview: row.apiKeyPreview,
      organization_id: row.organizationId ?? null,
      project_id: row.projectId ?? null,
      base_url: row.baseUrl ?? null,
      enabled: Boolean(row.enabled),
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      last_used_at: row.lastUsedAt ?? null,
      state,
      secret,
    };
  }

  static async listProviders(): Promise<OpenAIProviderCredential[]> {
    const providers = await this.listProvidersWithSecrets();
    return providers.map((provider) => mapStoredProviderToPublic(provider));
  }

  static async listProvidersWithSecrets(): Promise<StoredOpenAIProviderCredential[]> {
    return [];
  }

  static async getProvider(providerId: string): Promise<OpenAIProviderCredential | undefined> {
    const storedProvider = await this.getProviderWithSecret(providerId);
    if (!storedProvider) {
      return undefined;
    }

    return mapStoredProviderToPublic(storedProvider);
  }

  static async getProviderWithSecret(
    providerId: string,
  ): Promise<StoredOpenAIProviderCredential | undefined> {
    const { raw, orm } = getOpenAIProvidersDb();
    try {
      const rows = orm
        .select()
        .from(openaiProviders)
        .where(eq(openaiProviders.id, providerId))
        .all();
      const row = rows[0];
      if (!row) {
        return undefined;
      }

      return this.parseStoredProvider(orm, row);
    } finally {
      raw.close();
    }
  }

  static async addProvider(input: OpenAIProviderCreateInput): Promise<OpenAIProviderCredential> {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const enabled = input.enabled ?? true;
    const secret = normalizeSecret({ apiKey: input.apiKey });
    const state = sanitizeStateForEnabledFlag(createDefaultOpenAIProviderState(enabled), enabled);

    const { raw, orm } = getOpenAIProvidersDb();
    try {
      orm
        .insert(openaiProviders)
        .values({
          id,
          provider: 'openai',
          label: input.label.trim(),
          apiKeyPreview: buildOpenAIProviderApiKeyPreview(secret.apiKey),
          organizationId: normalizeOptionalString(input.organizationId),
          projectId: normalizeOptionalString(input.projectId),
          baseUrl: normalizeOptionalString(input.baseUrl),
          secretJson: await encrypt(JSON.stringify(secret)),
          stateJson: await encrypt(JSON.stringify(state)),
          enabled: enabled ? 1 : 0,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: null,
        })
        .run();
    } finally {
      raw.close();
    }

    const createdProvider = await this.getProvider(id);
    if (!createdProvider) {
      throw new Error('Failed to load created OpenAI provider');
    }

    return createdProvider;
  }

  static async updateProvider(input: OpenAIProviderUpdateInput): Promise<OpenAIProviderCredential> {
    const existingProvider = await this.getProviderWithSecret(input.providerId);
    if (!existingProvider) {
      throw new Error(`OpenAI provider not found: ${input.providerId}`);
    }

    const now = Math.floor(Date.now() / 1000);
    const nextEnabled = input.enabled ?? existingProvider.enabled;
    const nextState = sanitizeStateForEnabledFlag(existingProvider.state, nextEnabled);
    const nextSecret =
      input.apiKey !== undefined
        ? normalizeSecret({ apiKey: input.apiKey })
        : existingProvider.secret;

    const { raw, orm } = getOpenAIProvidersDb();
    try {
      orm
        .update(openaiProviders)
        .set({
          label: input.label?.trim() ?? existingProvider.label,
          apiKeyPreview:
            input.apiKey !== undefined
              ? buildOpenAIProviderApiKeyPreview(nextSecret.apiKey)
              : existingProvider.api_key_preview,
          organizationId:
            input.organizationId !== undefined
              ? normalizeOptionalString(input.organizationId)
              : (existingProvider.organization_id ?? null),
          projectId:
            input.projectId !== undefined
              ? normalizeOptionalString(input.projectId)
              : (existingProvider.project_id ?? null),
          baseUrl:
            input.baseUrl !== undefined
              ? normalizeOptionalString(input.baseUrl)
              : (existingProvider.base_url ?? null),
          secretJson: await encrypt(JSON.stringify(nextSecret)),
          stateJson: await encrypt(JSON.stringify(nextState)),
          enabled: nextEnabled ? 1 : 0,
          updatedAt: now,
        })
        .where(eq(openaiProviders.id, input.providerId))
        .run();
    } finally {
      raw.close();
    }

    const updatedProvider = await this.getProvider(input.providerId);
    if (!updatedProvider) {
      throw new Error(`Failed to load updated OpenAI provider: ${input.providerId}`);
    }

    return updatedProvider;
  }

  static async deleteProvider(providerId: string): Promise<void> {
    const { raw, orm } = getOpenAIProvidersDb();
    try {
      orm.delete(openaiProviders).where(eq(openaiProviders.id, providerId)).run();
      logger.info(`Removed OpenAI provider: ${providerId}`);
    } finally {
      raw.close();
    }
  }

  static async updateState(
    providerId: string,
    state: OpenAIProviderStateSnapshot,
  ): Promise<OpenAIProviderCredential> {
    const existingProvider = await this.getProvider(providerId);
    if (!existingProvider) {
      throw new Error(`OpenAI provider not found: ${providerId}`);
    }

    const normalizedState = sanitizeStateForEnabledFlag(state, existingProvider.enabled);
    const now = Math.floor(Date.now() / 1000);
    const { raw, orm } = getOpenAIProvidersDb();
    try {
      orm
        .update(openaiProviders)
        .set({
          stateJson: await encrypt(JSON.stringify(normalizedState)),
          updatedAt: now,
        })
        .where(eq(openaiProviders.id, providerId))
        .run();
    } finally {
      raw.close();
    }

    const updatedProvider = await this.getProvider(providerId);
    if (!updatedProvider) {
      throw new Error(`Failed to load OpenAI provider state after update: ${providerId}`);
    }

    return updatedProvider;
  }

  static async markUsed(
    providerId: string,
    usedAt: number = Math.floor(Date.now() / 1000),
  ): Promise<void> {
    const { raw, orm } = getOpenAIProvidersDb();
    try {
      orm
        .update(openaiProviders)
        .set({
          lastUsedAt: usedAt,
          updatedAt: usedAt,
        })
        .where(eq(openaiProviders.id, providerId))
        .run();
    } finally {
      raw.close();
    }
  }
}
