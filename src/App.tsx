import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { LOCAL_STORAGE_KEYS } from '@/constants';
import { getIpcDebugSnapshot } from '@/ipc/manager';
import { attachQueryClientDebugLogging, emitRendererDebug, installRendererDebugInstrumentation } from '@/utils/rendererDebug';
import { updateAppLanguage } from './actions/language';
import { syncWithLocalTheme } from './actions/theme';
import './localization/i18n';
import { router } from './utils/routes';

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const detachRendererDebug = installRendererDebugInstrumentation({
      getHeartbeatDetail: () => ({
        route: {
          pathname: router.state.location.pathname,
          search: router.state.location.searchStr,
        },
        language: document.documentElement.lang,
        ipc: getIpcDebugSnapshot(),
      }),
    });

    emitRendererDebug('app', 'mounted', {
      language: document.documentElement.lang,
      route: router.state.location.pathname,
    });

    return () => {
      emitRendererDebug('app', 'unmounted', {
        route: router.state.location.pathname,
      });
      detachRendererDebug();
    };
  }, []);

  useEffect(() => {
    syncWithLocalTheme();
    updateAppLanguage(i18n);
    if (window.electron?.changeLanguage) {
      window.electron.changeLanguage(i18n.language);
    }
  }, [i18n]);

  useEffect(() => {
    emitRendererDebug('app', 'language-synced', {
      language: i18n.language,
    });
  }, [i18n.language]);

  return <RouterProvider router={router} />;
}

const queryClient = new QueryClient();
attachQueryClientDebugLogging(queryClient);

const root = createRoot(document.getElementById('app')!);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider storageKey={LOCAL_STORAGE_KEYS.THEME} defaultTheme="system">
        <App />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
