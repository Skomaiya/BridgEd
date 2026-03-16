import { useState, useEffect, useRef } from 'react';
import { resumeAPI, profileAPI } from '../api/api';

const POLL_INTERVAL_MS = 2000;
const PROGRESS_CAP = 90;
const PROGRESS_TICK_MS = 400;
const PROGRESS_RAMP_SEC = 25;

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

const cardClass =
  'rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-4 text-bridged-primary dark:text-bridged-light';

const inputClass =
  'w-full rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 bg-white dark:bg-bridged-primary/80 px-3 py-2 text-sm text-bridged-primary dark:text-bridged-light placeholder:opacity-50 focus:border-bridged-teal focus:outline-none focus:ring-2 focus:ring-bridged-teal/20';

const StudentParser = ({ user, onComplete, isSignupStep, onBack }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState(null);
  const [pollingResumeId, setPollingResumeId] = useState(null);
  const [parseProgress, setParseProgress] = useState(0);
  const [savingEdits, setSavingEdits] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);
  const pollIntervalRef = useRef(null);
  const progressIntervalRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setError('');
      setResult(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setError('');
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }
    const ext = file.name && file.name.includes('.')
      ? '.' + file.name.split('.').pop().toLowerCase()
      : '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError('Invalid file type. Only PDF, DOCX, or TXT are allowed.');
      return;
    }
    setUploading(true);
    setError('');
    setResult(null);
    setPollingResumeId(null);
    setParseProgress(0);
    try {
      const response = await resumeAPI.upload(file);
      if (response.status === 'processing' || response.status === 'pending') {
        setFile(null);
        setPollingResumeId(response.resume_id);
      } else {
        setParseProgress(100);
        setResult(response);
        setFile(null);
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to upload. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    profileAPI.getStudentProfile().then((p) => setStudentProfile(p)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!pollingResumeId) return;
    const clearProgressInterval = () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
    const increment = (PROGRESS_CAP / (PROGRESS_RAMP_SEC * 1000)) * PROGRESS_TICK_MS;
    progressIntervalRef.current = setInterval(() => {
      setParseProgress((p) => Math.min(PROGRESS_CAP, p + increment));
    }, PROGRESS_TICK_MS);

    const poll = async () => {
      try {
        const data = await resumeAPI.get(pollingResumeId);
        if (data.status === 'completed') {
          setParseProgress(100);
          setResult(data);
          setPollingResumeId(null);
          clearProgressInterval();
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (data.status === 'failed') {
          setError(data.parsing_error || 'Parsing failed.');
          setPollingResumeId(null);
          clearProgressInterval();
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (err) {
        setError(
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'Failed to check status.'
        );
        setPollingResumeId(null);
        clearProgressInterval();
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    };
    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    poll();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      clearProgressInterval();
    };
  }, [pollingResumeId]);

  const saveDetails = async () => {
    if (!result?.resume_id) return;
    const dataToSave = editMode ? editedData : result.parsed_data;
    if (!dataToSave) return;
    setSavingEdits(true);
    setError('');
    try {
      await resumeAPI.updateParsedData(result.resume_id, {
        parsed_data: dataToSave,
        parsing_accuracy: result.parsing_accuracy,
      });
      const cleanAdditionalLinks = (Array.isArray(dataToSave.additional_links) ? dataToSave.additional_links : [])
        .filter((l) => l && (l.link_type || '').trim() && (l.url || '').trim())
        .map((l) => {
          let url = String(l.url).trim();
          if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
          return { link_type: String(l.link_type).trim(), url };
        });
      await profileAPI.updateStudentProfile({
        display_name: studentProfile?.display_name ?? '',
        university: studentProfile?.university ?? '',
        course: studentProfile?.course ?? '',
        expected_graduation_year: studentProfile?.expected_graduation_year ?? null,
        location: studentProfile?.location ?? '',
        proximity_radius: studentProfile?.proximity_radius ?? 50,
        linkedin_url: (dataToSave.linkedin_url || '').trim() || null,
        additional_links: cleanAdditionalLinks,
      });
      window.location.reload();
    } catch (err) {
      setError(
        err.response?.data?.parsed_data?.[0] ||
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Failed to save. Please try again.'
      );
    } finally {
      setSavingEdits(false);
    }
  };

  const toggleEditMode = async () => {
    if (!editMode && result) {
      const base = JSON.parse(JSON.stringify(result.parsed_data || {}));
      const structured = initStructuredSections(base);
      setEditedData({
        ...structured,
        linkedin_url: base.linkedin_url ?? studentProfile?.linkedin_url ?? '',
        additional_links: Array.isArray(base.additional_links)
          ? base.additional_links
          : Array.isArray(studentProfile?.additional_links)
            ? studentProfile.additional_links
            : [],
      });
      setEditMode(true);
      return;
    }
    if (editMode && editedData != null && result?.resume_id) {
      setSavingEdits(true);
      setError('');
      try {
        await resumeAPI.updateParsedData(result.resume_id, {
          parsed_data: editedData,
          parsing_accuracy: result.parsing_accuracy,
        });
        setResult((prev) => ({ ...prev, parsed_data: editedData }));
        const cleanAdditionalLinks = (Array.isArray(editedData.additional_links) ? editedData.additional_links : [])
          .filter((l) => l && (l.link_type || '').trim() && (l.url || '').trim())
          .map((l) => {
            let url = String(l.url).trim();
            if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
            return { link_type: String(l.link_type).trim(), url };
          });
        await profileAPI.updateStudentProfile({
          display_name: studentProfile?.display_name ?? '',
          university: studentProfile?.university ?? '',
          course: studentProfile?.course ?? '',
          expected_graduation_year: studentProfile?.expected_graduation_year ?? null,
          location: studentProfile?.location ?? '',
          proximity_radius: studentProfile?.proximity_radius ?? 50,
          linkedin_url: (editedData.linkedin_url || '').trim() || null,
          additional_links: cleanAdditionalLinks,
        });
        setStudentProfile((prev) => ({
          ...prev,
          linkedin_url: (editedData.linkedin_url || '').trim() || null,
          additional_links: cleanAdditionalLinks,
        }));
        setEditMode(false);
      } catch (err) {
        setError(
          err.response?.data?.parsed_data?.[0] ||
          err.response?.data?.detail ||
          err.response?.data?.error ||
          'Failed to save changes.'
        );
      } finally {
        setSavingEdits(false);
      }
    }
  };

  const handleFieldChange = (field, value) => {
    setEditedData((prev) => ({ ...prev, [field]: value }));
  };
  const handleSkillsChange = (type, value) => {
    const arr = value.split(',').map((s) => s.trim()).filter(Boolean);
    setEditedData((prev) => ({ ...prev, [type]: arr }));
  };

  const ensureArray = (val) => (Array.isArray(val) ? val : []);

  const initStructuredSections = (base) => {
    const clone = { ...(base || {}) };
    clone.education = ensureArray(clone.education).map((edu) => ({
      degree: edu.degree || edu.qualification || '',
      field: edu.field || edu.field_of_study || '',
      institution: edu.institution || edu.school || edu.university || '',
      location: edu.location || '',
      start_date: edu.start_date || '',
      end_date: edu.end_date || edu.graduation_year || '',
    }));
    clone.experience = ensureArray(clone.experience).map((exp) => ({
      title: exp.title || exp.role || exp.position || '',
      company: exp.company || exp.employer || exp.organization || '',
      location: exp.location || '',
      start_date: exp.start_date || '',
      end_date: exp.end_date || '',
      responsibilities: Array.isArray(exp.responsibilities || exp.description)
        ? (exp.responsibilities || exp.description).join('; ')
        : (exp.responsibilities || exp.description || ''),
    }));
    clone.certifications = ensureArray(clone.certifications).map((cert) => {
      if (typeof cert === 'string') return { name: cert, issuer: '' };
      return {
        name: cert.name || cert.title || '',
        issuer: cert.issuer || cert.provider || '',
      };
    });
    clone.projects = ensureArray(clone.projects).map((proj) => ({
      name: proj.name || proj.title || '',
      description: Array.isArray(proj.description)
        ? proj.description.join('\n')
        : (proj.description || ''),
      start_date: proj.start_date || '',
      end_date: proj.end_date || '',
    }));
    return clone;
  };

  const handleEducationChange = (index, field, value) => {
    setEditedData((prev) => {
      const list = [...ensureArray(prev?.education)];
      if (!list[index]) {
        list[index] = { degree: '', field: '', institution: '', location: '', start_date: '', end_date: '' };
      }
      list[index] = { ...list[index], [field]: value };
      return { ...prev, education: list };
    });
  };

  const addEducation = () => {
    setEditedData((prev) => ({
      ...prev,
      education: [...ensureArray(prev?.education), { degree: '', field: '', institution: '', location: '', start_date: '', end_date: '' }],
    }));
  };

  const removeEducation = (index) => {
    setEditedData((prev) => ({
      ...prev,
      education: ensureArray(prev?.education).filter((_, i) => i !== index),
    }));
  };

  const handleExperienceChange = (index, field, value) => {
    setEditedData((prev) => {
      const list = [...ensureArray(prev?.experience)];
      if (!list[index]) {
        list[index] = { title: '', company: '', location: '', start_date: '', end_date: '', responsibilities: '' };
      }
      list[index] = { ...list[index], [field]: value };
      return { ...prev, experience: list };
    });
  };

  const addExperience = () => {
    setEditedData((prev) => ({
      ...prev,
      experience: [...ensureArray(prev?.experience), { title: '', company: '', location: '', start_date: '', end_date: '', responsibilities: '' }],
    }));
  };

  const removeExperience = (index) => {
    setEditedData((prev) => ({
      ...prev,
      experience: ensureArray(prev?.experience).filter((_, i) => i !== index),
    }));
  };

  const handleCertificationChange = (index, field, value) => {
    setEditedData((prev) => {
      const list = [...ensureArray(prev?.certifications)];
      if (!list[index]) {
        list[index] = { name: '', issuer: '' };
      }
      list[index] = { ...list[index], [field]: value };
      return { ...prev, certifications: list };
    });
  };

  const addCertification = () => {
    setEditedData((prev) => ({
      ...prev,
      certifications: [...ensureArray(prev?.certifications), { name: '', issuer: '' }],
    }));
  };

  const removeCertification = (index) => {
    setEditedData((prev) => ({
      ...prev,
      certifications: ensureArray(prev?.certifications).filter((_, i) => i !== index),
    }));
  };

  const handleProjectChange = (index, field, value) => {
    setEditedData((prev) => {
      const list = [...ensureArray(prev?.projects)];
      if (!list[index]) {
        list[index] = { name: '', description: '', start_date: '', end_date: '' };
      }
      list[index] = { ...list[index], [field]: value };
      return { ...prev, projects: list };
    });
  };

  const addProject = () => {
    setEditedData((prev) => ({
      ...prev,
      projects: [...ensureArray(prev?.projects), { name: '', description: '', start_date: '', end_date: '' }],
    }));
  };

  const removeProject = (index) => {
    setEditedData((prev) => ({
      ...prev,
      projects: ensureArray(prev?.projects).filter((_, i) => i !== index),
    }));
  };

  const pd = result?.parsed_data;
  const ed = editMode ? editedData : pd;
  const linkedinDisplay = pd?.linkedin_url ?? studentProfile?.linkedin_url ?? '';
  const additionalLinksDisplay = (pd?.additional_links?.length ? pd.additional_links : studentProfile?.additional_links) ?? [];

  const handleAdditionalLinkChange = (index, field, value) => {
    setEditedData((prev) => {
      const links = [...(prev?.additional_links ?? [])];
      if (!links[index]) links[index] = { link_type: '', url: '' };
      links[index] = { ...links[index], [field]: value };
      return { ...prev, additional_links: links };
    });
  };
  const addAdditionalLink = () => {
    setEditedData((prev) => ({
      ...prev,
      additional_links: [...(prev?.additional_links ?? []), { link_type: '', url: '' }],
    }));
  };
  const removeAdditionalLink = (index) => {
    setEditedData((prev) => ({
      ...prev,
      additional_links: (prev?.additional_links ?? []).filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="min-h-[60vh] w-full px-6 py-8">
      {!isSignupStep && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-bridged-primary/60 dark:text-bridged-light/60 hover:text-bridged-teal"
        >
          <i className="fa-solid fa-arrow-left text-xs" aria-hidden />
          Back to settings
        </button>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-bridged-primary dark:text-bridged-light">
          {isSignupStep ? 'Complete your signup' : 'Re-upload CV'}
        </h1>
        <p className="mt-2 text-sm text-bridged-primary/70 dark:text-bridged-light/70">
          {isSignupStep
            ? 'Upload your CV to finish setting up your profile. We’ll extract your information so you can review and edit it. You can update this later from your dashboard.'
            : 'Upload your CV so we can extract and store your information. Review the summary below, add your LinkedIn and any other links, and edit anything that is not accurate. All of this is saved to your profile and you can update it at any time later.'}
        </p>
      </div>

      <div className={cardClass + ' mb-6'}>
        <h2 className="mb-4 text-lg font-semibold text-bridged-primary dark:text-bridged-light">
          Upload your CV
        </h2>
        <div
          className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? 'border-bridged-teal bg-bridged-teal/10'
              : 'border-bridged-primary/20 dark:border-bridged-light/20 bg-bridged-primary/5 dark:bg-bridged-light/5'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <i className="fa-solid fa-cloud-arrow-up mx-auto text-4xl text-bridged-primary/40 dark:text-bridged-light/40" aria-hidden />
          <p className="mt-2 text-sm font-medium text-bridged-primary dark:text-bridged-light">
            {file ? file.name : 'Drag and drop your CV here'}
          </p>
          <p className="mt-1 text-xs text-bridged-primary/60 dark:text-bridged-light/60">or</p>
          <label className="mt-2 inline-block cursor-pointer rounded-lg bg-bridged-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Browse files
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          <p className="mt-2 text-xs text-bridged-primary/50 dark:text-bridged-light/50">PDF, DOCX, or TXT</p>
        </div>

        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || uploading || pollingResumeId}
          className="mt-4 w-full rounded-lg bg-bridged-accent px-4 py-3 text-sm font-semibold text-bridged-primary transition hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading || pollingResumeId ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-bridged-primary/30 border-t-bridged-primary" />
              {pollingResumeId ? 'Extracting data…' : 'Uploading…'}
            </span>
          ) : (
            'Upload and extract data'
          )}
        </button>

        {(uploading || pollingResumeId) && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-bridged-primary/10 dark:bg-bridged-light/10">
              <div
                className="h-full rounded-full bg-bridged-teal transition-all duration-300"
                style={{ width: `${parseProgress}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-bridged-primary/60 dark:text-bridged-light/60">
              {Math.round(parseProgress)}%
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 border-t border-bridged-primary/10 dark:border-bridged-light/10 pt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-bridged-primary dark:text-bridged-light">
                Extracted information
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleEditMode}
                  disabled={editMode && savingEdits}
                  className="rounded-lg border border-bridged-teal/50 bg-bridged-teal/10 px-3 py-1.5 text-sm font-medium text-bridged-teal hover:bg-bridged-teal/20 disabled:opacity-50"
                >
                  {editMode ? (savingEdits ? 'Saving…' : 'Save changes') : 'Edit details'}
                </button>
                <button
                  type="button"
                  onClick={saveDetails}
                  disabled={savingEdits}
                  className="rounded-lg bg-bridged-teal px-3 py-1.5 text-sm font-medium text-white hover:opacity-95 disabled:opacity-50"
                >
                  {savingEdits ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className={cardClass}>
                <h4 className="mb-2 text-sm font-semibold text-bridged-primary/80 dark:text-bridged-light/80">Contact</h4>
                {editMode ? (
                  <div className="space-y-2">
                    <input className={inputClass} value={ed?.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} placeholder="Name" />
                    <input className={inputClass} value={ed?.email || ''} onChange={(e) => handleFieldChange('email', e.target.value)} placeholder="Email" type="email" />
                    <input className={inputClass} value={ed?.phone || ''} onChange={(e) => handleFieldChange('phone', e.target.value)} placeholder="Phone" type="tel" />
                  </div>
                ) : (
                  <div className="text-sm">
                    <p><strong>Name:</strong> {pd?.name || '—'}</p>
                    <p><strong>Email:</strong> {pd?.email || '—'}</p>
                    <p><strong>Phone:</strong> {pd?.phone || '—'}</p>
                  </div>
                )}
              </div>

              <div className={cardClass}>
                <h4 className="mb-2 text-sm font-semibold text-bridged-primary/80 dark:text-bridged-light/80">LinkedIn</h4>
                {editMode ? (
                  <input
                    className={inputClass}
                    type="url"
                    value={ed?.linkedin_url || ''}
                    onChange={(e) => handleFieldChange('linkedin_url', e.target.value)}
                    placeholder="https://linkedin.com/in/yourprofile"
                  />
                ) : (
                  <div className="text-sm">
                    {linkedinDisplay ? (
                      <a
                        href={linkedinDisplay.startsWith('http') ? linkedinDisplay : `https://${linkedinDisplay}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-bridged-teal hover:underline"
                      >
                        {linkedinDisplay}
                      </a>
                    ) : (
                      <span className="text-bridged-primary/50 dark:text-bridged-light/50">—</span>
                    )}
                  </div>
                )}
              </div>

              <div className={cardClass + ' sm:col-span-2'}>
                <h4 className="mb-2 text-sm font-semibold text-bridged-primary/80 dark:text-bridged-light/80">Additional links</h4>
                {editMode ? (
                  <div className="space-y-2">
                    {(ed?.additional_links ?? []).map((link, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-2">
                        <input
                          className={inputClass + ' flex-1 min-w-[100px]'}
                          value={link.link_type || ''}
                          onChange={(e) => handleAdditionalLinkChange(index, 'link_type', e.target.value)}
                          placeholder="e.g. GitHub, Website"
                        />
                        <input
                          className={inputClass + ' flex-[2] min-w-[140px]'}
                          type="url"
                          value={link.url || ''}
                          onChange={(e) => handleAdditionalLinkChange(index, 'url', e.target.value)}
                          placeholder="https://..."
                        />
                        <button
                          type="button"
                          onClick={() => removeAdditionalLink(index)}
                          className="rounded-lg border border-red-500/30 px-2 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addAdditionalLink}
                      className="rounded-lg border border-bridged-teal/50 bg-bridged-teal/10 px-3 py-1.5 text-sm font-medium text-bridged-teal hover:bg-bridged-teal/20"
                    >
                      Add link
                    </button>
                  </div>
                ) : (
                  <div className="text-sm">
                    {additionalLinksDisplay.length === 0 ? (
                      <span className="text-bridged-primary/50 dark:text-bridged-light/50">None added</span>
                    ) : (
                      <ul className="space-y-1">
                        {additionalLinksDisplay.map((link, i) => (
                          <li key={i}>
                            <a
                              href={typeof link === 'object' && link?.url ? (link.url.startsWith('http') ? link.url : `https://${link.url}`) : '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-bridged-teal hover:underline"
                            >
                              {typeof link === 'object' ? (link.link_type || link.url || 'Link') : link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {((editMode && ed) || pd?.technical_skills?.length > 0) && (
                <div className={cardClass}>
                  <h4 className="mb-2 text-sm font-semibold text-bridged-primary/80 dark:text-bridged-light/80">Technical skills</h4>
                  {editMode ? (
                    <textarea className={inputClass + ' min-h-[80px]'} value={ed?.technical_skills?.join(', ') || ''} onChange={(e) => handleSkillsChange('technical_skills', e.target.value)} placeholder="Comma-separated" rows={3} />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {pd.technical_skills.map((s, i) => (
                        <span key={i} className="rounded-full bg-bridged-primary/15 dark:bg-bridged-light/15 px-2 py-0.5 text-xs">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {((editMode && ed) || pd?.soft_skills?.length > 0) && (
                <div className={cardClass}>
                  <h4 className="mb-2 text-sm font-semibold text-bridged-primary/80 dark:text-bridged-light/80">Soft skills</h4>
                  {editMode ? (
                    <textarea className={inputClass + ' min-h-[80px]'} value={ed?.soft_skills?.join(', ') || ''} onChange={(e) => handleSkillsChange('soft_skills', e.target.value)} placeholder="Comma-separated" rows={3} />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {pd.soft_skills.map((s, i) => (
                        <span key={i} className="rounded-full bg-bridged-primary/15 dark:bg-bridged-light/15 px-2 py-0.5 text-xs">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {((editMode && ed) || pd?.languages?.length > 0) && (
                <div className={cardClass}>
                  <h4 className="mb-2 text-sm font-semibold text-bridged-primary/80 dark:text-bridged-light/80">Languages</h4>
                  {editMode ? (
                    <textarea className={inputClass} value={ed?.languages?.join(', ') || ''} onChange={(e) => handleSkillsChange('languages', e.target.value)} placeholder="Comma-separated" rows={2} />
                  ) : (
                    <div className="flex flex-wrap gap-1.5 text-sm">{pd.languages.map((l, i) => (
                      <span key={i} className="rounded bg-bridged-primary/10 dark:bg-bridged-light/10 px-2 py-0.5">{l}</span>
                    ))}</div>
                  )}
                </div>
              )}

              {((editMode && ed) || pd?.education) && (
                <div className={cardClass + ' sm:col-span-2'}>
                  <h4 className="mb-2 text-sm font-semibold text-bridged-primary/80 dark:text-bridged-light/80">Education</h4>
                  {editMode ? (
                    <div className="space-y-3">
                      {ensureArray(ed?.education).map((edu, i) => (
                        <div key={i} className="rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 bg-bridged-primary/5 dark:bg-bridged-light/5 p-3 space-y-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              className={inputClass}
                              value={edu.degree || ''}
                              onChange={(e) => handleEducationChange(i, 'degree', e.target.value)}
                              placeholder="Degree e.g. BSc Computer Science"
                            />
                            <input
                              className={inputClass}
                              value={edu.institution || ''}
                              onChange={(e) => handleEducationChange(i, 'institution', e.target.value)}
                              placeholder="Institution"
                            />
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              className={inputClass}
                              value={edu.field || ''}
                              onChange={(e) => handleEducationChange(i, 'field', e.target.value)}
                              placeholder="Field of study"
                            />
                            <input
                              className={inputClass}
                              value={edu.location || ''}
                              onChange={(e) => handleEducationChange(i, 'location', e.target.value)}
                              placeholder="Location"
                            />
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              className={inputClass}
                              value={edu.start_date || ''}
                              onChange={(e) => handleEducationChange(i, 'start_date', e.target.value)}
                              placeholder="Start date"
                            />
                            <input
                              className={inputClass}
                              value={edu.end_date || ''}
                              onChange={(e) => handleEducationChange(i, 'end_date', e.target.value)}
                              placeholder="End date"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeEducation(i)}
                              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
                            >
                              Remove education
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addEducation}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-bridged-teal/40 bg-bridged-teal/10 px-3 py-1.5 text-xs font-medium text-bridged-teal hover:bg-bridged-teal/20"
                      >
                        <i className="fa-solid fa-plus" aria-hidden /> Add education
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Array.isArray(pd.education) && pd.education.length > 0 ? pd.education.map((edu, i) => (
                        <div key={i} className="rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 bg-bridged-primary/5 dark:bg-bridged-light/5 p-3 text-sm">
                          {(edu.degree || edu.qualification) && <p className="font-semibold text-bridged-primary dark:text-bridged-light">{edu.degree || edu.qualification}</p>}
                          {(edu.institution || edu.school || edu.university) && <p className="text-bridged-teal text-xs font-medium mt-0.5">{edu.institution || edu.school || edu.university}</p>}
                          {(edu.field_of_study || edu.field) && <p className="text-bridged-primary/60 dark:text-bridged-light/60 text-xs mt-0.5">{edu.field_of_study || edu.field}</p>}
                          {(edu.start_date || edu.end_date || edu.graduation_year || edu.year) && (
                            <p className="text-bridged-primary/50 dark:text-bridged-light/50 text-xs mt-1">
                              {[edu.start_date, edu.end_date || edu.graduation_year || edu.year].filter(Boolean).join(' – ')}
                            </p>
                          )}
                        </div>
                      )) : typeof pd.education === 'string' && pd.education ? (
                        <p className="text-sm text-bridged-primary/70 dark:text-bridged-light/70">{pd.education}</p>
                      ) : (
                        <p className="text-sm text-bridged-primary/50 dark:text-bridged-light/50">No education records</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {((editMode && ed) || pd?.experience) && (
                <div className={cardClass + ' sm:col-span-2'}>
                  <h4 className="mb-2 text-sm font-semibold text-bridged-primary/80 dark:text-bridged-light/80">Experience</h4>
                  {editMode ? (
                    <div className="space-y-3">
                      {ensureArray(ed?.experience).map((exp, i) => (
                        <div key={i} className="rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 bg-bridged-primary/5 dark:bg-bridged-light/5 p-3 space-y-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              className={inputClass}
                              value={exp.title || ''}
                              onChange={(e) => handleExperienceChange(i, 'title', e.target.value)}
                              placeholder="Job title"
                            />
                            <input
                              className={inputClass}
                              value={exp.company || ''}
                              onChange={(e) => handleExperienceChange(i, 'company', e.target.value)}
                              placeholder="Company"
                            />
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              className={inputClass}
                              value={exp.location || ''}
                              onChange={(e) => handleExperienceChange(i, 'location', e.target.value)}
                              placeholder="Location"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                className={inputClass}
                                value={exp.start_date || ''}
                                onChange={(e) => handleExperienceChange(i, 'start_date', e.target.value)}
                                placeholder="Start date"
                              />
                              <input
                                className={inputClass}
                                value={exp.end_date || ''}
                                onChange={(e) => handleExperienceChange(i, 'end_date', e.target.value)}
                                placeholder="End date"
                              />
                            </div>
                          </div>
                          <div>
                            <textarea
                              className={inputClass + ' min-h-[80px]'}
                              value={exp.responsibilities || ''}
                              onChange={(e) => handleExperienceChange(i, 'responsibilities', e.target.value)}
                              placeholder="Responsibilities or key achievements"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeExperience(i)}
                              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
                            >
                              Remove experience
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addExperience}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-bridged-teal/40 bg-bridged-teal/10 px-3 py-1.5 text-xs font-medium text-bridged-teal hover:bg-bridged-teal/20"
                      >
                        <i className="fa-solid fa-plus" aria-hidden /> Add experience
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Array.isArray(pd.experience) && pd.experience.length > 0 ? pd.experience.map((exp, i) => (
                        <div key={i} className="rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 bg-bridged-primary/5 dark:bg-bridged-light/5 p-3 text-sm">
                          {(exp.title || exp.role || exp.position) && <p className="font-semibold text-bridged-primary dark:text-bridged-light">{exp.title || exp.role || exp.position}</p>}
                          {(exp.company || exp.employer || exp.organization) && <p className="text-bridged-teal text-xs font-medium mt-0.5">{exp.company || exp.employer || exp.organization}</p>}
                          {(exp.start_date || exp.end_date || exp.duration || exp.dates) && (
                            <p className="text-bridged-primary/50 dark:text-bridged-light/50 text-xs mt-0.5">
                              {exp.duration || exp.dates || [exp.start_date, exp.end_date].filter(Boolean).join(' – ')}
                            </p>
                          )}
                          {exp.location && <p className="text-bridged-primary/50 dark:text-bridged-light/50 text-xs">{exp.location}</p>}
                          {(exp.description || exp.responsibilities) && (
                            <p className="mt-1.5 text-xs text-bridged-primary/70 dark:text-bridged-light/70 leading-relaxed line-clamp-4">
                              {Array.isArray(exp.description || exp.responsibilities)
                                ? (exp.description || exp.responsibilities).join('; ')
                                : (exp.description || exp.responsibilities)}
                            </p>
                          )}
                        </div>
                      )) : typeof pd.experience === 'string' && pd.experience ? (
                        <p className="text-sm text-bridged-primary/70 dark:text-bridged-light/70">{pd.experience}</p>
                      ) : (
                        <p className="text-sm text-bridged-primary/50 dark:text-bridged-light/50">No experience records</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {((editMode && ed) || (pd?.certifications && pd.certifications.length > 0)) && (
                <div className={cardClass}>
                  <h4 className="mb-2 text-sm font-semibold text-bridged-primary/80 dark:text-bridged-light/80">Certifications</h4>
                  {editMode ? (
                    <div className="space-y-3">
                      {ensureArray(ed?.certifications).map((cert, i) => (
                        <div key={i} className="grid gap-2 sm:grid-cols-2 items-end">
                          <div>
                            <label className="block text-xs font-medium text-bridged-primary/70 dark:text-bridged-light/70 mb-1">Name</label>
                            <input
                              className={inputClass}
                              value={cert.name || ''}
                              onChange={(e) => handleCertificationChange(i, 'name', e.target.value)}
                              placeholder="Certification name"
                            />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-bridged-primary/70 dark:text-bridged-light/70 mb-1">Issuer</label>
                              <input
                                className={inputClass}
                                value={cert.issuer || ''}
                                onChange={(e) => handleCertificationChange(i, 'issuer', e.target.value)}
                                placeholder="Provider / issuer"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCertification(i)}
                              className="self-end rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addCertification}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-bridged-teal/40 bg-bridged-teal/10 px-3 py-1.5 text-xs font-medium text-bridged-teal hover:bg-bridged-teal/20"
                      >
                        <i className="fa-solid fa-plus" aria-hidden /> Add certification
                      </button>
                    </div>
                  ) : pd.certifications?.length > 0 ? (
                    <ul className="space-y-1.5">
                      {pd.certifications.map((cert, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <i className="fa-solid fa-certificate text-bridged-teal mt-0.5 text-xs flex-shrink-0" />
                          <span className="text-bridged-primary/80 dark:text-bridged-light/80">
                            {typeof cert === 'string' ? cert : (cert.name || cert.title || cert.certification || JSON.stringify(cert))}
                            {typeof cert === 'object' && cert.year && <span className="ml-1 text-bridged-primary/50 dark:text-bridged-light/50 text-xs">({cert.year})</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-bridged-primary/50 dark:text-bridged-light/50">None</p>
                  )}
                </div>
              )}

              {((editMode && ed) || (pd?.projects && pd.projects.length > 0)) && (
                <div className={cardClass}>
                  <h4 className="mb-2 text-sm font-semibold text-bridged-primary/80 dark:text-bridged-light/80">Projects</h4>
                  {editMode ? (
                    <div className="space-y-3">
                      {ensureArray(ed?.projects).map((proj, i) => (
                        <div key={i} className="rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 bg-bridged-primary/5 dark:bg-bridged-light/5 p-3 space-y-2">
                          <input
                            className={inputClass}
                            value={proj.name || ''}
                            onChange={(e) => handleProjectChange(i, 'name', e.target.value)}
                            placeholder="Project name"
                          />
                          <textarea
                            className={inputClass + ' min-h-[80px]'}
                            value={proj.description || ''}
                            onChange={(e) => handleProjectChange(i, 'description', e.target.value)}
                            placeholder="Short description"
                          />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              className={inputClass}
                              value={proj.start_date || ''}
                              onChange={(e) => handleProjectChange(i, 'start_date', e.target.value)}
                              placeholder="Start date"
                            />
                            <input
                              className={inputClass}
                              value={proj.end_date || ''}
                              onChange={(e) => handleProjectChange(i, 'end_date', e.target.value)}
                              placeholder="End date"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeProject(i)}
                              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
                            >
                              Remove project
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addProject}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-bridged-teal/40 bg-bridged-teal/10 px-3 py-1.5 text-xs font-medium text-bridged-teal hover:bg-bridged-teal/20"
                      >
                        <i className="fa-solid fa-plus" aria-hidden /> Add project
                      </button>
                    </div>
                  ) : pd.projects?.length > 0 ? (
                    <ul className="space-y-2">
                      {pd.projects.map((proj, i) => (
                        <li key={i} className="rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 bg-bridged-primary/5 dark:bg-bridged-light/5 p-2.5 text-sm">
                          <p className="font-medium text-bridged-primary dark:text-bridged-light">
                            {typeof proj === 'string' ? proj : (proj.name || proj.title || 'Project')}
                          </p>
                          {typeof proj === 'object' && (proj.description || proj.summary) && (
                            <p className="mt-0.5 text-xs text-bridged-primary/60 dark:text-bridged-light/60 line-clamp-3">{proj.description || proj.summary}</p>
                          )}
                          {typeof proj === 'object' && proj.url && (
                            <a href={proj.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 text-xs text-bridged-teal hover:underline block">{proj.url}</a>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-bridged-primary/50 dark:text-bridged-light/50">None</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {isSignupStep && onComplete && (
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-bridged-primary/10 dark:border-bridged-light/10 pt-6">
          <button
            type="button"
            onClick={() => onComplete()}
            className="rounded-lg bg-bridged-teal px-6 py-2.5 text-sm font-semibold text-white hover:opacity-95 shadow-lg shadow-bridged-teal/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Continue to dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentParser;
