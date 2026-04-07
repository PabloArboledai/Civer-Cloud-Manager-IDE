import { ipc } from '@/ipc/manager';
import type {
  OpenAIProviderCreateInput,
  OpenAIProviderCredential,
  OpenAIProviderUpdateInput,
} from '@/types/openai-provider';

export function listOpenAIProviders(): Promise<OpenAIProviderCredential[]> {
  return ipc.client.openai.listProviders() as Promise<OpenAIProviderCredential[]>;
}

export function getOpenAIProvider(input: {
  providerId: string;
}): Promise<OpenAIProviderCredential | null> {
  return ipc.client.openai.getProvider(input) as Promise<OpenAIProviderCredential | null>;
}

export function addOpenAIProvider(
  input: OpenAIProviderCreateInput,
): Promise<OpenAIProviderCredential> {
  return ipc.client.openai.addProvider(input) as Promise<OpenAIProviderCredential>;
}

export function updateOpenAIProvider(
  input: OpenAIProviderUpdateInput,
): Promise<OpenAIProviderCredential> {
  return ipc.client.openai.updateProvider(input) as Promise<OpenAIProviderCredential>;
}

export function deleteOpenAIProvider(input: { providerId: string }): Promise<void> {
  return ipc.client.openai.deleteProvider(input) as Promise<void>;
}

export function refreshOpenAIProviderState(input: {
  providerId: string;
}): Promise<OpenAIProviderCredential> {
  return ipc.client.openai.refreshProviderState(input) as Promise<OpenAIProviderCredential>;
}

export function refreshAllOpenAIProviderStates(): Promise<OpenAIProviderCredential[]> {
  return ipc.client.openai.refreshAllProviderStates() as Promise<OpenAIProviderCredential[]>;
}
