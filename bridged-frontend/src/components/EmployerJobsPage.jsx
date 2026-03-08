import { useState, useEffect } from 'react';
import { jobsAPI } from '../api/api';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { useNetworkStatus } from '../utils/networkStatus';
import { getCached, setCached, CACHE_KEYS } from '../utils/offlineCache';
import { useAlert } from '../context/GlobalAlertContext';

const cardClass =
  'rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-4 text-bridged-primary dark:text-bridged-light';

const EmployerJobsPage = ({ user, refreshTrigger = 0, onNavigateToCreate, onNavigateToEdit }) => {
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
  const { showAlert } = useAlert();

  const fetchJobs = (search = '', p = 1) => {
    setLoading(true);
    if (!isOnline) {
      getCached(CACHE_KEYS.employer_my_jobs)
        .then((entry) => {
          if (entry?.data != null) {
            let list = Array.isArray(entry.data) ? entry.data : [];
            if (search) {
              const s = search.toLowerCase();
              list = list.filter(j => 
                j.title.toLowerCase().includes(s) || 
                (j.location && j.location.toLowerCase().includes(s))
              );
            }
            setJobs(list);
            setTotalPages(1);
            setTotalCount(list.length);
          } else {
            setJobs([]);
            setTotalCount(0);
          }
        })
        .finally(() => setLoading(false));
      return;
    }
    
    jobsAPI
      .getMyJobs(search, { page: p })
      .then((data) => {
        const list = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
        setJobs(list);
        setTotalPages(data.count ? Math.ceil(data.count / 20) : 1);
        setTotalCount(data.count || list.length);
        if (!search && p === 1) setCached(CACHE_KEYS.employer_my_jobs, list);
      })
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPage(1);
  }, [searchTerm, activeTab]);

  useEffect(() => {
    fetchJobs(searchTerm, page);
  }, [isOnline, refreshTrigger, searchTerm, page]);

  const handleDeleteSubmitting = (jobId, title) => {
    setDeleteTarget({ id: jobId, type: 'job', name: title });
    setShowDeleteModal(true);
  };

  const confirmDeleteJob = async (jobId) => {
    setProcessingId(jobId);
    try {
      await jobsAPI.delete(jobId);
      setJobs(prev => prev.filter(j => j.job_id !== jobId));
      setShowDeleteModal(false);
      setDeleteTarget(null);
      showAlert('Job deleted successfully.', 'Success', 'success');
    } catch (err) {
      showAlert('Failed to delete job. Please try again.', 'Error', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const now = new Date();
  const activeJobs = jobs.filter(j => j.is_open && (!j.application_deadline || new Date(j.application_deadline) >= now));
  const expiredJobs = jobs.filter(j => !j.is_open || (j.application_deadline && new Date(j.application_deadline) < now));

  const displayedJobs = activeTab === 'active' ? activeJobs : expiredJobs;

  return (
    <div className="min-h-[60vh] w-full px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-bridged-primary dark:text-bridged-light">
            Jobs
          </h1>
          <p className="mt-1 text-sm text-bridged-primary/70 dark:text-bridged-light/70">
            Manage your job postings and listed roles.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-bridged-primary/40 dark:text-bridged-light/40" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-bridged-primary/10 bg-white px-9 py-2 text-sm focus:border-bridged-teal focus:outline-none dark:border-bridged-light/10 dark:bg-bridged-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={onNavigateToCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-bridged-teal px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-bridged-teal/20 transition hover:bg-bridged-teal-dark hover:scale-[1.02] active:scale-[0.98]"
          >
            <i className="fa-solid fa-plus-circle" aria-hidden />
            Create New Job
          </button>
        </div>
      </div>

      <div className="mb-6 flex border-b border-bridged-primary/10 dark:border-bridged-light/10">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'active'
              ? 'border-b-2 border-bridged-teal text-bridged-teal'
              : 'text-bridged-primary/60 hover:text-bridged-primary dark:text-bridged-light/60 dark:hover:text-bridged-light'
          }`}
          onClick={() => setActiveTab('active')}
        >
          Active <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] ${activeTab === 'active' ? 'bg-bridged-accent text-bridged-primary' : 'bg-bridged-primary/10 dark:bg-bridged-light/10 text-bridged-primary/60 dark:text-bridged-light/60'}`}>{activeJobs.length}</span>
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'expired'
              ? 'border-b-2 border-bridged-teal text-bridged-teal'
              : 'text-bridged-primary/60 hover:text-bridged-primary dark:text-bridged-light/60 dark:hover:text-bridged-light'
          }`}
          onClick={() => setActiveTab('expired')}
        >
          Expired <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] ${activeTab === 'expired' ? 'bg-bridged-accent text-bridged-primary' : 'bg-bridged-primary/10 dark:bg-bridged-light/10 text-bridged-primary/60 dark:text-bridged-light/60'}`}>{expiredJobs.length}</span>
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
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayedJobs.map((job) => (
              <li key={job.job_id} className={cardClass}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-bridged-primary dark:text-bridged-light">
                      {job.title}
                    </h3>
                    {activeTab === 'expired' && (
                       <span className="rounded bg-bridged-accent px-1.5 py-0.5 text-[10px] font-bold text-bridged-primary">
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
                    <span className="inline-flex items-center rounded-full bg-bridged-primary/5 dark:bg-bridged-light/5 px-2 py-0.5 text-[10px] font-medium capitalize border border-bridged-primary/10 dark:border-bridged-light/10">
                      {job.contract_type?.replace('-', ' ') || 'Full time'}
                    </span>
                    {job.job_length && (
                      <span className="inline-flex items-center rounded-full bg-bridged-primary/5 dark:bg-bridged-light/5 px-2 py-0.5 text-[10px] font-medium border border-bridged-primary/10 dark:border-bridged-light/10">
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
                  <div className="mt-3 flex items-center justify-between">
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
