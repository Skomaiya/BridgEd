import React from 'react';

const AboutPage = ({ onNavigate, darkMode, toggleDarkMode }) => {
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
      <nav className={`flex items-center justify-between px-6 py-4 sticky top-0 z-50 backdrop-blur-md border-b ${
        darkMode ? 'bg-bridged-primary/90 border-bridged-teal/30' : 'bg-white/90 border-bridged-primary/10'
      }`}>
        <div className="flex items-center">
          <img 
            src={darkMode ? '/images/logo-dark.png' : '/images/logo-light.png'} 
            alt="BridgEd" 
            className="h-12 w-auto object-contain cursor-pointer transition-transform origin-left scale-[2.5]"
            onClick={() => onNavigate('landing')}
          />
        </div>
        <div className="flex items-center gap-6 sm:gap-8">
          <button onClick={() => onNavigate('landing')} className={navLinkClass(false)}>Home</button>
          <button onClick={() => onNavigate('about')} className={navLinkClass(true)}>About</button>
          <button onClick={() => onNavigate('contact')} className={navLinkClass(false)}>Contact</button>
          <button
            onClick={toggleDarkMode}
            className={`rounded-lg p-2 transition-colors ${
              darkMode ? 'text-bridged-light/80 hover:bg-bridged-light/10' : 'text-bridged-primary/80 hover:bg-bridged-primary/10'
            }`}
          >
            {darkMode ? <i className="fa-solid fa-sun" /> : <i className="fa-solid fa-moon" />}
          </button>
          <button 
            onClick={() => onNavigate('auth')} 
            className="px-4 py-2 rounded-lg bg-bridged-teal text-white text-sm font-semibold hover:bg-bridged-teal/90 transition shadow-sm"
          >
            Sign In
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-24">
        <h1 className="text-5xl font-extrabold mb-12 text-center tracking-tight">
          About Bridg<span className="text-bridged-accent">Ed</span>
        </h1>
        
        <div className="space-y-16">
          <section className="relative">
            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-bridged-teal rounded-full opacity-50"></div>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              Our Mission
            </h2>
            <p className="text-xl leading-relaxed text-bridged-primary/70 dark:text-bridged-light/70">
              BridgEd was born from the vision to modernize the internship placements system in Nigeria. We create a transparent, digital-first ecosystem where talent meets opportunity, ensuring every student finds a place where they can grow and every employer finds the specific skills they need.
            </p>
          </section>

          <section className="grid md:grid-cols-2 gap-10">
            <div className={`p-10 rounded-3xl border transition-all ${
              darkMode ? 'bg-bridged-primary/40 border-bridged-teal/20' : 'bg-white border-bridged-primary/5'
            } shadow-sm`}>
              <h3 className="text-2xl font-bold mb-4 text-bridged-teal">For Students</h3>
              <p className="text-bridged-primary/70 dark:text-bridged-light/70 leading-relaxed">
                Unlock matching opportunities that align with your degree and actual technical skills. Stop sending endless paper applications, build a digital profile that performs for you.
              </p>
            </div>
            <div className={`p-10 rounded-3xl border transition-all ${
              darkMode ? 'bg-bridged-primary/40 border-bridged-teal/20' : 'bg-white border-bridged-primary/5'
            } shadow-sm`}>
              <h3 className="text-2xl font-bold mb-4 text-bridged-accent">For Employers</h3>
              <p className="text-bridged-primary/70 dark:text-bridged-light/70 leading-relaxed">
                Filter through thousands of students instantly using our competency-based matching engine. Focus your energy on interviewing pre-qualified candidates instead of administrative tasks.
              </p>
            </div>
          </section>

          <section className="text-center pt-8">
            <h2 className="text-3xl font-bold mb-8">Guided by Vision</h2>
            <div className="p-12 rounded-[2.5rem] bg-gradient-to-br from-bridged-teal to-bridged-teal/80 text-white shadow-2xl shadow-bridged-teal/30">
              <p className="text-2xl font-medium italic leading-relaxed">
                "To become the digital standard for internship excellence, empowering the next generation of Nigerian professionals through data-driven placements."
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className={`border-t py-12 px-6 mt-24 ${darkMode ? 'border-bridged-teal/20' : 'border-bridged-primary/5'}`}>
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-bridged-primary/40 dark:text-bridged-light/40 font-medium">
            &copy; 2026 BridgEd Platform. Empowering Industry Connections.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;
