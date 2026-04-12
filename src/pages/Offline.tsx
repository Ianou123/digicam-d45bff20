import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Pin, FileText, Wifi, WifiOff, Trash2, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getPinnedDocs,
  getPinnedBlob,
  searchPinned,
  type PinnedDocMeta,
} from '@/lib/offlineStorage';
import { usePinnedDocuments, type PinTarget } from '@/hooks/usePinnedDocuments';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const OFFLINE_SUGGEST_DISMISSED_KEY = 'offline_suggest_dismissed_at';
const FEW_PINS_THRESHOLD = 2;

type SuggestionRow = {
  id: string;
  title: string;
  document_type: string;
  tags: string[];
  ocr_text: string | null;
  confidentiality_level: string;
  current_version: number;
  file_url: string;
  file_size: number | null;
  department: { name: string } | null;
  viewCount: number;
};

function dismissedWithin24h(): boolean {
  const raw = localStorage.getItem(OFFLINE_SUGGEST_DISMISSED_KEY);
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 24 * 60 * 60 * 1000;
}

export default function Offline() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { user, isClientAdmin } = useAuth();
  const { unpinDocument, pinDocument, refreshStalePin, pinningIds } = usePinnedDocuments();

  const [docs, setDocs] = useState<PinnedDocMeta[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverVersions, setServerVersions] = useState<Record<string, number>>({});
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestDismissed, setSuggestDismissed] = useState(() => dismissedWithin24h());

  const reloadLocalDocs = useCallback(() => {
    getPinnedDocs()
      .then(setDocs)
      .catch(() => setDocs([]));
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    getPinnedDocs()
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => searchPinned(docs, query), [docs, query]);

  useEffect(() => {
    if (!isOnline || !docs.length) {
      setServerVersions({});
      return;
    }

    let cancelled = false;
    (async () => {
      const ids = docs.map((d) => d.id);
      const { data } = await supabase.from('documents').select('id, current_version').in('id', ids);
      if (cancelled || !data) return;
      const map: Record<string, number> = {};
      for (const row of data) {
        map[row.id] = row.current_version;
      }
      setServerVersions(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOnline, docs]);

  useEffect(() => {
    if (!user || !isOnline || isClientAdmin || docs.length > FEW_PINS_THRESHOLD || suggestDismissed) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setSuggestLoading(true);

    (async () => {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: views, error } = await supabase
          .from('activity_logs')
          .select('document_id')
          .eq('user_id', user.id)
          .eq('action_type', 'view')
          .not('document_id', 'is', null)
          .gte('created_at', sevenDaysAgo);

        if (cancelled || error || !views?.length) {
          setSuggestions([]);
          return;
        }

        const counts = new Map<string, number>();
        for (const v of views) {
          const id = v.document_id as string;
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }

        const pinned = new Set(docs.map((d) => d.id));
        const sorted = [...counts.entries()]
          .filter(([id]) => !pinned.has(id))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        if (!sorted.length) {
          setSuggestions([]);
          return;
        }

        const topIds = sorted.map(([id]) => id);
        const { data: docRows, error: docErr } = await supabase
          .from('documents')
          .select(
            `id, title, document_type, tags, ocr_text, confidentiality_level, current_version, file_url, file_size,
             departments!documents_department_id_fkey(name)`,
          )
          .in('id', topIds)
          .is('deleted_at', null);

        if (cancelled || docErr || !docRows?.length) {
          setSuggestions([]);
          return;
        }

        const countById = new Map(sorted);
        const out: SuggestionRow[] = [];
        for (const raw of docRows) {
          const row = raw as Record<string, unknown>;
          if (row.confidentiality_level === 'confidential') continue;
          const dept = row.departments as { name: string } | null | undefined;
          const id = row.id as string;
          out.push({
            id,
            title: row.title as string,
            document_type: row.document_type as string,
            tags: (row.tags as string[]) || [],
            ocr_text: (row.ocr_text as string | null) ?? null,
            confidentiality_level: row.confidentiality_level as string,
            current_version: row.current_version as number,
            file_url: row.file_url as string,
            file_size: (row.file_size as number | null) ?? null,
            department: dept?.name ? { name: dept.name } : null,
            viewCount: countById.get(id) ?? 0,
          });
        }
        out.sort((a, b) => b.viewCount - a.viewCount);
        setSuggestions(out.slice(0, 5));
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isOnline, isClientAdmin, docs, suggestDismissed]);

  const handleDismissSuggest = () => {
    localStorage.setItem(OFFLINE_SUGGEST_DISMISSED_KEY, new Date().toISOString());
    setSuggestDismissed(true);
    setSuggestions([]);
  };

  const suggestionToPinTarget = (s: SuggestionRow): PinTarget => ({
    id: s.id,
    title: s.title,
    document_type: s.document_type,
    tags: s.tags,
    ocr_text: s.ocr_text,
    confidentiality_level: s.confidentiality_level,
    current_version: s.current_version,
    file_url: s.file_url,
    file_size: s.file_size,
    department: s.department,
  });

  const handleSuggestPin = async (s: SuggestionRow) => {
    await pinDocument(suggestionToPinTarget(s));
    reloadLocalDocs();
    setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
  };

  const handleClick = async (doc: PinnedDocMeta) => {
    if (isOnline) {
      navigate(`/documents/${doc.id}`);
    } else {
      const blob = await getPinnedBlob(doc.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        toast.error(language === 'fr' ? 'Fichier non trouvé' : 'File not found');
      }
    }
  };

  const handleUnpin = async (id: string) => {
    const ok = await unpinDocument(id);
    if (ok) setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const handleRefreshStale = async (e: React.MouseEvent, documentId: string) => {
    e.stopPropagation();
    const ok = await refreshStalePin(documentId);
    if (ok) reloadLocalDocs();
  };

  const isStale = (doc: PinnedDocMeta) => {
    if (!isOnline) return false;
    const server = serverVersions[doc.id];
    if (server == null) return false;
    const pinnedAt = doc.pinned_version ?? doc.current_version;
    return server > pinnedAt;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[360px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const showSuggestCard =
    isOnline &&
    !isClientAdmin &&
    docs.length <= FEW_PINS_THRESHOLD &&
    !suggestDismissed &&
    (suggestLoading || suggestions.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold flex items-center gap-2">
          <Pin className="h-6 w-6" />
          {language === 'fr' ? 'Documents hors-ligne' : 'Offline Documents'}
        </h1>
        <p className="text-muted-foreground flex items-center gap-2 mt-1">
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4 text-success" /> {language === 'fr' ? 'Connecté' : 'Online'}
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-warning" /> {language === 'fr' ? 'Hors-ligne' : 'Offline'}
            </>
          )}
          <span className="mx-1">·</span>
          {docs.length}{' '}
          {language === 'fr' ? 'document(s) épinglé(s)' : 'pinned document(s)'}
        </p>
      </div>

      {showSuggestCard && (
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">
                {language === 'fr'
                  ? 'Documents consultés récemment'
                  : 'Recently viewed documents'}
              </p>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleDismissSuggest}>
                <X className="h-4 w-4" />
                <span className="sr-only">{language === 'fr' ? 'Fermer' : 'Dismiss'}</span>
              </Button>
            </div>
            {suggestLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {language === 'fr' ? 'Chargement…' : 'Loading…'}
              </div>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium truncate block">{s.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {language === 'fr'
                          ? `Consulté ${s.viewCount} fois cette semaine — épingler pour hors-ligne ?`
                          : `Viewed ${s.viewCount} times this week — pin for offline?`}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pinningIds.has(s.id)}
                      onClick={() => handleSuggestPin(s)}
                    >
                      {pinningIds.has(s.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Pin className="h-3.5 w-3.5 mr-1" />
                          {language === 'fr' ? 'Épingler' : 'Pin'}
                        </>
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            language === 'fr'
              ? 'Rechercher dans les documents épinglés...'
              : 'Search pinned documents...'
          }
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Pin className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{language === 'fr' ? 'Aucun document épinglé' : 'No pinned documents'}</p>
          <p className="text-sm mt-1">
            {language === 'fr'
              ? 'Épinglez des documents depuis la page Documents pour y accéder hors-ligne.'
              : 'Pin documents from the Documents page to access them offline.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((doc) => (
            <Card key={doc.id} className="document-card group cursor-pointer" onClick={() => handleClick(doc)}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{doc.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span className="uppercase text-xs font-medium">{doc.document_type}</span>
                      <span>·</span>
                      <span>v{doc.current_version}</span>
                      {doc.department_name && (
                        <>
                          <span>·</span>
                          <span>{doc.department_name}</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                        <Pin className="h-3 w-3 mr-1" />
                        {language === 'fr' ? 'Disponible hors-ligne' : 'Available offline'}
                      </Badge>
                      {isStale(doc) && (
                        <Badge variant="outline" className="text-xs border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100">
                          {language === 'fr' ? '⚠️ Mise à jour disponible' : '⚠️ Update available'}
                        </Badge>
                      )}
                      {doc.tags?.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    {isStale(doc) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={pinningIds.has(doc.id)}
                        onClick={(e) => handleRefreshStale(e, doc.id)}
                      >
                        {pinningIds.has(doc.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          language === 'fr' ? 'Rafraîchir' : 'Refresh'
                        )}
                      </Button>
                    )}
                  </div>
                  {doc.confidentiality_level !== 'confidential' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnpin(doc.id);
                      }}
                      title={language === 'fr' ? 'Désépingler' : 'Unpin'}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
