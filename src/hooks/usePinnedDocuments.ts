import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePinSizeConfirm } from '@/contexts/PinSizeConfirmContext';
import { getSignedDocumentUrl } from '@/lib/storage';
import {
  pinDocumentOffline,
  unpinDocumentOffline,
  getPinnedDocs,
  getPinnedBlob,
  getPinnedMeta,
  isPinnedOffline,
  type PinnedDocMeta,
} from '@/lib/offlineStorage';

const MAX_PIN_WITHOUT_CONFIRM_BYTES = 500 * 1024;

export interface PinTarget {
  id: string;
  title: string;
  document_type: string;
  tags: string[];
  ocr_text?: string | null;
  confidentiality_level: string;
  current_version: number;
  file_url: string;
  file_size?: number | null;
  department?: { name: string } | null;
}

function mapRowToPinTarget(row: Record<string, unknown>): PinTarget {
  const dept = row.departments as { name: string } | null | undefined;
  return {
    id: row.id as string,
    title: row.title as string,
    document_type: row.document_type as string,
    tags: (row.tags as string[]) || [],
    ocr_text: (row.ocr_text as string | null) ?? null,
    confidentiality_level: row.confidentiality_level as string,
    current_version: row.current_version as number,
    file_url: row.file_url as string,
    file_size: (row.file_size as number | null | undefined) ?? null,
    department: dept?.name ? { name: dept.name } : null,
  };
}

async function resolveEffectiveSizeBytes(doc: PinTarget, signedUrl: string): Promise<number | null> {
  if (doc.file_size != null && doc.file_size > 0) return doc.file_size;
  try {
    const headRes = await fetch(signedUrl, { method: 'HEAD' });
    const cl = headRes.headers.get('Content-Length');
    if (cl) {
      const n = parseInt(cl, 10);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function hasCompleteLocalPin(documentId: string): Promise<boolean> {
  const meta = await getPinnedMeta(documentId);
  if (!meta) return false;
  const blob = await getPinnedBlob(documentId);
  return !!blob;
}

export function usePinnedDocuments() {
  const { user, profile, isClientAdmin } = useAuth();
  const { language } = useLanguage();
  const requestPinSizeConfirm = usePinSizeConfirm();
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [pinningIds, setPinningIds] = useState<Set<string>>(new Set());
  const [pinnedDocs, setPinnedDocs] = useState<PinnedDocMeta[]>([]);

  useEffect(() => {
    getPinnedDocs()
      .then((docs) => {
        setPinnedIds(new Set(docs.map((d) => d.id)));
        setPinnedDocs(docs);
      })
      .catch(() => {});
  }, []);

  const refreshPinnedDocs = useCallback(async () => {
    try {
      const docs = await getPinnedDocs();
      setPinnedIds(new Set(docs.map((d) => d.id)));
      setPinnedDocs(docs);
    } catch {
      /* ignore */
    }
  }, []);

  const hydratePinnedFromServer = useCallback(async () => {
    if (!user || isClientAdmin || typeof navigator === 'undefined' || !navigator.onLine) return;

    try {
      const { data: pinRows, error } = await supabase
        .from('pinned_documents')
        .select('document_id')
        .eq('user_id', user.id);

      if (error || !pinRows?.length) return;

      const missingIds: string[] = [];
      for (const row of pinRows) {
        const complete = await hasCompleteLocalPin(row.document_id);
        if (!complete) missingIds.push(row.document_id);
      }
      if (!missingIds.length) return;

      const { data: docs, error: docErr } = await supabase
        .from('documents')
        .select(
          `id, title, document_type, tags, ocr_text, confidentiality_level, current_version, file_url, file_size,
           departments!documents_department_id_fkey(name)`,
        )
        .in('id', missingIds)
        .is('deleted_at', null);

      if (docErr || !docs?.length) return;

      for (const raw of docs) {
        const row = raw as Record<string, unknown>;
        if (row.confidentiality_level === 'confidential') continue;

        const doc = mapRowToPinTarget(row);
        const signedUrl = await getSignedDocumentUrl(doc.file_url, 3600, doc.id);
        if (!signedUrl) continue;

        const response = await fetch(signedUrl);
        if (!response.ok) continue;
        const blob = await response.blob();

        const meta: PinnedDocMeta = {
          id: doc.id,
          title: doc.title,
          document_type: doc.document_type,
          tags: doc.tags || [],
          ocr_text: doc.ocr_text || null,
          confidentiality_level: doc.confidentiality_level,
          current_version: doc.current_version,
          pinned_version: doc.current_version,
          pinned_at: new Date().toISOString(),
          department_name: doc.department?.name,
        };

        await pinDocumentOffline(meta, blob);
      }

      await refreshPinnedDocs();
    } catch (e) {
      console.error('Offline pin hydration failed:', e);
    }
  }, [user, isClientAdmin, refreshPinnedDocs]);

  useEffect(() => {
    if (!user || isClientAdmin) return;

    const run = () => {
      if (typeof navigator === 'undefined' || !navigator.onLine) return;
      void hydratePinnedFromServer();
    };

    run();
    window.addEventListener('online', run);
    return () => window.removeEventListener('online', run);
  }, [user?.id, isClientAdmin, hydratePinnedFromServer]);

  const persistPin = useCallback(
    async (
      doc: PinTarget,
      blob: Blob,
      options: { showToast: boolean; logActivity: boolean; syncPinnedTable: boolean },
    ) => {
      if (!user) return;

      const meta: PinnedDocMeta = {
        id: doc.id,
        title: doc.title,
        document_type: doc.document_type,
        tags: doc.tags || [],
        ocr_text: doc.ocr_text || null,
        confidentiality_level: doc.confidentiality_level,
        current_version: doc.current_version,
        pinned_version: doc.current_version,
        pinned_at: new Date().toISOString(),
        department_name: doc.department?.name,
      };

      await pinDocumentOffline(meta, blob);

      if (options.logActivity && profile?.client_id) {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          client_id: profile.client_id,
          action_type: 'update' as const,
          document_id: doc.id,
          metadata: { action: 'pin_offline' } as any,
        });
      }

      if (options.syncPinnedTable) {
        supabase.from('pinned_documents').insert({ user_id: user.id, document_id: doc.id }).then(() => {});
      }

      await refreshPinnedDocs();
      if (options.showToast) {
        toast.success('📌 Épinglé pour hors-ligne');
      }
    },
    [user, profile?.client_id, refreshPinnedDocs],
  );

  const pinDocument = useCallback(
    async (doc: PinTarget) => {
      if (!user) return;
      if (isClientAdmin) return;
      if (doc.confidentiality_level === 'confidential') return;

      setPinningIds((prev) => new Set(prev).add(doc.id));

      try {
        const signedUrl = await getSignedDocumentUrl(doc.file_url, 3600, doc.id);
        if (!signedUrl) throw new Error('Could not get signed URL');

        const effectiveSize = await resolveEffectiveSizeBytes(doc, signedUrl);
        if (effectiveSize != null && effectiveSize > MAX_PIN_WITHOUT_CONFIRM_BYTES) {
          const ok = await requestPinSizeConfirm(effectiveSize);
          if (!ok) return;
        }

        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();

        await persistPin(doc, blob, { showToast: true, logActivity: true, syncPinnedTable: true });
      } catch (err) {
        console.error('Pin failed:', err);
        toast.error("Erreur lors de l'épinglage");
      } finally {
        setPinningIds((prev) => {
          const next = new Set(prev);
          next.delete(doc.id);
          return next;
        });
      }
    },
    [user, persistPin, isClientAdmin, requestPinSizeConfirm],
  );

  const refreshStalePin = useCallback(
    async (documentId: string): Promise<boolean> => {
      if (!user || isClientAdmin) return false;

      setPinningIds((prev) => new Set(prev).add(documentId));
      try {
        const { data, error } = await supabase
          .from('documents')
          .select(
            `id, title, document_type, tags, ocr_text, confidentiality_level, current_version, file_url, file_size,
             departments!documents_department_id_fkey(name)`,
          )
          .eq('id', documentId)
          .maybeSingle();

        if (error || !data) return false;
        const row = data as Record<string, unknown>;
        if (row.confidentiality_level === 'confidential') return false;

        const doc = mapRowToPinTarget(row);
        const signedUrl = await getSignedDocumentUrl(doc.file_url, 3600, doc.id);
        if (!signedUrl) return false;

        const response = await fetch(signedUrl);
        if (!response.ok) return false;
        const blob = await response.blob();

        await persistPin(doc, blob, { showToast: false, logActivity: false, syncPinnedTable: false });
        toast.success(
          language === 'fr' ? 'Document hors-ligne mis à jour' : 'Offline copy updated',
        );
        return true;
      } catch (e) {
        console.error('Refresh stale pin failed:', e);
        toast.error('Erreur');
        return false;
      } finally {
        setPinningIds((prev) => {
          const next = new Set(prev);
          next.delete(documentId);
          return next;
        });
      }
    },
    [user, isClientAdmin, persistPin, language],
  );

  const unpinDocument = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) return false;

      try {
        await unpinDocumentOffline(id);

        if (profile?.client_id) {
          await supabase.from('activity_logs').insert({
            user_id: user.id,
            client_id: profile.client_id,
            action_type: 'update' as const,
            document_id: id,
            metadata: { action: 'unpin_offline' } as any,
          });
        }

        supabase
          .from('pinned_documents')
          .delete()
          .eq('user_id', user.id)
          .eq('document_id', id)
          .then(() => {});

        await refreshPinnedDocs();
        toast.success('📌 Désépinglé');
        return true;
      } catch {
        toast.error('Erreur');
        return false;
      }
    },
    [user, profile?.client_id, refreshPinnedDocs],
  );

  const togglePin = useCallback(
    async (doc: PinTarget) => {
      const pinned = await isPinnedOffline(doc.id);
      if (pinned) {
        await unpinDocument(doc.id);
      } else {
        await pinDocument(doc);
      }
    },
    [pinDocument, unpinDocument],
  );

  return {
    pinnedIds,
    pinnedDocs,
    pinningIds,
    isPinned: (id: string) => pinnedIds.has(id),
    togglePin,
    pinDocument,
    unpinDocument,
    refreshPinnedDocs,
    refreshStalePin,
    hydratePinnedFromServer,
  };
}
