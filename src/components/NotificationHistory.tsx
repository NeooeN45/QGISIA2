import { X, Trash2, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { notificationManager, NotificationItem } from "../lib/notifications";
import { useEffect, useState } from "react";

interface NotificationHistoryProps {
  onClose: () => void;
}

export default function NotificationHistory({ onClose }: NotificationHistoryProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const unsubscribe = notificationManager.subscribe((notifs) => {
      setNotifications(notifs);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={16} className="text-emerald-400" />;
      case "error":
        return <AlertCircle size={16} className="text-red-400" />;
      case "warning":
        return <AlertTriangle size={16} className="text-yellow-400" />;
      default:
        return <Info size={16} className="text-blue-400" />;
    }
  };

  const getBorderColor = (type: NotificationItem["type"]) => {
    switch (type) {
      case "success":
        return "border-emerald-500/30 bg-emerald-500/10";
      case "error":
        return "border-red-500/30 bg-red-500/10";
      case "warning":
        return "border-yellow-500/30 bg-yellow-500/10";
      default:
        return "border-blue-500/30 bg-blue-500/10";
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "À l'instant";
    if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)} h`;
    return date.toLocaleDateString("fr-FR");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#17181a] shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Historique des notifications</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => notificationManager.clear()}
              className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-all flex items-center gap-2"
            >
              <Trash2 size={14} />
              Effacer tout
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-1.5 text-gray-400 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Info size={48} className="text-gray-200 dark:text-white/20 mb-4" />
              <p className="text-sm text-gray-500 dark:text-white/50">Aucune notification</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-white/30">Les notifications récentes apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "rounded-xl border p-4 transition-all",
                    getBorderColor(notification.type)
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{notification.title}</p>
                      {notification.message && (
                        <p className="mt-1 text-xs text-gray-600 dark:text-white/70">{notification.message}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 dark:text-white/40">{formatTime(notification.timestamp)}</span>
                        {notification.action && (
                          <button
                            onClick={notification.action.onClick}
                            className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-2 py-1 text-[10px] font-medium text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-all"
                          >
                            {notification.action.label}
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => notificationManager.remove(notification.id)}
                      className="rounded-lg p-1 text-gray-300 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-red-400 transition-all"
                      title="Supprimer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-white/5 px-6 py-3">
          <p className="text-[10px] text-gray-400 dark:text-white/30 text-center">
            {notifications.length} notification(s)
          </p>
        </div>
      </div>
    </div>
  );
}
