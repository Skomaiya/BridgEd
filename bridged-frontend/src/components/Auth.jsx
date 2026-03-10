import { useState, useEffect } from 'react';
import { authAPI } from '../api/api';

const Auth = ({ onLoginSuccess, onRegisterSuccess, onBack, darkMode, toggleDarkMode }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('student');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showImageFallback, setShowImageFallback] = useState(false);
  const [panelImageExt, setPanelImageExt] = useState('png');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isLogin) {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (role === 'employer' && !companyName.trim()) {
        setError('Company name is required for employers.');
        return;
      }
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("You're offline. Please connect to a network and try again.");
      return;
    }

    setLoading(true);
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('user_display_name');
      if (isLogin) {
        const response = await authAPI.login(email, password);
        localStorage.setItem('access_token', response.tokens.access);
        localStorage.setItem('refresh_token', response.tokens.refresh);
        localStorage.setItem('user', JSON.stringify(response.user));
        if (name.trim()) localStorage.setItem('user_display_name', name.trim());
        onLoginSuccess(response.user);
      } else {
        const response = await authAPI.register(
          email,
          password,
          confirmPassword,
          role,
          role === 'employer' ? companyName.trim() || undefined : undefined
        );
        localStorage.setItem('access_token', response.tokens.access);
        localStorage.setItem('refresh_token', response.tokens.refresh);
        localStorage.setItem('user', JSON.stringify(response.user));
        if (name.trim()) localStorage.setItem('user_display_name', name.trim());
        onRegisterSuccess(response.user);
      }
    } catch (err) {
      const noResponse = !err.response && (err.request || err.code === 'ERR_NETWORK' || err.message === 'Network Error');
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (noResponse || isOffline) {
        setError(
          isOffline
            ? "You're offline. Please connect to a network and try again."
            : "Cannot reach server. Please check your connection and try again."
        );
        return;
      }
      const data = err.response?.data;
      const msg =
        (data && typeof data === 'object' && data.error) ||
        (data && typeof data === 'object' && data.detail) ||
        (data && typeof data === 'object' && data.email?.[0]) ||
        (data && typeof data === 'object' && data.password?.[0]) ||
        (data && typeof data === 'object' && Object.values(data).flat().find(Boolean)) ||
        (err.response?.status === 401 && 'Invalid email or password.') ||
        (err.response?.status === 500 && 'Server error. Please try again later.') ||
        (err.response?.status && `Request failed (${err.response.status}).`) ||
        'Something went wrong. Please try again.';
      setError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bridged-light dark:bg-bridged-primary p-4 md:p-6">
      <div className="flex w-full max-w-6xl overflow-hidden rounded-2xl bg-white dark:bg-bridged-primary/40 shadow-xl ring-1 ring-bridged-primary/5 dark:ring-bridged-teal/10">
        
        {/* Left Side: Form */}
        <div className="flex flex-[1.2] flex-col justify-center px-8 py-10 md:px-16 lg:px-24">
          <div className="mb-8 flex items-center justify-between">
            <img
              src={darkMode ? '/images/logo-dark.png' : '/images/logo-light.png'}
              alt="BridgEd"
              className="h-10 w-auto object-contain transition-transform origin-left scale-[2.0]"
            />
            <button
              type="button"
              onClick={toggleDarkMode}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-bridged-primary dark:text-bridged-light border border-bridged-teal/40 hover:bg-bridged-teal/10 transition-colors flex items-center gap-2"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <><i className="fa-solid fa-sun" /> Light</> : <><i className="fa-solid fa-moon" /> Dark</>}
            </button>
          </div>

          <button 
            onClick={onBack}
            className="mb-6 flex items-center gap-2 text-sm font-medium text-bridged-primary/60 dark:text-bridged-light/60 hover:text-bridged-teal transition-colors"
          >
            <i className="fa-solid fa-arrow-left text-xs"></i>
            Back to home
          </button>

          <div className="mb-4 flex gap-6">
            <button
              type="button"
              className={`relative bg-transparent pb-2 text-base font-medium transition-all ${
                isLogin
                  ? 'text-bridged-primary dark:text-bridged-light'
                  : 'text-bridged-primary/60 dark:text-bridged-light/60 hover:text-bridged-primary dark:hover:text-bridged-light'
              }`}
              onClick={() => { setIsLogin(true); setError(''); }}
            >
              Sign In
              {isLogin && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-bridged-primary dark:bg-bridged-light" />
              )}
            </button>
            <button
              type="button"
              className={`relative bg-transparent pb-2 text-base font-medium transition-all ${
                !isLogin
                  ? 'text-bridged-primary dark:text-bridged-light'
                  : 'text-bridged-primary/60 dark:text-bridged-light/60 hover:text-bridged-primary dark:hover:text-bridged-light'
              }`}
              onClick={() => { setIsLogin(false); setError(''); }}
            >
              Sign Up
              {!isLogin && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-bridged-primary dark:bg-bridged-light" />
              )}
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-bridged-primary dark:text-bridged-light mb-1">
              {isLogin ? 'Welcome back' : 'Create Your Account'}
            </h2>
            <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60 font-medium">
              {isLogin ? 'Log in to your account.' : 'Become a BridgEd user.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {!isLogin && (
              <div className="flex flex-col gap-2">
                <label htmlFor="name" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                  disabled={loading}
                  autoComplete="name"
                  className="rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 bg-white dark:bg-bridged-primary/80 px-4 py-3 text-bridged-primary dark:text-bridged-light placeholder:opacity-50 focus:border-bridged-teal focus:outline-none focus:ring-2 focus:ring-bridged-teal/20 disabled:opacity-50"
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                disabled={loading}
                autoComplete="email"
                className="rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 bg-white dark:bg-bridged-primary/80 px-4 py-3 text-bridged-primary dark:text-bridged-light placeholder:opacity-50 focus:border-bridged-teal focus:outline-none focus:ring-2 focus:ring-bridged-teal/20 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" title="Password must be at least 8 characters" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={8}
                autoComplete={isLogin ? 'current-password' : 'off'}
                className="rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 bg-white dark:bg-bridged-primary/80 px-4 py-3 text-bridged-primary dark:text-bridged-light placeholder:opacity-50 focus:border-bridged-teal focus:outline-none focus:ring-2 focus:ring-bridged-teal/20 disabled:opacity-50"
              />
            </div>

            {!isLogin && (
              <>
                <div className="flex flex-col gap-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    minLength={8}
                    autoComplete="off"
                    className="rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 bg-white dark:bg-bridged-primary/80 px-4 py-3 text-bridged-primary dark:text-bridged-light placeholder:opacity-50 focus:border-bridged-teal focus:outline-none focus:ring-2 focus:ring-bridged-teal/20 disabled:opacity-50"
                  />
                </div>
                <div className="mt-1 flex flex-col gap-2">
                  <span className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">I am a</span>
                  <div className="flex gap-6">
                    <label className="flex cursor-pointer items-center gap-2 text-bridged-primary dark:text-bridged-light">
                      <input type="radio" name="role" value="student" checked={role === 'student'} onChange={() => setRole('student')} disabled={loading} className="accent-bridged-accent" />
                      Student
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-bridged-primary dark:text-bridged-light">
                      <input type="radio" name="role" value="employer" checked={role === 'employer'} onChange={() => setRole('employer')} disabled={loading} className="accent-bridged-accent" />
                      Employer
                    </label>
                  </div>
                </div>
                {role === 'employer' && (
                  <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-300">
                    <label htmlFor="companyName" className="text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70">Company Name</label>
                    <input
                      id="companyName"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your company name"
                      disabled={loading}
                      className="rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 bg-white dark:bg-bridged-primary/80 px-4 py-3 text-bridged-primary dark:text-bridged-light placeholder:opacity-50 focus:border-bridged-teal focus:outline-none focus:ring-2 focus:ring-bridged-teal/20 disabled:opacity-50"
                    />
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-lg bg-bridged-accent px-6 py-3 text-base font-semibold text-bridged-primary transition hover:opacity-95 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : isLogin ? 'Log In' : 'Create Account'}
            </button>
          </form>
        </div>

        <div
          className={`relative hidden flex-1 items-center justify-center p-12 lg:flex ${
            darkMode ? 'bg-bridged-teal/10' : 'bg-bridged-primary/5'
          }`}
        >
          <div
            className={`relative flex aspect-[4/5] w-full max-w-sm shrink-0 items-center justify-center rounded-2xl p-6 ${
              darkMode ? 'bg-bridged-teal' : 'bg-bridged-primary'
            } transition-all duration-500`}
          >
            {!showImageFallback ? (
              <img
                key={`${darkMode ? 'dark' : 'light'}-${panelImageExt}`}
                src={`${darkMode ? '/images/signup-dark.' : '/images/signup-light.'}${panelImageExt}?theme=${darkMode ? 'dark' : 'light'}`}
                alt="BridgEd"
                className="max-h-full max-w-full rounded-xl object-contain"
                onError={() => {
                  if (panelImageExt === 'png') setPanelImageExt('jpeg');
                  else setShowImageFallback(true);
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/20">
                <i className="fa-solid fa-user-graduate text-9xl animate-bounce" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
