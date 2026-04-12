import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';

function formatPinSize(bytes: number, language: 'fr' | 'en') {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return language === 'fr' ? `${mb.toFixed(1)} Mo` : `${mb.toFixed(1)} MB`;
  }
  const kb = bytes / 1024;
  return language === 'fr' ? `${Math.round(kb)} Ko` : `${Math.round(kb)} KB`;
}

type PinSizeConfirmContextValue = {
  requestPinSizeConfirm: (bytes: number) => Promise<boolean>;
};

const PinSizeConfirmContext = createContext<PinSizeConfirmContextValue | null>(null);

export function PinSizeConfirmProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [sizeBytes, setSizeBytes] = useState(0);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const requestPinSizeConfirm = useCallback((bytes: number) => {
    setSizeBytes(bytes);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const finish = useCallback((ok: boolean) => {
    const r = resolverRef.current;
    if (!r) return;
    resolverRef.current = null;
    r(ok);
    setOpen(false);
  }, []);

  return (
    <PinSizeConfirmContext.Provider value={{ requestPinSizeConfirm }}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) finish(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'fr' ? 'Épingler hors-ligne' : 'Pin for offline'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'fr'
                ? `Ce document fait ${formatPinSize(sizeBytes, language)}. Voulez-vous l'épingler pour hors-ligne ?`
                : `This document is ${formatPinSize(sizeBytes, language)}. Pin it for offline access?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => finish(false)}>
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => finish(true)}>
              {language === 'fr' ? 'Épingler' : 'Pin'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PinSizeConfirmContext.Provider>
  );
}

export function usePinSizeConfirm(): (bytes: number) => Promise<boolean> {
  const ctx = useContext(PinSizeConfirmContext);
  return ctx?.requestPinSizeConfirm ?? (async () => true);
}
