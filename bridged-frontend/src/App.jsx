import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import StudentRegister from './components/StudentRegister';
import EmployerRegister from './components/EmployerRegister';
import MainLayout from './components/MainLayout';
import Dashboard from './components/Dashboard';
import StudentParser from './components/StudentParser';
import NotificationsPage from './components/NotificationsPage';
import SettingsPage from './components/SettingsPage';
import EmployerJobsPage from './components/EmployerJobsPage';
import JobFormPage from './components/JobFormPage';
import EmployerMatchesPage from './components/EmployerMatchesPage';
import StudentMatchesPage from './components/StudentMatchesPage';
import AdminDashboard from './components/AdminDashboard';
import LandingPage from './components/LandingPage';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import MessagesPage from './components/MessagesPage';
import { profileAPI, paystackAPI } from './api/api';
import { useNetworkStatus } from './utils/networkStatus';
import { getCached, CACHE_KEYS, clearAll as clearOfflineCache } from './utils/offlineCache';
import { drain as drainOfflineQueue, getCount as getOfflineQueueCount, clear as clearOfflineQueue } from './utils/offlineQueue';
import './App.css';

const NEEDS_REGISTRATION = 'needs_registration';
const NEEDS_CV = 'needs_cv';
const REGISTRATION_COMPLETE = 'complete';
const REGISTRATION_UNKNOWN = null;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registrationStatus, setRegistrationStatus] = useState(REGISTRATION_UNKNOWN);
  const [mainPage, setMainPage] = useState('landing');
  const [darkMode, setDarkMode] = useState(true);
  const [editJobId, setEditJobId] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncFailedCount, setSyncFailedCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0); 
  const [paymentResult, setPaymentResult] = useState(null); 

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
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');

    if (!storedUser || !token) {
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setMainPage(parsed.role === 'admin' ? 'admin-dashboard' : 'dashboard');
      checkProfileComplete(parsed);
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('trxref') || params.get('reference');
    if (!ref) return;
    window.history.replaceState({}, '', window.location.pathname);
    const token = localStorage.getItem('access_token');
    if (!token) {
      setPaymentResult({ ok: false, message: 'Please log in to confirm your payment.' });
      return;
    }
    paystackAPI.verify(ref)
      .then((data) => {
        setPaymentResult({ ok: true, message: data.message, plan: data.plan_display });
        setMainPage('settings');
      })
      .catch((err) => {
        const msg = err?.response?.data?.error || 'Could not verify your payment. Please contact support.';
        setPaymentResult({ ok: false, message: msg });
      });
  }, []);

  const checkProfileComplete = async (userData) => {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    try {
      if (userData.role === 'student') {
        let profile;
        if (offline) {
          const entry = await getCached(CACHE_KEYS.student_profile);
          profile = entry?.data ?? null;
        } else {
          profile = await profileAPI.getStudentProfile();
        }
        const hasMinimum = !!(
          profile?.university?.trim() ||
          profile?.course?.trim() ||
          profile?.display_name?.trim()
        );
        setRegistrationStatus(hasMinimum ? REGISTRATION_COMPLETE : NEEDS_REGISTRATION);
      } else if (userData.role === 'employer') {
        let profile;
        if (offline) {
          const entry = await getCached(CACHE_KEYS.employer_profile);
          profile = entry?.data ?? null;
        } else {
          profile = await profileAPI.getEmployerProfile();
        }
        const complete = profile?.company_name && profile.company_name !== 'Company Name Required';
        setRegistrationStatus(complete ? REGISTRATION_COMPLETE : NEEDS_REGISTRATION);
      } else {
        setRegistrationStatus(REGISTRATION_COMPLETE);
      }
    } catch {
      setRegistrationStatus(REGISTRATION_COMPLETE);
    } finally {
      setLoading(false);
    }
  };
  const handleCVComplete = () => setRegistrationStatus(REGISTRATION_COMPLETE);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setRegistrationStatus(REGISTRATION_UNKNOWN);
    setLoading(true);
    if (userData.role === 'admin') {
      setMainPage('admin-dashboard');
      setRegistrationStatus(REGISTRATION_COMPLETE);
      setLoading(false);
    } else {
      setMainPage('dashboard');
      checkProfileComplete(userData);
    }
  };

  const handleRegisterSuccess = (userData) => {
    setUser(userData);
    setRegistrationStatus(NEEDS_REGISTRATION);
  };

  const handleRegistrationComplete = () => {
    if (user?.role === 'student') {
      setRegistrationStatus(NEEDS_CV);
    } else {
      setRegistrationStatus(REGISTRATION_COMPLETE);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_display_name');
    clearOfflineQueue().catch(() => {});
    setUser(null);
    setRegistrationStatus(REGISTRATION_UNKNOWN);
    setMainPage('landing');
  };

  const { isOnline, wasOffline, clearWasOffline } = useNetworkStatus();

  useEffect(() => {
    if (!isOnline) return;
    getOfflineQueueCount()
      .then((count) => {
        if (count === 0) return;
        setSyncStatus('syncing');
        return drainOfflineQueue();
      })
      .then((result) => {
        if (result == null) return;
        if (result.failed > 0) {
          setSyncFailedCount(result.failed);
          setSyncStatus('failed');
        } else {
          setSyncStatus('synced');
          if (result.synced > 0) setRefreshTrigger((t) => t + 1);
        }
        const t = setTimeout(() => { setSyncStatus(null); setSyncFailedCount(0); }, 4000);
        return () => clearTimeout(t);
      })
      .catch(() => setSyncStatus('failed'));
  }, [isOnline]);

  const offlineBanner = !isOnline && (
    <div
      className="sticky top-0 z-50 flex w-full items-center justify-center gap-2 bg-amber-500/95 px-4 py-2 text-sm font-medium text-white shadow"
      role="status"
      aria-live="polite"
    >
      <i className="fa-solid fa-cloud opacity-90" aria-hidden />
      <span>You&apos;re offline. Some data may be outdated. Changes will sync when you&apos;re back online.</span>
    </div>
  );

  const backOnlineBar = wasOffline && isOnline && !syncStatus && (
    <div
      className="sticky top-0 z-50 flex w-full items-center justify-center gap-2 bg-bridged-teal/95 px-4 py-2 text-sm font-medium text-white shadow"
      role="status"
      aria-live="polite"
    >
      <i className="fa-solid fa-wifi" aria-hidden />
      <span>You&apos;re back online.</span>
      <button
        type="button"
        onClick={clearWasOffline}
        className="ml-2 rounded px-2 py-0.5 text-white/90 hover:bg-white/20"
      >
        Dismiss
      </button>
    </div>
  );

  const syncingBar = syncStatus === 'syncing' && (
    <div
      className="sticky top-0 z-50 flex w-full items-center justify-center gap-2 bg-bridged-teal/95 px-4 py-2 text-sm font-medium text-white shadow"
      role="status"
      aria-live="polite"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
      <span>Syncing changes…</span>
    </div>
  );

  const syncedBar = syncStatus === 'synced' && (
    <div
      className="sticky top-0 z-50 flex w-full items-center justify-center gap-2 bg-green-600/95 px-4 py-2 text-sm font-medium text-white shadow"
      role="status"
      aria-live="polite"
    >
      <i className="fa-solid fa-check" aria-hidden />
      <span>All changes synced.</span>
    </div>
  );

  const syncFailedBar = syncStatus === 'failed' && (
    <div
      className="sticky top-0 z-50 flex w-full items-center justify-center gap-2 bg-amber-600/95 px-4 py-2 text-sm font-medium text-white shadow"
      role="status"
      aria-live="polite"
    >
      <i className="fa-solid fa-triangle-exclamation" aria-hidden />
      <span>
        {syncFailedCount > 0
          ? `${syncFailedCount} change(s) could not be synced.`
          : 'Some changes could not be synced.'}
      </span>
    </div>
  );

  if (loading && user && registrationStatus === REGISTRATION_UNKNOWN) {
    return (
      <div className="min-h-screen bg-bridged-light dark:bg-bridged-primary">
        {offlineBanner}
        {backOnlineBar}
        {syncingBar}
        {syncedBar}
        {syncFailedBar}
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-bridged-primary/20 border-t-bridged-teal dark:border-bridged-light/20 dark:border-t-bridged-teal" aria-hidden />
        </div>
      </div>
    );
  }

  const toggleDarkMode = () => setDarkMode(d => !d);

  if (!user) {
    const pageWrapper = (content) => (
      <div className="min-h-screen bg-bridged-light dark:bg-bridged-primary">
        {offlineBanner} 
        {backOnlineBar} 
        {syncingBar} 
        {syncedBar} 
        {syncFailedBar}
        {content}
      </div>
    );

    if (mainPage === 'about') return pageWrapper(
      <AboutPage onNavigate={setMainPage} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
    );
    if (mainPage === 'contact') return pageWrapper(
      <ContactPage onNavigate={setMainPage} darkMode={darkMode} toggleDarkMode={toggleDarkMode} user={user} />
    );
    if (mainPage === 'auth') return pageWrapper(
      <Auth
        onLoginSuccess={handleLoginSuccess}
        onRegisterSuccess={handleRegisterSuccess}
        onBack={() => setMainPage('landing')}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
    );
    
    return pageWrapper(
      <LandingPage onNavigate={setMainPage} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
    );
  }

  if (registrationStatus === NEEDS_REGISTRATION) {
    return (
      <div className="min-h-screen bg-bridged-light dark:bg-bridged-primary">
        {offlineBanner}
        {backOnlineBar}
        {syncingBar}
        {syncedBar}
        {syncFailedBar}
        {user.role === 'student' ? (
          <StudentRegister user={user} onComplete={handleRegistrationComplete} />
        ) : (
          <EmployerRegister user={user} onComplete={handleRegistrationComplete} />
        )}
      </div>
    );
  }

  if (registrationStatus === NEEDS_CV && user.role === 'student') {
    return (
      <div className="min-h-screen bg-bridged-light dark:bg-bridged-primary">
        {offlineBanner}
        {backOnlineBar}
        {syncingBar}
        {syncedBar}
        {syncFailedBar}
        <StudentParser user={user} onComplete={handleCVComplete} isSignupStep />
      </div>
    );
  }

  const handleNavigate = (page, context) => {
    setMainPage(page);
    if (page !== 'jobs-edit') setEditJobId(null);
    if (page === 'jobs-edit' && context?.jobId != null) setEditJobId(context.jobId);
  };

  return (
    <div className="min-h-screen bg-bridged-light dark:bg-bridged-primary">
      {offlineBanner}
      {backOnlineBar}
      {syncingBar}
      {syncedBar}
      {syncFailedBar}

      {/* Payment result toast */}
      {paymentResult && (
        <div className={`fixed bottom-6 right-6 z-[9999] max-w-sm rounded-2xl shadow-xl p-5 flex gap-4 items-start
          ${paymentResult.ok
            ? 'bg-bridged-teal text-white'
            : 'bg-red-600 text-white'
          }`}
          role="status"
          aria-live="polite"
        >
          <i className={`fa-solid mt-0.5 text-xl ${paymentResult.ok ? 'fa-circle-check' : 'fa-circle-xmark'}`} aria-hidden />
          <div className="flex-1">
            {paymentResult.ok ? (
              <>
                <p className="font-bold text-lg leading-tight">Payment successful! 🎉</p>
                {paymentResult.plan && (
                  <p className="mt-1 text-sm opacity-90">{paymentResult.plan} plan is now active.</p>
                )}
                <p className="mt-1 text-sm opacity-80">Check the Subscriptions tab in Settings.</p>
              </>
            ) : (
              <>
                <p className="font-bold text-lg leading-tight">Payment could not be verified</p>
                <p className="mt-1 text-sm opacity-90">{paymentResult.message}</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPaymentResult(null)}
            className="shrink-0 opacity-80 hover:opacity-100"
            aria-label="Dismiss"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      <MainLayout
      user={user}
      onLogout={handleLogout}
      currentPage={mainPage}
      onNavigate={handleNavigate}
    >
      {mainPage === 'settings' ? (
        <SettingsPage user={user} onNavigate={handleNavigate} />
      ) : mainPage === 'messages' && (user.role === 'student' || user.role === 'employer') ? (
        <MessagesPage user={user} />
      ) : mainPage === 'notifications' ? (
        <NotificationsPage
          user={user}
          syncNotification={
            syncStatus === 'syncing'
              ? 'Syncing your offline changes…'
              : syncStatus === 'synced'
              ? 'All changes have been synced successfully.'
              : syncStatus === 'failed'
              ? `Some changes could not be synced (${syncFailedCount} failed). Please try again.`
              : null
          }
        />
      ) : mainPage === 'matches' && user.role === 'employer' ? (
        <EmployerMatchesPage user={user} onNavigate={handleNavigate} />
      ) : mainPage === 'student-matches' && user.role === 'student' ? (
        <StudentMatchesPage user={user} onNavigate={handleNavigate} />
      ) : mainPage === 'jobs' && user.role === 'employer' ? (
        <EmployerJobsPage
          user={user}
          refreshTrigger={refreshTrigger}
          onNavigateToCreate={() => setMainPage('jobs-new')}
          onNavigateToEdit={(id) => {
            setEditJobId(id);
            setMainPage('jobs-edit');
          }}
        />
      ) : mainPage === 'jobs-new' && user.role === 'employer' ? (
        <JobFormPage
          user={user}
          onSuccess={() => { setMainPage('jobs'); setRefreshTrigger((t) => t + 1); }}
          onBack={() => setMainPage('jobs')}
        />
      ) : mainPage === 'jobs-edit' && user.role === 'employer' ? (
        <JobFormPage
          user={user}
          jobId={editJobId}
          onSuccess={() => { setMainPage('jobs'); setEditJobId(null); setRefreshTrigger((t) => t + 1); }}
          onBack={() => { setMainPage('jobs'); setEditJobId(null); setRefreshTrigger((t) => t + 1); }}
        />
      ) : mainPage === 'student-registration' && user.role === 'student' ? (
        <StudentParser user={user} />
      ) : mainPage === 'resume-upload' && user.role === 'student' ? (
        <StudentParser
          user={user}
          onComplete={() => handleNavigate('settings')}
          isSignupStep={false}
          onBack={() => handleNavigate('settings')}
        />
      ) : mainPage === 'admin-dashboard' && user.role === 'admin' ? (
        <AdminDashboard user={user} activeTab="dashboard" />
      ) : mainPage === 'admin-students' && user.role === 'admin' ? (
        <AdminDashboard user={user} activeTab="students" />
      ) : mainPage === 'admin-employers' && user.role === 'admin' ? (
        <AdminDashboard user={user} activeTab="employers" />
      ) : mainPage === 'admin-admins' && user.role === 'admin' ? (
        <AdminDashboard user={user} activeTab="admins" />
      ) : mainPage === 'admin-jobs' && user.role === 'admin' ? (
        <AdminDashboard user={user} activeTab="jobs" />
      ) : mainPage === 'admin-contacts' && user.role === 'admin' ? (
        <AdminDashboard user={user} activeTab="contacts" />
      ) : mainPage === 'admin-reports' && user.role === 'admin' ? (
        <AdminDashboard user={user} activeTab="reports" />
      ) : (
        <Dashboard user={user} refreshTrigger={refreshTrigger} onNavigate={handleNavigate} />
      )}
    </MainLayout>
    </div>
  );
}

export default App;
