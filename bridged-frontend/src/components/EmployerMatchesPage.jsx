import { useState, useEffect } from 'react';
import { employerAPI, messagesAPI, statsAPI } from '../api/api';
import ConfirmationModal from './ConfirmationModal';
import { useNetworkStatus } from '../utils/networkStatus';
import { getCached, setCached, CACHE_KEYS } from '../utils/offlineCache';
import { useAlert } from '../context/GlobalAlertContext';

const cardClass =
  'rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-4 text-bridged-primary dark:text-bridged-light';

const EmployerMatchesPage = ({ user, onNavigate }) => {
  const { isOnline } = useNetworkStatus();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileMatchId, setProfileMatchId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { showAlert } = useAlert();
  const [overviewStats, setOverviewStats] = useState(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    type: 'info',
    onConfirm: null,
  });

  const openProfile = (matchId) => {
    setProfileMatchId(matchId);
    setProfile(null);
    setProfileLoading(true);
    employerAPI
      .getMatchStudentProfile(matchId)
      .then((data) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  };

  const handleDownloadResume = async (matchId) => {
    setDownloadLoading(matchId);
    try {
      const res = await employerAPI.getMatchResumeDownload(matchId);
      const blob = res.data;
      const contentType = res.headers?.['content-type'] || blob?.type || '';
      if (contentType.indexOf('application/json') !== -1) {
        const text = await blob.text();
        const j = JSON.parse(text);
        if (j?.url) {
          window.open(j.url, '_blank');
        }
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resume-${matchId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (_) {}
    setDownloadLoading(null);
  };

  const handleMessage = async (matchId) => {
    try {
      await messagesAPI.startConversation(matchId);
      onNavigate?.('messages');
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  const handleEmploy = (match) => {
    const name = match.student_interested ? (match.student?.display_name || match.student?.email) : 'the student';
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Employment',
      message: `Are you absolutely sure you want to employ ${name}? This will count towards your recruitment slots and notify the candidate.`,
      confirmText: 'Yes, Employ',
      type: 'success',
      onConfirm: async () => {
        try {
          await employerAPI.employCandidate(match.match_id);
          showAlert('Candidate employed successfully!', 'Success', 'success');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          showAlert(err.response?.data?.error || 'Failed to employ candidate.', 'Error', 'error');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDismiss = (matchId, name) => {
    setConfirmModal({
      isOpen: true,
      title: 'Dismiss Candidate',
      message: `Are you sure you want to dismiss ${name}? They will be removed from your match list for this job.`,
      confirmText: 'Yes, Dismiss',
      type: 'danger',
      onConfirm: async () => {
        try {
          await employerAPI.dismissCandidate(matchId);
          setMatches(prev => prev.filter(m => m.match_id !== matchId));
          showAlert('Candidate dismissed.', 'Success', 'success');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          showAlert('Failed to dismiss candidate.', 'Error', 'error');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const fetchMatches = () => {
    setLoading(true);
    if (!isOnline) {
      getCached(CACHE_KEYS.employer_matches)
        .then((entry) => {
          if (entry?.data != null) {
            setMatches(Array.isArray(entry.data) ? entry.data : []);
            setTotalPages(1);
          }
        })
        .finally(() => setLoading(false));
      return;
    }

    const params = { page };
    if (selectedJobId) {
      params.job_id = selectedJobId;
    }

    employerAPI
      .getMatches(params)
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
        setMatches(list);
        setTotalPages(data.count ? Math.ceil(data.count / 20) : 1);
        if (page === 1 && !selectedJobId) setCached(CACHE_KEYS.employer_matches, list);
      })
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPage(1); 
  }, [selectedJobId]);

  useEffect(() => {
    fetchMatches();
  }, [isOnline, page, selectedJobId]);

  useEffect(() => {
    if (!isOnline) {
      setOverviewStats(null);
      return;
    }

    let isMounted = true;
    const params = selectedJobId ? { job_id: selectedJobId } : {};

    statsAPI
      .getEmployerMatchStats(params)
      .then((data) => {
        if (isMounted) setOverviewStats(data);
      })
      .catch(() => {
        if (isMounted) setOverviewStats(null);
      });
    return () => {
      isMounted = false;
    };
  }, [isOnline, selectedJobId]);

  const jobsMap = {};
  matches.forEach((m) => {
    const jid = m.job?.job_id;
    if (!jid) return;
    if (!jobsMap[jid]) {
      jobsMap[jid] = {
        job: m.job,
        matches: [],
      };
    }
    jobsMap[jid].matches.push(m);
  });
  const sortedJobs = Object.values(jobsMap).sort((a, b) => b.matches.length - a.matches.length);

  const selectedJob = selectedJobId ? (jobsMap[selectedJobId]?.job || null) : null;
  const shortlistMatches = selectedJobId ? matches : [];

  return (
    <div className="min-h-[60vh] w-full px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold text-bridged-primary dark:text-bridged-light">
        Matches
      </h1>
      <p className="mb-4 text-sm text-bridged-primary/70 dark:text-bridged-light/70">
        Students matched to your jobs. Identity is shown once they accept the match.
      </p>

      {overviewStats && (
      <div className="mb-6 rounded-2xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white/90 dark:bg-bridged-primary/40 px-4 py-4 sm:px-5 sm:py-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-bridged-primary/50 dark:text-bridged-light/60">
              <i className="fa-solid fa-chart-line text-bridged-teal" />
              <span>{selectedJobId ? 'Job match overview' : 'Match overview'}</span>
            </div>
              <p className="text-[11px] text-bridged-primary/60 dark:text-bridged-light/60 max-w-xl">
                Note: The match overview counts all matches for this job, while the shortlist below only shows the top candidates within your shortlist cap and current application window.
              </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full sm:w-auto">
              <div className="rounded-xl bg-bridged-teal/10 px-3 py-2.5 flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-bridged-teal/80">
                  Total matches
                </span>
                <span className="mt-0.5 text-base font-extrabold text-bridged-primary dark:text-bridged-light">
                  {overviewStats.total_matches.toLocaleString()}
                </span>
              </div>
              <div className="rounded-xl bg-emerald-500/10 px-3 py-2.5 flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600/80 dark:text-emerald-400/90">
                  Accepted
                </span>
                <span className="mt-0.5 text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                  {overviewStats.accepted_matches.toLocaleString()}
                </span>
              </div>
              <div className="rounded-xl bg-amber-500/10 px-3 py-2.5 flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600/90">
                  Pending
                </span>
                <span className="mt-0.5 text-base font-extrabold text-bridged-accent">
                  {overviewStats.pending_matches.toLocaleString()}
                </span>
              </div>
              <div className="rounded-xl bg-red-500/10 px-3 py-2.5 flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-red-600/90">
                  Declined
                </span>
                <span className="mt-0.5 text-base font-extrabold text-red-700">
                  {overviewStats.declined_matches.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isOnline && (
        <p className="mb-4 text-xs text-bridged-primary/60 dark:text-bridged-light/60">
          Showing cached matches. Connect to the internet to refresh.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-bridged-teal/30 border-t-bridged-teal" />
        </div>
      ) : (
        <>
          {selectedJobId ? (
            <>
              <div className="mb-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedJobId(null)}
                  className="flex items-center gap-2 text-sm font-medium text-bridged-teal hover:underline"
                >
                  <i className="fa-solid fa-arrow-left" />
                  Back to Matches List
                </button>
                <div className="flex-1 flex flex-col items-end gap-1">
                  <div className="text-right">
                    <h2 className="text-lg font-bold text-bridged-primary dark:text-bridged-light">
                      {selectedJob?.title || 'Job Shortlist'}
                    </h2>
                    <p className="text-xs text-bridged-primary/60 dark:text-bridged-light/60">
                      Shortlist candidates
                    </p>
                  </div>
                </div>
              </div>

              <ul className="space-y-4">
                {shortlistMatches.map((m) => {
                  const name = m.student_interested ? (m.student?.display_name || m.student?.email || 'Student') : 'A student';
                  return (
                    <li key={m.match_id} className={`${cardClass} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 hover:border-bridged-teal/20 transition-all`}>
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-14 w-14 shrink-0 rounded-2xl bg-bridged-teal/10 flex items-center justify-center text-bridged-teal font-bold text-xl uppercase shadow-inner">
                          {name[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-lg text-bridged-primary dark:text-bridged-light truncate">
                              {name}
                            </p>
                            {m.status === 'employed' && (
                              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <i className="fa-solid fa-check-circle" />
                                Employed
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-xs font-bold text-bridged-teal bg-bridged-teal/10 px-2 py-0.5 rounded-md">
                              {typeof m.compatibility_score === 'number' ? Math.round(m.compatibility_score) : '—'}% Match
                            </p>
                            <p className="text-xs text-bridged-primary/50 dark:text-bridged-light/50">
                              Matched {new Date(m.matched_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {m.student_interested ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openProfile(m.match_id)}
                              className="rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/40 px-4 py-2 text-sm font-semibold text-bridged-primary dark:text-bridged-light hover:bg-bridged-primary/5 dark:hover:bg-bridged-light/5 transition-colors"
                            >
                              View Profile
                            </button>
                            
                            <button
                              type="button"
                              disabled={downloadLoading === m.match_id}
                              onClick={() => handleDownloadResume(m.match_id)}
                              className="rounded-xl bg-bridged-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-bridged-primary/10 hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                            >
                              <i className="fa-solid fa-file-arrow-down" />
                              {downloadLoading === m.match_id ? 'Downloading...' : 'Download CV'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMessage(m.match_id)}
                              className="rounded-xl border-2 border-bridged-teal px-4 py-2 text-sm font-bold text-bridged-teal hover:bg-bridged-teal hover:text-white transition-all"
                            >
                              Message
                            </button>

                            {m.status !== 'employed' && (
                              <div className="flex gap-2 ml-2 pl-4 border-l border-bridged-primary/10 dark:border-bridged-light/10">
                                <button
                                  type="button"
                                  onClick={() => handleEmploy(m)}
                                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
                                >
                                  Employ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDismiss(m.match_id, name)}
                                  className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="rounded-xl bg-bridged-primary/5 dark:bg-bridged-light/5 px-4 py-2 border border-dashed border-bridged-primary/20 dark:border-bridged-light/20">
                              <p className="text-xs font-medium text-bridged-primary/40 dark:text-bridged-light/40 italic">
                                Waiting for student interaction
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDismiss(m.match_id, name)}
                              className="rounded-xl bg-red-500/10 px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sortedJobs.length === 0 ? (
                <div className={`col-span-full ${cardClass} p-12 text-center`}>
                  <i className="fa-solid fa-briefcase text-4xl opacity-10 mb-3" />
                  <p className="text-bridged-primary/40 dark:text-bridged-light/40">
                    No students matched to your jobs yet.
                  </p>
                </div>
              ) : (
                sortedJobs.map((group) => (
                  <div key={group.job.job_id} className={`${cardClass} flex flex-col justify-between hover:border-bridged-teal/30 transition-colors`}>
                    <div>
                      <h3 className="text-lg font-bold text-bridged-primary dark:text-bridged-light mb-1 truncate">
                        {group.job.title}
                      </h3>
                      <p className="text-xs text-bridged-primary/60 dark:text-bridged-light/60 mb-6">
                        {group.matches.length} matches on this page
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedJobId(group.job.job_id)}
                      className="w-full rounded-xl bg-bridged-teal py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      View Shortlist
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0); }}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 text-sm font-bold text-bridged-primary/60 dark:text-bridged-light/60 hover:bg-bridged-primary/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <i className="fa-solid fa-chevron-left mr-2" /> Previous
              </button>
              <span className="text-sm font-bold text-bridged-primary/40 dark:text-bridged-light/40">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo(0, 0); }}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 text-sm font-bold text-bridged-primary/60 dark:text-bridged-light/60 hover:bg-bridged-primary/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next <i className="fa-solid fa-chevron-right ml-2" />
              </button>
            </div>
          )}
        </>
      )}

      {profileMatchId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-bridged-primary p-6 shadow-2xl">
            <button
              onClick={() => setProfileMatchId(null)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-bridged-primary/5 text-bridged-primary hover:bg-bridged-primary/10 dark:bg-bridged-light/5 dark:text-bridged-light"
            >
              <i className="fa-solid fa-xmark" />
            </button>
            <h2 id="profile-modal-title" className="text-2xl font-bold text-bridged-primary dark:text-bridged-light">
              Student Profile
            </h2>
            {profileLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-bridged-teal/30 border-t-bridged-teal" />
              </div>
            ) : profile ? (
              <div className="mt-4 space-y-3 text-sm">
                {profile.display_name && <p><span className="font-medium text-bridged-primary dark:text-bridged-light">Name:</span> {profile.display_name}</p>}
                {profile.email && <p><span className="font-medium text-bridged-primary dark:text-bridged-light">Email:</span> {profile.email}</p>}
                {profile.university && <p><span className="font-medium text-bridged-primary dark:text-bridged-light">University:</span> {profile.university}</p>}
                {profile.course && <p><span className="font-medium text-bridged-primary dark:text-bridged-light">Course:</span> {profile.course}</p>}
                {profile.expected_graduation_year && <p><span className="font-medium text-bridged-primary dark:text-bridged-light">Expected graduation:</span> {profile.expected_graduation_year}</p>}
                {profile.location && <p><span className="font-medium text-bridged-primary dark:text-bridged-light">Location:</span> {profile.location}</p>}
                {profile.linkedin_url && (
                  <p>
                    <span className="font-medium text-bridged-primary dark:text-bridged-light">LinkedIn: </span>
                    <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-bridged-teal hover:underline break-all">
                      {profile.linkedin_url}
                    </a>
                  </p>
                )}
                {Array.isArray(profile.additional_links) && profile.additional_links.length > 0 && (
                  <div>
                    <span className="font-medium text-bridged-primary dark:text-bridged-light">Additional links:</span>
                    <ul className="mt-1 space-y-1">
                      {profile.additional_links.map((link, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          {link.link_type && (
                            <span className="rounded bg-bridged-teal/10 px-1.5 py-0.5 text-xs font-medium text-bridged-teal flex-shrink-0">
                              {link.link_type}
                            </span>
                          )}
                          {link.url ? (
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-bridged-teal hover:underline break-all"
                            >
                              {link.url}
                            </a>
                          ) : (
                            <span className="text-bridged-primary/50 dark:text-bridged-light/50 italic">No URL</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {typeof profile.compatibility_score === 'number' && <p><span className="font-medium text-bridged-primary dark:text-bridged-light">Match score:</span> {Math.round(profile.compatibility_score)}%</p>}
                {profile.job_title && <p><span className="font-medium text-bridged-primary dark:text-bridged-light">Job:</span> {profile.job_title}</p>}
                {(profile.has_resume_file || profile.resume_file_url) && (
                  <p className="pt-2">
                    <button
                      type="button"
                      disabled={downloadLoading === profileMatchId}
                      onClick={() => handleDownloadResume(profileMatchId)}
                      className="rounded-lg bg-bridged-teal px-3 py-1.5 text-sm font-medium text-white hover:opacity-95 disabled:opacity-50"
                    >
                      {downloadLoading === profileMatchId ? '…' : 'Download CV'}
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-bridged-primary/60 dark:text-bridged-light/60">Could not load profile.</p>
            )}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default EmployerMatchesPage;
