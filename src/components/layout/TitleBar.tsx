import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';
import { isTauri } from '../../utils/env';

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    
    const appWindow = getCurrentWindow();
    
    // Check initial state
    appWindow.isMaximized().then(setIsMaximized);
    
    // Listen to resize events to update the maximize icon
    const unlisten = appWindow.onResized(async () => {
      const max = await appWindow.isMaximized();
      setIsMaximized(max);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  if (!isTauri()) return null;

  const appWindow = getCurrentWindow();

  return (
    <div 
      className="h-9 w-full flex items-center justify-between select-none bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-50 flex-shrink-0 relative"
    >
      <div data-tauri-drag-region className="flex-1 flex items-center pl-4 h-full">
        <span data-tauri-drag-region className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Civer Cloud IDE
        </span>
      </div>
      
      <div className="flex h-full">
        <div 
          className="inline-flex justify-center items-center w-12 h-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
          onClick={() => appWindow.minimize()}
        >
          <Minus size={16} />
        </div>
        <div 
          className="inline-flex justify-center items-center w-12 h-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
          onClick={() => appWindow.toggleMaximize()}
        >
          {isMaximized ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 2.5H10.5V10.5H2.5V2.5Z" stroke="currentColor" strokeWidth="1"/>
              <path d="M0.5 0.5H8.5V8.5" stroke="currentColor" strokeWidth="1"/>
            </svg>
          ) : (
            <Square size={14} />
          )}
        </div>
        <div 
          className="inline-flex justify-center items-center w-12 h-full hover:bg-red-500 hover:text-white text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
          onClick={() => appWindow.close()}
        >
          <X size={18} />
        </div>
      </div>
    </div>
  );
}
