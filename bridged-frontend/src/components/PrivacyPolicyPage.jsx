import React from 'react';

const PrivacyPolicyPage = ({ onNavigate, darkMode, toggleDarkMode }) => {
  const EFFECTIVE_DATE = 'March 30, 2026';

  const Section = ({ id, number, title, children }) => (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-3 flex items-center gap-3 text-lg font-bold text-bridged-primary dark:text-bridged-light">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bridged-teal/20 text-sm font-extrabold text-bridged-teal">
          {number}
        </span>
        {title}
      </h2>
      <div className="space-y-4 pl-10 text-sm leading-relaxed text-bridged-primary/80 dark:text-bridged-light/70">
        {children}
      </div>
    </section>
  );

  const Sub = ({ id, title, children }) => (
    <div id={id}>
      <p className="mb-1 font-semibold text-bridged-primary dark:text-bridged-light">{title}</p>
      <div className="text-bridged-primary/80 dark:text-bridged-light/70">{children}</div>
    </div>
  );

  const toc = [
    { id: 's1', label: '1. Data We Collect' },
    { id: 's2', label: '2. How We Use Your Data' },
    { id: 's3', label: '3. How We Share Information' },
    { id: 's4', label: '4. Your Choices & Obligations' },
    { id: 's5', label: '5. Other Important Information' },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-bridged-primary text-bridged-light' : 'bg-bridged-light text-bridged-primary'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-20 flex items-center justify-between px-5 py-3 shadow-sm backdrop-blur-md transition-colors duration-300 ${darkMode ? 'bg-bridged-primary/95 border-b border-bridged-teal/30' : 'bg-white/95 border-b border-bridged-primary/10'}`}>
        <button
          type="button"
          onClick={() => onNavigate?.('landing')}
          className="flex items-center gap-2 text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70 hover:text-bridged-teal transition-colors"
        >
          <i className="fa-solid fa-arrow-left" />
          Back to Home
        </button>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleDarkMode}
            className={`rounded-lg p-2 transition-colors ${darkMode ? 'text-bridged-light/80 hover:bg-bridged-light/10 hover:text-bridged-light' : 'text-bridged-primary/80 hover:bg-bridged-primary/10 hover:text-bridged-primary'}`}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <i className="fa-solid fa-sun" /> : <i className="fa-solid fa-moon" />}
          </button>
          <img
            src={darkMode ? '/images/logo-dark.png' : '/images/logo-light.png'}
            alt="BridgEd"
            className="h-8 w-auto object-contain cursor-pointer"
            onClick={() => onNavigate?.('landing')}
          />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-10 text-center">
          <span className="mb-4 inline-block rounded-full bg-bridged-teal/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-bridged-teal ring-1 ring-bridged-teal/20">
            Legal
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-bridged-primary dark:text-bridged-light sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-bridged-primary/60 dark:text-bridged-light/50">
            <strong>BridgEd</strong>
            <br />
            Effective Date: {EFFECTIVE_DATE}
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Table of Contents sidebar */}
          <aside className="hidden lg:block lg:w-64 lg:shrink-0">
            <div className="sticky top-24 rounded-2xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white/80 dark:bg-bridged-primary/40 backdrop-blur-sm p-4 shadow-sm transition-colors duration-300">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-bridged-teal">Contents</p>
              <ul className="space-y-1">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="block rounded-lg px-2 py-1.5 text-xs text-bridged-primary/70 dark:text-bridged-light/60 hover:bg-bridged-teal/10 hover:text-bridged-teal transition-colors">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1 space-y-10 rounded-2xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white/80 dark:bg-bridged-primary/40 backdrop-blur-sm p-6 shadow-sm sm:p-8 transition-colors duration-300">

            <div className="space-y-4 text-sm text-bridged-primary/80 dark:text-bridged-light/70">
              <h3 className="text-xl font-bold text-bridged-primary dark:text-bridged-light">Your Privacy Matters</h3>
              <p>
                BridgEd’s mission is to connect talented university students with forward-thinking employers to foster productive industrial placements. Central to this mission is our commitment to be transparent about the data we collect about you, how it is used, and with whom it is shared.
              </p>
              <p>
                This Privacy Policy applies when you use our Services. We offer our users choices about the data we collect, use, and share as described in this Policy.
              </p>

              <h3 className="text-lg font-bold text-bridged-primary dark:text-bridged-light mt-6">Introduction</h3>
              <p>
                We are a platform connecting students and employers in Nigeria. Our Privacy Policy applies to any Member (a registered Student or Employer).
              </p>

              <h3 className="text-lg font-bold text-bridged-primary dark:text-bridged-light mt-6">Changes</h3>
              <p>
                We can modify this Privacy Policy. If we make material changes to it, we will provide active notice through our Services, or by other means, to provide you the opportunity to explicitly review and accept the changes before they become effective.
              </p>
            </div>

            <Section id="s1" number="1" title="Data We Collect">
              <Sub id="s1-1" title="1.1 Data You Provide To Us">
                <p><strong>Registration:</strong> To create an account, you must provide data including your name, email address, password, and account type (Student or Employer). If an employer registers for premium placement services, they provide billing information.</p>
                <p className="mt-2"><strong>Profile and Resumes:</strong> You create your BridgEd profile. Students provide education, work experience, and skills, and can upload CVs/resumes. Employers provide company details and job listings.</p>
              </Sub>
              <Sub id="s1-2" title="1.2 Service Use & Automatically Collected Data">
                <p>We log usage data when you visit or otherwise use our Services. Our servers automatically log standard web requests (IP addresses, browser versions, operating systems) for temporary security monitoring and crash diagnostics.</p>
              </Sub>
              <Sub id="s1-3" title="1.3 Cookies and Local Storage">
                <p>We do not use tracking cookies for advertising. BridgEd functions as a Progressive Web App (PWA) and uses your browser's local storage strictly to temporarily cache system data so the application functions efficiently in low bandwidth areas.</p>
              </Sub>
            </Section>

            <Section id="s2" number="2" title="How We Use Your Data">
              <p>We use your data to provide, support, personalize, and develop our Services.</p>
              <Sub id="s2-1" title="2.1 Services & AI Matching">
                <p>We use your data to authorize access to our Services. For students, when you explicitly consent and upload a resume, BridgEd uses automated Large Language Models (LLMs) to scan the document and extract skills.</p>
                <p className="mt-2">We also utilize a secondary LLM specifically dedicated to match processing. Rather than making subjective or biased hiring judgments, this model performs an objective comparison, evaluating the meaning and context of a student's extracted skills against the specific requirements set by an employer. Returning a "compatibility score" indicating the compatibility percentage.</p>
                <p className="mt-2">This score determines how highly a student ranks in an employer's dashboard. This is an automated suggestion, not a final hiring decision.</p>
              </Sub>
              <Sub id="s2-2" title="2.2 Communications">
                <p>We will contact you through the website notifications regarding service availability, security, match alerts, or system updates.</p>
              </Sub>
              <Sub id="s2-3" title="2.3 Security and Investigations">
                <p>We use your data for security purposes or to investigate possible fraud, violations of our agreements, or attempts to harm our Members.</p>
              </Sub>
            </Section>

            <Section id="s3" number="3" title="How We Share Information">
              <Sub id="s3-1" title="3.1 Between Members">
                <p>A student's full identity, contact details, and resume are shared with an employer only when a student actively accepts a match offer for a job.</p>
              </Sub>
              <Sub id="s3-2" title="3.2 Service Providers">
                <p>We use others to help us provide our Services. They will have access to your information as reasonably necessary to perform these tasks on our behalf:</p>
                <ul className="list-disc mt-2 pl-4 space-y-1">
                  <li><strong>Hosting Providers:</strong> Render (Web Server) and Supabase (Database). Both securely host our backend infrastructure.</li>
                  <li><strong>AI Processing:</strong> Hugging Face Inference APIs are utilized exclusively to extract text and skills from resumes, and a secondary LLM for calculating compatibility matches. They do not use your data to train their public models.</li>
                  <li><strong>Payment Gateway:</strong> Paystack securely processes employer billing. We do not store credit card numbers.</li>
                </ul>
              </Sub>
              <Sub id="s3-3" title="3.3 Legal Disclosures">
                <p>We may need to disclose information about you when required by Nigerian law, subpoena, or other legal process.</p>
              </Sub>
              <Sub id="s3-4" title="3.4 Change in Control or Sale">
                <p>We can also share your personal data as part of a sale, or change in business control.</p>
              </Sub>
            </Section>

            <Section id="s4" number="4" title="Your Choices & Obligations">
              <Sub id="s4-1" title="4.1 Data Retention">
                <p>We keep most of your personal data as long as your account is open. Upon account deletion, all personal identifiers and resumes are permanently removed from our databases within 30 days. Automatically collected server logs are cleared within 90 days.</p>
              </Sub>
              <Sub id="s4-2" title="4.2 Rights to Access and Control Your Personal Data (NDPA 2023)">
                <p>Under the Nigeria Data Protection Act (NDPA) 2023, you have the right to:</p>
                <ul className="list-disc mt-2 pl-4 space-y-1">
                  <li><strong>Access & Portability:</strong> Learn what data we hold and request a machine-readable copy.</li>
                  <li><strong>Change or Correct Data:</strong> Edit your profile directly.</li>
                  <li><strong>Delete Data (Erasure):</strong> Ask us to erase your personal data by closing your account.</li>
                  <li><strong>Withdraw Consent:</strong> Revoke your consent for AI processing at any time without losing access to manual platform features.</li>
                  <li><strong>Object:</strong> Object to automated decision-making and request manual review of matches.</li>
                </ul>
              </Sub>
              <Sub id="s4-3" title="4.3 Account Closure">
                <p>If you close your account, your personal data will generally stop being visible to others on our Services within 24 hours.</p>
              </Sub>
            </Section>

            <Section id="s5" number="5" title="Other Important Information">
              <Sub id="s5-1" title="5.1 Security">
                <p>We implement security safeguards designed to protect your data. All web traffic is secured with TLS/HTTPS (Encryption in Transit). Passwords are irreversibly protected via Cryptographic Hashing. Our Supabase databases are encrypted at the storage level (Encryption at Rest).</p>
              </Sub>
              <Sub id="s5-2" title="5.2 Cross-Border Data Transfers">
                <p>As we utilize global cloud hosting providers, your data may be transferred to servers in the USA or EU. We safeguard these transfers using standard compliance certifications to protect your information abroad.</p>
              </Sub>
              <Sub id="s5-3" title="5.3 Lawful Bases for Processing">
                <p>We will only collect and process personal data about you where we have lawful bases:</p>
                <ul className="list-disc mt-2 pl-4 space-y-1">
                  <li><strong>Contractual Necessity:</strong> Processing necessary to perform our contract with you (e.g., logging you in, providing core placement functions).</li>
                  <li><strong>Consent:</strong> Where we process data based on consent (such as AI resume parsing), we ask for your explicit consent at the point of action. You may withdraw it at any time.</li>
                  <li><strong>Legitimate Interests:</strong> Processing for security monitoring and fraud prevention.</li>
                </ul>
              </Sub>
              <Sub id="s5-4" title="5.4 Contact Information">
                <p>If you have questions or complaints regarding this Policy please reach out to:<br />
                <a href="mailto:[EMAIL_ADDRESS]" className="font-semibold text-bridged-teal hover:underline mt-2 inline-block">bridged@gmail.com</a></p>
              </Sub>
            </Section>

          </main>
        </div>
      </div>
      
      <footer className="mt-12 border-t border-bridged-primary/10 dark:border-bridged-light/10 py-8 text-center text-xs text-bridged-primary/40 dark:text-bridged-light/40">
        © {new Date().getFullYear()} BridgEd. All rights reserved.
      </footer>
    </div>
  );
};

export default PrivacyPolicyPage;
