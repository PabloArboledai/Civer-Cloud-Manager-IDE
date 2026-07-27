import React from 'react';

function Md5Viewer() {
  return (
    <div className="flex flex-col h-full w-full bg-[#faf8f5] dark:bg-base-300">
      <div className="flex-1 w-full h-full relative">
        <iframe
          src="http://127.0.0.1:3011"
          className="absolute inset-0 w-full h-full border-none"
          title="MD5 Viewer"
          allow="microphone; camera; clipboard-read; clipboard-write; display-capture"
        />
      </div>
    </div>
  );
}

export default Md5Viewer;
