import React, { useState } from 'react';
import { Search, X, Clock, SlidersHorizontal, Bell, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';

interface FilterState {
  search: string;
  department: string;
  type: string;
  year: string;
  confidentiality: string;
  status: string;
}

interface DocumentFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  departments: { id: string; name: string; archived_at?: string | null }[];
  searchHistory?: string[];
  onSearchHistoryClick?: (query: string) => void;
  onWatchSearch?: () => void;
  isWatchLoading?: boolean;
  searchRef?: React.RefObject<HTMLInputElement>;
  onSearchEnter?: () => void;
}

const documentTypes = ['pdf', 'jpg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

const confidentialityLabels: Record<string, { fr: string; en: string }> = {
  public: { fr: 'Public', en: 'Public' },
  internal: { fr: 'Interne', en: 'Internal' },
  confidential: { fr: 'Confidentiel', en: 'Confidential' },
};

const statusLabels: Record<string, { fr: string; en: string }> = {
  draft: { fr: 'Brouillon', en: 'Draft' },
  published: { fr: 'Publié', en: 'Published' },
  archived: { fr: 'Archivé', en: 'Archived' },
};

export function DocumentFilters({ filters, onFiltersChange, departments, searchHistory = [], onSearchHistoryClick, onWatchSearch, isWatchLoading, searchRef, onSearchEnter }: DocumentFiltersProps) {
  const { t, language } = useLanguage();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const updateFilter = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearPopoverFilters = () => {
    onFiltersChange({
      ...filters,
      type: '',
      year: '',
      confidentiality: '',
      status: '',
    });
  };

  const hasActiveSearch = !!(filters.search || filters.department || filters.type || filters.year || filters.confidentiality);

  const activeFilterCount = (['type', 'year', 'confidentiality', 'status'] as (keyof FilterState)[])
    .filter(k => filters[k]).length;

  const activeFilterChips = [
    filters.type && { key: 'type' as keyof FilterState, label: filters.type.toUpperCase() },
    filters.year && { key: 'year' as keyof FilterState, label: filters.year },
    filters.confidentiality && {
      key: 'confidentiality' as keyof FilterState,
      label: confidentialityLabels[filters.confidentiality]?.[language as 'fr' | 'en'] ?? filters.confidentiality,
    },
    filters.status && {
      key: 'status' as keyof FilterState,
      label: statusLabels[filters.status]?.[language as 'fr' | 'en'] ?? filters.status,
    },
  ].filter(Boolean) as { key: keyof FilterState; label: string }[];

  return (
    <div className="space-y-3">
      {/* Search Bar + Watch Button + Filtres Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder={language === 'fr' ? 'Rechercher...' : 'Search...'}
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearchEnter?.(); }}
            className="pl-12 h-12 text-base border-2 focus:border-primary shadow-sm"
          />
        </div>

        {hasActiveSearch && onWatchSearch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 flex-shrink-0"
                onClick={onWatchSearch}
                disabled={isWatchLoading}
              >
                {isWatchLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Bell className="h-5 w-5 text-muted-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{language === 'fr' ? 'Surveiller cette recherche' : 'Watch this search'}</p>
            </TooltipContent>
          </Tooltip>
        )}

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11 gap-2 px-4 border-2 flex-shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
              <span>{language === 'fr' ? 'Filtres' : 'Filters'}</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('documents.filterByType')}
                </Label>
                <Select
                  value={filters.type || 'all'}
                  onValueChange={(v) => updateFilter('type', v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('documents.allTypes')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('documents.allTypes')}</SelectItem>
                    {documentTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {language === 'fr' ? 'Année' : 'Year'}
                </Label>
                <Select
                  value={filters.year || 'all'}
                  onValueChange={(v) => updateFilter('year', v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('documents.allYears')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('documents.allYears')}</SelectItem>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {language === 'fr' ? 'Confidentialité' : 'Confidentiality'}
                </Label>
                <Select
                  value={filters.confidentiality || 'all'}
                  onValueChange={(v) => updateFilter('confidentiality', v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('documents.allLevels')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('documents.allLevels')}</SelectItem>
                    <SelectItem value="public">{t('documents.public')}</SelectItem>
                    <SelectItem value="internal">{t('documents.internal')}</SelectItem>
                    <SelectItem value="confidential">{t('documents.confidential')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {language === 'fr' ? 'Statut' : 'Status'}
                </Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(v) => updateFilter('status', v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={language === 'fr' ? 'Tous' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === 'fr' ? 'Tous' : 'All'}</SelectItem>
                    <SelectItem value="draft">{language === 'fr' ? 'Brouillon' : 'Draft'}</SelectItem>
                    <SelectItem value="published">{language === 'fr' ? 'Publié' : 'Published'}</SelectItem>
                    <SelectItem value="archived">{language === 'fr' ? 'Archivé' : 'Archived'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearPopoverFilters}
                className="mt-4 w-full h-8 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                {language === 'fr' ? 'Effacer les filtres' : 'Clear filters'} ({activeFilterCount})
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Search History */}
      {searchHistory.length > 0 && !filters.search && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{t('documents.recentSearches')}:</span>
          </div>
          {searchHistory.map((query, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 transition-colors"
              onClick={() => onSearchHistoryClick?.(query)}
            >
              {query}
            </Badge>
          ))}
        </div>
      )}

      {/* Active filter chips */}
      {activeFilterChips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilterChips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1.5 pr-1">
              {chip.label}
              <button
                onClick={() => updateFilter(chip.key, '')}
                className="ml-0.5 rounded-full hover:bg-secondary-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
