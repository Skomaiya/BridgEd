import { useState, useEffect, useRef } from 'react';
import { profileAPI, notificationsAPI, messagesAPI } from '../api/api';
import { getDisplayName, getInitial } from '../utils/displayName';
import { useNetworkStatus } from '../utils/networkStatus';
import { getCached, setCached, CACHE_KEYS } from '../utils/offlineCache';

const notificationTypeLabel = (type) => {
  const labels = {
    new_match: 'New match',
    student_interested: 'Student interested',
    job_posted: 'Job posted',
    profile_incomplete: 'Profile incomplete',
    subscription_expiring: 'Subscription expiring',
  };
  return labels[type] || type;
};

const navLinkClass = (darkMode, active) =>
  `whitespace-nowrap text-sm font-medium transition-colors ${
    active
      ? darkMode ? 'text-bridged-accent' : 'text-bridged-teal'
      : darkMode
        ? 'text-bridged-light hover:text-bridged-accent'
        : 'text-bridged-primary hover:text-bridged-teal'
  }`;

const MainLayout = ({ user, onLogout, children, currentPage, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const { isOnline } = useNetworkStatus();
  const [darkMode, setDarkMode] = useState(true);
  const [employerProfile, setEmployerProfile] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const notificationsRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem('bridged-dark-mode');
    if (stored !== null) setDarkMode(stored === 'true');
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('bridged-dark-mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('bridged-dark-mode', 'false');
    }
  }, [darkMode]);

  useEffect(() => {
    if (user?.role !== 'employer') {
      setEmployerProfile(null);
      return;
    }
    if (!isOnline) {
      getCached(CACHE_KEYS.employer_profile).then((entry) => {
        if (entry?.data != null) setEmployerProfile(entry.data);
      });
      return;
    }
    profileAPI.getEmployerProfile().then((p) => {
      setEmployerProfile(p);
      setCached(CACHE_KEYS.employer_profile, p);
    }).catch(() => {});
  }, [user?.role, isOnline]);

  useEffect(() => {
    if (user?.role !== 'student') {
      setStudentProfile(null);
      return;
    }
    if (!isOnline) {
      getCached(CACHE_KEYS.student_profile).then((entry) => {
        if (entry?.data != null) setStudentProfile(entry.data);
      });
      return;
    }
    profileAPI.getStudentProfile().then((p) => {
      setStudentProfile(p);
      setCached(CACHE_KEYS.student_profile, p);
    }).catch(() => {});
  }, [user?.role, isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    const fetchCount = () => {
      notificationsAPI.list().then((data) => {
        const list = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
        setNotifications(list);
        setCached(CACHE_KEYS.notifications, list);
      }).catch(() => {});
    };
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline || user?.role === 'admin') return;
    const fetchUnread = () => {
      messagesAPI.getUnreadCount().then(setUnreadMessages).catch(() => {});
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => clearInterval(id);
  }, [isOnline, user?.role]);
  useEffect(() => {
    if (!notificationsOpen) return;
    setLoadingNotifications(true);
    if (!isOnline) {
      getCached(CACHE_KEYS.notifications).then((entry) => {
        if (entry?.data != null) setNotifications(Array.isArray(entry.data) ? entry.data : []);
      }).finally(() => setLoadingNotifications(false));
      return;
    }
    notificationsAPI
      .list()
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
        setNotifications(list);
        setCached(CACHE_KEYS.notifications, list);
      })
      .catch(() => setNotifications([]))
      .finally(() => setLoadingNotifications(false));
  }, [notificationsOpen, isOnline]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClickOutside = (e) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationsOpen]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const displayNameRaw = getDisplayName(user, employerProfile?.company_name, studentProfile?.display_name);
  const displayName = displayNameRaw || (user?.role === 'student' ? 'Student' : user?.role === 'admin' ? 'Admin' : 'User');
  const initial = getInitial(displayName);
  const navPhotoUrl = studentProfile?.profile_image_url || employerProfile?.profile_image_url || null;
  const isEmployer = user?.role === 'employer';
  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';

  const buildNavLinks = (onClick) => (
    <>
      {isStudent && onNavigate ? (
        <>
          <button type="button" onClick={() => { onNavigate('dashboard'); onClick?.(); }} className={navLinkClass(darkMode, currentPage === 'dashboard')}>Dashboard</button>
          <button type="button" onClick={() => { onNavigate('student-matches'); onClick?.(); }} className={navLinkClass(darkMode, currentPage === 'student-matches')}>Matches</button>
        </>
      ) : (
        <a href="#" onClick={(e) => { e.preventDefault(); if (onNavigate) onNavigate(user?.role === 'admin' ? 'admin-dashboard' : 'dashboard'); onClick?.(); }} className={navLinkClass(darkMode, currentPage === 'dashboard' || currentPage === 'admin-dashboard')}>Dashboard</a>
      )}
      {isEmployer && (
        <>
          <button type="button" onClick={() => { onNavigate?.('jobs'); onClick?.(); }} className={navLinkClass(darkMode, currentPage === 'jobs')}>My Jobs</button>
          <button type="button" onClick={() => { onNavigate?.('matches'); onClick?.(); }} className={navLinkClass(darkMode, currentPage === 'matches')}>Matches</button>
        </>
      )}
      {user?.role === 'admin' && (
        <>
          <button type="button" onClick={() => { onNavigate?.('admin-students'); onClick?.(); }} className={navLinkClass(darkMode, currentPage === 'admin-students')}>Students</button>
          <button type="button" onClick={() => { onNavigate?.('admin-employers'); onClick?.(); }} className={navLinkClass(darkMode, currentPage === 'admin-employers')}>Employers</button>
          <button type="button" onClick={() => { onNavigate?.('admin-jobs'); onClick?.(); }} className={navLinkClass(darkMode, currentPage === 'admin-jobs')}>Jobs</button>
          <button type="button" onClick={() => { onNavigate?.('admin-admins'); onClick?.(); }} className={navLinkClass(darkMode, currentPage === 'admin-admins')}>Admins</button>
          <button type="button" onClick={() => { onNavigate?.('admin-contacts'); onClick?.(); }} className={navLinkClass(darkMode, currentPage === 'admin-contacts')}>Contacts</button>
          <button type="button" onClick={() => { onNavigate?.('admin-reports'); onClick?.(); }} className={navLinkClass(darkMode, currentPage === 'admin-reports')}>Reports</button>
        </>
      )}
      {(isStudent || isEmployer) && (
        <button type="button" onClick={() => { onNavigate?.('messages'); onClick?.(); }} className={`relative ${navLinkClass(darkMode, currentPage === 'messages')}`} aria-label="Messages">
          Messages
          {unreadMessages > 0 && (
            <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-bridged-teal px-1 text-[10px] font-bold text-white" aria-hidden>{unreadMessages}</span>
          )}
        </button>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-bridged-light dark:bg-bridged-primary">
      <header
        className={`sticky top-0 z-20 w-full min-w-0 ${
          darkMode ? 'bg-bridged-primary/95 backdrop-blur-md' : 'bg-white/95 backdrop-blur-md'
        } shadow-sm`}
      >
        <div className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3 lg:px-6">
          <div className="flex min-w-0 shrink items-center">
            <img
              src={darkMode ? '/images/logo-dark.png' : '/images/logo-light.png'}
              alt="BridgEd"
              className="h-8 w-auto max-h-9 max-w-[9.5rem] cursor-pointer object-contain object-left sm:max-w-[11rem] sm:max-h-10 lg:max-w-[12rem]"
              onClick={() => onNavigate?.(user?.role === 'admin' ? 'admin-dashboard' : 'dashboard')}
            />
          </div>

          {/* Nav: horizontal from lg up; phone + tablet use hamburger below */}
          <nav className="hidden min-w-0 items-center gap-3 lg:flex xl:gap-6">
            {buildNavLinks(null)}
          </nav>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 lg:gap-2">
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => { onNavigate?.('notifications'); }}
                className={`relative rounded-lg p-2 transition-colors lg:hidden ${
                  darkMode
                    ? 'text-bridged-light hover:bg-bridged-light/10'
                    : 'text-bridged-primary/80 hover:bg-bridged-primary/10 hover:text-bridged-primary'
                }`}
                aria-label="Notifications"
              >
                <i className="fa-solid fa-bell" style={{ width: '1.25rem', display: 'inline-block', textAlign: 'center' }} />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" aria-hidden />
                )}
              </button>
              <button
                type="button"
                onClick={() => setNotificationsOpen((o) => !o)}
                className={`relative hidden rounded-lg p-2 transition-colors lg:flex ${
                  darkMode
                    ? 'text-bridged-light hover:bg-bridged-light/10'
                    : 'text-bridged-primary/80 hover:bg-bridged-primary/10 hover:text-bridged-primary'
                }`}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <i className="fa-solid fa-bell" style={{ width: '1.25rem', display: 'inline-block', textAlign: 'center' }} />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" aria-hidden />
                )}
              </button>
              {notificationsOpen && (
                <div
                  className={`absolute right-0 top-full z-30 mt-1 w-[min(90vw,320px)] rounded-xl border shadow-lg ${
                    darkMode
                      ? 'border-bridged-teal/30 bg-bridged-primary'
                      : 'border-bridged-primary/10 bg-white'
                  }`}
                  role="dialog"
                  aria-label="Notifications preview"
                >
                  <div className="max-h-[70vh] overflow-y-auto p-2">
                  <p className="mb-2 px-2 py-1 text-sm font-medium text-bridged-primary dark:text-bridged-light">
                    Notifications
                  </p>
                    {loadingNotifications ? (
                    <p className="px-2 py-4 text-sm text-bridged-primary/60 dark:text-bridged-light/60">
                      Loading...
                    </p>
                    ) : notifications.length === 0 ? (
                    <p className="px-2 py-4 text-sm text-bridged-primary/60 dark:text-bridged-light/60">
                      No notifications yet.
                    </p>
                    ) : (
                      <ul className="space-y-1">
                        {notifications.slice(0, 8).map((n) => (
                          <li
                            key={n.notification_id}
                            className={`rounded-lg px-2 py-2 text-sm ${
                            darkMode
                              ? 'text-bridged-light/90 hover:bg-bridged-light/5'
                              : 'text-bridged-primary/90 hover:bg-bridged-primary/5'
                            } ${!n.is_read ? (darkMode ? 'bg-bridged-teal/10' : 'bg-bridged-teal/5') : ''}`}
                          >
                          <span className="text-xs font-medium text-bridged-teal">
                            {notificationTypeLabel(n.type)}
                          </span>
                            <p className="mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="mt-0.5 text-xs opacity-70">
                            {n.created_at
                              ? new Date(n.created_at).toLocaleString(undefined, {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {onNavigate && (
                  <div
                    className={`border-t p-2 ${
                      darkMode ? 'border-bridged-teal/30' : 'border-bridged-primary/10'
                    }`}
                  >
                      <button
                        type="button"
                      onClick={() => {
                        setNotificationsOpen(false);
                        onNavigate('notifications');
                      }}
                        className="w-full rounded-lg py-2 text-sm font-medium text-bridged-teal hover:bg-bridged-teal/10 dark:hover:bg-bridged-teal/20"
                      >
                        View all notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('settings')}
              className={`rounded-lg p-2 transition-colors ${
                currentPage === 'settings'
                  ? darkMode ? 'text-bridged-accent' : 'text-bridged-teal'
                  : darkMode
                    ? 'text-bridged-light/80 hover:bg-bridged-light/10 hover:text-bridged-light'
                    : 'text-bridged-primary/80 hover:bg-bridged-primary/10 hover:text-bridged-primary'
              }`}
              aria-label="Settings"
            >
              <i className="fa-solid fa-gear" style={{ width: '1.25rem', display: 'inline-block', textAlign: 'center' }} />
            </button>
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              className={`rounded-lg p-2 transition-colors ${
                darkMode
                  ? 'text-bridged-light/80 hover:bg-bridged-light/10 hover:text-bridged-light'
                  : 'text-bridged-primary/80 hover:bg-bridged-primary/10 hover:text-bridged-primary'
              }`}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode
                ? <i className="fa-solid fa-sun" style={{ width: '1.25rem', display: 'inline-block', textAlign: 'center' }} />
                : <i className="fa-solid fa-moon" style={{ width: '1.25rem', display: 'inline-block', textAlign: 'center' }} />
              }
            </button>

            <div
              className={`hidden h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold lg:flex ${
                darkMode ? 'bg-bridged-teal text-white' : 'border-2 border-bridged-accent bg-bridged-light text-bridged-primary'
              }`}
              title={displayName}
              aria-hidden
            >
            {navPhotoUrl ? (
              <img
                src={navPhotoUrl}
                alt={displayName}
                className="h-full w-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              initial
            )}
            </div>
            <button
              type="button"
              onClick={onLogout}
              className={`hidden items-center gap-2 text-sm font-medium lg:flex ${
                darkMode ? 'text-bridged-light/80 hover:text-bridged-light' : 'text-bridged-primary/80 hover:text-bridged-primary'
              }`}
            >
              <i className="fa-solid fa-right-from-bracket" style={{ width: '1rem', display: 'inline-block', textAlign: 'center' }} aria-hidden />
              Logout
            </button>

            {/* Hamburger: phone + tablet (&lt; lg) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className={`rounded-lg p-2 transition-colors lg:hidden ${
                darkMode ? 'text-bridged-light hover:bg-bridged-light/10' : 'text-bridged-primary/80 hover:bg-bridged-primary/10'
              }`}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              <i className={`fa-solid ${mobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`} style={{ width: '1.25rem', display: 'inline-block', textAlign: 'center' }} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            className={`flex max-h-[min(75vh,520px)] flex-col gap-1 overflow-y-auto overscroll-contain border-t px-4 py-3 lg:hidden ${
              darkMode
                ? 'bg-bridged-primary border-bridged-teal/20'
                : 'bg-white border-bridged-primary/10'
            }`}
          >
            {buildNavLinks(closeMobileMenu)}
            <hr className={`my-2 border-0 border-t ${ darkMode ? 'border-bridged-light/10' : 'border-bridged-primary/10'}`} />
            <div className="flex items-center gap-3 py-1">
              <div
                className={`h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full overflow-hidden text-sm font-semibold ${
                  darkMode ? 'bg-bridged-teal text-white' : 'border-2 border-bridged-accent bg-bridged-light text-bridged-primary'
                }`}
              >
                {navPhotoUrl
                  ? <img src={navPhotoUrl} alt={displayName} className="h-full w-full object-cover" />
                  : initial
                }
              </div>
              <span className={`text-sm font-medium ${darkMode ? 'text-bridged-light' : 'text-bridged-primary'}`}>{displayName}</span>
            </div>
            <button
              type="button"
              onClick={() => { onLogout(); closeMobileMenu(); }}
              className={`flex items-center gap-2 py-2 text-sm font-medium text-red-500 hover:opacity-80`}
            >
              <i className="fa-solid fa-right-from-bracket" aria-hidden />
              Logout
            </button>
          </div>
        )}
      </header>

      <div
        className={`h-px w-full shrink-0 ${
          darkMode ? 'bg-bridged-teal/40' : 'bg-bridged-primary/10'
        }`}
      />

      <main
        className={`min-h-0 min-w-0 flex-1 overflow-x-hidden ${
          darkMode
            ? 'bg-bridged-primary'
            : 'bg-gradient-to-b from-bridged-light/80 to-white'
        }`}
      >
        <div className="min-w-0 px-2 sm:px-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
