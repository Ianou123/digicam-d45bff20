import { 
  FileText, 
  FileImage, 
  FileSpreadsheet, 
  Presentation,
  Download,
  Eye,
  MoreVertical,
  Calendar,
  User,
  Shield,
  RotateCcw,
  Trash2,
  Search,
  FileSearch,
  Share2,
  Star,
  Pin,
  Loader2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface DocumentCardProps {
  document: {
    id: string;
    title: string;
    document_type: string;
    confidentiality_level: string;
    created_at: string;
    updated_at: string;
    tags: string[];
    current_version: number;
    file_size?: number | null;
    ocr_text?: string | null;
    department?: { name: string } | null;
    profiles?: { full_name: string } | null;
  };
  isInTrash?: boolean;
  selected?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  onSelect?: () => void;
  onView?: (id: string) => void;
  onDownload?: (id: string) => void;
  onShare?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  isPinned?: boolean;
  isPinning?: boolean;
  onTogglePin?: (doc: any) => void;
  viewMode?: 'list' | 'grid';
}

const documentTypeIcons: Record<string, any> = {
  pdf: FileText,
  jpg: FileImage,
  png: FileImage,
  doc: FileText,
  docx: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  ppt: Presentation,
  pptx: Presentation,
};

const confidentialityColors: Record<string, string> = {
  public: 'badge-public',
  internal: 'badge-internal',
  confidential: 'badge-confidential',
};

export function DocumentCard({
  document,
  isInTrash = false,
  selected = false,
  isFavorite = false,
  onToggleFavorite,
  onSelect,
  onView,
  onDownload,
  onShare,
  onEdit,
  onDelete,
  onRestore,
  isPinned = false,
  isPinning = false,
  onTogglePin,
  viewMode = 'list',
}: DocumentCardProps) {
  const { t, language } = useLanguage();
  const { canManageDocuments } = useAuth();

  const Icon = documentTypeIcons[document.document_type] || FileText;
  const dateLocale = language === 'fr' ? fr : enUS;
  const isList = viewMode === 'list';

  const formatConfidentiality = (level: string) => {
    switch (level) {
      case 'public': return t('documents.public');
      case 'internal': return t('documents.internal');
      case 'confidential': return t('documents.confidential');
      default: return level;
    }
  };

  const handleCardClick = () => {
    if (!isInTrash && onView) onView(document.id);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Card
      className={cn(
        "document-card group cursor-pointer",
        selected && "ring-2 ring-primary"
      )}
      onClick={handleCardClick}
    >
      <CardContent className={cn("p-0", isList ? "py-2.5" : "")}>
        <div className="flex gap-3">
          {/* Selection Checkbox */}
          {onSelect && (
            <div className="flex-shrink-0 flex items-start pt-1" onClick={stop}>
              <Checkbox
                checked={selected}
                onCheckedChange={onSelect}
                onClick={stop}
              />
            </div>
          )}

          {/* Icon */}
          <div className={cn(
            "flex-shrink-0 rounded-lg bg-muted flex items-center justify-center",
            isList ? "w-9 h-9" : "w-12 h-12"
          )}>
            <Icon className={cn("text-muted-foreground", isList ? "h-4 w-4" : "h-6 w-6")} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-foreground truncate">
                  {document.title}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                  <span className="uppercase font-medium">
                    {document.document_type}
                  </span>
                  {!isList && (
                    <>
                      <span>•</span>
                      <span>Version {document.current_version}</span>
                    </>
                  )}
                  {document.department && (
                    <>
                      <span>•</span>
                      <span className="truncate">{document.department.name}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{format(new Date(document.created_at), 'PP', { locale: dateLocale })}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 md:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity" onClick={stop}>
                {isInTrash ? (
                  <>
                    {onRestore && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { stop(e); onRestore(document.id); }}
                        title={t('documents.restore')}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { stop(e); onDelete(document.id); }}
                        title={t('documents.deletePermanently')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    {onToggleFavorite && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { stop(e); onToggleFavorite(document.id); }}
                        title={isFavorite ? (language === 'fr' ? 'Retirer des favoris' : 'Remove from favorites') : (language === 'fr' ? 'Ajouter aux favoris' : 'Add to favorites')}
                      >
                        <Star className={cn("h-3.5 w-3.5", isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                      </Button>
                    )}
                    {onTogglePin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={isPinning}
                        onClick={(e) => { stop(e); onTogglePin(document); }}
                        title={isPinned ? (language === 'fr' ? 'Désépingler' : 'Unpin') : (language === 'fr' ? 'Épingler hors-ligne' : 'Pin offline')}
                      >
                        {isPinning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Pin className={cn("h-3.5 w-3.5", isPinned ? "fill-primary text-primary" : "text-muted-foreground")} />
                        )}
                      </Button>
                    )}
                    {onShare && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { stop(e); onShare(document.id); }}
                        title={language === 'fr' ? 'Partager' : 'Share'}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { stop(e); onDownload?.(document.id); }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {canManageDocuments && (onEdit || onDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={stop}>
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={stop}>
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(document.id)}>
                              {t('documents.edit')}
                            </DropdownMenuItem>
                          )}
                          {onEdit && onDelete && <DropdownMenuSeparator />}
                          {onDelete && (
                            <DropdownMenuItem
                              onClick={() => onDelete(document.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              {t('documents.moveToTrash')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Compact badges row */}
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {document.ocr_text ? (
                <Badge variant="outline" className="h-5 text-[10px] px-1.5 bg-success/10 text-success border-success/30 gap-0.5">
                  <FileSearch className="h-2.5 w-2.5" />
                  {language === 'fr' ? 'Texte' : 'Text'}
                </Badge>
              ) : null}
              <Badge
                variant="outline"
                className={cn('h-5 text-[10px] px-1.5 gap-0.5', confidentialityColors[document.confidentiality_level])}
              >
                <Shield className="h-2.5 w-2.5" />
                {formatConfidentiality(document.confidentiality_level)}
              </Badge>
              {document.tags?.slice(0, isList ? 2 : 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="h-5 text-[10px] px-1.5">
                  {tag}
                </Badge>
              ))}
              {document.tags?.length > (isList ? 2 : 3) && (
                <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                  +{document.tags.length - (isList ? 2 : 3)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}