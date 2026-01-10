import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, FileText, RefreshCw, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: any;
  document_id: string | null;
  is_read: boolean;
  created_at: string;
}

const notificationIcons: Record<string, typeof Bell> = {
  watch_match: FileText,
  update_request: RefreshCw,
  trend: TrendingUp,
  system: Bell,
};

export function NotificationCenter() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const dateLocale = language === 'fr' ? fr : enUS;
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Subscribe to realtime notifications
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications(prev => [payload.new as Notification, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Use rpc or raw query for new tables not yet in types
      const { data, error } = await supabase
        .from('notifications' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications((data as unknown as Notification[]) || []);
      setUnreadCount((data as unknown as Notification[])?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications' as any)
        .update({ is_read: true })
        .eq('id', id);

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      await supabase
        .from('notifications' as any)
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.document_id) {
      navigate(`/documents/${notification.document_id}`);
      setIsOpen(false);
    } else if (notification.type === 'trend') {
      navigate('/documents');
      setIsOpen(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true, locale: dateLocale });
    }
    return format(date, 'dd MMM', { locale: dateLocale });
  };

  const getIcon = (type: string) => {
    const Icon = notificationIcons[type] || Bell;
    return Icon;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-xs bg-primary text-primary-foreground"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">
            {language === 'fr' ? 'Notifications' : 'Notifications'}
          </h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-1" />
              {language === 'fr' ? 'Tout marquer lu' : 'Mark all read'}
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map(notification => {
                const Icon = getIcon(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors',
                      !notification.is_read && 'bg-primary/5'
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className={cn(
                      'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                      notification.type === 'watch_match' && 'bg-blue-100 text-blue-600',
                      notification.type === 'update_request' && 'bg-amber-100 text-amber-600',
                      notification.type === 'trend' && 'bg-green-100 text-green-600',
                      notification.type === 'system' && 'bg-gray-100 text-gray-600',
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          'text-sm line-clamp-1',
                          !notification.is_read && 'font-medium'
                        )}>
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">
                {language === 'fr' 
                  ? 'Aucune notification'
                  : 'No notifications'}
              </p>
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-3 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full"
              onClick={() => {
                navigate('/notifications');
                setIsOpen(false);
              }}
            >
              {language === 'fr' ? 'Voir tout l\'historique' : 'View all history'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}