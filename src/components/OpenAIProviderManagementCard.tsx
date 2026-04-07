import { useMemo, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  useAddOpenAIProvider,
  useDeleteOpenAIProvider,
  useOpenAIProviders,
  useRefreshAllOpenAIProviderStates,
  useRefreshOpenAIProviderState,
  useUpdateOpenAIProvider,
} from '@/hooks/useOpenAIProviders';
import { Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'N/D';
  }

  return new Intl.NumberFormat('es-ES').format(value);
}

function formatCurrency(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'N/D';
  }

  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: (currency || 'USD').toUpperCase(),
  }).format(value);
}

function formatDate(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 'N/D';
  }

  return new Date(value * 1000).toLocaleString('es-ES');
}

export function OpenAIProviderManagementCard() {
  const { toast } = useToast();
  const { data: providers, isLoading } = useOpenAIProviders();
  const addProviderMutation = useAddOpenAIProvider();
  const updateProviderMutation = useUpdateOpenAIProvider();
  const deleteProviderMutation = useDeleteOpenAIProvider();
  const refreshProviderMutation = useRefreshOpenAIProviderState();
  const refreshAllMutation = useRefreshAllOpenAIProviderStates();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [enabled, setEnabled] = useState(true);

  const providerCount = providers?.length ?? 0;
  const healthyCount = useMemo(() => {
    return (providers ?? []).filter((provider) => provider.state.health.status === 'healthy')
      .length;
  }, [providers]);

  const resetForm = () => {
    setLabel('');
    setApiKey('');
    setOrganizationId('');
    setProjectId('');
    setBaseUrl('https://api.openai.com/v1');
    setEnabled(true);
  };

  const handleCreate = () => {
    addProviderMutation.mutate(
      {
        label,
        apiKey,
        organizationId: organizationId.trim() || null,
        projectId: projectId.trim() || null,
        baseUrl: baseUrl.trim() || null,
        enabled,
      },
      {
        onSuccess: (provider) => {
          setIsDialogOpen(false);
          resetForm();
          refreshProviderMutation.mutate({ providerId: provider.id });
          toast({
            title: 'Proveedor agregado',
            description: 'La credencial oficial de OpenAI ya esta almacenada y cifrada.',
          });
        },
        onError: (error) => {
          toast({
            title: 'No se pudo agregar el proveedor',
            description: String(error),
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleToggleEnabled = (providerId: string, nextEnabled: boolean) => {
    updateProviderMutation.mutate(
      {
        providerId,
        enabled: nextEnabled,
      },
      {
        onError: (error) => {
          toast({
            title: 'No se pudo actualizar el proveedor',
            description: String(error),
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleDelete = (providerId: string) => {
    deleteProviderMutation.mutate(
      { providerId },
      {
        onError: (error) => {
          toast({
            title: 'No se pudo eliminar el proveedor',
            description: String(error),
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleRefreshOne = (providerId: string) => {
    refreshProviderMutation.mutate(
      { providerId },
      {
        onError: (error) => {
          toast({
            title: 'No se pudo refrescar el estado',
            description: String(error),
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleRefreshAll = () => {
    refreshAllMutation.mutate(undefined, {
      onError: (error) => {
        toast({
          title: 'No se pudo refrescar el pool',
          description: String(error),
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Pool oficial OpenAI API</CardTitle>
            <CardDescription>
              Gestiona API keys oficiales para el proxy local. Para métricas completas de uso/coste,
              la credencial debe tener acceso a endpoints administrativos.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleRefreshAll}
              disabled={refreshAllMutation.isPending}
            >
              {refreshAllMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refrescar pool
            </Button>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar proveedor
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-muted-foreground text-xs uppercase">Proveedores</div>
            <div className="mt-2 text-2xl font-semibold">{providerCount}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-muted-foreground text-xs uppercase">Saludables</div>
            <div className="mt-2 text-2xl font-semibold">{healthyCount}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-muted-foreground text-xs uppercase">Uso transparente</div>
            <div className="mt-2 text-sm font-medium">
              GPT/o-models entran por el proxy local y rotan sin reiniciar el cliente.
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : providerCount === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
            Todavia no hay proveedores OpenAI configurados.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(providers ?? []).map((provider) => (
              <div key={provider.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{provider.label}</div>
                    <div className="text-muted-foreground mt-1 font-mono text-xs">
                      {provider.api_key_preview}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      Estado: <span className="font-medium">{provider.state.health.status}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`provider-enabled-${provider.id}`} className="text-xs">
                        Activo
                      </Label>
                      <Switch
                        id={`provider-enabled-${provider.id}`}
                        checked={provider.enabled}
                        onCheckedChange={(checked) => handleToggleEnabled(provider.id, checked)}
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleRefreshOne(provider.id)}
                      disabled={refreshProviderMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => handleDelete(provider.id)}
                      disabled={deleteProviderMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground text-xs uppercase">Project ID</div>
                    <div className="mt-1 text-xs break-all">{provider.project_id || 'N/D'}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground text-xs uppercase">Admin APIs</div>
                    <div className="mt-1 text-xs">
                      {provider.state.admin_api_available === null
                        ? 'No verificado'
                        : provider.state.admin_api_available
                          ? 'Disponible'
                          : 'No disponible'}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground text-xs uppercase">
                      Modelos detectados
                    </div>
                    <div className="mt-1 text-xs">
                      {provider.state.availableModels?.length
                        ? `${provider.state.availableModels.length} modelos`
                        : 'N/D'}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground text-xs uppercase">Ultimo refresh</div>
                    <div className="mt-1 text-xs">
                      {formatDate(provider.state.last_refreshed_at)}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground text-xs uppercase">Solicitudes 30d</div>
                    <div className="mt-1 text-xs">
                      {formatNumber(provider.state.usage?.totalRequests ?? null)}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-muted-foreground text-xs uppercase">Coste 30d</div>
                    <div className="mt-1 text-xs">
                      {formatCurrency(
                        provider.state.usage?.totalCostUsd ?? null,
                        provider.state.usage?.currency,
                      )}
                    </div>
                  </div>
                </div>

                {provider.state.health.lastErrorMessage && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Ultimo hallazgo
                    </div>
                    <div>{provider.state.health.lastErrorMessage}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar proveedor OpenAI oficial</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-provider-label">Etiqueta</Label>
              <Input
                id="openai-provider-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Cuenta principal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="openai-provider-key">API key</Label>
              <Input
                id="openai-provider-key"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-..."
                type="password"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="openai-provider-org">Organization ID</Label>
                <Input
                  id="openai-provider-org"
                  value={organizationId}
                  onChange={(event) => setOrganizationId(event.target.value)}
                  placeholder="org_..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai-provider-project">Project ID</Label>
                <Input
                  id="openai-provider-project"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  placeholder="proj_..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openai-provider-baseurl">Base URL</Label>
              <Input
                id="openai-provider-baseurl"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Activar al guardar</div>
                <div className="text-muted-foreground text-xs">
                  Si está activo, el scheduler podrá seleccionarlo de inmediato.
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={addProviderMutation.isPending || !label.trim() || !apiKey.trim()}
            >
              {addProviderMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Guardar proveedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
