import { useState, useEffect } from 'react';
import { profileAPI, jobsAPI, employerAPI, matchAPI } from '../api/api';
import { getDisplayName } from '../utils/displayName';
import { useNetworkStatus } from '../utils/networkStatus';
import { getCached, setCached, CACHE_KEYS } from '../utils/offlineCache';

const cardClass =
  'rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-4 text-bridged-primary dark:text-bridged-light';

function formatDeadline(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return `Closes on ${d.toLocaleDateString(undefined, options)}`;
  } catch (_) {
    return `Closes on ${dateStr}`;
  }
}

function filterActiveMatches(list) {
  const now = new Date();
  return (list || []).filter((m) => {
    if (m.is_open === false) return false;
    if (m.application_deadline) {
      try { if (new Date(m.application_deadline) < now) return false; } catch (_) {}
    }
    return true;
  });
}

const Dashboard = ({ user, refreshTrigger = 0, onNavigate }) => {
  const { isOnline } = useNetworkStatus();
  const [employerProfile, setEmployerProfile] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [studentMatches, setStudentMatches] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingStudentMatches, setLoadingStudentMatches] = useState(false);
  const [studentMatchError, setStudentMatchError] = useState('');
  const [cachedAt, setCachedAt] = useState(null);

  const isEmployer = user?.role === 'employer';
  const isStudent = user?.role === 'student';

  useEffect(() => {
    if (!isEmployer) {
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
      setCachedAt(null);
    }).catch(() => {});
  }, [isEmployer, isOnline, refreshTrigger]);

  useEffect(() => {
    if (!isStudent) {
      setStudentProfile(null);
      return;
    }
    if (!isOnline) {
      getCached(CACHE_KEYS.student_profile).then((entry) => {
        if (entry?.data != null) setStudentProfile(entry.data);
        if (entry?.cachedAt) setCachedAt((prev) => (prev == null ? entry.cachedAt : Math.max(prev, entry.cachedAt)));
      });
      return;
    }
    profileAPI.getStudentProfile().then((p) => {
      setStudentProfile(p);
      setCached(CACHE_KEYS.student_profile, p);
      setCachedAt(null);
    }).catch(() => {});
  }, [isStudent, isOnline, refreshTrigger]);

  useEffect(() => {
    if (!isEmployer) return;
    setLoadingJobs(true);
    if (!isOnline) {
      getCached(CACHE_KEYS.employer_my_jobs).then((entry) => {
        if (entry?.data != null) setJobs(Array.isArray(entry.data) ? entry.data : []);
        if (entry?.cachedAt) setCachedAt((prev) => (prev == null ? entry.cachedAt : Math.max(prev, entry.cachedAt)));
      }).finally(() => setLoadingJobs(false));
      return;
    }
    jobsAPI.getMyJobs()
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
        setJobs(list);
        setCached(CACHE_KEYS.employer_my_jobs, list);
        setCachedAt(null);
      })
      .catch(() => setJobs([]))
      .finally(() => setLoadingJobs(false));
  }, [isEmployer, isOnline, refreshTrigger]);

  useEffect(() => {
    if (!isEmployer) return;
    setLoadingMatches(true);
    if (!isOnline) {
      getCached(CACHE_KEYS.employer_matches).then((entry) => {
        if (entry?.data != null) setMatches(Array.isArray(entry.data) ? entry.data : []);
        if (entry?.cachedAt) setCachedAt((prev) => (prev == null ? entry.cachedAt : Math.max(prev, entry.cachedAt)));
      }).finally(() => setLoadingMatches(false));
      return;
    }
    employerAPI.getMatches()
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
        const filtered = filterActiveMatches(list);
        setMatches(filtered);
        setCached(CACHE_KEYS.employer_matches, filtered);
        setCachedAt(null);
      })
      .catch(() => setMatches([]))
      .finally(() => setLoadingMatches(false));
  }, [isEmployer, isOnline, refreshTrigger]);

  useEffect(() => {
    if (!isStudent) return;
    setLoadingStudentMatches(true);
    setStudentMatchError('');
    if (!isOnline) {
      getCached(CACHE_KEYS.student_match).then((entry) => {
        if (entry?.data != null) {
          const list = Array.isArray(entry.data.matches) ? entry.data.matches : [];
          setStudentMatches(list);
          if (entry?.cachedAt) setCachedAt((prev) => (prev == null ? entry.cachedAt : Math.max(prev, entry.cachedAt)));
        } else {
          setStudentMatches([]);
        }
      }).finally(() => setLoadingStudentMatches(false));
      return;
    }
    matchAPI.getMyMatches()
      .then((data) => {
        const all = Array.isArray(data.matches) ? data.matches : [];
        setStudentMatches(filterActiveMatches(all));
        setCached(CACHE_KEYS.student_match, data);
        setCachedAt(null);
      })
      .catch((err) => {
        const msg = err.response?.data?.error || 'Could not load matches.';
        setStudentMatchError(msg);
        setStudentMatches([]);
      })
      .finally(() => setLoadingStudentMatches(false));
  }, [isStudent, isOnline, refreshTrigger]);

  const displayName = getDisplayName(user, employerProfile?.company_name, studentProfile?.display_name);

  return (
    <div className="min-h-[60vh] w-full px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-bridged-primary/70 dark:text-bridged-light/70">
          {displayName ? (
            <>Welcome, <strong className="text-bridged-primary dark:text-bridged-light">{displayName}</strong>. This is your dashboard.</>
          ) : (
            'Welcome. This is your dashboard.'
          )}
        </p>
        {isStudent && onNavigate && (
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('student-matches')}
              className="inline-flex items-center gap-2 rounded-lg bg-bridged-teal px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
            >
              <i className="fa-solid fa-briefcase" aria-hidden />
              Job matches
            </button>
          </div>
        )}
      </div>
      {!isOnline && cachedAt != null && (
        <p className="mb-4 text-xs text-bridged-primary/60 dark:text-bridged-light/60">
          Last updated at {new Date(cachedAt).toLocaleString()} (cached for offline)
        </p>
      )}

      {isEmployer && (
        <>
          <section id="employer-jobs" className="scroll-mt-6 mb-10">
            <h2 className="mb-4 text-lg font-semibold text-bridged-primary dark:text-bridged-light">
              Your jobs
            </h2>
            {loadingJobs ? (
              <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">Loading...</p>
            ) : jobs.filter(j => j.is_open && (!j.application_deadline || new Date(j.application_deadline) >= new Date())).length === 0 ? (
              <div className={cardClass}>
                <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">No active jobs found. Check the Jobs page for expired listings.</p>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {jobs.filter(j => j.is_open && (!j.application_deadline || new Date(j.application_deadline) >= new Date())).map((job) => (
                  <li key={job.job_id} className={cardClass}>
                    <h3 className="font-medium text-bridged-primary dark:text-bridged-light">{job.title}</h3>
                    {job.location && (
                      <p className="mt-1 text-sm text-bridged-primary/60 dark:text-bridged-light/60">{job.location}</p>
                    )}
                    <p className="mt-2 text-xs text-bridged-primary/50 dark:text-bridged-light/50">
                      <span className="capitalize">{job.contract_type?.replace('-', ' ') || 'Full time'}</span> · {job.is_open ? 'Open' : 'Closed'} · {formatDeadline(job.application_deadline)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="employer-matches" className="scroll-mt-6">
            <h2 className="mb-4 text-lg font-semibold text-bridged-primary dark:text-bridged-light">
              Matches
            </h2>
            {loadingMatches ? (
              <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">Loading...</p>
            ) : matches.length === 0 ? (
              <div className={cardClass}>
                <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">
                  {jobs.length > 0
                    ? "No student matches yet. We'll inform you when there is a match."
                    : 'No student matches yet. Post a job to get matches.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {matches.map((m) => (
                  <li key={m.match_id} className={cardClass}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium text-bridged-primary dark:text-bridged-light">
                          {m.student?.anonymized ? 'A student' : (m.student?.email ?? m.student?.user?.email ?? 'Student')}
                        </span>
                        <span className="mx-2 text-bridged-primary/50 dark:text-bridged-light/50">·</span>
                        <span className="text-sm text-bridged-primary/70 dark:text-bridged-light/70">
                          {m.job?.title ?? 'Job'}
                        </span>
                      </div>
                      <span className="rounded-full bg-bridged-teal/20 px-2 py-0.5 text-sm font-medium text-bridged-teal">
                        {typeof m.compatibility_score === 'number' ? Math.round(m.compatibility_score) : '—'}% match
                      </span>
                    </div>
                    {m.matched_at && (
                      <p className="mt-1 text-xs text-bridged-primary/50 dark:text-bridged-light/50">
                        Matched {new Date(m.matched_at).toLocaleDateString()}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {isStudent && (
        <section id="student-matches" className="scroll-mt-6">
          <h2 className="mb-4 text-lg font-semibold text-bridged-primary dark:text-bridged-light">
            Your job matches
          </h2>
          {loadingStudentMatches ? (
            <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">Loading...</p>
          ) : studentMatchError ? (
            <div className={cardClass}>
              <p className="text-sm text-bridged-primary/70 dark:text-bridged-light/70">{studentMatchError}</p>
              <p className="mt-2 text-xs text-bridged-primary/60 dark:text-bridged-light/60">
                Upload a resume from the app to get matched with jobs.
              </p>
            </div>
          ) : studentMatches.length === 0 ? (
            <div className={cardClass}>
              <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">
                No active job matches yet. Upload your resume to see roles that match your skills.
              </p>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('student-matches')}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-bridged-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                >
                  <i className="fa-solid fa-magnifying-glass" aria-hidden />Find matches
                </button>
              )}
            </div>
          ) : (() => {
            const newMatches = studentMatches.filter((m) => m.student_interested === null || m.student_interested === undefined);
            const newCount = newMatches.length;
            const total = studentMatches.length;
            return (
              <div className={cardClass}>
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <p className="text-bridged-primary dark:text-bridged-light">
                      <span className="text-3xl font-bold text-bridged-teal">{total}</span>
                      <span className="ml-2 text-sm text-bridged-primary/70 dark:text-bridged-light/70">
                        active match{total !== 1 ? 'es' : ''}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-bridged-primary/50 dark:text-bridged-light/50">
                      All closed or expired jobs are automatically removed.
                    </p>
                  </div>
                  {newCount > 0 && (
                    <div className="flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" aria-hidden />
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                        {newCount} new — needs your response
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('student-matches')}
                      className="inline-flex items-center gap-2 rounded-lg bg-bridged-teal px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                    >
                      <i className="fa-solid fa-briefcase" aria-hidden />
                      {newCount > 0 ? `Review ${newCount} new match${newCount !== 1 ? 'es' : ''}` : 'View all matches'}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {!isEmployer && !isStudent && (
        <div className={cardClass + ' max-w-md'}>
          <p className="text-sm text-bridged-primary/70 dark:text-bridged-light/70">
            Use the app to upload your resume and discover job matches.
          </p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
