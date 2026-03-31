import { useState, useEffect, useCallback } from "react";
import { notificationsAPI } from "../api/api";
import { useNetworkStatus } from "../utils/networkStatus";
import { getCached, setCached, CACHE_KEYS } from "../utils/offlineCache";

const cardClass =
  "w-full min-w-0 rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-4 text-bridged-primary dark:text-bridged-light";

const TYPE_META = {
  new_match: { label: "New match", icon: "fa-briefcase", color: "text-bridged-teal" },
  student_interested: { label: "Student interested", icon: "fa-user-check", color: "text-green-500" },
  'employment confirmed': { label: "Employment confirmed", icon: "fa-circle-check", color: "text-green-500" },
  interest_confirmed: { label: "Match accepted", icon: "fa-circle-check", color: "text-green-500" },
  match_declined: { label: "Match declined", icon: "fa-circle-xmark", color: "text-amber-500" },
  job_posted: { label: "Job posted", icon: "fa-file-circle-plus", color: "text-bridged-teal" },
  profile_incomplete: { label: "Profile incomplete", icon: "fa-triangle-exclamation", color: "text-amber-500" },
  subscription_expiring: { label: "Subscription expiring", icon: "fa-clock", color: "text-red-500" },
  sync_complete: { label: "Data synced", icon: "fa-rotate", color: "text-bridged-teal" },
  cv_parsed: { label: "CV processed", icon: "fa-file-lines", color: "text-bridged-teal" },
  user_suspended: { label: "Account status", icon: "fa-user-lock", color: "text-amber-500" },
  'profile update': { label: "Profile update", icon: "fa-user-gear", color: "text-bridged-teal" },
};

const getTypeMeta = (type) =>
  TYPE_META[type] ?? { label: type, icon: "fa-bell", color: "text-bridged-primary/40 dark:text-bridged-light/40" };

const PREFS_STORAGE_KEY = 'bridged-notif-prefs';

const NotificationsPage = ({ user, syncNotification }) => {
  const { isOnline } = useNetworkStatus();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const notifPrefs = (() => {
    const saved = user?.notification_preferences;
    if (saved && Object.keys(saved).length > 0) return saved;
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  })();

  const isVisible = (n) => {
    if (Object.keys(notifPrefs).length === 0) return true;
    if (notifPrefs[n.type] === false) return false;
    return true;
  };

  const fetchNotifications = useCallback(() => {
    setLoading(true);
    setError("");
    if (!isOnline) {
      getCached(CACHE_KEYS.notifications)
        .then((entry) => {
          if (entry?.data != null)
            setNotifications(Array.isArray(entry.data) ? entry.data : []);
          else setNotifications([]);
        })
        .finally(() => setLoading(false));
      return;
    }
    notificationsAPI
      .list()
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
        setNotifications(list);
        setCached(CACHE_KEYS.notifications, list);
      })
      .catch(() => setError("Could not load notifications."))
      .finally(() => setLoading(false));
  }, [isOnline]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = (notificationId) => {
    notificationsAPI
      .markRead(notificationId)
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) =>
            n.notification_id === notificationId ? { ...n, is_read: true } : n,
          ),
        );
      })
      .catch(() => {});
  };

  const handleMarkAllRead = () => {
    const unread = notifications.filter((n) => !n.is_read);
    unread.forEach((n) => handleMarkRead(n.notification_id));
  };

  const unreadCount = notifications.filter((n) => !n.is_read && isVisible(n)).length;

  return (
    <div className="mx-auto min-h-[60vh] w-full min-w-0 max-w-[1600px] px-4 py-6 sm:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-bridged-primary dark:text-bridged-light">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-bridged-primary/70 dark:text-bridged-light/70">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
          </p>
        </div>
        {unreadCount > 1 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="w-full shrink-0 rounded-lg border border-bridged-teal/40 px-3 py-2 text-sm font-medium text-bridged-teal hover:bg-bridged-teal/10 sm:w-auto sm:py-1.5"
          >
            Mark all read
          </button>
        )}
      </div>

      {syncNotification && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-bridged-teal/30 bg-bridged-teal/10 px-4 py-3 text-sm text-bridged-teal">
          <i className="fa-solid fa-rotate animate-spin" aria-hidden />
          <span>{syncNotification}</span>
        </div>
      )}

      {!isOnline && (
        <p className="mb-4 text-xs text-bridged-primary/60 dark:text-bridged-light/60">
          Showing cached notifications. Connect to the internet to refresh.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">
          Loading...
        </p>
      ) : error ? (
        <div className={cardClass}>
          <p className="text-sm text-bridged-primary/70 dark:text-bridged-light/70">
            {error}
          </p>
        </div>
      ) : notifications.length === 0 ? (
        <div className={cardClass}>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <i className="fa-regular fa-bell text-3xl text-bridged-primary/30 dark:text-bridged-light/30" aria-hidden />
            <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">
              No notifications yet. Activity will appear here.
            </p>
          </div>
        </div>
      ) : (
        <ul className="w-full min-w-0 space-y-3">
          {notifications.filter(isVisible).length === 0 ? (
            <div className={cardClass}>
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <i className="fa-regular fa-bell-slash text-3xl text-bridged-primary/30 dark:text-bridged-light/30" aria-hidden />
                <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">
                  No visible notifications. Some may be hidden by your notification preferences.
                </p>
              </div>
            </div>
          ) : notifications.filter(isVisible).map((n) => {
            const meta = getTypeMeta(n.type);
            return (
              <li
                key={n.notification_id}
                className={`${cardClass} transition-shadow ${
                  !n.is_read
                    ? "ring-1 ring-bridged-teal/30 dark:ring-bridged-teal/40"
                    : "opacity-75"
                }`}
              >
                <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 w-full flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <i
                        className={`fa-solid ${meta.icon} shrink-0 text-sm ${meta.color}`}
                        aria-hidden
                      />
                      <span className="text-xs font-semibold uppercase tracking-wide text-bridged-primary/60 dark:text-bridged-light/50">
                        {meta.label}
                      </span>
                      {!n.is_read && (
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-bridged-teal sm:ml-1" />
                      )}
                    </div>

                    <p className="break-words text-sm leading-relaxed text-bridged-primary [overflow-wrap:anywhere] dark:text-bridged-light">
                      {n.message}
                    </p>

                    <p className="mt-2 text-xs text-bridged-primary/50 dark:text-bridged-light/50">
                      {n.created_at
                        ? new Date(n.created_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : ""}
                    </p>
                  </div>

                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.notification_id)}
                      className="w-full shrink-0 rounded-lg px-3 py-2 text-center text-xs font-medium text-bridged-teal hover:bg-bridged-teal/10 dark:hover:bg-bridged-teal/20 sm:w-auto sm:self-start sm:py-1.5"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default NotificationsPage;
