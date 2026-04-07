import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addOpenAIProvider,
  deleteOpenAIProvider,
  getOpenAIProvider,
  listOpenAIProviders,
  refreshAllOpenAIProviderStates,
  refreshOpenAIProviderState,
  updateOpenAIProvider,
} from '@/actions/openai';
import type {
  OpenAIProviderCreateInput,
  OpenAIProviderCredential,
  OpenAIProviderUpdateInput,
} from '@/types/openai-provider';

export const OPENAI_PROVIDER_QUERY_KEYS = {
  all: ['openaiProviders'] as const,
  detail: (providerId: string) => ['openaiProviders', providerId] as const,
};

export function useOpenAIProviders() {
  return useQuery<OpenAIProviderCredential[]>({
    queryKey: OPENAI_PROVIDER_QUERY_KEYS.all,
    queryFn: listOpenAIProviders,
    staleTime: 1000 * 30,
  });
}

export function useOpenAIProvider(providerId: string | null | undefined) {
  return useQuery<OpenAIProviderCredential | null>({
    queryKey: OPENAI_PROVIDER_QUERY_KEYS.detail(providerId ?? 'unknown'),
    queryFn: async () => {
      if (!providerId) {
        return null;
      }

      return getOpenAIProvider({ providerId });
    },
    enabled: Boolean(providerId),
    staleTime: 1000 * 30,
  });
}

export function useAddOpenAIProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: OpenAIProviderCreateInput) => addOpenAIProvider(input),
    onSuccess: (provider) => {
      queryClient.invalidateQueries({ queryKey: OPENAI_PROVIDER_QUERY_KEYS.all });
      queryClient.setQueryData(OPENAI_PROVIDER_QUERY_KEYS.detail(provider.id), provider);
    },
  });
}

export function useUpdateOpenAIProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: OpenAIProviderUpdateInput) => updateOpenAIProvider(input),
    onSuccess: (provider) => {
      queryClient.invalidateQueries({ queryKey: OPENAI_PROVIDER_QUERY_KEYS.all });
      queryClient.setQueryData(OPENAI_PROVIDER_QUERY_KEYS.detail(provider.id), provider);
    },
  });
}

export function useDeleteOpenAIProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ providerId }: { providerId: string }) => deleteOpenAIProvider({ providerId }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: OPENAI_PROVIDER_QUERY_KEYS.all });
      queryClient.removeQueries({
        queryKey: OPENAI_PROVIDER_QUERY_KEYS.detail(variables.providerId),
      });
    },
  });
}

export function useRefreshOpenAIProviderState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ providerId }: { providerId: string }) =>
      refreshOpenAIProviderState({ providerId }),
    onSuccess: (provider) => {
      queryClient.invalidateQueries({ queryKey: OPENAI_PROVIDER_QUERY_KEYS.all });
      queryClient.setQueryData(OPENAI_PROVIDER_QUERY_KEYS.detail(provider.id), provider);
    },
  });
}

export function useRefreshAllOpenAIProviderStates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshAllOpenAIProviderStates,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OPENAI_PROVIDER_QUERY_KEYS.all });
    },
  });
}
