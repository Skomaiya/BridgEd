import { useState, useEffect } from 'react';
import { profileAPI } from '../api/api';

const inputClass =
  'rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 bg-white dark:bg-bridged-primary/80 px-4 py-3 text-bridged-primary dark:text-bridged-light placeholder:opacity-50 focus:border-bridged-teal focus:outline-none focus:ring-2 focus:ring-bridged-teal/20 disabled:opacity-50';

const EmployerRegister = ({ user, onComplete }) => {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [location, setLocation] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [bio, setBio] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [yearEstablished, setYearEstablished] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    profileAPI.getEmployerProfile().then((p) => {
      setCompanyName(p.company_name || '');
      setIndustry(p.industry || '');
      setCompanySize(p.company_size || '');
      setLocation(p.location || '');
      setOfficeAddress(p.office_address || '');
      setContactNumber(p.contact_number || '');
      setWebsite(p.website || '');
      setBio(p.bio || '');
      setRegistrationNumber(p.registration_number || '');
      setYearEstablished(p.year_established != null ? String(p.year_established) : '');
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!companyName.trim()) {
      setError('Company name is required.');
      return;
    }

    setLoading(true);
    try {
      await profileAPI.updateEmployerProfile({
        company_name: companyName.trim(),
        industry: industry.trim() || undefined,
        company_size: companySize.trim() || undefined,
        location: location.trim() || undefined,
        office_address: officeAddress.trim() || undefined,
        contact_number: contactNumber.trim() || undefined,
        website: website.trim() && website.trim().startsWith('http') ? website.trim() : website.trim() ? 'https://' + website.trim() : undefined,
        bio: bio.trim() || undefined,
        registration_number: registrationNumber.trim() || undefined,
        year_established: yearEstablished ? parseInt(yearEstablished, 10) : undefined,
      });
      onComplete();
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.company_name?.[0] ||
        (typeof err.response?.data === 'object' && Object.values(err.response.data).flat().find(Boolean)) ||
        'Failed to save. Please try again.';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bridged-light p-6 dark:bg-bridged-primary sm:p-8">
      <div className="w-full max-w-[520px] rounded-2xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/50 p-6 shadow-lg sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-bridged-primary dark:text-bridged-light">
            Complete your company profile
          </h1>
          <p className="mt-2 text-sm text-bridged-primary/70 dark:text-bridged-light/70">
            You're signing up as an <strong className="text-bridged-primary dark:text-bridged-light">Employer</strong>. Add your company details so we can verify your organisation and you can post jobs.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="companyName" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
              Company name
            </label>
            <input
              id="companyName"
              name="company_name"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your company or organisation name"
              required
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="industry" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
              Industry
            </label>
            <input
              id="industry"
              name="industry"
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Technology, Finance, Healthcare"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="companySize" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
              Company size
            </label>
            <select
              id="companySize"
              name="company_size"
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              className={inputClass + ' cursor-pointer'}
            >
              <option value="">Select size</option>
              <option value="1-10">1–10</option>
              <option value="11-50">11–50</option>
              <option value="51-200">51–200</option>
              <option value="200+">200+</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="location" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
              Location (city / region)
            </label>
            <input
              id="location"
              name="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Lagos, Nigeria"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="officeAddress" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
              Physical office address
            </label>
            <textarea
              id="officeAddress"
              name="office_address"
              value={officeAddress}
              onChange={(e) => setOfficeAddress(e.target.value)}
              placeholder="Full address for verification (street, building, city)"
              rows={2}
              className={inputClass + ' resize-y min-h-[4rem]'}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="website" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
              Company website
            </label>
            <input
              id="website"
              name="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.yourcompany.com"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="bio" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
              Company bio
            </label>
            <textarea
              id="bio"
              name="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short description of your company and what you do"
              rows={3}
              className={inputClass + ' resize-y min-h-[5rem]'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="registrationNumber" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
                Registration number
              </label>
              <input
                id="registrationNumber"
                name="registration_number"
                type="text"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="If applicable"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="yearEstablished" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
                Year established
              </label>
              <input
                id="yearEstablished"
                name="year_established"
                type="number"
                min="1900"
                max={new Date().getFullYear()}
                value={yearEstablished}
                onChange={(e) => setYearEstablished(e.target.value)}
                placeholder="e.g. 2015"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="contactNumber" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">
              Contact number
            </label>
            <input
              id="contactNumber"
              name="contact_number"
              type="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g. +234 800 000 0000"
              className={inputClass}
            />
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
            {loading ? 'Saving...' : 'Continue to BridgEd'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmployerRegister;
