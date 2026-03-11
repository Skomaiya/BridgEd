import React, { useState } from 'react';

const LandingPage = ({ onNavigate, darkMode, toggleDarkMode }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinkClass = (active) =>
    `text-sm font-medium transition-colors ${
      active
        ? darkMode ? 'text-bridged-accent' : 'text-bridged-teal'
        : darkMode
          ? 'text-bridged-light hover:text-bridged-accent'
          : 'text-bridged-primary hover:text-bridged-teal'
    }`;

  return (
    <div className="min-h-screen bg-bridged-light dark:bg-bridged-primary text-bridged-primary dark:text-bridged-light transition-colors duration-300">
      <nav className={`sticky top-0 z-50 backdrop-blur-md border-b ${
        darkMode ? 'bg-bridged-primary/90 border-bridged-teal/30' : 'bg-white/90 border-bridged-primary/10'
      }`}>
        <div className="flex items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center">
            <img
              src={darkMode ? '/images/logo-dark.png' : '/images/logo-light.png'}
              alt="BridgEd"
              className="h-12 w-auto object-contain cursor-pointer transition-transform origin-left scale-[2.5]"
              onClick={() => onNavigate('landing')}
            />
          </div>
          <div className="hidden sm:flex items-center gap-6 sm:gap-8">
            <button onClick={() => onNavigate('landing')} className={navLinkClass(true)}>Home</button>
            <button onClick={() => onNavigate('about')} className={navLinkClass(false)}>About</button>
            <button onClick={() => onNavigate('contact')} className={navLinkClass(false)}>Contact</button>
            <button onClick={toggleDarkMode} className={`rounded-lg p-2 transition-colors ${darkMode ? 'text-bridged-light/80 hover:bg-bridged-light/10' : 'text-bridged-primary/80 hover:bg-bridged-primary/10'}`}>
              {darkMode ? <i className="fa-solid fa-sun" /> : <i className="fa-solid fa-moon" />}
            </button>
            <button onClick={() => onNavigate('auth')} className="px-4 py-2 rounded-lg bg-bridged-teal text-white text-sm font-semibold hover:bg-bridged-teal/90 transition shadow-sm">
              Sign In / Sign Up
            </button>
          </div>
          <div className="flex sm:hidden items-center gap-2">
            <button onClick={toggleDarkMode} className={`rounded-lg p-2 transition-colors ${darkMode ? 'text-bridged-light/80 hover:bg-bridged-light/10' : 'text-bridged-primary/80 hover:bg-bridged-primary/10'}`}>
              {darkMode ? <i className="fa-solid fa-sun" /> : <i className="fa-solid fa-moon" />}
            </button>
            <button onClick={() => setMenuOpen(o => !o)} className={`rounded-lg p-2 transition-colors ${darkMode ? 'text-bridged-light hover:bg-bridged-light/10' : 'text-bridged-primary/80 hover:bg-bridged-primary/10'}`} aria-label="Toggle menu">
              <i className={`fa-solid ${menuOpen ? 'fa-xmark' : 'fa-bars'}`} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className={`sm:hidden border-t flex flex-col gap-1 px-4 py-3 ${darkMode ? 'bg-bridged-primary border-bridged-teal/20' : 'bg-white border-bridged-primary/10'}`}>
            <button onClick={() => { onNavigate('landing'); setMenuOpen(false); }} className={navLinkClass(true) + ' py-2 text-left'}>Home</button>
            <button onClick={() => { onNavigate('about'); setMenuOpen(false); }} className={navLinkClass(false) + ' py-2 text-left'}>About</button>
            <button onClick={() => { onNavigate('contact'); setMenuOpen(false); }} className={navLinkClass(false) + ' py-2 text-left'}>Contact</button>
            <button onClick={() => { onNavigate('auth'); setMenuOpen(false); }} className="mt-2 w-full px-4 py-2 rounded-lg bg-bridged-teal text-white text-sm font-semibold hover:bg-bridged-teal/90 transition">Sign In / Sign Up</button>
          </div>
        )}
      </nav>

      <main>
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-16 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            Connecting <span className="text-bridged-teal">Brilliant Students</span> <br />
            with <span className="text-bridged-accent">Visionary Employers</span>
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-bridged-primary/70 dark:text-bridged-light/70 mb-10 leading-relaxed">
            The intelligent matching platform for internship placements. We bridge the gap between academic theory and industry practice through competency-based matching.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button 
              onClick={() => onNavigate('auth')} 
              className="px-10 py-4 rounded-xl bg-bridged-teal text-white font-bold text-lg hover:scale-105 active:scale-95 transition shadow-xl shadow-bridged-teal/20"
            >
              Get Started Now
            </button>
            <button 
              onClick={() => onNavigate('about')} 
              className={`px-10 py-4 rounded-xl border-2 font-bold text-lg hover:bg-bridged-primary/5 active:scale-95 transition ${
                darkMode ? 'border-bridged-light/20' : 'border-bridged-primary/20'
              }`}
            >
              Learn More
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-8">
          {[
            { 
              icon: 'fa-bolt', 
              color: 'text-bridged-teal', 
              bg: 'bg-bridged-teal/10',
              title: 'Instant Matching', 
              desc: 'Our AI algorithm matches students to roles based on skills, course of study, and interests.' 
            },
            { 
              icon: 'fa-file-invoice', 
              color: 'text-bridged-accent', 
              bg: 'bg-bridged-accent/10',
              title: 'CV Parsing', 
              desc: 'Upload your CV and let us do the rest. We extract your skills and experience automatically using advanced LLMs.' 
            },
            { 
              icon: 'fa-circle-check', 
              color: 'text-green-500', 
              bg: 'bg-green-500/10',
              title: 'Verified Profiles', 
              desc: 'Trust is our priority. Profiles are verified to ensure high-quality, professional connections for everyone.' 
            }
          ].map((feat, i) => (
            <div key={i} className={`p-10 rounded-3xl border ${
              darkMode ? 'bg-bridged-primary/40 border-bridged-teal/20' : 'bg-white border-bridged-primary/5'
            } shadow-sm hover:shadow-xl transition-all duration-300 group`}>
              <div className={`h-14 w-14 ${feat.bg} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition`}>
                <i className={`fa-solid ${feat.icon} ${feat.color} text-2xl`}></i>
              </div>
              <h3 className="text-2xl font-extrabold mb-4">{feat.title}</h3>
              <p className="text-bridged-primary/60 dark:text-bridged-light/60 leading-relaxed">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className={`border-t py-16 px-6 ${darkMode ? 'border-bridged-teal/20' : 'border-bridged-primary/5'}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center h-12">
              <img 
                src={darkMode ? '/images/logo-dark.png' : '/images/logo-light.png'} 
                alt="BridgEd" 
                className="h-12 w-auto object-contain transition-transform origin-center md:origin-left scale-[2.5]"
              />
            </div>
            <p className="text-sm text-bridged-primary/50 dark:text-bridged-light/50 max-w-xs text-center md:text-left">
              Empowering students and streamlining industrial placements across Nigeria.
            </p>
          </div>
          <div className="flex gap-12 text-sm font-semibold">
            <div className="flex flex-col gap-4">
              <span className="text-bridged-teal uppercase tracking-widest text-xs">Platform</span>
              <button onClick={() => onNavigate('about')} className="text-bridged-primary/70 dark:text-bridged-light/70 hover:text-bridged-teal transition text-left">About Us</button>
              <button onClick={() => onNavigate('contact')} className="text-bridged-primary/70 dark:text-bridged-light/70 hover:text-bridged-teal transition text-left">Get in Touch</button>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-bridged-teal uppercase tracking-widest text-xs">Legal</span>
              <a href="#" className="text-bridged-primary/70 dark:text-bridged-light/70 hover:text-bridged-teal transition">Privacy</a>
              <a href="#" className="text-bridged-primary/70 dark:text-bridged-light/70 hover:text-bridged-teal transition">Terms</a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-bridged-primary/5 dark:border-bridged-teal/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-bridged-primary/40 dark:text-bridged-light/40">
          <p>&copy; 2026 BridgEd Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
