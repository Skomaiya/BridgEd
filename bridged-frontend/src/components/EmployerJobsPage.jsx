import { useState, useEffect, useCallback } from 'react';
import { jobsAPI, API_PAGE_SIZE } from '../api/api';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { useNetworkStatus } from '../utils/networkStatus';
import { getCached, setCached, CACHE_KEYS } from '../utils/offlineCache';
import { useAlert } from '../context/GlobalAlertContext';

const cardClass =
  'rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-4 text-bridged-primary dark:text-bridged-light min-w-0';

function partitionJobsByStatus(jobs, now) {
  const activeJobs = jobs.filter(
    (j) =>
      j.is_open &&
      (!j.application_deadline || new Date(j.application_deadline) >= now)
  );
  const expiredJobs = jobs.filter(
    (j) =>
      !j.is_open ||
      (j.application_deadline && new Date(j.application_deadline) < now)
  );
  return { activeJobs, expiredJobs };
}

const EmployerJobsPage = ({ user: _user, refreshTrigger = 0, onNavigateToCreate, onNavigateToEdit }) => {
  const { isOnline } = useNetworkStatus();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);
  const { showAlert } = useAlert();

  const fetchJobs = useCallback((search = '', p = 1, tab = 'active') => {
    setLoading(true);
    const now = new Date();
    if (!isOnline) {
      getCached(CACHE_KEYS.employer_my_jobs)
        .then((entry) => {
          if (entry?.data != null) {
            let list = Array.isArray(entry.data) ? entry.data : [];
            if (search) {
              const s = search.toLowerCase();
              list = list.filter(
                (j) =>
                  j.title.toLowerCase().includes(s) ||
                  (j.location && j.location.toLowerCase().includes(s))
              );
            }
            const { activeJobs, expiredJobs } = partitionJobsByStatus(list, now);
            const slice = tab === 'active' ? activeJobs : expiredJobs;
            setJobs(slice);
            setTotalPages(1);
            setTotalCount(slice.length);
            setActiveCount(activeJobs.length);
            setExpiredCount(expiredJobs.length);
          } else {
            setJobs([]);
            setTotalCount(0);
            setActiveCount(0);
            setExpiredCount(0);
          }
        })
        .finally(() => setLoading(false));
      return;
    }

    const listingStatus = tab === 'active' ? 'active' : 'expired';
    jobsAPI
      .getMyJobs(search, { page: p, listing_status: listingStatus })
      .then((data) => {
        const list = Array.isArray(data.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : [];
        setJobs(list);
        const count = data.count != null ? data.count : list.length;
        setTotalPages(count ? Math.ceil(count / API_PAGE_SIZE) : 1);
        setTotalCount(count);
        if (typeof data.active_count === 'number') setActiveCount(data.active_count);
        if (typeof data.expired_count === 'number') setExpiredCount(data.expired_count);
        if (!search && p === 1 && tab === 'active') {
          setCached(CACHE_KEYS.employer_my_jobs, list);
        }
      })
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [isOnline]);

  useEffect(() => {
    fetchJobs(searchTerm, page, activeTab);
  }, [isOnline, refreshTrigger, searchTerm, page, activeTab, fetchJobs]);

  const handleDeleteSubmitting = (jobId, title) => {
    setDeleteTarget({ id: jobId, type: 'job', name: title });
    setShowDeleteModal(true);
  };

  const confirmDeleteJob = async (jobId) => {
    setProcessingId(jobId);
    try {
      await jobsAPI.delete(jobId);
      setJobs((prev) => prev.filter((j) => j.job_id !== jobId));
      setShowDeleteModal(false);
      setDeleteTarget(null);
      showAlert('Job deleted successfully.', 'Success', 'success');
      fetchJobs(searchTerm, page, activeTab);
    } catch (err) {
      showAlert('Failed to delete job. Please try again.', 'Error', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const displayedJobs = jobs;

  return (
    <div className="min-h-[60vh] w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0 shrink">
          <h1 className="text-xl font-semibold text-bridged-primary dark:text-bridged-light">
            Jobs
          </h1>
          <p className="mt-1 text-sm text-bridged-primary/70 dark:text-bridged-light/70">
            Manage your job postings and listed roles.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:max-w-2xl lg:shrink-0">
          <div className="relative min-w-0 flex-1 sm:max-w-xs md:max-w-sm">
            <i className="fa-solid fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bridged-primary/40 dark:text-bridged-light/40" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full min-w-0 rounded-lg border border-bridged-primary/10 bg-white py-2 pl-9 pr-3 text-sm focus:border-bridged-teal focus:outline-none dark:border-bridged-light/10 dark:bg-bridged-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={onNavigateToCreate}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-bridged-teal px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-bridged-teal/20 transition hover:bg-bridged-teal-dark hover:scale-[1.02] active:scale-[0.98] sm:whitespace-nowrap"
          >
            <i className="fa-solid fa-plus-circle" aria-hidden />
            Create New Job
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-bridged-primary/10 dark:border-bridged-light/10 sm:gap-4">
        <button
          type="button"
          className={`px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
            activeTab === 'active'
              ? 'border-b-2 border-bridged-teal text-bridged-teal'
              : 'text-bridged-primary/60 hover:text-bridged-primary dark:text-bridged-light/60 dark:hover:text-bridged-light'
          }`}
          onClick={() => {
            setActiveTab('active');
            setPage(1);
          }}
        >
          Active{' '}
          <span
            className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] ${
              activeTab === 'active'
                ? 'bg-bridged-accent text-bridged-primary'
                : 'bg-bridged-primary/10 dark:bg-bridged-light/10 text-bridged-primary/60 dark:text-bridged-light/60'
            }`}
          >
            {activeCount}
          </span>
        </button>
        <button
          type="button"
          className={`px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
            activeTab === 'expired'
              ? 'border-b-2 border-bridged-teal text-bridged-teal'
              : 'text-bridged-primary/60 hover:text-bridged-primary dark:text-bridged-light/60 dark:hover:text-bridged-light'
          }`}
          onClick={() => {
            setActiveTab('expired');
            setPage(1);
          }}
        >
          Expired{' '}
          <span
            className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] ${
              activeTab === 'expired'
                ? 'bg-bridged-accent text-bridged-primary'
                : 'bg-bridged-primary/10 dark:bg-bridged-light/10 text-bridged-primary/60 dark:text-bridged-light/60'
            }`}
          >
            {expiredCount}
          </span>
        </button>
      </div>

      {!isOnline && (
        <p className="mb-4 text-xs text-bridged-primary/60 dark:text-bridged-light/60">
          Showing cached jobs. Connect to the internet to perform actions.
        </p>
      )}

      <section>
        {loading ? (
          <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">Loading...</p>
        ) : displayedJobs.length === 0 ? (
          <div className={cardClass}>
            <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">
              {searchTerm
                ? `No jobs found matching "${searchTerm}" in this category.`
                : activeTab === 'active'
                  ? "You don't have any active job postings."
                  : "You don't have any expired job postings."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {displayedJobs.map((job) => (
              <li key={job.job_id} className={cardClass}>
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 break-words font-medium leading-snug text-bridged-primary dark:text-bridged-light">
                      {job.title}
                    </h3>
                    {activeTab === 'expired' && (
                      <span className="shrink-0 rounded bg-bridged-accent px-1.5 py-0.5 text-[10px] font-bold text-bridged-primary">
                        EXPIRED
                      </span>
                    )}
                  </div>
                  {job.location && (
                    <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">
                      {job.location}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    <span className="inline-flex items-center rounded-full border border-bridged-primary/10 bg-bridged-primary/5 px-2 py-0.5 text-[10px] font-medium capitalize dark:border-bridged-light/10 dark:bg-bridged-light/5">
                      {job.contract_type?.replace('-', ' ') || 'Full time'}
                    </span>
                    {job.job_length && (
                      <span className="inline-flex items-center rounded-full border border-bridged-primary/10 bg-bridged-primary/5 px-2 py-0.5 text-[10px] font-medium dark:border-bridged-light/10 dark:bg-bridged-light/5">
                        {job.job_length}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-bridged-primary/50 dark:text-bridged-light/50">
                    {job.is_open ? 'Open' : 'Closed'}
                    {job.application_deadline
                      ? ` · Deadline ${new Date(job.application_deadline).toLocaleDateString()}`
                      : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigateToEdit(job.job_id)}
                      className="rounded-lg border border-bridged-teal/40 bg-transparent px-3 py-1.5 text-xs font-medium text-bridged-teal hover:bg-bridged-teal/10"
                    >
                      {activeTab === 'expired' ? 'Re-publish / Edit' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubmitting(job.job_id, job.title)}
                      className="rounded-lg border border-red-200 bg-transparent px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {totalPages > 1 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-bridged-primary/10 pt-6 dark:border-bridged-light/10">
          <button
            type="button"
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
              window.scrollTo(0, 0);
            }}
            disabled={page === 1}
            className="rounded-lg border border-bridged-primary/10 px-4 py-2 text-sm font-bold text-bridged-primary/60 transition-all hover:bg-bridged-primary/5 disabled:cursor-not-allowed disabled:opacity-30 dark:border-bridged-light/10 dark:text-bridged-light/60"
          >
            <i className="fa-solid fa-chevron-left mr-2" /> Previous
          </button>
          <span className="text-sm font-bold text-bridged-primary/40 dark:text-bridged-light/40">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1));
              window.scrollTo(0, 0);
            }}
            disabled={page === totalPages}
            className="rounded-lg border border-bridged-primary/10 px-4 py-2 text-sm font-bold text-bridged-primary/60 transition-all hover:bg-bridged-primary/5 disabled:cursor-not-allowed disabled:opacity-30 dark:border-bridged-light/10 dark:text-bridged-light/60"
          >
            Next <i className="fa-solid fa-chevron-right ml-2" />
          </button>
        </div>
      )}
      {totalPages === 1 && totalCount > 0 && isOnline && (
        <p className="mt-6 text-center text-xs text-bridged-primary/45 dark:text-bridged-light/45">
          Showing all {totalCount} job{totalCount === 1 ? '' : 's'} in this tab
          {searchTerm ? ' (filtered)' : ''}.
        </p>
      )}

      {showDeleteModal && (
        <DeleteConfirmationModal
          target={deleteTarget}
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={confirmDeleteJob}
          processing={processingId === deleteTarget.id}
        />
      )}
    </div>
  );
};

export default EmployerJobsPage;
