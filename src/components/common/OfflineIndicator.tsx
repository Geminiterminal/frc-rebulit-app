import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600/95 border border-amber-500/50 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm animate-pulse">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — All data saves locally to device</span>
    </div>
  );
};
