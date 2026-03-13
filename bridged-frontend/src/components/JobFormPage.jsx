import { useState, useEffect } from 'react';
import { jobsAPI } from '../api/api';
import { useNetworkStatus } from '../utils/networkStatus';
import { getCached, setCached, CACHE_KEYS } from '../utils/offlineCache';

const cardClass =
  'rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-4 text-bridged-primary dark:text-bridged-light';

const inputClass =
  'w-full rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 bg-white dark:bg-bridged-primary/80 px-3 py-2 text-sm text-bridged-primary dark:text-bridged-light placeholder:opacity-50 focus:border-bridged-teal focus:outline-none focus:ring-2 focus:ring-bridged-teal/20';

const emptyForm = () => ({
  title: '',
  description: '',
  required_skills: '',
  nice_to_have_skills: '',
  location: '',
  is_open: true,
  published_at: '',
  application_deadline: '',
  max_shortlist_size: '',
  contract_type: 'internship',
  job_length: '',
  recruitment_slots: '1',
});

const jobToForm = (job) => {
  if (!job) return emptyForm();
  const formatDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const h = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  };
  return {
    title: job.title || '',
    description: job.description || '',
    required_skills: Array.isArray(job.required_skills) ? job.required_skills.join(', ') : '',
    nice_to_have_skills: Array.isArray(job.nice_to_have_skills) ? job.nice_to_have_skills.join(', ') : '',
    location: job.location || '',
    is_open: job.is_open !== false,
    published_at: formatDate(job.published_at),
    application_deadline: formatDate(job.application_deadline),
    max_shortlist_size: job.max_shortlist_size != null ? String(job.max_shortlist_size) : '',
    contract_type: job.contract_type || 'full-time',
    job_length: job.job_length || '',
    recruitment_slots: job.recruitment_slots != null ? String(job.recruitment_slots) : '1',
  };
};

const JobFormPage = ({ user, jobId, onSuccess, onBack }) => {
  const { isOnline } = useNetworkStatus();
  const isEdit = !!jobId;
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setLoadError('');
    if (!isOnline) {
      getCached(CACHE_KEYS.employer_my_jobs)
        .then((entry) => {
          const list = entry?.data != null && Array.isArray(entry.data) ? entry.data : [];
          const job = list.find((j) => String(j.job_id) === String(jobId));
          if (job) {
            setForm(jobToForm(job));
          } else {
            setLoadError('Job not in cache. Open jobs list while online to edit offline.');
          }
        })
        .finally(() => setLoading(false));
      return;
    }
    jobsAPI
      .get(jobId)
      .then((job) => {
        setForm(jobToForm(job));
        getCached(CACHE_KEYS.employer_my_jobs).then((entry) => {
          const list = entry?.data != null && Array.isArray(entry.data) ? entry.data : [];
          const idx = list.findIndex((j) => String(j.job_id) === String(jobId));
          const updated = idx >= 0 ? [...list] : list.concat(job);
          if (idx >= 0) updated[idx] = job;
          setCached(CACHE_KEYS.employer_my_jobs, updated);
        });
      })
      .catch(() => setLoadError('Could not load job.'))
      .finally(() => setLoading(false));
  }, [jobId, isEdit, isOnline]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const parseSkills = (str) =>
    (str || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required.');
      return;
    }
    if (!form.location.trim()) {
      setError('Location is required.');
      return;
    }
    if (!form.application_deadline.trim()) {
      setError('Application deadline is required.');
      return;
    }
    if (!form.recruitment_slots || parseInt(form.recruitment_slots, 10) <= 0) {
      setError('Please specify a valid number of recruitment slots (at least 1).');
      return;
    }
    const deadlineDate = new Date(form.application_deadline);
    const now = new Date();
    if (deadlineDate <= now) {
      setError('Application deadline must be in the future.');
      return;
    }
    if (form.published_at.trim()) {
      const pubDate = new Date(form.published_at);
      if (pubDate <= now && !isEdit) {}
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        required_skills: parseSkills(form.required_skills),
        nice_to_have_skills: parseSkills(form.nice_to_have_skills),
        location: form.location.trim(),
        is_open: form.is_open,
        contract_type: form.contract_type,
        job_length: form.job_length.trim(),
      };
      if (form.published_at.trim()) {
        payload.published_at = new Date(form.published_at).toISOString();
      } else {
        payload.published_at = null;
      }
      payload.application_deadline = new Date(form.application_deadline).toISOString();
      
      if (isEdit) {
         payload.is_open = true; 
      }
      if (form.max_shortlist_size !== '' && form.max_shortlist_size != null) {
        const n = parseInt(form.max_shortlist_size, 10);
        if (!Number.isNaN(n) && n > 0) payload.max_shortlist_size = n;
      }
      if (form.recruitment_slots !== '' && form.recruitment_slots != null) {
        const n = parseInt(form.recruitment_slots, 10);
        if (!Number.isNaN(n) && n > 0) payload.recruitment_slots = n;
      }
      if (isEdit) {
        await jobsAPI.update(jobId, payload);
      } else {
        await jobsAPI.create(payload);
      }
      onSuccess();
    } catch (err) {
      setError(
        err.response?.data?.title?.[0] ||
          err.response?.data?.description?.[0] ||
          err.response?.data?.location?.[0] ||
          err.response?.data?.published_at?.[0] ||
          err.response?.data?.application_deadline?.[0] ||
          err.response?.data?.detail ||
          err.response?.data?.error ||
          (isEdit ? 'Failed to update job.' : 'Failed to create job.')
      );
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loading) {
    return (
      <div className="min-h-[60vh] w-full px-6 py-8">
        <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">Loading job...</p>
      </div>
    );
  }

  if (isEdit && loadError) {
    return (
      <div className="min-h-[60vh] w-full px-6 py-8">
        <div className={cardClass}>
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 rounded-lg bg-bridged-teal px-4 py-2 text-sm font-medium text-white hover:opacity-95"
          >
            Back to jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] w-full px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-bridged-primary dark:text-bridged-light">
          {isEdit ? 'Edit job' : 'Create new job'}
        </h1>
        <button
          type="button"
          onClick={onBack}
          className="self-start rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 px-4 py-2 text-sm font-medium text-bridged-primary dark:text-bridged-light hover:bg-bridged-primary/5 dark:hover:bg-bridged-light/5"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className={cardClass + ' max-w-2xl space-y-4'}>
        <div>
          <label className="mb-1 block text-sm font-medium text-bridged-primary dark:text-bridged-light">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={inputClass}
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g. Software Engineer Intern"
            maxLength={255}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-bridged-primary dark:text-bridged-light">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            className={inputClass + ' min-h-[120px]'}
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Role description, responsibilities, and requirements..."
            rows={5}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-bridged-primary dark:text-bridged-light">
            Location <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={inputClass}
            value={form.location}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder="e.g. Lagos, Nigeria or Remote"
            maxLength={255}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-bridged-primary dark:text-bridged-light">
              Contract type <span className="text-red-500">*</span>
            </label>
            <select
              className={inputClass}
              value={form.contract_type}
              onChange={(e) => handleChange('contract_type', e.target.value)}
            >
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
              <option value="freelance">Freelance</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-bridged-primary dark:text-bridged-light">
              Job duration
            </label>
            <input
              type="text"
              className={inputClass}
              value={form.job_length}
              onChange={(e) => handleChange('job_length', e.target.value)}
              placeholder="e.g. 6 months, Permanent"
              maxLength={255}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-bridged-primary dark:text-bridged-light">
            Required skills <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={inputClass}
            value={form.required_skills}
            onChange={(e) => handleChange('required_skills', e.target.value)}
            placeholder="Comma-separated, e.g. Python, SQL, React"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-bridged-primary dark:text-bridged-light">
            Nice-to-have skills
          </label>
          <input
            type="text"
            className={inputClass}
            value={form.nice_to_have_skills}
            onChange={(e) => handleChange('nice_to_have_skills', e.target.value)}
            placeholder="Comma-separated"
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_open}
              onChange={(e) => handleChange('is_open', e.target.checked)}
              className="h-4 w-4 rounded border-bridged-primary/30 text-bridged-teal focus:ring-bridged-teal"
            />
            <span className="text-sm text-bridged-primary dark:text-bridged-light">
              Accepting applications (open)
            </span>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-bridged-primary dark:text-bridged-light">
              Publish date (optional)
            </label>
            <input
              type="datetime-local"
              className={inputClass}
              value={form.published_at}
              onChange={(e) => handleChange('published_at', e.target.value)}
            />
            <p className="mt-0.5 text-xs text-bridged-primary/50 dark:text-bridged-light/50">
              Leave empty to publish immediately.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-bridged-primary dark:text-bridged-light">
              Application deadline <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              className={inputClass}
              value={form.application_deadline}
              onChange={(e) => handleChange('application_deadline', e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-bridged-primary dark:text-bridged-light">
            Max shortlist size (optional)
          </label>
          <input
            type="number"
            min={1}
            className={inputClass}
            value={form.max_shortlist_size}
            onChange={(e) => handleChange('max_shortlist_size', e.target.value)}
            placeholder="e.g. 10 — max students to show per job"
          />
          <p className="mt-0.5 text-xs text-bridged-primary/50 dark:text-bridged-light/50">
            Cap on number of recommended students shown. Leave empty for no cap.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-bridged-primary dark:text-bridged-light">
            Recruitment Slots <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={1}
            required
            className={inputClass}
            value={form.recruitment_slots}
            onChange={(e) => handleChange('recruitment_slots', e.target.value)}
            placeholder="e.g. 1 — total people you want to hire"
          />
          <p className="mt-0.5 text-xs text-bridged-primary/50 dark:text-bridged-light/50">
            The job will automatically close once you hire this many candidates.
          </p>
        </div>
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-bridged-teal px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save changes' : 'Create job'}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 px-4 py-3 text-sm font-medium text-bridged-primary dark:text-bridged-light hover:bg-bridged-primary/5"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default JobFormPage;
