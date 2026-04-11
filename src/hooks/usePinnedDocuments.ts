import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getSignedDocumentUrl } from '@/lib/storage';
import {
  pinDocumentOffline,
  unpinDocumentOffline,
  getPinnedDocs,
  isPinnedOffline,
  type PinnedDocMeta,
} from '@/lib/offlineStorage';

interface PinTarget {
  id: string;
  title: string;
  document_type: string;
  tags: string[];
  ocr_text?: string | null;
  confidentiality_level: string;
  current_version: number;
  file_url: string;
  department?: { name: string } | null;
}

export function usePinnedDocuments() {
  const { user } = useAuth();
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [pinningIds, setPinningIds] = useState<Set<string>>(new Set());
  const [pinnedDocs, setPinnedDocs] = useState<PinnedDocMeta[]>([]);

  // Load pinned IDs from IndexedDB on mount
  useEffect(() => {
    getPinnedDocs().then(docs => {
      setPinnedIds(new Set(docs.map(d => d.id)));
      setPinnedDocs(docs);
    }).catch(() => {});
  }, []);

  const refreshPinnedDocs = useCallback(async () => {
    try {
      const docs = await getPinnedDocs();
      setPinnedIds(new Set(docs.map(d => d.id)));
      setPinnedDocs(docs);
    } catch {}
  }, []);

  const pinDocument = useCallback(async (doc: PinTarget) => {
    if (!user) return;

    setPinningIds(prev => new Set(prev).add(doc.id));

    try {
      // 1. Get signed URL and download blob
      const signedUrl = await getSignedDocumentUrl(doc.file_url, 3600, doc.id);
      if (!signedUrl) throw new Error('Could not get signed URL');

      const response = await fetch(signedUrl);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();

      // 2. Store in IndexedDB
      const meta: PinnedDocMeta = {
        id: doc.id,
        title: doc.title,
        document_type: doc.document_type,
        tags: doc.tags || [],
        ocr_text: doc.ocr_text || null,
        confidentiality_level: doc.confidentiality_level,
        current_version: doc.current_version,
        pinned_at: new Date().toISOString(),
        department_name: doc.department?.name,
      };

      await pinDocumentOffline(meta, blob);

      // 3. Sync to Supabase (non-blocking, silent fail)
      supabase
        .from('pinned_documents')
        .insert({ user_id: user.id, document_id: doc.id })
        .then(() => {});

      await refreshPinnedDocs();
      toast.success('📌 Épinglé pour hors-ligne');
    } catch (err) {
      console.error('Pin failed:', err);
      toast.error('Erreur lors de l\'épinglage');
    } finally {
      setPinningIds(prev => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  }, [user, refreshPinnedDocs]);

  const unpinDocument = useCallback(async (id: string) => {
    if (!user) return;

    try {
      await unpinDocumentOffline(id);

      // Sync to Supabase (non-blocking)
      supabase
        .from('pinned_documents')
        .delete()
        .eq('user_id', user.id)
        .eq('document_id', id)
        .then(() => {});

      await refreshPinnedDocs();
      toast.success('📌 Désépinglé');
    } catch {
      toast.error('Erreur');
    }
  }, [user, refreshPinnedDocs]);

  const togglePin = useCallback(async (doc: PinTarget) => {
    const pinned = await isPinnedOffline(doc.id);
    if (pinned) {
      await unpinDocument(doc.id);
    } else {
      await pinDocument(doc);
    }
  }, [pinDocument, unpinDocument]);

  return {
    pinnedIds,
    pinnedDocs,
    pinningIds,
    isPinned: (id: string) => pinnedIds.has(id),
    togglePin,
    pinDocument,
    unpinDocument,
    refreshPinnedDocs,
  };
}
