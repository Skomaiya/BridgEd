import React, { useState, useEffect } from 'react';
import { supportAPI } from '../api/api';

const ContactPage = ({ onNavigate, darkMode, toggleDarkMode, user }) => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState({ loading: false, success: null, error: null });

  const navLinkClass = (active) =>
    `text-sm font-medium transition-colors ${
      active
        ? darkMode ? 'text-bridged-accent' : 'text-bridged-teal'
        : darkMode
          ? 'text-bridged-light hover:text-bridged-accent'
          : 'text-bridged-primary hover:text-bridged-teal'
    }`;

  useEffect(() => {
    if (user) {
      setForm(prev => ({ 
        ...prev, 
        email: user.email,
        name: user.role === 'employer' ? (user.employer_profile?.company_name || '') : (user.student_profile?.display_name || prev.name)
      }));
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: null, error: null });
    try {
      const res = await supportAPI.submitContact(form);
      setStatus({ loading: false, success: res.message, error: null });
      if (!user) {
        setForm({ name: '', email: '', subject: '', message: '' });
      } else {
        setForm(prev => ({ ...prev, subject: '', message: '' }));
      }
    } catch (err) {
      setStatus({ 
        loading: false, 
        success: null, 
        error: err.response?.data?.error || 'Something went wrong. Please try again later.' 
      });
    }
  };

  return (
    <div className="min-h-screen bg-bridged-light dark:bg-bridged-primary text-bridged-primary dark:text-bridged-light transition-colors duration-300">
      <nav className={`flex items-center justify-between px-6 py-4 sticky top-0 z-50 backdrop-blur-md border-b ${
        darkMode ? 'bg-bridged-primary/90 border-bridged-teal/30' : 'bg-white/90 border-bridged-primary/10'
      }`}>
        <div className="flex items-center">
          <img 
            src={darkMode ? '/images/logo-dark.png' : '/images/logo-light.png'} 
            alt="BridgEd" 
            className="h-12 w-auto object-contain cursor-pointer transition-transform origin-left scale-[2.5]"
            onClick={() => onNavigate(user ? 'dashboard' : 'landing')}
          />
        </div>
        <div className="flex items-center gap-6 sm:gap-8">
          <button onClick={() => onNavigate(user ? 'dashboard' : 'landing')} className={navLinkClass(false)}>
            {user ? 'Dashboard' : 'Home'}
          </button>
          {!user && (
            <button onClick={() => onNavigate('about')} className={navLinkClass(false)}>About</button>
          )}
          <button onClick={() => onNavigate('contact')} className={navLinkClass(true)}>Contact</button>
          <button
            onClick={toggleDarkMode}
            className={`rounded-lg p-2 transition-colors ${
              darkMode ? 'text-bridged-light/80 hover:bg-bridged-light/10' : 'text-bridged-primary/80 hover:bg-bridged-primary/10'
            }`}
          >
            {darkMode ? <i className="fa-solid fa-sun" /> : <i className="fa-solid fa-moon" />}
          </button>
          {!user && (
            <button 
              onClick={() => onNavigate('auth')} 
              className="px-4 py-2 rounded-lg bg-bridged-teal text-white text-sm font-semibold hover:bg-bridged-teal/90 transition shadow-sm"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold mb-4 tracking-tight">
            Get in <span className="text-bridged-teal">Touch</span>
          </h1>
          <p className="text-xl text-bridged-primary/60 dark:text-bridged-light/60">
            Have questions or need support? Our team handles every request with care.
          </p>
        </div>

        <div className={`p-10 rounded-[2.5rem] border transition-all ${
          darkMode ? 'bg-bridged-primary/40 border-bridged-teal/20' : 'bg-white border-bridged-primary/5'
        } shadow-2xl`}>
          {status.success ? (
            <div className="py-12 text-center animate-in fade-in zoom-in duration-300">
              <div className="h-24 w-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
                <i className="fa-solid fa-check text-green-500 text-4xl"></i>
              </div>
              <h2 className="text-3xl font-bold mb-4">Message Received!</h2>
              <p className="text-lg text-bridged-primary/70 dark:text-bridged-light/70 mb-10">{status.success}</p>
              <button 
                onClick={() => setStatus({ ...status, success: null })}
                className="px-8 py-3 rounded-xl bg-bridged-teal text-white font-bold hover:scale-105 transition"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {status.error && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold flex items-center gap-3">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  {status.error}
                </div>
              )}
              
              <div className="grid md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-2 group">
                  <label htmlFor="name" className="text-sm font-extrabold uppercase tracking-wider text-bridged-primary/40 dark:text-bridged-light/40 group-focus-within:text-bridged-teal transition-colors flex items-center gap-2">
                    <i className="fa-solid fa-user text-[10px]" />
                    Your Name
                  </label>
                  <div className="relative">
                    <input 
                      id="name"
                      name="name"
                      type="text" 
                      required
                      disabled={status.loading || !!user}
                      value={form.name}
                      onChange={(e) => setForm({...form, name: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl bg-bridged-primary/5 dark:bg-bridged-light/5 border-2 border-transparent focus:border-bridged-teal focus:bg-white dark:focus:bg-bridged-primary/40 transition-all outline-none font-medium disabled:opacity-50 shadow-sm"
                      placeholder="John Doe"
                      autoComplete="name"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 group">
                  <label htmlFor="email" className="text-sm font-extrabold uppercase tracking-wider text-bridged-primary/40 dark:text-bridged-light/40 group-focus-within:text-bridged-teal transition-colors flex items-center gap-2">
                    <i className="fa-solid fa-envelope text-[10px]" />
                    Email Address
                  </label>
                  <div className="relative">
                    <input 
                      id="email"
                      name="email"
                      type="email" 
                      required
                      disabled={status.loading || !!user}
                      value={form.email}
                      onChange={(e) => setForm({...form, email: e.target.value})}
                      className={`w-full px-5 py-4 rounded-2xl bg-bridged-primary/5 dark:bg-bridged-light/5 border-2 border-transparent focus:border-bridged-teal focus:bg-white dark:focus:bg-bridged-primary/40 transition-all outline-none font-medium shadow-sm ${
                        user ? 'opacity-50 cursor-not-allowed border-dashed border-bridged-primary/10 dark:border-bridged-light/10' : 'disabled:opacity-50'
                      }`}
                      placeholder="john@example.com"
                      autoComplete="email"
                    />
                    {user && <p className="mt-1 text-[10px] uppercase font-extrabold text-bridged-teal/60">Verified account email</p>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 group">
                <label htmlFor="subject" className="text-sm font-extrabold uppercase tracking-wider text-bridged-primary/40 dark:text-bridged-light/40 group-focus-within:text-bridged-teal transition-colors flex items-center gap-2">
                  <i className="fa-solid fa-circle-info text-[10px]" />
                  Subject
                </label>
                <div className="relative">
                  <input 
                    id="subject"
                    name="subject"
                    type="text" 
                    required
                    disabled={status.loading}
                    value={form.subject}
                    onChange={(e) => setForm({...form, subject: e.target.value})}
                    className="w-full px-5 py-4 rounded-2xl bg-bridged-primary/5 dark:bg-bridged-light/5 border-2 border-transparent focus:border-bridged-teal focus:bg-white dark:focus:bg-bridged-primary/40 transition-all outline-none font-medium disabled:opacity-50 shadow-sm"
                    placeholder="How can we help you?"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 group">
                <label htmlFor="message" className="text-sm font-extrabold uppercase tracking-wider text-bridged-primary/40 dark:text-bridged-light/40 group-focus-within:text-bridged-teal transition-colors flex items-center gap-2">
                  <i className="fa-solid fa-message text-[10px]" />
                  Message
                </label>
                <div className="relative">
                  <textarea 
                    id="message"
                    name="message"
                    required
                    rows="5"
                    disabled={status.loading}
                    value={form.message}
                    onChange={(e) => setForm({...form, message: e.target.value})}
                    className="w-full px-5 py-4 rounded-2xl bg-bridged-primary/5 dark:bg-bridged-light/5 border-2 border-transparent focus:border-bridged-teal focus:bg-white dark:focus:bg-bridged-primary/40 transition-all outline-none font-medium resize-none disabled:opacity-50 shadow-sm"
                    placeholder="Tell us what's on your mind..."
                    autoComplete="off"
                  ></textarea>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={status.loading}
                className="w-full py-5 rounded-2xl bg-bridged-teal text-white font-extrabold text-xl hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all shadow-xl shadow-bridged-teal/20 flex items-center justify-center gap-3 overflow-hidden group relative"
              >
                <span className="relative z-10">
                  {status.loading ? (
                    <span className="flex items-center gap-3">
                      <i className="fa-solid fa-spinner animate-spin"></i> Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-3">
                      Submit Request <i className="fa-solid fa-paper-plane text-sm group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </span>
                  )}
                </span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default ContactPage;
