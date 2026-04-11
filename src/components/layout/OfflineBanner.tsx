import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="sticky top-0 z-30 bg-warning/15 border-b border-warning/30 px-4 py-2 text-sm text-warning-foreground flex items-center gap-2 justify-center">
      <WifiOff className="h-4 w-4" />
      <span>Vous êtes hors-ligne — Seuls vos documents épinglés sont accessibles</span>
      <Link to="/offline" className="underline font-medium ml-1">
        Voir mes documents épinglés
      </Link>
    </div>
  );
}
