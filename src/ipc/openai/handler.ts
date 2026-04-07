import {
  OpenAIProviderCreateInput,
  OpenAIProviderCredential,
  OpenAIProviderUpdateInput,
} from '../../types/openai-provider';
import { OpenAIProviderRepo } from '../database/openaiProviderRepo';

export async function listOpenAIProviders(): Promise<OpenAIProviderCredential[]> {
  return OpenAIProviderRepo.listProviders();
}

export async function getOpenAIProvider(
  providerId: string,
): Promise<OpenAIProviderCredential | undefined> {
  return OpenAIProviderRepo.getProvider(providerId);
}

export async function addOpenAIProvider(
  input: OpenAIProviderCreateInput,
): Promise<OpenAIProviderCredential> {
  return OpenAIProviderRepo.addProvider(input);
}

export async function updateOpenAIProvider(
  input: OpenAIProviderUpdateInput,
): Promise<OpenAIProviderCredential> {
  return OpenAIProviderRepo.updateProvider(input);
}

export async function deleteOpenAIProvider(providerId: string): Promise<void> {
  await OpenAIProviderRepo.deleteProvider(providerId);
}
