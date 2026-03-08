export function getDisplayName(user, employerCompanyName, studentDisplayName) {
  if (user?.role === 'employer') return employerCompanyName ?? null;
  if (user?.role === 'student') {
    const fromProfile = studentDisplayName && studentDisplayName.trim();
    if (fromProfile) return fromProfile;
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('user_display_name') : null;
    const name = stored && stored.trim();
    if (name) return name;
    return null;
  }
  return null;
}

export function getInitial(displayName) {
  return (displayName || 'U').charAt(0).toUpperCase();
}
