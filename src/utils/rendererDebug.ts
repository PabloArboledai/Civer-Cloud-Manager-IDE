import type { QueryClient } from '@tanstack/react-query';

import { DEBUG_HEARTBEAT_INTERVAL_MS, createDebugEvent, formatDebugEvent } from '@/utils/debug';

const DEBUG_INSTRUMENTATION_ENABLED = process.env.NODE_ENV !== 'production';
const SENSITIVE_FIELD_PATTERN = /(password|token|secret|key|auth|code|otp|pin)/i;
const instrumentedQueryClients = new WeakSet<QueryClient>();

interface RendererDebugOptions {
  getHeartbeatDetail?: () => unknown;
}

let isRendererInstrumentationInstalled = false;

function truncatePreview(value: string, maxLength = 80): string | undefined {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function isSensitiveField(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): boolean {
  const targetName = [element.name, element.id, element.getAttribute('autocomplete')]
    .filter(Boolean)
    .join(' ');

  if (element instanceof HTMLInputElement && element.type === 'password') {
    return true;
  }

  return SENSITIVE_FIELD_PATTERN.test(targetName);
}

function describeElement(target: EventTarget | Element | null): Record<string, unknown> | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }

  const htmlElement = target as HTMLElement;
  const previewText =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
      ? undefined
      : truncatePreview(htmlElement.innerText || htmlElement.textContent || '');

  return {
    tag: target.tagName.toLowerCase(),
    id: htmlElement.id || undefined,
    name: target.getAttribute('name') || undefined,
    role: target.getAttribute('role') || undefined,
    title: target.getAttribute('title') || undefined,
    ariaLabel: target.getAttribute('aria-label') || undefined,
    type:
      target instanceof HTMLButtonElement ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement
        ? target.type
        : undefined,
    href: target instanceof HTMLAnchorElement ? target.href : undefined,
    dataSlot: target.getAttribute('data-slot') || undefined,
    text: previewText,
  };
}

function describeValue(
  target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): Record<string, unknown> {
  if (target instanceof HTMLSelectElement) {
    return {
      value: truncatePreview(target.value),
      selectedIndex: target.selectedIndex,
    };
  }

  if (target instanceof HTMLInputElement && ['checkbox', 'radio'].includes(target.type)) {
    return {
      checked: target.checked,
    };
  }

  if (isSensitiveField(target)) {
    return {
      masked: true,
      length: target.value.length,
    };
  }

  return {
    masked: true,
    length: target.value.length,
  };
}

function findInteractiveTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest('button, a, input, select, textarea, form, [role="button"], [data-slot]');
}

function dispatchRendererDebug(event: ReturnType<typeof createDebugEvent>) {
  try {
    if (window.electron?.debugLog) {
      window.electron.debugLog(event);
      return;
    }
  } catch (error) {
    const bridgeFailure = createDebugEvent('renderer', 'debug-bridge', 'send-failed', { error });
    console.debug(formatDebugEvent(bridgeFailure), bridgeFailure.detail);
  }

  console.debug(formatDebugEvent(event), event.detail);
}

export function emitRendererDebug(source: string, action: string, detail?: unknown) {
  if (!DEBUG_INSTRUMENTATION_ENABLED) {
    return;
  }

  dispatchRendererDebug(createDebugEvent('renderer', source, action, detail));
}

export function installRendererDebugInstrumentation(options?: RendererDebugOptions) {
  if (!DEBUG_INSTRUMENTATION_ENABLED || isRendererInstrumentationInstalled) {
    return () => undefined;
  }

  isRendererInstrumentationInstalled = true;

  const handleClick = (event: MouseEvent) => {
    const element = findInteractiveTarget(event.target);

    if (!element) {
      return;
    }

    emitRendererDebug('ui', 'click', {
      element: describeElement(element),
      button: event.button,
      detail: event.detail,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleSubmit = (event: SubmitEvent) => {
    emitRendererDebug('ui', 'submit', {
      element: describeElement(findInteractiveTarget(event.target)),
    });
  };

  const handleInputLikeEvent = (event: Event) => {
    const target = event.target;

    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    ) {
      return;
    }

    emitRendererDebug('ui', event.type, {
      element: describeElement(target),
      value: describeValue(target),
    });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const target = findInteractiveTarget(event.target);
    const isTextEntryTarget =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
        ? true
        : false;
    const isSensitiveTarget =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
        ? isSensitiveField(target)
        : false;

    emitRendererDebug('ui', 'keydown', {
      element: describeElement(target),
      key:
        isTextEntryTarget && event.key.length === 1
          ? '[character]'
          : isSensitiveTarget && event.key.length > 0
            ? '[masked-key]'
            : event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
    });
  };

  const handleFocusEvent = (event: FocusEvent) => {
    emitRendererDebug('ui', event.type, {
      element: describeElement(findInteractiveTarget(event.target)),
    });
  };

  const handleVisibilityChange = () => {
    emitRendererDebug('window', 'visibilitychange', {
      visibilityState: document.visibilityState,
      hasFocus: document.hasFocus(),
    });
  };

  const handleWindowFocus = () => {
    emitRendererDebug('window', 'focus', {
      visibilityState: document.visibilityState,
    });
  };

  const handleWindowBlur = () => {
    emitRendererDebug('window', 'blur', {
      visibilityState: document.visibilityState,
    });
  };

  const handleError = (event: ErrorEvent) => {
    emitRendererDebug('window', 'error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    emitRendererDebug('window', 'unhandledrejection', {
      reason: event.reason,
    });
  };

  emitRendererDebug('renderer', 'instrumentation-attached', {
    language: navigator.language,
    userAgent: navigator.userAgent,
  });

  document.addEventListener('click', handleClick, true);
  document.addEventListener('submit', handleSubmit, true);
  document.addEventListener('input', handleInputLikeEvent, true);
  document.addEventListener('change', handleInputLikeEvent, true);
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('focusin', handleFocusEvent, true);
  document.addEventListener('focusout', handleFocusEvent, true);
  document.addEventListener('visibilitychange', handleVisibilityChange, true);
  window.addEventListener('focus', handleWindowFocus, true);
  window.addEventListener('blur', handleWindowBlur, true);
  window.addEventListener('error', handleError, true);
  window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

  const heartbeatId = window.setInterval(() => {
    emitRendererDebug('renderer', 'heartbeat', {
      hasFocus: document.hasFocus(),
      visibilityState: document.visibilityState,
      activeElement: describeElement(document.activeElement),
      ...(options?.getHeartbeatDetail?.() ?? {}),
    });
  }, DEBUG_HEARTBEAT_INTERVAL_MS);

  return () => {
    window.clearInterval(heartbeatId);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('submit', handleSubmit, true);
    document.removeEventListener('input', handleInputLikeEvent, true);
    document.removeEventListener('change', handleInputLikeEvent, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('focusin', handleFocusEvent, true);
    document.removeEventListener('focusout', handleFocusEvent, true);
    document.removeEventListener('visibilitychange', handleVisibilityChange, true);
    window.removeEventListener('focus', handleWindowFocus, true);
    window.removeEventListener('blur', handleWindowBlur, true);
    window.removeEventListener('error', handleError, true);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
    isRendererInstrumentationInstalled = false;
  };
}

export function attachQueryClientDebugLogging(queryClient: QueryClient) {
  if (!DEBUG_INSTRUMENTATION_ENABLED || instrumentedQueryClients.has(queryClient)) {
    return () => undefined;
  }

  instrumentedQueryClients.add(queryClient);

  const unsubscribeQueryCache = queryClient.getQueryCache().subscribe((event) => {
    if (!event?.query) {
      return;
    }

    emitRendererDebug('query-cache', event.type, {
      queryKey: event.query.queryKey,
      status: event.query.state.status,
      fetchStatus: event.query.state.fetchStatus,
      isInvalidated: event.query.state.isInvalidated,
      fetchFailureCount: event.query.state.fetchFailureCount,
      dataUpdatedAt: event.query.state.dataUpdatedAt,
      errorUpdatedAt: event.query.state.errorUpdatedAt,
    });
  });

  const unsubscribeMutationCache = queryClient.getMutationCache().subscribe((event) => {
    if (!event?.mutation) {
      return;
    }

    emitRendererDebug('mutation-cache', event.type, {
      mutationKey: event.mutation.options.mutationKey,
      status: event.mutation.state.status,
      submittedAt: event.mutation.state.submittedAt,
      variables: event.mutation.state.variables,
      error: event.mutation.state.error,
    });
  });

  emitRendererDebug('query-client', 'subscriptions-attached');

  return () => {
    unsubscribeQueryCache();
    unsubscribeMutationCache();
    instrumentedQueryClients.delete(queryClient);
  };
}
