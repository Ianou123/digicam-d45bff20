import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Pin, FileText, Wifi, WifiOff, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getPinnedDocs,
  getPinnedBlob,
  unpinDocumentOffline,
  searchPinned,
  type PinnedDocMeta,
} from '@/lib/offlineStorage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Offline() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [docs, setDocs] = useState<PinnedDocMeta[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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
    await unpinDocumentOffline(id);
    if (user) {
      supabase.from('pinned_documents').delete().eq('user_id', user.id).eq('document_id', id).then(() => {});
    }
    setDocs(prev => prev.filter(d => d.id !== id));
    toast.success('📌 Désépinglé');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[360px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold flex items-center gap-2">
          <Pin className="h-6 w-6" />
          {language === 'fr' ? 'Documents hors-ligne' : 'Offline Documents'}
        </h1>
        <p className="text-muted-foreground flex items-center gap-2 mt-1">
          {isOnline ? (
            <><Wifi className="h-4 w-4 text-success" /> {language === 'fr' ? 'Connecté' : 'Online'}</>
          ) : (
            <><WifiOff className="h-4 w-4 text-warning" /> {language === 'fr' ? 'Hors-ligne' : 'Offline'}</>
          )}
          <span className="mx-1">·</span>
          {docs.length} {language === 'fr' ? 'document(s) épinglé(s)' : 'pinned document(s)'}
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={language === 'fr' ? 'Rechercher dans les documents épinglés...' : 'Search pinned documents...'}
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
          {filtered.map(doc => (
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
                      {doc.department_name && <><span>·</span><span>{doc.department_name}</span></>}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                        <Pin className="h-3 w-3 mr-1" />
                        {language === 'fr' ? 'Disponible hors-ligne' : 'Available offline'}
                      </Badge>
                      {doc.tags?.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => { e.stopPropagation(); handleUnpin(doc.id); }}
                    title={language === 'fr' ? 'Désépingler' : 'Unpin'}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
