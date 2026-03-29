import { useState, useEffect, useRef } from 'react';
import { profileAPI, resumeAPI, paystackAPI, authAPI } from '../api/api';
import serverClient from '../api/api';
import { useAlert } from '../context/GlobalAlertContext';

const NOTIF_PREFS = [
  { key: 'new_match',         label: 'New job matches',            desc: 'When the system finds jobs that match your profile' },
  { key: 'interest_confirmed',label: 'Match acceptance confirmed',  desc: 'Confirmation when you accept a match' },
  { key: 'match_declined',    label: 'Match pass confirmation',     desc: 'Confirmation when you pass on a match' },
  { key: 'student_interested',label: 'Student interest (employer)', desc: 'When a student accepts a match with your job listing' },
  { key: 'job_published',     label: 'Job listing live',            desc: 'When your job listing goes live and starts accepting applications' },
  { key: 'cv_parsed',         label: 'CV processed',               desc: 'When your CV upload has been processed and saved' },
  { key: 'subscription_expiring', label: 'Subscription expiring',  desc: 'Reminder before your subscription expires' },
  { key: 'user_registered',    label: 'New user registration',      desc: 'Notify when a new student or employer registers' },
  { key: 'job_posted',        label: 'New job posting',           desc: 'Notify when a new job listing is published' },
  { key: 'user_suspended',     label: 'User account suspended',     desc: 'Notify when a user account is suspended or reactivated' },
  { key: 'verified_employer',  label: 'Employer verified',           desc: 'Notify when an employer is verified by an administrator' },
];

const contractTypes = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance', label: 'Freelance' },
];

const PREFS_STORAGE_KEY = 'bridged-notif-prefs';

function loadPrefs(user) {
  if (user?.notification_preferences && Object.keys(user.notification_preferences).length > 0) {
    return user.notification_preferences;
  }
  const defaults = Object.fromEntries(NOTIF_PREFS.map((p) => [p.key, true]));
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return defaults;
}

const TABS = ['General', 'Notification Preferences', 'Subscriptions'];

const PLANS = {
  free: {
    name: 'Free',
    color: 'text-bridged-primary dark:text-bridged-light',
    badge: 'bg-bridged-primary/10 text-bridged-primary dark:bg-bridged-light/10 dark:text-bridged-light',
    features: ['Up to 5 job matches', 'Basic profile', 'In-app notifications'],
  },
  basic: {
    name: 'Basic',
    color: 'text-bridged-teal',
    badge: 'bg-bridged-teal/20 text-bridged-teal',
    features: ['Up to 20 job matches', 'Priority matching', 'CV visibility to employers', 'In-app notifications'],
  },
  premium: {
    name: 'Premium',
    color: 'text-bridged-accent',
    badge: 'bg-bridged-accent/20 text-bridged-accent',
    features: ['Unlimited job matches', 'Top of employer shortlists', 'CV visibility to employers', 'Profile analytics', 'In-app notifications'],
  },
};

const inputCls =
  'w-full rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 ' +
  'bg-white dark:bg-bridged-primary/40 px-3 py-2 text-sm text-bridged-primary ' +
  'dark:text-bridged-light placeholder:text-bridged-primary/40 dark:placeholder:text-bridged-light/40 ' +
  'focus:outline-none focus:ring-2 focus:ring-bridged-teal/50';

const labelCls = 'block text-xs font-medium text-bridged-primary/70 dark:text-bridged-light/70 mb-1';

export default function SettingsPage({ user, onNavigate }) {
  const [activeTab, setActiveTab] = useState('General');

  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCV, setUploadingCV] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [cvMsg, setCvMsg] = useState(null);
  const [imgError, setImgError] = useState(false);
  const photoInputRef = useRef(null);
  const cvInputRef = useRef(null);

  const [links, setLinks] = useState([]);
  const [contractPreferences, setContractPreferences] = useState([]);

  const [notifPrefs, setNotifPrefs] = useState(() => loadPrefs(user));
  const [payLoading, setPayLoading] = useState(null);
  const [payError, setPayError] = useState(null);
  const { showAlert } = useAlert();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePwdReadOnly, setDeletePwdReadOnly] = useState(true);

  const isStudent = user?.role === 'student' || profile?.user?.role === 'student';
  const isEmployer = user?.role === 'employer' || profile?.user?.role === 'employer';

  useEffect(() => {
    if (user?.role === 'admin') {
      return;
    }
    const fetchProfile = isStudent
      ? profileAPI.getStudentProfile
      : (isEmployer ? profileAPI.getEmployerProfile : null);

    if (fetchProfile) {
      fetchProfile()
        .then((data) => {
          setProfile(data);
          if (isStudent && Array.isArray(data.additional_links)) {
            setLinks(data.additional_links);
          }
          if (isStudent && Array.isArray(data.contract_preferences)) {
            setContractPreferences(data.contract_preferences);
          }
          setPhotoPreview(data.profile_image_url || null);
          
          if (data.user?.notification_preferences) {
            setNotifPrefs(prev => ({ ...prev, ...data.user.notification_preferences }));
          }
        })
        .catch(() => {});
    } else if (user?.role === 'admin') {
      profileAPI.getUserProfile()
        .then(data => {
          setProfile(data);
          setPhotoPreview(data.profile_image_url || null);
          if (data.notification_preferences) {
            setNotifPrefs(prev => ({ ...prev, ...data.notification_preferences }));
          }
        })
        .catch(() => {});
    }
  }, [isStudent, user?.role]);

  useEffect(() => {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(notifPrefs));
  }, [notifPrefs]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', photoFile);
      const currentRole = user?.role || profile?.user?.role;
      const endpoint = currentRole === 'student' ? '/students/profile/photo' : (currentRole === 'employer' ? '/employers/profile/photo' : '/user/profile/photo');
      const res = await serverClient.post(endpoint, formData);
      const freshUrl = res.data.profile_image_url;
      setPhotoPreview(freshUrl ? `${freshUrl}?t=${Date.now()}` : null);
      setPhotoFile(null);
      showAlert('Profile photo updated successfully.', 'Success', 'success');
    } catch {
      showAlert('Failed to upload photo. Please try again.', 'Upload Error', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setRemovingPhoto(true);
    try {
      const currentRole = user?.role || profile?.user?.role;
      const endpoint = currentRole === 'student' ? '/students/profile/photo' : (currentRole === 'employer' ? '/employers/profile/photo' : '/user/profile/photo');
      await serverClient.delete(endpoint);
      setPhotoPreview(null);
      setPhotoFile(null);
      showAlert('Profile photo removed successfully.', 'Success', 'success');
    } catch {
      showAlert('Failed to remove photo. Please try again.', 'Error', 'error');
    } finally {
      setRemovingPhoto(false);
    }
  };

  const handleField = (key, value) => setProfile((p) => ({ ...p, [key]: value }));

  const addLink = () => setLinks((l) => [...l, { link_type: '', url: '' }]);
  const updateLink = (i, key, val) =>
    setLinks((l) => l.map((item, idx) => (idx === i ? { ...item, [key]: val } : item)));
  const removeLink = (i) => setLinks((l) => l.filter((_, idx) => idx !== i));

  const toggleContractPreference = (val) => {
    setContractPreferences((prev) =>
      prev.includes(val) ? prev.filter((p) => p !== val) : [...prev, val]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const currentRole = user?.role || profile?.user?.role;
      const payload = currentRole === 'student'
        ? {
            display_name: profile?.display_name,
            university: profile?.university,
            course: profile?.course,
            expected_graduation_year: profile?.expected_graduation_year,
            location: profile?.location,
            linkedin_url: profile?.linkedin_url,
            additional_links: links,
            contract_preferences: contractPreferences,
            auto_accept_matches: profile?.auto_accept_matches ?? false,
          }
        : {
            company_name: profile?.company_name,
            industry: profile?.industry,
            company_size: profile?.company_size,
            location: profile?.location,
            contact_number: profile?.contact_number,
            website: profile?.website,
            bio: profile?.bio,
          };

      if (isStudent && payload.linkedin_url && !payload.linkedin_url.startsWith('http://') && !payload.linkedin_url.startsWith('https://')) {
        setSaveMsg('Please provide the full LinkedIn URL starting with https://');
        setSaving(false);
        return;
      }
      
      if (isStudent && payload.additional_links.some(l => l.url && !l.url.startsWith('http://') && !l.url.startsWith('https://'))) {
        setSaveMsg('Please provide the full URL starting with https:// for all additional links.');
        setSaving(false);
        return;
      }

      if (currentRole === 'student') {
        await profileAPI.updateStudentProfile(payload);
      } else if (currentRole === 'employer') {
        await profileAPI.updateEmployerProfile(payload);
      } else {
        await profileAPI.updateUserProfile(payload);
      }

      await profileAPI.updateUserProfile({
        notification_preferences: notifPrefs
      });

      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...currentUser, notification_preferences: notifPrefs };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      showAlert('Settings saved successfully.', 'Profile Updated', 'success');
    } catch (err) {
      showAlert(err.response?.data?.error || 'Failed to save settings. Please try again.', 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCV(true);
    setCvMsg(null);
    try {
      await resumeAPI.upload(file);
      showAlert('CV uploaded successfully. Processing started — check Notifications for confirmation.', 'Upload Success', 'success');
    } catch {
      showAlert('Failed to upload CV. Please check the file type and try again.', 'Upload Error', 'error');
    } finally {
      setUploadingCV(false);
    }
  };

  const handleUpgrade = async (plan) => {
    setPayLoading(plan);
    setPayError(null);
    try {
      const callbackUrl = `${window.location.origin}${window.location.pathname}?plan=${plan}`;
      const { authorization_url } = await paystackAPI.initialize(plan, callbackUrl);
      window.location.href = authorization_url;
    } catch (err) {
      setPayError(err?.response?.data?.error || 'Could not start checkout. Please try again.');
      setPayLoading(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      showAlert('Enter your account password to confirm deletion.', 'Password required', 'error');
      return;
    }
    try {
      setSaving(true);
      await authAPI.deleteAccount({ password: deletePassword });
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      window.location.href = "/";
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        (Array.isArray(err.response?.data?.password) ? err.response.data.password[0] : null) ||
        'Failed to delete account. Please try again or contact support.';
      showAlert(msg, 'Critical Error', 'error');
    } finally {
      setSaving(false);
      setShowDeleteModal(false);
      setDeletePassword('');
      setDeletePwdReadOnly(true);
    }
  };

  const currentPlan = profile?.subscription_plan || (profile?.is_premium_active ? 'premium' : 'free');

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-bridged-primary dark:text-bridged-light">
        Settings
      </h1>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-bridged-primary/5 dark:bg-bridged-light/5 p-1">
        {TABS.filter((tab) => {
          if (isEmployer && tab === 'Subscriptions') return false;
          if (user?.role === 'admin' && tab === 'Subscriptions') return false;
          return true;
        }).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white dark:bg-bridged-primary shadow text-bridged-teal'
                : 'text-bridged-primary/60 dark:text-bridged-light/60 hover:text-bridged-primary dark:hover:text-bridged-light'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'General' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-5">
            <h2 className="mb-4 text-sm font-semibold text-bridged-primary dark:text-bridged-light">
              Profile photo
            </h2>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border-2 border-bridged-teal/40 bg-bridged-teal/10">
                {photoPreview && !imgError ? (
                  <img src={photoPreview} alt="Profile" className="h-full w-full object-cover" onError={() => setImgError(true)} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-bridged-teal">
                    {(profile?.display_name || profile?.company_name || user?.email || '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="rounded-lg border border-bridged-teal/30 px-3 py-1.5 text-sm text-bridged-teal hover:bg-bridged-teal/10"
                >
                  {photoPreview ? 'Change photo' : 'Upload photo'}
                </button>
                {photoFile && (
                  <button
                    type="button"
                    onClick={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="rounded-lg bg-bridged-teal px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {uploadingPhoto ? 'Saving…' : 'Save photo'}
                  </button>
                )}
                {photoPreview && !photoFile && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={removingPhoto}
                    className="rounded-lg px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                  >
                    {removingPhoto ? 'Removing…' : 'Remove'}
                  </button>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-5">
            <h2 className="mb-4 text-sm font-semibold text-bridged-primary dark:text-bridged-light">
              Account
            </h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Email</label>
                <input
                  className={inputCls + ' opacity-60 cursor-not-allowed'}
                  value={user?.email || ''}
                  readOnly
                />
                <p className="mt-1 text-xs text-bridged-primary/50 dark:text-bridged-light/50">
                  Email cannot be changed here. Contact support if needed.
                </p>
              </div>

              {isStudent && (
                <>
                  <div>
                    <label className={labelCls}>Display name</label>
                    <input
                      className={inputCls}
                      value={profile?.display_name || ''}
                      onChange={(e) => handleField('display_name', e.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>University / institution</label>
                      <input
                        className={inputCls}
                        value={profile?.university || ''}
                        onChange={(e) => handleField('university', e.target.value)}
                        placeholder="e.g. University of Lagos"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Course / programme</label>
                      <input
                        className={inputCls}
                        value={profile?.course || ''}
                        onChange={(e) => handleField('course', e.target.value)}
                        placeholder="e.g. Computer Science"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Expected graduation year</label>
                      <input
                        className={inputCls}
                        type="number"
                        min={2020}
                        max={2035}
                        value={profile?.expected_graduation_year || ''}
                        onChange={(e) => handleField('expected_graduation_year', e.target.value)}
                        placeholder="e.g. 2026"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Location</label>
                      <input
                        className={inputCls}
                        value={profile?.location || ''}
                        onChange={(e) => handleField('location', e.target.value)}
                        placeholder="e.g. Lagos, Nigeria"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>LinkedIn URL</label>
                    <input
                      className={inputCls}
                      type="url"
                      value={profile?.linkedin_url || ''}
                      onChange={(e) => handleField('linkedin_url', e.target.value)}
                      placeholder="https://linkedin.com/in/your-name"
                    />
                    <p className="mt-1 text-[10px] text-bridged-primary/50 dark:text-bridged-light/50">
                      Hint: Use full URL including https://
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Contract Preferences</label>
                    <div className="flex flex-wrap gap-2 mt-1">
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
                  <div className="mt-4 rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 bg-bridged-primary/5 dark:bg-bridged-light/5 px-4 py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-bridged-primary dark:text-bridged-light">
                        Auto-accept new matches
                      </p>
                      <p className="mt-1 text-[11px] text-bridged-primary/70 dark:text-bridged-light/80 max-w-sm">
                        When turned on, BridgEd will automatically accept new eligible matches for you so employers can immediately view your full profile.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!profile?.auto_accept_matches}
                      onClick={() => handleField('auto_accept_matches', !profile?.auto_accept_matches)}
                      className={`relative mt-1 flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                        profile?.auto_accept_matches ? 'bg-bridged-teal' : 'bg-bridged-primary/20 dark:bg-bridged-light/20'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white text-bridged-teal shadow-md flex items-center justify-center text-[10px] transition-transform ${
                          profile?.auto_accept_matches ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </>
              )}

              {isEmployer && (
                <>
                  <div>
                    <label className={labelCls}>Company name</label>
                    <input
                      className={inputCls}
                      value={profile?.company_name || ''}
                      onChange={(e) => handleField('company_name', e.target.value)}
                      placeholder="Company name"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Industry</label>
                      <input
                        className={inputCls}
                        value={profile?.industry || ''}
                        onChange={(e) => handleField('industry', e.target.value)}
                        placeholder="e.g. Technology"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Company size</label>
                      <select
                        className={inputCls}
                        value={profile?.company_size || ''}
                        onChange={(e) => handleField('company_size', e.target.value)}
                      >
                        <option value="">Select size</option>
                        {['1-10', '11-50', '51-200', '201-500', '500+'].map((s) => (
                          <option key={s} value={s}>{s} employees</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Location</label>
                      <input
                        className={inputCls}
                        value={profile?.location || ''}
                        onChange={(e) => handleField('location', e.target.value)}
                        placeholder="e.g. Lagos, Nigeria"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Contact number</label>
                      <input
                        className={inputCls}
                        value={profile?.contact_number || ''}
                        onChange={(e) => handleField('contact_number', e.target.value)}
                        placeholder="+234…"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Website</label>
                    <input
                      className={inputCls}
                      type="url"
                      value={profile?.website || ''}
                      onChange={(e) => handleField('website', e.target.value)}
                      placeholder="https://yourcompany.com"
                    />
                    <p className="mt-1 text-[10px] text-bridged-primary/50 dark:text-bridged-light/50">
                      Hint: Use full URL including https://
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Company bio</label>
                    <textarea
                      className={inputCls}
                      rows={3}
                      value={profile?.bio || ''}
                      onChange={(e) => handleField('bio', e.target.value)}
                      placeholder="Short company description shown to students"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {isStudent && (
            <section className="rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-bridged-primary dark:text-bridged-light">
                  Additional links
                </h2>
                <button
                  type="button"
                  onClick={addLink}
                  className="flex items-center gap-1.5 rounded-lg border border-bridged-teal/30 px-3 py-1.5 text-xs text-bridged-teal hover:bg-bridged-teal/10"
                >
                  <i className="fa-solid fa-plus" aria-hidden /> Add link
                </button>
              </div>
              <p className="mb-4 text-[10px] text-bridged-primary/50 dark:text-bridged-light/50">
                Hint: Use full URLs including https:// (e.g. https://github.com/...)
              </p>
              {links.length === 0 ? (
                <p className="text-sm text-bridged-primary/50 dark:text-bridged-light/50">
                  No additional links added yet. Add GitHub, Portfolio, or other relevant links.
                </p>
              ) : (
                <div className="space-y-3">
                  {links.map((link, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        className={inputCls + ' flex-1'}
                        value={link.link_type}
                        onChange={(e) => updateLink(i, 'link_type', e.target.value)}
                      >
                        <option value="">Link type…</option>
                        {['GitHub', 'Portfolio', 'LinkedIn', 'Twitter / X', 'Website', 'Other'].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <input
                        className={inputCls + ' flex-1'}
                        type="url"
                        value={link.url}
                        onChange={(e) => updateLink(i, 'url', e.target.value)}
                        placeholder="https://…"
                      />
                      <button
                        type="button"
                        onClick={() => removeLink(i)}
                        className="rounded-lg p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        aria-label="Remove link"
                      >
                        <i className="fa-solid fa-trash-can text-xs" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {isStudent && (
            <section className="rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-5">
              <h2 className="mb-1 text-sm font-semibold text-bridged-primary dark:text-bridged-light">
                Re-upload CV
              </h2>
              <p className="mb-4 text-xs text-bridged-primary/60 dark:text-bridged-light/60">
                Upload a new CV to update your profile. After uploading, you can review and edit the parsed information.
              </p>
              <button
                type="button"
                disabled={uploadingCV}
                onClick={() => onNavigate?.('resume-upload')}
                className="inline-flex items-center gap-2 rounded-lg border border-bridged-teal/30 px-4 py-2 text-sm text-bridged-teal hover:bg-bridged-teal/10 dark:text-bridged-light hover:dark:bg-bridged-light/10"
              >
                <i className="fa-solid fa-file-arrow-up" aria-hidden />
                Go to CV upload
              </button>
            </section>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-bridged-teal px-6 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
          
          <section className="mt-12 pt-8 border-t border-red-500/10">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
              <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60 mb-6">
                Permanently delete your account and all associated data. This action is irreversible. All your profile information, matching history, and resumes will be deleted.
              </p>
              <button
                 type="button"
                 onClick={() => {
                   setDeletePassword('');
                   setDeletePwdReadOnly(true);
                   setShowDeleteModal(true);
                 }}
                 disabled={saving}
                 className="px-6 py-2.5 rounded-lg border border-red-500 text-red-500 text-sm font-bold hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
              >
                Delete Account
              </button>
            </div>
          </section>

          {showDeleteModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bridged-primary/60 backdrop-blur-sm">
              <div className="w-full max-w-md bg-white dark:bg-bridged-primary rounded-2xl shadow-2xl border border-red-500/20 overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
                <div className="bg-red-500/10 p-6 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 text-red-500">
                    <i className="fa-solid fa-triangle-exclamation text-xl" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-bridged-primary dark:text-bridged-light">Delete Account?</h3>
                    <p className="text-xs text-red-500 font-medium uppercase tracking-wider">Irreversible Action</p>
                  </div>
                </div>
                
                <form
                  className="p-6"
                  autoComplete="off"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleDeleteAccount();
                  }}
                >
                  <p className="text-sm text-bridged-primary/70 dark:text-bridged-light/70 mb-4 leading-relaxed">
                    Are you absolutely sure? This will permanently delete your BridgEd account and all data across the platform. This cannot be undone.
                  </p>
                  <div className="mb-6">
                    <label className={labelCls} htmlFor="delete-account-password">
                      Enter your password to confirm
                    </label>
                    <input
                      id="delete-account-password"
                      name="account-deletion-password"
                      type="password"
                      autoComplete="new-password"
                      autoCorrect="off"
                      spellCheck={false}
                      readOnly={deletePwdReadOnly}
                      onFocus={(e) => {
                        setDeletePwdReadOnly(false);
                        e.target.removeAttribute('readonly');
                      }}
                      data-1p-ignore
                      data-lpignore="true"
                      data-form-type="other"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteModal(false);
                        setDeletePassword('');
                        setDeletePwdReadOnly(true);
                      }}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 text-sm font-semibold text-bridged-primary dark:text-bridged-light hover:bg-bridged-primary/5 dark:hover:bg-bridged-light/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all disabled:opacity-50"
                    >
                      {saving ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Notification Preferences' && (
        <div className="space-y-4">
          <p className="text-sm text-bridged-primary/70 dark:text-bridged-light/70">
            Choose which in-app notifications you want to receive. Preferences are saved to this browser.
          </p>
          <section className="rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 divide-y divide-bridged-primary/8 dark:divide-bridged-light/8">
            {NOTIF_PREFS.filter((p) => {
              const isAdmin = user?.role === 'admin';
              const adminOnly = ['user_registered', 'job_posted', 'user_suspended'];
              if (adminOnly.includes(p.key)) return isAdmin;
              
              if (isAdmin) {
                return !['new_match', 'interest_confirmed', 'match_declined', 'student_interested', 'job_published', 'cv_parsed', 'subscription_expiring'].includes(p.key);
              }

              if (isStudent && ['student_interested', 'job_published'].includes(p.key)) return false;
              if (isEmployer && ['new_match', 'interest_confirmed', 'match_declined', 'cv_parsed'].includes(p.key)) return false;
              return true;
            }).map((pref) => (
              <div key={pref.key} className="flex items-start justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-bridged-primary dark:text-bridged-light">{pref.label}</p>
                  <p className="mt-0.5 text-xs text-bridged-primary/60 dark:text-bridged-light/60">{pref.desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!notifPrefs[pref.key]}
                  onClick={() =>
                    setNotifPrefs((p) => ({ ...p, [pref.key]: !p[pref.key] }))
                  }
                  className={`relative mt-0.5 flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                    notifPrefs[pref.key] ? 'bg-bridged-teal' : 'bg-bridged-primary/20 dark:bg-bridged-light/20'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      notifPrefs[pref.key] ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </section>
          <p className="text-xs text-bridged-primary/40 dark:text-bridged-light/40">
            Note: disabled notification types are filtered from your Notifications page. They are not deleted.
          </p>
        </div>
      )}

      {activeTab === 'Subscriptions' && (
        <div className="space-y-6">
          {isEmployer ? (
            <section className="rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-5">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-building-columns text-bridged-teal text-xl" aria-hidden />
                <div>
                  <p className="font-semibold text-bridged-primary dark:text-bridged-light">Employer account</p>
                  <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">
                    Employer access is included with your account. Subscription plans are for students.
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-5">
                <h2 className="mb-3 text-sm font-semibold text-bridged-primary dark:text-bridged-light">
                  Current plan
                </h2>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${PLANS[currentPlan].badge}`}>
                    {PLANS[currentPlan].name}
                  </span>
                  <span className="text-sm text-bridged-primary/70 dark:text-bridged-light/70">
                    {currentPlan === 'free' ? 'Upgrade to access more matches and features.' : 'You have an active subscription.'}
                  </span>
                </div>
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                {(['basic', 'premium']).map((plan) => {
                  const p = PLANS[plan];
                  const isCurrent = currentPlan === plan;
                  return (
                    <div
                      key={plan}
                      className={`rounded-xl border p-5 ${
                        plan === 'premium'
                          ? 'border-bridged-accent/40 bg-bridged-accent/5 dark:bg-bridged-accent/10'
                          : 'border-bridged-teal/30 bg-bridged-teal/5 dark:bg-bridged-teal/10'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className={`text-base font-bold ${p.color}`}>{p.name}</p>
                        {isCurrent && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.badge}`}>
                            Current
                          </span>
                        )}
                      </div>
                      <ul className="mb-5 space-y-1.5">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm text-bridged-primary/80 dark:text-bridged-light/80">
                            <i className="fa-solid fa-circle-check mt-0.5 text-bridged-teal text-xs flex-shrink-0" aria-hidden />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {!isCurrent && (
                        <button
                          type="button"
                          disabled={!!payLoading}
                          onClick={() => handleUpgrade(plan)}
                          className={`w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50 transition-opacity ${
                            plan === 'premium' ? 'bg-bridged-accent hover:opacity-90' : 'bg-bridged-teal hover:opacity-90'
                          }`}
                        >
                          {payLoading === plan ? (
                            <><i className="fa-solid fa-rotate animate-spin mr-2" aria-hidden />Opening…</>
                          ) : (
                            `Upgrade to ${p.name}`
                          )}
                        </button>
                      )}
                      {isCurrent && (
                        <p className="text-center text-xs text-bridged-primary/50 dark:text-bridged-light/50">
                          You are on this plan
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {payError && (
                <p className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  {payError}
                </p>
              )}

              <p className="text-xs text-bridged-primary/40 dark:text-bridged-light/40">
                Payments are handled securely by Paystack. BridgEd does not store your card details.
                This is currently in test mode.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
