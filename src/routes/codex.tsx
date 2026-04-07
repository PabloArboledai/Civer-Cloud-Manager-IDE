import { createFileRoute } from '@tanstack/react-router';
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TerminalSquare,
  Loader2,
  RefreshCw,
  ShieldCheck,
  PlugZap,
  Play,
  Square,
  LogIn,
  LogOut,
  FolderOpen,
  SearchCode,
  Cpu,
  UserRound,
  Mail,
  Building2,
  BadgeCheck,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  CODEX_STATUS_QUERY_KEY,
  useAnalyzeCodexCallback,
  useCancelCodexExec,
  useCodexRun,
  useCodexStatus,
  useLogoutCodex,
  useOpenCodexHome,
  useOpenCodexLogin,
  useStartCodexExec,
} from '@/hooks/useCodex';
import type {
  CodexCallbackDiagnostics,
  CodexExecEvent,
  CodexExecRunSnapshot,
  CodexStatusSnapshot,
} from '@/types/codex';
import { useQueryClient } from '@tanstack/react-query';

const MAX_VISIBLE_EVENTS = 200;

function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'danger'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}
    >
      {label}
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border p-3">
      <span className="text-muted-foreground text-xs uppercase">{label}</span>
      <span className="font-mono text-xs break-all">{value || 'N/D'}</span>
    </div>
  );
}

function formatEventLine(event: CodexExecEvent): string {
  if (event.line) {
    return event.line;
  }
  if (event.parsed) {
    try {
      return JSON.stringify(event.parsed);
    } catch {
      return '[evento no serializable]';
    }
  }
  return event.kind;
}

function formatTimestampLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatBooleanLabel(value: boolean | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value ? 'Si' : 'No';
}

function CodexIdentityCard({
  auth,
}: {
  auth: CodexStatusSnapshot['auth'] | undefined;
}) {
  const identity = auth?.identity;
  const stateTone = auth?.isAuthenticated ? 'success' : 'warning';

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4" />
              Identidad local de Codex / ChatGPT
            </CardTitle>
            <CardDescription>
              Tarjeta segura de la sesion activa compartida en <code>~/.codex</code>. Esto no se
              mezcla con el pool de Google en <code>Accounts</code>.
            </CardDescription>
          </div>
          <StatusPill label={auth?.loginLabel || 'Sin datos'} tone={stateTone} />
        </div>
        <div className="flex flex-wrap gap-2">
          {identity?.planType ? (
            <StatusPill label={`Plan: ${identity.planType}`} tone="neutral" />
          ) : null}
          {identity?.defaultOrganization?.titleMasked ? (
            <StatusPill
              label={`Org: ${identity.defaultOrganization.titleMasked}`}
              tone="neutral"
            />
          ) : null}
          {identity?.defaultOrganization?.role ? (
            <StatusPill label={`Rol: ${identity.defaultOrganization.role}`} tone="neutral" />
          ) : null}
          {identity?.emailVerified !== null && identity?.emailVerified !== undefined ? (
            <StatusPill
              label={identity.emailVerified ? 'Email verificado' : 'Email sin verificar'}
              tone={identity.emailVerified ? 'success' : 'warning'}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {auth?.isAuthenticated ? (
          identity ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryRow label="Cuenta" value={identity.accountIdMasked} />
                <SummaryRow label="Correo" value={identity.emailMasked} />
                <SummaryRow label="Perfil" value={identity.displayNameMasked} />
                <SummaryRow label="Usuario" value={identity.userIdMasked} />
                <SummaryRow label="Proveedor auth" value={identity.authProvider} />
                <SummaryRow
                  label="Callback localhost"
                  value={formatBooleanLabel(identity.localhostCallback)}
                />
                <SummaryRow
                  label="Organizaciones"
                  value={
                    identity.organizationCount !== null && identity.organizationCount !== undefined
                      ? String(identity.organizationCount)
                      : null
                  }
                />
                <SummaryRow label="Platform host" value={identity.platformUrlHost} />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Mail className="h-4 w-4" />
                    Sesion
                  </div>
                  <div className="space-y-3">
                    <SummaryRow label="Ultimo refresh" value={formatTimestampLabel(auth.lastRefresh)} />
                    <SummaryRow
                      label="Expira id_token"
                      value={formatTimestampLabel(identity.idTokenExpiresAt)}
                    />
                    <SummaryRow
                      label="Expira access_token"
                      value={formatTimestampLabel(identity.accessTokenExpiresAt)}
                    />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4" />
                    Organizacion detectada
                  </div>
                  <div className="space-y-3">
                    <SummaryRow
                      label="Organizacion por defecto"
                      value={identity.defaultOrganization?.titleMasked}
                    />
                    <SummaryRow label="Rol" value={identity.defaultOrganization?.role} />
                    <SummaryRow
                      label="Es default"
                      value={formatBooleanLabel(identity.defaultOrganization?.isDefault)}
                    />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <BadgeCheck className="h-4 w-4" />
                    Suscripcion
                  </div>
                  <div className="space-y-3">
                    <SummaryRow label="Plan" value={identity.planType} />
                    <SummaryRow
                      label="Activa desde"
                      value={formatTimestampLabel(identity.subscription?.activeStart)}
                    />
                    <SummaryRow
                      label="Activa hasta"
                      value={formatTimestampLabel(identity.subscription?.activeUntil)}
                    />
                    <SummaryRow
                      label="Ultima verificacion"
                      value={formatTimestampLabel(identity.subscription?.lastChecked)}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              Hay una sesion autenticada, pero el estado local no incluye suficientes claims seguros
              para pintar una tarjeta enriquecida.
            </div>
          )
        ) : (
          <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            Aun no se detecta una sesion local de ChatGPT/Codex en <code>~/.codex</code>.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CodexPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pollTimeoutRef = useRef<number | null>(null);
  const [pollWindowActive, setPollWindowActive] = useState(false);
  const { data, isLoading, isError, error, refetch } = useCodexStatus(
    pollWindowActive ? 3000 : false,
  );
  const loginMutation = useOpenCodexLogin();
  const logoutMutation = useLogoutCodex();
  const openHomeMutation = useOpenCodexHome();
  const analyzeMutation = useAnalyzeCodexCallback();
  const startExecMutation = useStartCodexExec();
  const cancelExecMutation = useCancelCodexExec();

  const defaultCwd =
    typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '';
  const [callbackInput, setCallbackInput] = useState('');
  const [callbackDiagnostics, setCallbackDiagnostics] = useState<CodexCallbackDiagnostics | null>(
    null,
  );
  const [execPrompt, setExecPrompt] = useState('');
  const [execCwd, setExecCwd] = useState(defaultCwd);
  const [execModel, setExecModel] = useState('');
  const [execSandbox, setExecSandbox] = useState<
    'read-only' | 'workspace-write' | 'danger-full-access'
  >('workspace-write');
  const [liveRunSnapshot, setLiveRunSnapshot] = useState<CodexExecRunSnapshot | null>(null);
  const activeRunId =
    liveRunSnapshot?.summary.status === 'running'
      ? liveRunSnapshot.summary.runId
      : data?.lastRun?.status === 'running'
        ? data.lastRun.runId
        : null;
  const { data: storedRunSnapshot } = useCodexRun(activeRunId);
  const runSnapshot = storedRunSnapshot ?? liveRunSnapshot;
  const deferredEvents = useDeferredValue(runSnapshot?.events ?? []);

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!window.electron?.onCodexExecEvent) {
      return;
    }

    return window.electron.onCodexExecEvent((detail) => {
      const event = detail as CodexExecEvent;
      if (!event?.runId) {
        return;
      }

      startTransition(() => {
        setLiveRunSnapshot((previous) => {
          const previousEvents = previous?.summary.runId === event.runId ? previous.events : [];
          const nextEvents = [...previousEvents, event].slice(-MAX_VISIBLE_EVENTS);
          return {
            summary: event.summary,
            events: nextEvents,
          };
        });
      });

      if (event.kind === 'exit' || event.kind === 'error') {
        queryClient.invalidateQueries({ queryKey: CODEX_STATUS_QUERY_KEY });
      }
    });
  }, [queryClient]);

  const installationTone = data?.installation.available ? 'success' : 'danger';
  const authTone = data?.auth.isAuthenticated ? 'success' : 'warning';
  const runTone =
    runSnapshot?.summary.status === 'failed'
      ? 'danger'
      : runSnapshot?.summary.status === 'completed'
        ? 'success'
        : runSnapshot?.summary.status === 'cancelled'
          ? 'warning'
          : 'neutral';

  const execSummary = runSnapshot?.summary ?? data?.lastRun ?? null;
  const warningList = useMemo(() => callbackDiagnostics?.warnings ?? [], [callbackDiagnostics]);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl p-6">
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto max-w-6xl p-6">
        <div className="rounded-lg border border-dashed p-8 text-center">
          <div className="text-lg font-semibold">
            {t('error.generic', 'Ocurrio un error inesperado.')}
          </div>
          <div className="text-muted-foreground mt-2 text-sm">{String(error)}</div>
          <Button className="mt-4" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('action.retry', 'Reintentar')}
          </Button>
        </div>
      </div>
    );
  }

  const handleLogin = () => {
    loginMutation.mutate(undefined, {
      onSuccess: () => {
        setPollWindowActive(true);
        if (pollTimeoutRef.current !== null) {
          window.clearTimeout(pollTimeoutRef.current);
        }
        pollTimeoutRef.current = window.setTimeout(() => {
          setPollWindowActive(false);
        }, 60_000);
        toast({
          title: 'Flujo oficial iniciado',
          description:
            'Se abrio Codex para completar el inicio de sesion. El estado se refrescara automaticamente.',
        });
      },
      onError: (mutationError) => {
        toast({
          title: 'No se pudo iniciar el login',
          description: String(mutationError),
          variant: 'destructive',
        });
      },
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: 'Sesion cerrada',
          description: 'Las credenciales locales de Codex se eliminaron del entorno actual.',
        });
      },
      onError: (mutationError) => {
        toast({
          title: 'No se pudo cerrar la sesion',
          description: String(mutationError),
          variant: 'destructive',
        });
      },
    });
  };

  const handleOpenHome = () => {
    openHomeMutation.mutate(undefined, {
      onError: (mutationError) => {
        toast({
          title: 'No se pudo abrir la carpeta',
          description: String(mutationError),
          variant: 'destructive',
        });
      },
    });
  };

  const handleAnalyzeCallback = () => {
    analyzeMutation.mutate(
      { input: callbackInput },
      {
        onSuccess: (result) => {
          setCallbackDiagnostics(result);
        },
        onError: (mutationError) => {
          toast({
            title: 'No se pudo analizar el callback',
            description: String(mutationError),
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleStartExec = () => {
    startExecMutation.mutate(
      {
        prompt: execPrompt,
        cwd: execCwd,
        model: execModel || undefined,
        sandbox: execSandbox,
        skipGitRepoCheck: false,
        fullAuto: false,
      },
      {
        onSuccess: (result) => {
          setLiveRunSnapshot(result);
          toast({
            title: 'Ejecucion iniciada',
            description: 'Codex exec se esta ejecutando con stream de eventos en vivo.',
          });
        },
        onError: (mutationError) => {
          toast({
            title: 'No se pudo iniciar la ejecucion',
            description: String(mutationError),
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleCancelExec = () => {
    if (!runSnapshot?.summary.runId) {
      return;
    }

    cancelExecMutation.mutate(
      { runId: runSnapshot.summary.runId },
      {
        onSuccess: () => {
          toast({
            title: 'Cancelacion solicitada',
            description: 'Se envio la senal de cancelacion al proceso de Codex.',
          });
        },
        onError: (mutationError) => {
          toast({
            title: 'No se pudo cancelar la ejecucion',
            description: String(mutationError),
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-xl">
              <TerminalSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Codex</h2>
              <p className="text-muted-foreground">
                Soporte para instalacion local, estado seguro de sesion, diagnostico de callbacks y
                ejecucion no interactiva.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refrescar
          </Button>
          <Button variant="outline" onClick={handleOpenHome} disabled={openHomeMutation.isPending}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Abrir .codex
          </Button>
          <Button
            onClick={handleLogin}
            disabled={loginMutation.isPending || !data?.installation.available}
          >
            {loginMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="mr-2 h-4 w-4" />
            )}
            Iniciar sesion
          </Button>
          <Button
            variant="destructive"
            onClick={handleLogout}
            disabled={logoutMutation.isPending || !data?.auth.isAuthenticated}
          >
            {logoutMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            Cerrar sesion
          </Button>
        </div>
      </div>

      <div className="bg-muted/40 rounded-lg border border-dashed p-4">
        <div className="text-sm font-semibold">
          Codex y ChatGPT se gestionan aqui, no en Accounts
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Antigravity detecta el estado compartido de <code className="font-mono">~/.codex</code>,
          incluyendo sesiones creadas por el CLI oficial y por la extension oficial de VS Code / VS
          Code Insiders. Si completas el login fuera de esta ventana, vuelve aqui y pulsa
          <span className="font-medium"> Refrescar</span>.
        </p>
      </div>

      <CodexIdentityCard auth={data?.auth} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <PlugZap className="h-4 w-4" />
              Instalacion
            </CardTitle>
            <CardDescription>Deteccion del binario y del home local de Codex.</CardDescription>
            <StatusPill
              label={data?.installation.available ? 'Disponible' : 'No detectada'}
              tone={installationTone}
            />
          </CardHeader>
          <CardContent className="grid gap-3">
            <SummaryRow label="Origen" value={data?.installation.source} />
            <SummaryRow label="Ejecutable" value={data?.installation.executablePath} />
            <SummaryRow label="Version" value={data?.installation.version} />
            <SummaryRow label="Home" value={data?.installation.codexHome} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Sesion
            </CardTitle>
            <CardDescription>
              Lectura segura y redactada del estado local de autenticacion.
            </CardDescription>
            <StatusPill label={data?.auth.loginLabel || 'Sin datos'} tone={authTone} />
          </CardHeader>
          <CardContent className="grid gap-3">
            <SummaryRow label="Modo" value={data?.auth.authMode} />
            <SummaryRow label="Cuenta" value={data?.auth.accountIdMasked} />
            <SummaryRow label="Ultimo refresh" value={data?.auth.lastRefresh} />
            <div className="flex flex-wrap gap-2">
              <StatusPill label={`access_token: ${data?.auth.hasAccessToken ? 'si' : 'no'}`} />
              <StatusPill label={`refresh_token: ${data?.auth.hasRefreshToken ? 'si' : 'no'}`} />
              <StatusPill label={`id_token: ${data?.auth.hasIdToken ? 'si' : 'no'}`} />
              <StatusPill label={`api_key: ${data?.auth.hasApiKey ? 'si' : 'no'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Configuracion
            </CardTitle>
            <CardDescription>Snapshot seguro del archivo `config.toml` local.</CardDescription>
            <StatusPill label={execSummary ? execSummary.status : 'Sin ejecucion'} tone={runTone} />
          </CardHeader>
          <CardContent className="grid gap-3">
            <SummaryRow label="Modelo" value={data?.config.model} />
            <SummaryRow label="Reasoning" value={data?.config.modelReasoningEffort} />
            <SummaryRow label="Perfil" value={data?.config.profile} />
            <SummaryRow label="Sandbox" value={data?.config.sandboxMode} />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="exec" className="space-y-4">
        <TabsList>
          <TabsTrigger value="exec">Ejecucion</TabsTrigger>
          <TabsTrigger value="callback">Callback localhost</TabsTrigger>
        </TabsList>

        <TabsContent value="exec" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ejecucion `codex exec --json`</CardTitle>
              <CardDescription>
                Lanza una tarea no interactiva y recibe eventos JSONL por streaming en la UI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="codex-exec-cwd">Directorio de trabajo</Label>
                  <Input
                    id="codex-exec-cwd"
                    value={execCwd}
                    onChange={(event) => setExecCwd(event.target.value)}
                    placeholder="C:\\ruta\\del\\repositorio"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codex-exec-model">Modelo opcional</Label>
                  <Input
                    id="codex-exec-model"
                    value={execModel}
                    onChange={(event) => setExecModel(event.target.value)}
                    placeholder={data?.config.model || 'gpt-5.4'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="codex-exec-sandbox">Sandbox</Label>
                <Select
                  value={execSandbox}
                  onValueChange={(value: 'read-only' | 'workspace-write' | 'danger-full-access') =>
                    setExecSandbox(value)
                  }
                >
                  <SelectTrigger id="codex-exec-sandbox">
                    <SelectValue placeholder="Selecciona un modo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read-only">read-only</SelectItem>
                    <SelectItem value="workspace-write">workspace-write</SelectItem>
                    <SelectItem value="danger-full-access">danger-full-access</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="codex-exec-prompt">Prompt</Label>
                <textarea
                  id="codex-exec-prompt"
                  className="border-input bg-background min-h-36 w-full rounded-md border px-3 py-2 text-sm"
                  value={execPrompt}
                  onChange={(event) => setExecPrompt(event.target.value)}
                  placeholder="Describe la tarea que quieres ejecutar con Codex..."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleStartExec}
                  disabled={
                    startExecMutation.isPending ||
                    !execPrompt.trim() ||
                    !execCwd.trim() ||
                    execSummary?.status === 'running'
                  }
                >
                  {startExecMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Ejecutar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelExec}
                  disabled={cancelExecMutation.isPending || execSummary?.status !== 'running'}
                >
                  {cancelExecMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="mr-2 h-4 w-4" />
                  )}
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumen de ejecucion</CardTitle>
              <CardDescription>
                Ultimo snapshot conocido del proceso actual o mas reciente.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryRow label="Run ID" value={execSummary?.runId} />
              <SummaryRow label="Estado" value={execSummary?.status} />
              <SummaryRow label="Comando" value={execSummary?.commandPreview} />
              <SummaryRow label="Ultimo mensaje" value={execSummary?.lastMessage} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stream de eventos</CardTitle>
              <CardDescription>
                Se muestran los ultimos {MAX_VISIBLE_EVENTS} eventos conocidos del run activo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 max-h-[420px] overflow-auto rounded-lg border p-3 font-mono text-xs">
                {deferredEvents.length === 0 ? (
                  <div className="text-muted-foreground">Todavia no hay eventos de ejecucion.</div>
                ) : (
                  deferredEvents.map((event) => (
                    <div
                      key={`${event.runId}-${event.at}-${event.kind}`}
                      className="border-border/60 border-b py-2 last:border-b-0"
                    >
                      <div className="text-muted-foreground mb-1">
                        [{event.at}] {event.kind}
                      </div>
                      <div className="break-words whitespace-pre-wrap">
                        {formatEventLine(event)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="callback" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SearchCode className="h-4 w-4" />
                Diagnostico seguro del login Codex
              </CardTitle>
              <CardDescription>
                Pega la URL de autorizacion de <code className="font-mono">auth.openai.com</code>,
                la URL del callback <code className="font-mono">localhost</code> o solo la query
                string para estudiar el flujo sin exponer secretos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="codex-callback-input">Callback</Label>
                <textarea
                  id="codex-callback-input"
                  className="border-input bg-background min-h-36 w-full rounded-md border px-3 py-2 text-sm"
                  value={callbackInput}
                  onChange={(event) => setCallbackInput(event.target.value)}
                  placeholder="https://auth.openai.com/oauth/authorize?... o http://localhost:1455/success?... o solo needs_setup=false&id_token=..."
                />
              </div>
              <Button
                onClick={handleAnalyzeCallback}
                disabled={analyzeMutation.isPending || !callbackInput.trim()}
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <SearchCode className="mr-2 h-4 w-4" />
                )}
                Analizar callback
              </Button>
            </CardContent>
          </Card>

          {callbackDiagnostics && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Resultado del analisis</CardTitle>
                  <CardDescription>
                    Vista normalizada y sin secretos de la URL analizada.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryRow label="Valido" value={callbackDiagnostics.valid ? 'si' : 'no'} />
                  <SummaryRow
                    label="Tipo de flujo"
                    value={callbackDiagnostics.queryFlags.flowType}
                  />
                  <SummaryRow label="Host" value={callbackDiagnostics.host} />
                  <SummaryRow label="Puerto" value={callbackDiagnostics.port?.toString()} />
                  <SummaryRow label="Ruta" value={callbackDiagnostics.path} />
                  <SummaryRow label="URL redactada" value={callbackDiagnostics.normalizedUrl} />
                  <SummaryRow
                    label="Parametros"
                    value={callbackDiagnostics.parameterNames.join(', ')}
                  />
                  <SummaryRow
                    label="Parametros sensibles"
                    value={callbackDiagnostics.sensitiveParams.join(', ')}
                  />
                  <SummaryRow
                    label="Plan / needs_setup"
                    value={`${callbackDiagnostics.queryFlags.planType || 'N/D'} / ${callbackDiagnostics.queryFlags.needsSetup === null ? 'N/D' : callbackDiagnostics.queryFlags.needsSetup ? 'true' : 'false'}`}
                  />
                  <SummaryRow
                    label="redirect_uri host"
                    value={callbackDiagnostics.queryFlags.redirectUriHost}
                  />
                  <SummaryRow
                    label="originator"
                    value={callbackDiagnostics.queryFlags.originator}
                  />
                  <SummaryRow
                    label="state / challenge"
                    value={`${callbackDiagnostics.queryFlags.hasState ? 'si' : 'no'} / ${callbackDiagnostics.queryFlags.hasCodeChallenge ? 'si' : 'no'}`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Advertencias</CardTitle>
                  <CardDescription>Hallazgos relevantes del analizador.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {warningList.length === 0 ? (
                    <StatusPill label="Sin advertencias" tone="success" />
                  ) : (
                    warningList.map((warning) => (
                      <div
                        key={warning}
                        className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
                      >
                        {warning}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Metadatos del token</CardTitle>
                  <CardDescription>
                    Solo se muestran campos no sensibles utiles para compatibilidad.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryRow label="alg" value={callbackDiagnostics.tokenMetadata?.header?.alg} />
                  <SummaryRow label="typ" value={callbackDiagnostics.tokenMetadata?.header?.typ} />
                  <SummaryRow label="kid" value={callbackDiagnostics.tokenMetadata?.header?.kid} />
                  <SummaryRow
                    label="issuer"
                    value={callbackDiagnostics.tokenMetadata?.claims?.issuer}
                  />
                  <SummaryRow
                    label="audienceCount"
                    value={callbackDiagnostics.tokenMetadata?.claims?.audienceCount?.toString()}
                  />
                  <SummaryRow
                    label="issuedAt"
                    value={callbackDiagnostics.tokenMetadata?.claims?.issuedAt}
                  />
                  <SummaryRow
                    label="expiresAt"
                    value={callbackDiagnostics.tokenMetadata?.claims?.expiresAt}
                  />
                  <SummaryRow
                    label="planType"
                    value={callbackDiagnostics.tokenMetadata?.claims?.planType}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const Route = createFileRoute('/codex')({
  component: CodexPage,
});
