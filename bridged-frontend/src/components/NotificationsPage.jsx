import { useState, useEffect, useCallback } from "react";
import { notificationsAPI } from "../api/api";
import { useNetworkStatus } from "../utils/networkStatus";
import { getCached, setCached, CACHE_KEYS } from "../utils/offlineCache";

const cardClass =
  "rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-4 text-bridged-primary dark:text-bridged-light";

const TYPE_META = {
  new_match: { label: "New match", icon: "fa-briefcase", color: "text-bridged-teal" },
  student_interested: { label: "Student interested", icon: "fa-user-check", color: "text-green-500" },
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

const NotificationsPage = ({ user, syncNotification }) => {
  const { isOnline } = useNetworkStatus();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-[60vh] w-full px-6 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
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
            className="rounded-lg border border-bridged-teal/40 px-3 py-1.5 text-sm font-medium text-bridged-teal hover:bg-bridged-teal/10"
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
        <ul className="space-y-3">
          {notifications.map((n) => {
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <i
                        className={`fa-solid ${meta.icon} text-sm ${meta.color}`}
                        aria-hidden
                      />
                      <span className="text-xs font-semibold uppercase tracking-wide text-bridged-primary/60 dark:text-bridged-light/50">
                        {meta.label}
                      </span>
                      {!n.is_read && (
                        <span className="ml-auto inline-block h-2 w-2 rounded-full bg-bridged-teal shrink-0" />
                      )}
                    </div>

                    <p className="text-sm leading-relaxed text-bridged-primary dark:text-bridged-light">
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
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-bridged-teal hover:bg-bridged-teal/10 dark:hover:bg-bridged-teal/20"
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
