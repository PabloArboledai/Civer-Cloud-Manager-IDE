import i18n from '../i18n';
import { Account, DeviceProfile, DeviceProfileVersion, ModelQuota, QuotaData } from '../types/account';
import { request as invoke } from '../utils/request';


// 检查环境 (可选)
function ensureTauriEnvironment() {
    // Web 模式下 request 也是一个 function，所以这里不应抛错
    if (typeof invoke !== 'function') {
        throw new Error(i18n.t('common.tauri_api_not_loaded'));
    }
}

/**
 * La API puede devolver models como:
 *   - Array: [{name, percentage, ...}]   ← formato Tauri
 *   - Dict:  {modelName: {percentage, resetTime, ...}}  ← formato REST web
 * Esta función normaliza ambos a array con el campo `name` siempre presente.
 */
function normalizeModels(models: any): ModelQuota[] {
    if (!models) return [];
    if (Array.isArray(models)) return models;
    // Es un diccionario: convertir a array añadiendo name = clave
    return Object.entries(models).map(([name, data]: [string, any]) => ({
        name,
        percentage: data.percentage ?? 0,
        reset_time: data.resetTime ?? data.reset_time ?? '',
        display_name: data.display_name ?? undefined,
        supports_images: data.supports_images ?? undefined,
        supports_thinking: data.supports_thinking ?? undefined,
        thinking_budget: data.thinking_budget ?? undefined,
        recommended: data.recommended ?? undefined,
        max_tokens: data.max_tokens ?? undefined,
        max_output_tokens: data.max_output_tokens ?? undefined,
        supported_mime_types: data.supported_mime_types ?? undefined,
    }));
}

function normalizeAccount(acc: any): any {
    if (!acc) return acc;
    if (acc.quota && acc.quota.models && !Array.isArray(acc.quota.models)) {
        return { ...acc, quota: { ...acc.quota, models: normalizeModels(acc.quota.models) } };
    }
    return acc;
}

export async function listAccounts(): Promise<Account[]> {
    const response = await invoke<any>('list_accounts');
    let accounts: any[];
    if (response && typeof response === 'object' && Array.isArray(response.accounts)) {
        accounts = response.accounts;
    } else {
        accounts = Array.isArray(response) ? response : [];
    }
    return accounts.map(normalizeAccount);
}

export async function getCurrentAccount(): Promise<Account | null> {
    const acc = await invoke<any>('get_current_account');
    return normalizeAccount(acc);
}

export async function addAccount(email: string, refreshToken: string): Promise<Account> {
    return await invoke('add_account', { email, refreshToken });
}

export async function deleteAccount(accountId: string): Promise<void> {
    return await invoke('delete_account', { accountId });
}

export async function deleteAccounts(accountIds: string[]): Promise<void> {
    return await invoke('delete_accounts', { accountIds });
}

export async function switchAccount(accountId: string, targetIde?: string): Promise<void> {
    return await invoke('switch_account', { accountId, targetIde });
}

export async function fetchAccountQuota(accountId: string): Promise<QuotaData> {
    return await invoke('fetch_account_quota', { accountId });
}

export interface RefreshStats {
    total: number;
    success: number;
    failed: number;
    details: string[];
}

export async function refreshAllQuotas(): Promise<RefreshStats> {
    return await invoke('refresh_all_quotas');
}

// OAuth
export async function startOAuthLogin(oauthClientKey?: string): Promise<Account> {
    ensureTauriEnvironment();

    try {
        return await invoke('start_oauth_login', oauthClientKey ? { oauthClientKey } : undefined);
    } catch (error) {
        // 增强错误信息
        if (typeof error === 'string') {
            // 如果是 refresh_token 缺失错误,保持原样(已包含详细说明)
            if (error.includes('Refresh Token') || error.includes('refresh_token')) {
                throw error;
            }
            // 其他错误添加上下文
            throw i18n.t('accounts.add.oauth_error', { error });
        }
        throw error;
    }
}

export async function completeOAuthLogin(): Promise<Account> {
    ensureTauriEnvironment();
    try {
        return await invoke('complete_oauth_login');
    } catch (error) {
        if (typeof error === 'string') {
            if (error.includes('Refresh Token') || error.includes('refresh_token')) {
                throw error;
            }
            throw i18n.t('accounts.add.oauth_error', { error });
        }
        throw error;
    }
}

export async function cancelOAuthLogin(): Promise<void> {
    ensureTauriEnvironment();
    return await invoke('cancel_oauth_login');
}

export interface OAuthClientInfo {
    key: string;
    label: string;
    client_id: string;
    is_active: boolean;
    is_builtin: boolean;
}

export async function listOAuthClients(): Promise<OAuthClientInfo[]> {
    const res = await invoke<{ clients: OAuthClientInfo[] }>('list_oauth_clients');
    if (res && Array.isArray(res.clients)) return res.clients;
    return (res as unknown as OAuthClientInfo[]) || [];
}

export async function getActiveOAuthClient(): Promise<string> {
    const res = await invoke<{ client_key: string } | string>('get_active_oauth_client');
    if (typeof res === 'string') return res;
    return res?.client_key || '';
}

export async function setActiveOAuthClient(clientKey: string): Promise<void> {
    return await invoke('set_active_oauth_client', { clientKey });
}

// 导入
export async function importV1Accounts(): Promise<Account[]> {
    return await invoke('import_v1_accounts');
}

export async function importFromDb(): Promise<Account> {
    return await invoke('import_from_db');
}

export async function importFromCustomDb(path: string): Promise<Account> {
    return await invoke('import_custom_db', { path });
}

export async function syncAccountFromDb(): Promise<Account | null> {
    return await invoke('sync_account_from_db');
}

export async function toggleProxyStatus(accountId: string, enable: boolean, reason?: string): Promise<void> {
    return await invoke('toggle_proxy_status', { accountId, enable, reason });
}

/**
 * 重新排序账号列表
 * @param accountIds 按新顺序排列的账号ID数组
 */
export async function reorderAccounts(accountIds: string[]): Promise<void> {
    return await invoke('reorder_accounts', { accountIds });
}

// 设备指纹相关
export interface DeviceProfilesResponse {
    current_storage?: DeviceProfile;
    history?: DeviceProfileVersion[];
    baseline?: DeviceProfile;
}

export async function getDeviceProfiles(accountId: string): Promise<DeviceProfilesResponse> {
    return await invoke('get_device_profiles', { accountId });
}

export async function bindDeviceProfile(accountId: string, mode: 'capture' | 'generate'): Promise<DeviceProfile> {
    return await invoke('bind_device_profile', { accountId, mode });
}

export async function restoreOriginalDevice(): Promise<string> {
    return await invoke('restore_original_device');
}

export async function listDeviceVersions(accountId: string): Promise<DeviceProfilesResponse> {
    return await invoke('list_device_versions', { accountId });
}

export async function restoreDeviceVersion(accountId: string, versionId: string): Promise<DeviceProfile> {
    return await invoke('restore_device_version', { accountId, versionId });
}

export async function deleteDeviceVersion(accountId: string, versionId: string): Promise<void> {
    return await invoke('delete_device_version', { accountId, versionId });
}

export async function openDeviceFolder(): Promise<void> {
    return await invoke('open_device_folder');
}

export async function previewGenerateProfile(): Promise<DeviceProfile> {
    return await invoke('preview_generate_profile');
}

export async function bindDeviceProfileWithProfile(accountId: string, profile: DeviceProfile): Promise<DeviceProfile> {
    return await invoke('bind_device_profile_with_profile', { accountId, profile });
}

// 预热相关
export async function warmUpAllAccounts(): Promise<string> {
    return await invoke('warm_up_all_accounts');
}

export async function warmUpAccount(accountId: string): Promise<string> {
    return await invoke('warm_up_account', { accountId });
}

// 导出账号相关
export interface ExportAccountItem {
    email: string;
    refresh_token: string;
}

export interface ExportAccountsResponse {
    accounts: ExportAccountItem[];
}

export async function exportAccounts(accountIds: string[]): Promise<ExportAccountsResponse> {
    return await invoke('export_accounts', { accountIds });
}

// 自定义标签相关
export async function updateAccountLabel(accountId: string, label: string): Promise<void> {
    return await invoke('update_account_label', { accountId, label });
}

