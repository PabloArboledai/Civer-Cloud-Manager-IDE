import { os } from '@orpc/server';
import { z } from 'zod';
import {
  OpenAIProviderCreateInputSchema,
  OpenAIProviderCredentialSchema,
  OpenAIProviderUpdateInputSchema,
} from '../../types/openai-provider';
import {
  addOpenAIProvider,
  deleteOpenAIProvider,
  getOpenAIProvider,
  listOpenAIProviders,
  refreshAllOpenAIProviderStates,
  refreshOpenAIProviderState,
  updateOpenAIProvider,
} from './handler';

export const openaiRouter = os.router({
  listProviders: os.output(z.array(OpenAIProviderCredentialSchema)).handler(async () => {
    return listOpenAIProviders();
  }),

  getProvider: os
    .input(z.object({ providerId: z.string() }))
    .output(OpenAIProviderCredentialSchema.nullable())
    .handler(async ({ input }) => {
      const provider = await getOpenAIProvider(input.providerId);
      return provider ?? null;
    }),

  addProvider: os
    .input(OpenAIProviderCreateInputSchema)
    .output(OpenAIProviderCredentialSchema)
    .handler(async ({ input }) => {
      return addOpenAIProvider(input);
    }),

  updateProvider: os
    .input(OpenAIProviderUpdateInputSchema)
    .output(OpenAIProviderCredentialSchema)
    .handler(async ({ input }) => {
      return updateOpenAIProvider(input);
    }),

  deleteProvider: os
    .input(z.object({ providerId: z.string() }))
    .output(z.void())
    .handler(async ({ input }) => {
      await deleteOpenAIProvider(input.providerId);
    }),

  refreshProviderState: os
    .input(z.object({ providerId: z.string() }))
    .output(OpenAIProviderCredentialSchema)
    .handler(async ({ input }) => {
      return refreshOpenAIProviderState(input.providerId);
    }),

  refreshAllProviderStates: os
    .output(z.array(OpenAIProviderCredentialSchema))
    .handler(async () => {
      return refreshAllOpenAIProviderStates();
    }),
});
