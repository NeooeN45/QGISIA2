import { toast as sonnerToast } from "sonner";

interface NotificationItem {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message?: string;
  timestamp: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export type { NotificationItem };

class NotificationManager {
  private notifications: NotificationItem[] = [];
  private listeners: Set<(notifications: NotificationItem[]) => void> = new Set();
  private groupedNotifications: Map<string, NotificationItem[]> = new Map();
  private groupKey: string = "";

  subscribe(listener: (notifications: NotificationItem[]) => void) {
    this.listeners.add(listener);
    listener(this.getAllNotifications());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.getAllNotifications()));
  }

  getAllNotifications(): NotificationItem[] {
    return [...this.notifications].sort((a, b) => b.timestamp - a.timestamp);
  }

  clear() {
    this.notifications = [];
    this.groupedNotifications.clear();
    this.notifyListeners();
  }

  remove(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.notifyListeners();
  }

  setGroupKey(key: string) {
    this.groupKey = key;
  }

  private getGroupKey(notification: NotificationItem): string {
    if (this.groupKey) {
      return this.groupKey;
    }
    // Auto-group by type and title similarity
    return `${notification.type}-${notification.title}`;
  }

  toast(config: {
    type?: "success" | "error" | "info" | "warning";
    title: string;
    message?: string;
    action?: {
      label: string;
      onClick: () => void;
    };
    duration?: number;
  }) {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notification: NotificationItem = {
      id,
      type: config.type || "info",
      title: config.title,
      message: config.message,
      timestamp: Date.now(),
      action: config.action,
    };

    this.notifications.push(notification);

    // Grouping logic
    const groupKey = this.getGroupKey(notification);
    if (!this.groupedNotifications.has(groupKey)) {
      this.groupedNotifications.set(groupKey, []);
    }
    this.groupedNotifications.get(groupKey)!.push(notification);

    const group = this.groupedNotifications.get(groupKey);
    const count = group ? group.length : 1;

    // Show grouped toast
    const toastMessage = count > 1 
      ? `${config.title} (${count})` 
      : config.title;

    const toastFn = config.type === "success" ? sonnerToast.success :
                    config.type === "error" ? sonnerToast.error :
                    config.type === "warning" ? sonnerToast.warning :
                    sonnerToast.info;

    const toastOptions: any = {
      duration: config.duration || 4000,
      action: config.action ? {
        label: config.action.label,
        onClick: config.action.onClick,
      } : undefined,
    };

    if (config.message) {
      toastFn(toastMessage, toastOptions);
    } else {
      toastFn(toastMessage, toastOptions);
    }

    this.notifyListeners();
  }

  success(title: string, message?: string, action?: { label: string; onClick: () => void }) {
    this.toast({ type: "success", title, message, action });
  }

  error(title: string, message?: string, action?: { label: string; onClick: () => void }) {
    this.toast({ type: "error", title, message, action, duration: 6000 });
  }

  info(title: string, message?: string, action?: { label: string; onClick: () => void }) {
    this.toast({ type: "info", title, message, action });
  }

  warning(title: string, message?: string, action?: { label: string; onClick: () => void }) {
    this.toast({ type: "warning", title, message, action, duration: 5000 });
  }
}

export const notificationManager = new NotificationManager();

// Re-export sonner toast for backward compatibility
export const toast = notificationManager;
