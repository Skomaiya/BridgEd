import { useState, useEffect } from "react";
import { matchAPI, API_PAGE_SIZE } from "../api/api";
import { useNetworkStatus } from "../utils/networkStatus";
import { getCached, setCached, CACHE_KEYS } from "../utils/offlineCache";

const cardClass =
  "rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary/30 p-4 text-bridged-primary dark:text-bridged-light";

function filterAcceptingMatches(list) {
  const now = new Date();
  return (list || []).filter((m) => {
    if (m.is_open === false) return false;
    if (m.application_deadline) {
      try {
        if (new Date(m.application_deadline) < now) return false;
      } catch (_) {}
    }
    return true;
  });
}

const StudentMatchesPage = ({ user, onNavigate }) => {
  const { isOnline } = useNetworkStatus();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailMatch, setDetailMatch] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [findingMatches, setFindingMatches] = useState(false);
  const [findMatchMsg, setFindMatchMsg] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadMatches = (p = 1) => {
    setLoading(true);
    setError("");
    if (!isOnline) {
      getCached(CACHE_KEYS.student_match)
        .then((entry) => {
          if (entry?.data != null) {
            const list = Array.isArray(entry.data.matches)
              ? entry.data.matches
              : [];
            setMatches(filterAcceptingMatches(list));
            setTotalPages(1);
          } else {
            setMatches([]);
          }
        })
        .finally(() => setLoading(false));
      return;
    }
    matchAPI
      .getMyMatches({ page: p })
      .then((data) => {
        const list = Array.isArray(data.matches) ? data.matches : [];
        setMatches(filterAcceptingMatches(list));
        setTotalPages(data.count ? Math.ceil(data.count / API_PAGE_SIZE) : 1);
        if (p === 1) setCached(CACHE_KEYS.student_match, data);
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Could not load matches.");
        setMatches([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMatches(page);
  }, [isOnline, page]);

  const handleFindMatches = async () => {
    setFindingMatches(true);
    setFindMatchMsg('');
    setError('');
    try {
      const data = await matchAPI.getMyMatches();
      const list = Array.isArray(data.matches) ? data.matches : [];
      setMatches(filterAcceptingMatches(list));
      setPage(1);
      setTotalPages(data.count ? Math.ceil(data.count / API_PAGE_SIZE) : 1);
      setCached(CACHE_KEYS.student_match, data);
      const count = filterAcceptingMatches(list).length;
      setFindMatchMsg(count > 0 ? `Found ${count} match${count !== 1 ? 'es' : ''}.` : 'No new matches found based on your current CV.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not run matching. Make sure your CV is uploaded.');
    } finally {
      setFindingMatches(false);
    }
  };

  const handleAccept = (matchId) => {
    setActionLoading(true);
    matchAPI
      .indicateInterest(matchId)
      .then(() => {
        setMatches((prev) =>
          prev.map((m) =>
            m.match_id === matchId
              ? { ...m, student_interested: true, student_declined: false }
              : m,
          ),
        );
        setDetailMatch((current) =>
          current?.match_id === matchId
            ? { ...current, student_interested: true, student_declined: false }
            : current,
        );
      })
      .finally(() => setActionLoading(false));
  };

  const handleDecline = (matchId) => {
    setActionLoading(true);
    matchAPI
      .decline(matchId)
      .then(() => {
        setMatches((prev) =>
          prev.map((m) =>
            m.match_id === matchId
              ? { ...m, student_declined: true, student_interested: false }
              : m,
          ),
        );
        setDetailMatch((current) =>
          current?.match_id === matchId
            ? { ...current, student_declined: true, student_interested: false }
            : current,
        );
      })
      .finally(() => setActionLoading(false));
  };

  const isNew = (m) => m.student_interested === null || m.student_interested === undefined;
  const displayMatches = [...matches].sort((a, b) => {
    const aScore = isNew(a) ? 0 : a.student_interested ? 1 : 2;
    const bScore = isNew(b) ? 0 : b.student_interested ? 1 : 2;
    return aScore - bScore;
  });
  const newCount = matches.filter(isNew).length;

  return (
    <div className="min-h-[60vh] w-full px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-bridged-primary dark:text-bridged-light">
            Your job matches
          </h1>
          <p className="mt-1 text-sm text-bridged-primary/70 dark:text-bridged-light/70">
            {displayMatches.length > 0
              ? (
                <>
                  <span className="font-medium text-bridged-teal">{displayMatches.length}</span> active match{displayMatches.length !== 1 ? 'es' : ''}
                  {newCount > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden />
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{newCount} new — awaiting your response</span>
                    </span>
                  )}
                </>
              )
              : 'Jobs that match your resume.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleFindMatches}
          disabled={findingMatches || !isOnline}
          className="inline-flex items-center gap-2 rounded-lg bg-bridged-teal px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
        >
          {findingMatches ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Searching…</>
          ) : (
            <><i className="fa-solid fa-magnifying-glass" aria-hidden />Find new matches</>
          )}
        </button>
      </div>
      {findMatchMsg && (
        <p className="mb-4 text-sm text-bridged-teal">{findMatchMsg}</p>
      )}

      {!isOnline && (
        <p className="mb-4 text-xs text-bridged-primary/60 dark:text-bridged-light/60">
          Showing cached matches. Connect to the internet to refresh.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">
          Loading...
        </p>
      ) : error ? (
        <div className={cardClass}>
          <p className="text-sm text-bridged-primary/70 dark:text-bridged-light/70">
            {error}
          </p>
          <p className="mt-2 text-xs text-bridged-primary/60 dark:text-bridged-light/60">
            Upload a resume from the app to get matched with jobs.
          </p>
        </div>
      ) : displayMatches.length === 0 ? (
        <div className={cardClass}>
          <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">
            No job matches yet. Upload your resume to see roles that match your
            skills.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayMatches.map((m) => (
            <li key={m.match_id || m.job_id} className={cardClass}>
              <h3 className="font-medium text-bridged-primary dark:text-bridged-light">
                {m.job_title ?? "Job"}
              </h3>
              {m.company_name && (
                <p className="mt-1 text-sm text-bridged-primary/70 dark:text-bridged-light/70">
                  {m.company_name}
                </p>
              )}
              {m.job_location && (
                <p className="mt-0.5 text-sm text-bridged-primary/60 dark:text-bridged-light/60">
                  {m.job_location || m.location}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-bridged-primary/5 dark:bg-bridged-light/5 px-2 py-0.5 text-[10px] font-medium capitalize border border-bridged-primary/10 dark:border-bridged-light/10">
                   {m.contract_type?.replace('-', ' ') || 'Full time'}
                </span>
                {m.job_length && (
                  <span className="inline-flex items-center rounded-full bg-bridged-primary/5 dark:bg-bridged-light/5 px-2 py-0.5 text-[10px] font-medium border border-bridged-primary/10 dark:border-bridged-light/10">
                    {m.job_length}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {isNew(m) && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden />
                    New
                  </span>
                )}
                <span className="rounded-full bg-bridged-teal/20 px-2 py-0.5 text-sm font-medium text-bridged-teal">
                  Qualified match
                </span>
                {m.student_interested && !m.student_declined && (
                  <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                    Accepted
                  </span>
                )}
                {m.student_declined && (
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    Passed
                  </span>
                )}
              </div>
              {m.matched_skills?.length > 0 && (
                <p className="mt-2 text-xs text-bridged-primary/60 dark:text-bridged-light/60">
                  Matched skills: {m.matched_skills.slice(0, 5).join(", ")}
                  {m.matched_skills.length > 5 ? "…" : ""}
                </p>
              )}
              <button
                type="button"
                onClick={() => setDetailMatch(m)}
                className="mt-3 w-full rounded-lg border border-bridged-teal/50 bg-transparent px-3 py-2 text-sm font-medium text-bridged-teal hover:bg-bridged-teal/10"
              >
                View job & respond
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 text-sm font-bold text-bridged-primary/60 dark:text-bridged-light/60 hover:bg-bridged-primary/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <i className="fa-solid fa-chevron-left mr-2" /> Previous
          </button>
          <span className="text-sm font-bold text-bridged-primary/40 dark:text-bridged-light/40">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 text-sm font-bold text-bridged-primary/60 dark:text-bridged-light/60 hover:bg-bridged-primary/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Next <i className="fa-solid fa-chevron-right ml-2" />
          </button>
        </div>
      )}

      {detailMatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-detail-title"
        >
          <div
            className={`rounded-xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white dark:bg-bridged-primary p-4 text-bridged-primary dark:text-bridged-light max-h-[90vh] w-full max-w-lg overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2
                id="match-detail-title"
                className="text-lg font-semibold text-bridged-primary dark:text-bridged-light"
              >
                {detailMatch.job_title ?? "Job"}
              </h2>
              <button
                type="button"
                onClick={() => setDetailMatch(null)}
                className="rounded p-1 text-bridged-primary/70 hover:bg-bridged-primary/10 dark:text-bridged-light/70 dark:hover:bg-bridged-light/10"
                aria-label="Close"
              >
                <i className="fa-solid fa-times" />
              </button>
            </div>
            {detailMatch.company_name && (
              <p className="mt-1 text-sm font-medium text-bridged-primary/80 dark:text-bridged-light/80">
                {detailMatch.company_name}
              </p>
            )}
            {detailMatch.location && (
              <p className="mt-0.5 text-sm text-bridged-primary/60 dark:text-bridged-light/60">
                {detailMatch.location}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-bridged-teal/10 px-2.5 py-1 text-xs font-semibold capitalize text-bridged-teal border border-bridged-teal/20">
                <i className="fa-solid fa-briefcase mr-1.5 text-[10px]" aria-hidden />
                {detailMatch.contract_type?.replace('-', ' ') || 'Full time'}
              </span>
              {detailMatch.job_length && (
                <span className="inline-flex items-center rounded-full bg-bridged-primary/5 dark:bg-bridged-light/5 px-2.5 py-1 text-xs font-medium border border-bridged-primary/10 dark:border-bridged-light/10 text-bridged-primary/70 dark:text-bridged-light/70">
                  <i className="fa-solid fa-clock mr-1.5 text-[10px]" aria-hidden />
                  {detailMatch.job_length}
                </span>
              )}
            </div>
            <div className="mt-2">
              <span className="rounded-full bg-bridged-teal/20 px-2 py-0.5 text-sm font-medium text-bridged-teal">
                ✓ You meet the qualifications for this role
              </span>
            </div>
            {detailMatch.application_deadline && (
              <p className="mt-2 text-xs text-bridged-primary/60 dark:text-bridged-light/60">
                Application deadline:{" "}
                {new Date(detailMatch.application_deadline).toLocaleString()}
              </p>
            )}
            {detailMatch.description && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-bridged-primary dark:text-bridged-light">
                  Job description
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-bridged-primary/80 dark:text-bridged-light/80">
                  {detailMatch.description}
                </p>
              </div>
            )}
            {(detailMatch.employer_bio || detailMatch.employer_industry || detailMatch.employer_location || detailMatch.employer_website || detailMatch.employer_company_size) && (
              <div className="mt-4 rounded-lg border border-bridged-primary/10 dark:border-bridged-light/10 bg-bridged-primary/3 dark:bg-bridged-light/3 p-4">
                <h3 className="mb-3 text-sm font-semibold text-bridged-primary dark:text-bridged-light">
                  About the company
                </h3>
                {(detailMatch.employer_industry || detailMatch.employer_company_size || detailMatch.employer_location) && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {detailMatch.employer_industry && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-bridged-primary/15 dark:border-bridged-light/15 px-2.5 py-1 text-xs text-bridged-primary/70 dark:text-bridged-light/70">
                        <i className="fa-solid fa-briefcase text-[10px] opacity-60" aria-hidden />
                        {detailMatch.employer_industry}
                      </span>
                    )}
                    {detailMatch.employer_company_size && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-bridged-primary/15 dark:border-bridged-light/15 px-2.5 py-1 text-xs text-bridged-primary/70 dark:text-bridged-light/70">
                        <i className="fa-solid fa-users text-[10px] opacity-60" aria-hidden />
                        {detailMatch.employer_company_size} employees
                      </span>
                    )}
                    {detailMatch.employer_location && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-bridged-primary/15 dark:border-bridged-light/15 px-2.5 py-1 text-xs text-bridged-primary/70 dark:text-bridged-light/70">
                        <i className="fa-solid fa-location-dot text-[10px] opacity-60" aria-hidden />
                        {detailMatch.employer_location}
                      </span>
                    )}
                  </div>
                )}
                {detailMatch.employer_bio && (
                  <p className="whitespace-pre-wrap text-sm text-bridged-primary/80 dark:text-bridged-light/80">
                    {detailMatch.employer_bio}
                  </p>
                )}
                {detailMatch.employer_website && (
                  <a
                    href={detailMatch.employer_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-bridged-teal hover:underline"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden />
                    Visit company website
                  </a>
                )}
              </div>
            )}

            {detailMatch.matched_skills?.length > 0 && (
              <p className="mt-3 text-xs text-bridged-primary/60 dark:text-bridged-light/60">
                Matched skills: {detailMatch.matched_skills.join(", ")}
              </p>
            )}
            {(detailMatch.student_interested ||
              detailMatch.student_declined) && (
              <p className="mt-3 text-sm text-bridged-primary/70 dark:text-bridged-light/70">
                {detailMatch.student_interested
                  ? "You have accepted this match. You can change your choice below."
                  : "You passed on this match. It's still here in case you change your mind — accept it below if the position is still open."}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              {detailMatch.can_accept !== false ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAccept(detailMatch.match_id)}
                  className="rounded-lg bg-bridged-teal px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                >
                  {actionLoading
                    ? "…"
                    : detailMatch.student_interested
                      ? "Accepted ✓"
                      : "Accept match"}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-bridged-primary/15 dark:border-bridged-light/15 px-4 py-2.5 text-sm text-bridged-primary/50 dark:text-bridged-light/50">
                  <i className="fa-solid fa-lock text-xs" aria-hidden />
                  {new Date(detailMatch.application_deadline) < new Date()
                    ? "Application deadline has passed"
                    : "Employer is currently not accepting more applicants"}
                </span>
              )}
              <button
                type="button"
                disabled={actionLoading || detailMatch.student_declined}
                onClick={() => handleDecline(detailMatch.match_id)}
                className="rounded-lg border border-bridged-primary/20 dark:border-bridged-light/20 px-4 py-2.5 text-sm font-medium text-bridged-primary dark:text-bridged-light hover:bg-bridged-primary/5 disabled:opacity-50"
              >
                {actionLoading
                  ? "…"
                  : detailMatch.student_declined
                    ? "Passed"
                    : "Pass"}
              </button>
              <button
                type="button"
                onClick={() => setDetailMatch(null)}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-bridged-primary/70 dark:text-bridged-light/70 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentMatchesPage;
