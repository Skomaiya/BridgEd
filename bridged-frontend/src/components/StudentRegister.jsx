import { useState, useEffect } from 'react';
import { profileAPI } from '../api/api';

const inputClass =
  'rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 bg-white dark:bg-bridged-primary/80 px-4 py-3 text-bridged-primary dark:text-bridged-light placeholder:opacity-50 focus:border-bridged-teal focus:outline-none focus:ring-2 focus:ring-bridged-teal/20 disabled:opacity-50';

const StudentRegister = ({ user, onComplete }) => {
  const [displayName, setDisplayName] = useState('');
  const [university, setUniversity] = useState('');
  const [course, setCourse] = useState('');
  const [expectedGraduationYear, setExpectedGraduationYear] = useState('');
  const [location, setLocation] = useState('');
  const [contractPreferences, setContractPreferences] = useState([]);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [additionalLinks, setAdditionalLinks] = useState([{ link_type: '', url: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const contractTypes = [
    { value: 'full-time', label: 'Full-time' },
    { value: 'part-time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'internship', label: 'Internship' },
    { value: 'freelance', label: 'Freelance' },
  ];

  useEffect(() => {
    profileAPI.getStudentProfile().then((p) => {
      if (p.display_name) setDisplayName(p.display_name);
      if (p.university) setUniversity(p.university);
      if (p.course) setCourse(p.course);
      if (p.expected_graduation_year) setExpectedGraduationYear(String(p.expected_graduation_year));
      if (p.location) setLocation(p.location);
      if (p.contract_preferences) setContractPreferences(p.contract_preferences);
      if (p.linkedin_url) setLinkedinUrl(p.linkedin_url);
      if (Array.isArray(p.additional_links) && p.additional_links.length > 0) {
        setAdditionalLinks(p.additional_links.map((l) => ({ link_type: l.link_type || '', url: l.url || '' })));
      }
    }).catch(() => {});
    const fromAuth = localStorage.getItem('user_display_name');
    if (fromAuth && fromAuth.trim()) setDisplayName((prev) => prev || fromAuth.trim());
  }, []);

  const addLink = () => {
    setAdditionalLinks([...additionalLinks, { link_type: '', url: '' }]);
  };

  const removeLink = (i) => {
    if (additionalLinks.length <= 1) return;
    setAdditionalLinks(additionalLinks.filter((_, idx) => idx !== i));
  };

  const updateLink = (i, field, value) => {
    const next = [...additionalLinks];
    next[i] = { ...next[i], [field]: value };
    setAdditionalLinks(next);
  };

  const toggleContractPreference = (val) => {
    if (contractPreferences.includes(val)) {
      setContractPreferences(contractPreferences.filter((p) => p !== val));
    } else {
      setContractPreferences([...contractPreferences, val]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!displayName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!university.trim()) {
      setError('University is required.');
      return;
    }
    if (!course.trim()) {
      setError('Course is required.');
      return;
    }
    if (!expectedGraduationYear) {
      setError('Expected graduation year is required.');
      return;
    }
    if (!location.trim()) {
      setError('Location is required.');
      return;
    }

    const links = additionalLinks
      .filter((l) => l.link_type.trim() && l.url.trim() && l.url.startsWith('http'))
      .map((l) => ({ link_type: l.link_type.trim(), url: l.url.trim() }));

    setLoading(true);
    try {
      await profileAPI.updateStudentProfile({
        display_name: displayName.trim(),
        university: university.trim(),
        course: course.trim(),
        expected_graduation_year: expectedGraduationYear ? parseInt(expectedGraduationYear, 10) : null,
        location: location.trim(),
        contract_preferences: contractPreferences,
        linkedin_url: linkedinUrl.trim() || undefined,
        additional_links: links,
      });
      onComplete();
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.university?.[1] ||
        (typeof err.response?.data === 'object' && Object.values(err.response.data).flat().find(Boolean)) ||
        'Failed to save. Please try again.';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bridged-light p-8 dark:bg-bridged-primary">
      <div className="w-full max-w-[520px] rounded-2xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/50 p-8 shadow-lg">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-bridged-primary dark:text-bridged-light">
            Complete your profile
          </h1>
          <p className="mt-2 text-sm text-bridged-primary/70 dark:text-bridged-light/70">
            You're signing up as a <strong className="text-bridged-primary dark:text-bridged-light">Student</strong>. Add your details so employers can find you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="displayName" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                id="displayName"
                name="name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
                className={inputClass}
                autoComplete="name"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="location" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                id="location"
                name="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lagos, Nigeria"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="university" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
              University / Institution <span className="text-red-500">*</span>
            </label>
            <input
              id="university"
              name="university"
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="e.g. University of Lagos"
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="course" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
                Course <span className="text-red-500">*</span>
              </label>
              <input
                id="course"
                name="course"
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g. Computer Science"
                className={inputClass}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="graduationYear" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
                Graduation year <span className="text-red-500">*</span>
              </label>
              <input
                id="graduationYear"
                name="graduation_year"
                type="number"
                min="2024"
                max="2035"
                value={expectedGraduationYear}
                onChange={(e) => setExpectedGraduationYear(e.target.value)}
                placeholder="e.g. 2026"
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
              Contract preferences
            </label>
            <div className="flex flex-wrap gap-3">
              {contractTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => toggleContractPreference(type.value)}
                  className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                    contractPreferences.includes(type.value)
                      ? 'bg-bridged-teal text-white shadow-md'
                      : 'bg-bridged-primary/5 text-bridged-primary/60 hover:bg-bridged-primary/10 dark:bg-bridged-light/5 dark:text-bridged-light/60'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-bridged-primary/40 dark:text-bridged-light/40">
              Select all types of jobs you are interested in.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="linkedin" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
              LinkedIn profile URL
            </label>
            <input
              id="linkedin"
              name="linkedin"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourprofile"
              className={inputClass}
              autoComplete="url"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
                Additional links (optional)
              </label>
              <button
                type="button"
                onClick={addLink}
                className="rounded-md border border-bridged-teal/50 px-3 py-1.5 text-xs text-bridged-teal hover:bg-bridged-teal/10"
              >
                + Add link
              </button>
            </div>
            {additionalLinks.map((link, i) => (
              <div key={i} className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={link.link_type}
                  onChange={(e) => updateLink(i, 'link_type', e.target.value)}
                  placeholder="e.g. GitHub"
                  className={`w-28 flex-shrink-0 ${inputClass}`}
                />
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(i, 'url', e.target.value)}
                  placeholder="https://..."
                  className={`min-w-0 flex-1 ${inputClass}`}
                />
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  aria-label="Remove"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                >
                  −
                </button>
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-bridged-accent px-6 py-3.5 text-base font-semibold text-bridged-primary transition hover:opacity-95 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Finish setup'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StudentRegister;
