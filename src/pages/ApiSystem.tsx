import React from 'react';

function ApiSystem() {
  return (
    <div className="flex flex-col h-full w-full bg-[#faf8f5] dark:bg-base-300">
      <div className="flex-1 w-full h-full relative">
        <iframe
          src="http://127.0.0.1:3001"
          className="absolute inset-0 w-full h-full border-none"
          title="API System"
          allow="microphone; camera; clipboard-read; clipboard-write; display-capture"
        />
      </div>
    </div>
  );
}

export default ApiSystem;
