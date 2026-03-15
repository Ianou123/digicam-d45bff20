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
  Star
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
  onSelect,
  onView,
  onDownload,
  onShare,
  onEdit,
  onDelete,
  onRestore,
}: DocumentCardProps) {
  const { t, language } = useLanguage();
  const { canManageDocuments } = useAuth();
  
  const Icon = documentTypeIcons[document.document_type] || FileText;
  const dateLocale = language === 'fr' ? fr : enUS;

  const formatConfidentiality = (level: string) => {
    switch (level) {
      case 'public': return t('documents.public');
      case 'internal': return t('documents.internal');
      case 'confidential': return t('documents.confidential');
      default: return level;
    }
  };

  return (
    <Card className={cn("document-card group", selected && "ring-2 ring-primary")}>
      <CardContent className="p-0">
        <div className="flex gap-4">
          {/* Selection Checkbox */}
          {onSelect && (
            <div className="flex-shrink-0 flex items-start pt-1">
              <Checkbox 
                checked={selected} 
                onCheckedChange={onSelect}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium text-foreground truncate">
                  {document.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span className="uppercase text-xs font-medium">
                    {document.document_type}
                  </span>
                  <span>•</span>
                  <span>Version {document.current_version}</span>
                  {document.department && (
                    <>
                      <span>•</span>
                      <span className="truncate">{document.department.name}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions - always visible on desktop for better discoverability */}
              <div className="flex items-center gap-1 md:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity">
                {isInTrash ? (
                  // Trash view actions
                  <>
                    {onRestore && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onRestore(document.id)}
                        title={t('documents.restore')}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(document.id)}
                        title={t('documents.deletePermanently')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                ) : (
                  // Normal view actions
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onView?.(document.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onShare && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); onShare(document.id); }}
                        title={language === 'fr' ? 'Partager' : 'Share'}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onDownload?.(document.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canManageDocuments && (onEdit || onDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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

            {/* Tags and metadata */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {/* Search capability badge */}
              {document.ocr_text ? (
                <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                  <FileSearch className="h-3 w-3 mr-1" />
                  {t('documents.fullTextSearchable')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                  <Search className="h-3 w-3 mr-1" />
                  {t('documents.metadataOnly')}
                </Badge>
              )}
              <Badge 
                variant="outline" 
                className={cn('text-xs', confidentialityColors[document.confidentiality_level])}
              >
                <Shield className="h-3 w-3 mr-1" />
                {formatConfidentiality(document.confidentiality_level)}
              </Badge>
              {document.tags?.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {document.tags?.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{document.tags.length - 3}
                </Badge>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>
                  {format(new Date(document.created_at), 'PP', { locale: dateLocale })}
                </span>
              </div>
              {document.profiles?.full_name && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span className="truncate">{document.profiles.full_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}