import { invoke } from '@tauri-apps/api/core';

export const logFrontendEvent = async (
  level: 'info' | 'warn' | 'error',
  message: string,
  payload?: any
) => {
  try {
    let payloadStr = '';
    if (payload) {
      payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    }
    
    await invoke('log_frontend_event', {
      level,
      message,
      payload: payloadStr || null
    });
  } catch (e) {
    console.error('Failed to send frontend log to backend:', e);
  }
};

export const setupGlobalTelemetry = () => {
  // Catch unhandled errors
  window.addEventListener('error', (event) => {
    logFrontendEvent('error', `Unhandled Error: ${event.message}`, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.stack
    });
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logFrontendEvent('error', `Unhandled Promise Rejection: ${event.reason}`);
  });

  // Catch global clicks on important elements
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    
    // Only log if the target is a button, link, or has an important class/role
    const isClickable = 
      target.tagName === 'BUTTON' || 
      target.tagName === 'A' || 
      target.getAttribute('role') === 'button' ||
      target.closest('button') ||
      target.closest('a');
      
    if (isClickable) {
      // Find the closest meaningful element
      const element = target.closest('button, a, [role="button"]') || target;
      
      const text = element.textContent?.trim().substring(0, 50);
      const id = element.id;
      const className = element.className;
      const href = element.getAttribute('href');
      
      let description = target.tagName;
      if (text) description += ` "${text}"`;
      if (id) description += ` id="${id}"`;
      if (href) description += ` href="${href}"`;
      
      logFrontendEvent('info', `User clicked ${description}`);
    }
  }, { passive: true });
  
  logFrontendEvent('info', 'Neuralink Telemetry Initialized');
};
