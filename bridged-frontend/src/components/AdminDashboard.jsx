import { useState, useEffect } from 'react';
import serverClient, { adminAPI, jobsAPI } from '../api/api';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { useAlert } from '../context/GlobalAlertContext';

const AdminDashboard = ({ user, activeTab }) => {
  const [employers, setEmployers] = useState([]);
  const [students, setStudents] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [contactRequests, setContactRequests] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingVerifyId, setProcessingVerifyId] = useState(null);
  const [processingSuspendId, setProcessingSuspendId] = useState(null);
  const [processingDeleteId, setProcessingDeleteId] = useState(null);
  const [editingEmailId, setEditingEmailId] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const { showAlert } = useAlert();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); 
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [activeTab, searchTerm, page]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { search: searchTerm, page: page };
      if (activeTab === 'employers') {
        const data = await adminAPI.listEmployers(params);
        setEmployers(data.results || []);
        setTotalPages(data.count ? Math.ceil(data.count / 20) : 1);
      } else if (activeTab === 'students') {
        const data = await adminAPI.listStudents(params);
        setStudents(data.results || []);
        setTotalPages(data.count ? Math.ceil(data.count / 20) : 1);
      } else if (activeTab === 'jobs') {
        const data = await jobsAPI.list(params);
        setJobs(data.results || []);
        setTotalPages(data.count ? Math.ceil(data.count / 20) : 1);
      } else if (activeTab === 'contacts') {
        const data = await adminAPI.listContactRequests(params);
        setContactRequests(Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []));
        if (data.results) setTotalPages(Math.ceil(data.count / 20)); else setTotalPages(1);
      } else if (activeTab === 'reports') {
        const data = await adminAPI.listReports(params);
        setUserReports(data.results || []);
        setTotalPages(data.count ? Math.ceil(data.count / 20) : 1);
      } else if (activeTab === 'admins') {
        const data = await adminAPI.listAdmins(params);
        const adminArray = data.results || [];
        setTotalPages(data.count ? Math.ceil(data.count / 20) : 1);
        setAdmins(adminArray.map(u => ({ user: u, display_name: 'Admin User' })));
      } else {
        const [empData, stuData] = await Promise.all([
          adminAPI.listEmployers(),
          adminAPI.listStudents()
        ]);
        const emps = empData.results || [];
        const stus = stuData.results || [];
        setEmployers(emps.slice(0, 3));
        setStudents(stus.slice(0, 3));
        setTotalPages(1);
      }
    } catch (err) {
      setError('Failed to load data. Please check your admin permissions.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (userId) => {
    setProcessingVerifyId(userId);
    try {
      const result = await adminAPI.verifyEmployer(userId);
      setEmployers(prev => prev.map(emp => 
        emp.user_id === userId ? { ...emp, employer_profile: { ...emp.employer_profile, is_verified: result.is_verified } } : emp
      ));
      showAlert(`Employer ${result.is_verified ? 'verified' : 'unverified'} successfully.`, 'Success', 'success');
    } catch (err) {
      showAlert('Failed to update verification status.', 'Error', 'error');
    } finally {
      setProcessingVerifyId(null);
    }
  };

  const handleUpdateEmail = async (userId) => {
    if (!newEmail || !newEmail.includes('@')) {
      showAlert('Please enter a valid email address.', 'Invalid Input', 'warning');
      return;
    }
    setProcessingSuspendId(userId);
    try {
      const result = await adminAPI.updateEmail(userId, newEmail);
      const updater = prev => prev.map(item => 
        (item.user_id === userId) ? { ...item, email: result.email } : item
      );
      if (activeTab === 'employers') setEmployers(updater);
      else if (activeTab === 'students') setStudents(updater);
      else if (activeTab === 'admins') setAdmins(updater);
      setEditingEmailId(null);
      setNewEmail('');
      showAlert('Email updated successfully.', 'Success', 'success');
    } catch (err) {
      showAlert(err.response?.data?.error || 'Failed to update email.', 'Error', 'error');
    } finally {
      setProcessingSuspendId(null);
    }
  };

  const handleToggleActive = async (userId, isCurrentlyActive) => {
    setProcessingSuspendId(userId);
    try {
      const result = await adminAPI.toggleActive(userId);
      const updater = prev => prev.map(item => 
        (item.user_id === userId) ? { ...item, is_active: result.is_active } : item
      );
      if (activeTab === 'employers' || activeTab === 'dashboard') setEmployers(updater);
      if (activeTab === 'students' || activeTab === 'dashboard') setStudents(updater);
      if (activeTab === 'admins') setAdmins(updater);
      showAlert(`User ${result.is_active ? 'activated' : 'suspended'} successfully.`, 'Success', 'success');
    } catch (err) {
      showAlert('Failed to toggle user status.', 'Error', 'error');
    } finally {
      setProcessingSuspendId(null);
    }
  };

  const handleUpdatePlan = async (userId, newPlan) => {
    setProcessingSuspendId(userId);
    try {
      const result = await adminAPI.updatePlan(userId, newPlan);
      setStudents(prev => prev.map(stu => 
        stu.user_id === userId ? { ...stu, student_profile: { ...stu.student_profile, subscription_plan: result.subscription_plan } } : stu
      ));
      showAlert(`Student plan updated to ${result.subscription_plan}.`, 'Success', 'success');
    } catch (err) {
      showAlert('Failed to update student plan.', 'Error', 'error');
    } finally {
      setProcessingSuspendId(null);
    }
  };

  const handleDeleteJob = (jobId, title) => {
    setDeleteTarget({ id: jobId, type: 'job', name: title });
    setShowDeleteModal(true);
  };

  const confirmDeleteJob = async (jobId) => {
    setProcessingDeleteId(jobId);
    try {
      await jobsAPI.delete(jobId);
      setJobs(prev => prev.filter(j => j.job_id !== jobId));
      setShowDeleteModal(false);
      setDeleteTarget(null);
      if (selectedJob && selectedJob.job_id === jobId) setSelectedJob(null);
      showAlert('Job deleted successfully.', 'Success', 'success');
    } catch (err) {
      showAlert('Failed to delete job.', 'Error', 'error');
    } finally {
      setProcessingDeleteId(null);
    }
  };

  const handleDelete = (userId, name) => {
    setDeleteTarget({ id: userId, type: 'user', name: name });
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async (userId) => {
    setProcessingDeleteId(userId);
    try {
      await adminAPI.deleteUser(userId);
      if (activeTab === 'employers' || activeTab === 'dashboard') {
        setEmployers(prev => prev.filter(emp => emp.user_id !== userId));
      }
      if (activeTab === 'students' || activeTab === 'dashboard') {
        setStudents(prev => prev.filter(stu => stu.user_id !== userId));
      }
      if (activeTab === 'admins') {
        setAdmins(prev => prev.filter(adm => adm.user_id !== userId));
      }
      setShowDeleteModal(false);
      setDeleteTarget(null);
      showAlert('User deleted successfully.', 'Success', 'success');
    } catch (err) {
      showAlert('Failed to delete user.', 'Error', 'error');
    } finally {
      setProcessingDeleteId(null);
    }
  };

  const glassCls = "rounded-2xl border border-bridged-primary/10 dark:border-bridged-light/10 bg-white/70 dark:bg-bridged-primary/40 backdrop-blur-md shadow-sm transition-all duration-300";

  const getPageTitle = () => {
    switch (activeTab) {
      case 'employers': return 'Manage Employers';
      case 'students': return 'Manage Students';
      case 'admins': return 'Manage Administrators';
      case 'jobs': return 'Manage Job Listings';
      case 'contacts': return 'Manage Contact Requests';
      case 'reports': return 'Manage User Reports';
      default: return 'Admin Dashboard Overview';
    }
  };

  const handleToggleResolve = async (pk) => {
    setProcessingSuspendId(pk);
    try {
      const result = await adminAPI.resolveContactRequest(pk);
      setContactRequests(prev => prev.map(cr => 
        cr.request_id === pk ? { ...cr, is_resolved: result.is_resolved } : cr
      ));
      showAlert(`Contact request marked as ${result.is_resolved ? 'resolved' : 'unresolved'}.`, 'Success', 'success');
    } catch (err) {
      showAlert('Failed to update resolution status.', 'Error', 'error');
    } finally {
      setProcessingSuspendId(null);
    }
  };

  const handleResolveReport = async (pk) => {
    setProcessingSuspendId(pk);
    try {
      const result = await adminAPI.resolveReport(pk);
      setUserReports(prev => prev.map(rep => 
        rep.report_id === pk ? { ...rep, is_resolved: result.is_resolved } : rep
      ));
      showAlert('Report marked as resolved.', 'Success', 'success');
    } catch (err) {
      showAlert('Failed to update resolution status.', 'Error', 'error');
    } finally {
      setProcessingSuspendId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bridged-primary dark:text-bridged-light">
            {getPageTitle()}
          </h1>
          <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">
          </p>
        </div>
      </header>

      {activeTab !== 'dashboard' && (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {activeTab !== 'jobs' ? (
            <>
              <div>
                <h2 className="text-xl font-bold text-bridged-primary dark:text-bridged-light">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} List
                </h2>
                <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">
                  Filter and manage {activeTab}.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative">
                  <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-bridged-primary/40 dark:text-bridged-light/40" />
                  <input
                    type="text"
                    placeholder={`Search ${activeTab}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-lg border border-bridged-primary/10 bg-white px-9 py-2 text-sm focus:border-bridged-teal focus:outline-none dark:border-bridged-light/10 dark:bg-bridged-primary/20"
                  />
                </div>
                {(searchTerm) && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-bold text-bridged-primary dark:text-bridged-light">Job Listings</h2>
                <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">Manage all job postings</p>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative">
                  <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-bridged-primary/40 dark:text-bridged-light/40" />
                  <input
                    type="text"
                    placeholder="Search job or company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-lg border border-bridged-primary/10 bg-white px-9 py-2 text-sm focus:border-bridged-teal focus:outline-none dark:border-bridged-light/10 dark:bg-bridged-primary/20"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {(searchTerm) && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-600 dark:text-red-400">
          <i className="fa-solid fa-circle-exclamation mr-2" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-bridged-teal/20 border-t-bridged-teal" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {activeTab === 'employers' && (
            employers.length === 0 ? (
              <p className="py-12 text-center text-bridged-primary/40 dark:text-bridged-light/40">No employers found.</p>
            ) : employers.map(userItem => {
              const emp = userItem.employer_profile || {};
              const userObj = userItem;
              return (
                <div key={userObj.user_id} className={`${glassCls} p-6 flex flex-col sm:flex-row gap-6 items-start group`}>
                  <div className="h-16 w-16 overflow-hidden rounded-xl bg-bridged-primary/5 dark:bg-bridged-light/5 ring-1 ring-bridged-primary/10">
                    {emp.profile_image_url ? (
                      <img src={emp.profile_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-bold text-bridged-teal/40">
                        {emp.company_name?.[0] || userObj.email[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-bridged-primary dark:text-bridged-light">
                        {emp.company_name || 'Incomplete Profile'}
                      </h3>
                      {emp.is_verified && (
                        <i className="fa-solid fa-circle-check text-bridged-teal text-sm" title="Verified Employer" />
                      )}
                    </div>
                    <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">{emp.industry || 'No Industry'} • {emp.company_size || 'N/A'} employees</p>
                    
                    <div className="flex flex-col gap-1">
                      {editingEmailId === userObj.user_id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="text-xs bg-white dark:bg-bridged-primary border border-bridged-teal rounded px-2 py-1 focus:outline-none"
                            placeholder="New email"
                            autoFocus
                          />
                          <button onClick={() => handleUpdateEmail(userObj.user_id)} className="text-bridged-teal hover:opacity-80">
                            <i className="fa-solid fa-check" />
                          </button>
                          <button onClick={() => setEditingEmailId(null)} className="text-red-500 hover:opacity-80">
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-bridged-primary/50 dark:text-bridged-light/50 flex items-center gap-2">
                          <i className="fa-solid fa-envelope" /> {userObj.email}
                          <button 
                            onClick={() => { setEditingEmailId(userObj.user_id); setNewEmail(userObj.email); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-bridged-teal"
                          >
                            <i className="fa-solid fa-pen-to-square" />
                          </button>
                        </span>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {emp.website && (
                          <a href={emp.website} target="_blank" rel="noreferrer" className="text-xs text-bridged-teal hover:underline">
                            <i className="fa-solid fa-link mr-1" /> Website
                          </a>
                        )}
                        <span className="text-xs text-bridged-primary/50 dark:text-bridged-light/50">
                          <i className="fa-solid fa-location-dot mr-1" /> {emp.location || 'No location'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-4 sm:pt-0">
                    <button
                      onClick={() => handleVerify(userObj.user_id)}
                      disabled={processingVerifyId === userObj.user_id}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        emp.is_verified 
                          ? 'border border-bridged-primary/10 dark:border-bridged-light/10 text-bridged-primary/60 dark:text-bridged-light/60 hover:bg-bridged-primary/5' 
                          : 'bg-bridged-teal text-white hover:bg-bridged-teal-dark shadow-md shadow-bridged-teal/20'
                      }`}
                    >
                      {processingVerifyId === userObj.user_id ? (
                        <i className="fa-solid fa-spinner animate-spin" />
                      ) : (emp.is_verified ? 'Unverify' : 'Verify')}
                    </button>
                      <button
                        onClick={() => handleToggleActive(userObj.user_id, userObj.is_active)}
                        disabled={processingSuspendId === userObj.user_id}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          userObj.is_active 
                            ? 'border border-amber-500/20 text-amber-500 hover:bg-amber-500/10' 
                            : 'bg-amber-500 text-white hover:bg-amber-600 shadow-md'
                        }`}
                      >
                        {processingSuspendId === userObj.user_id ? (
                           <i className="fa-solid fa-spinner animate-spin" />
                        ) : (userObj.is_active ? 'Suspend' : 'Reactivate')}
                      </button>
                    <button
                      onClick={() => handleDelete(userObj.user_id, emp.company_name || userObj.email)}
                      disabled={processingDeleteId === userObj.user_id}
                      className="px-4 py-2 rounded-lg border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-all"
                    >
                      {processingDeleteId === userObj.user_id ? (
                        <i className="fa-solid fa-spinner animate-spin" />
                      ) : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {activeTab === 'students' && (
            students.length === 0 ? (
              <p className="py-12 text-center text-bridged-primary/40 dark:text-bridged-light/40">No students found.</p>
            ) : students.map(userItem => {
              const stu = userItem.student_profile || {};
              const userObj = userItem;
              return (
                <div key={userObj.user_id} className={`${glassCls} p-6 flex flex-col sm:flex-row gap-6 items-start group`}>
                  <div className="h-16 w-16 overflow-hidden rounded-full bg-bridged-primary/5 dark:bg-bridged-light/5 ring-1 ring-bridged-primary/10">
                    {stu.profile_image_url ? (
                      <img src={stu.profile_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-bold text-bridged-teal/40">
                        {stu.display_name?.[0] || userObj.email[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-lg font-bold text-bridged-primary dark:text-bridged-light">
                      {stu.display_name || 'Anonymous Student'}
                      {stu.is_premium_active && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-tight ring-1 ring-amber-500/20">
                          Premium
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">{stu.university || 'No University'} • {stu.course || 'No Course'}</p>
                    
                    <div className="flex flex-col gap-1">
                      {editingEmailId === userObj.user_id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="text-xs bg-white dark:bg-bridged-primary border border-bridged-teal rounded px-2 py-1 focus:outline-none"
                            placeholder="New email"
                            autoFocus
                          />
                          <button onClick={() => handleUpdateEmail(userObj.user_id)} className="text-bridged-teal hover:opacity-80">
                            <i className="fa-solid fa-check" />
                          </button>
                          <button onClick={() => setEditingEmailId(null)} className="text-red-500 hover:opacity-80">
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-bridged-primary/50 dark:text-bridged-light/50 flex items-center gap-2">
                          <i className="fa-solid fa-envelope" /> {userObj.email}
                          <button 
                            onClick={() => { setEditingEmailId(userObj.user_id); setNewEmail(userObj.email); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-bridged-teal"
                          >
                            <i className="fa-solid fa-pen-to-square" />
                          </button>
                        </span>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {stu.linkedin_url && (
                          <a href={stu.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-bridged-teal hover:underline">
                            <i className="fa-brands fa-linkedin mr-1" /> LinkedIn
                          </a>
                        )}
                        <span className="text-xs text-bridged-primary/50 dark:text-bridged-light/50">
                          <i className="fa-solid fa-location-dot mr-1" /> {stu.location || 'No location'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-4 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <select
                        value={stu.subscription_plan || 'free'}
                        onChange={(e) => handleUpdatePlan(userObj.user_id, e.target.value)}
                        disabled={processingSuspendId === userObj.user_id}
                        className="bg-transparent border border-bridged-primary/10 dark:border-bridged-light/10 rounded px-2 py-1 text-[10px] font-bold text-bridged-teal focus:outline-none"
                      >
                        <option value="free">Free</option>
                        <option value="basic">Basic</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>
                      <button
                        onClick={() => handleToggleActive(userObj.user_id, userObj.is_active)}
                        disabled={processingSuspendId === userObj.user_id}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          userObj.is_active 
                            ? 'border border-amber-500/20 text-amber-500 hover:bg-amber-500/10' 
                            : 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/20'
                        }`}
                      >
                        {processingSuspendId === userObj.user_id ? (
                           <i className="fa-solid fa-spinner animate-spin" />
                        ) : (userObj.is_active ? 'Suspend' : 'Reactivate')}
                      </button>
                    <button
                      onClick={() => handleDelete(userObj.user_id, stu.display_name || userObj.email)}
                      disabled={processingDeleteId === userObj.user_id}
                      className="px-4 py-2 rounded-lg border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-all"
                    >
                      {processingDeleteId === userObj.user_id ? (
                        <i className="fa-solid fa-spinner animate-spin" />
                      ) : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {activeTab === 'admins' && (
            admins.length === 0 ? (
              <p className="py-12 text-center text-bridged-primary/40 dark:text-bridged-light/40">No other admins found.</p>
            ) : admins.map(userItem => {
              const userObj = userItem.user || userItem; // Handle potential mapping
              return (
                <div key={userObj.user_id} className={`${glassCls} p-6 flex flex-col sm:flex-row gap-6 items-start group`}>
                  <div className="h-12 w-12 overflow-hidden rounded-full bg-bridged-primary/5 dark:bg-bridged-light/5 ring-1 ring-bridged-primary/10 flex items-center justify-center text-lg font-bold text-bridged-teal/40">
                    <i className="fa-solid fa-user-shield" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-lg font-bold text-bridged-primary dark:text-bridged-light">
                      {userObj.email} {userObj.user_id === user.user_id && <span className="text-xs font-normal text-bridged-teal ml-2">(You)</span>}
                    </h3>
                    
                    <div className="flex flex-col gap-1">
                      {editingEmailId === userObj.user_id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="text-xs bg-white dark:bg-bridged-primary border border-bridged-teal rounded px-2 py-1 focus:outline-none"
                            placeholder="New email"
                            autoFocus
                          />
                          <button onClick={() => handleUpdateEmail(userObj.user_id)} className="text-bridged-teal hover:opacity-80">
                            <i className="fa-solid fa-check" />
                          </button>
                          <button onClick={() => setEditingEmailId(null)} className="text-red-500 hover:opacity-80">
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-bridged-primary/50 dark:text-bridged-light/50 flex items-center gap-2">
                          <i className="fa-solid fa-envelope" /> {userObj.email}
                          <button 
                            onClick={() => { setEditingEmailId(userObj.user_id); setNewEmail(userObj.email); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-bridged-teal"
                          >
                            <i className="fa-solid fa-pen-to-square" />
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-4 sm:pt-0">
                      <button
                        onClick={() => handleToggleActive(userObj.user_id, userObj.is_active)}
                        disabled={processingSuspendId === userObj.user_id || userObj.user_id === user.user_id}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          userObj.is_active 
                            ? 'border border-amber-500/20 text-amber-500 hover:bg-amber-500/10' 
                            : 'bg-amber-500 text-white hover:bg-amber-600 shadow-md'
                        }`}
                      >
                        {processingSuspendId === userObj.user_id ? (
                           <i className="fa-solid fa-spinner animate-spin" />
                        ) : (userObj.is_active ? 'Suspend' : 'Reactivate')}
                      </button>
                    <button
                      onClick={() => handleDelete(userObj.user_id, userObj.email)}
                      disabled={userObj.user_id === user.user_id}
                      className="px-4 py-2 rounded-lg border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-all disabled:opacity-50"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {activeTab === 'jobs' && (
            jobs.length === 0 ? (
              <p className="py-12 text-center text-bridged-primary/40 dark:text-bridged-light/40">No jobs posted yet.</p>
            ) : jobs.map(job => (
              <div key={job.job_id} className={`${glassCls} p-6 flex flex-col sm:flex-row gap-6 items-start`}>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-bridged-primary dark:text-bridged-light">{job.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ring-1 ${
                      job.is_open 
                        ? 'bg-bridged-teal/10 text-bridged-teal ring-bridged-teal/20' 
                        : 'bg-bridged-accent text-bridged-primary ring-bridged-accent/30'
                    }`}>
                      {job.is_open ? 'Open' : 'Closed'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase ring-1 bg-bridged-primary/5 dark:bg-bridged-light/5 text-bridged-primary/60 dark:text-bridged-light/60 ring-bridged-primary/10">
                       {job.contract_type?.replace('-', ' ') || 'Full time'}
                    </span>
                  </div>
                  <p className="text-sm text-bridged-teal font-medium">{job.company_name}</p>
                  <p className="text-xs text-bridged-primary/60 dark:text-bridged-light/60 line-clamp-2 max-w-2xl">{job.description}</p>
                  <div className="flex flex-wrap gap-4 pt-2">
                     <span className="text-[10px] text-bridged-primary/40 dark:text-bridged-light/40 flex items-center gap-1">
                       <i className="fa-solid fa-calendar-plus" /> Posted: {new Date(job.created_at).toLocaleDateString()}
                     </span>
                     {job.application_deadline && (
                       <span className={`text-[10px] flex items-center gap-1 ${
                         new Date(job.application_deadline) < new Date() ? 'text-red-500' : 'text-bridged-primary/40 dark:text-bridged-light/40'
                       }`}>
                         <i className="fa-solid fa-clock" /> Deadline: {new Date(job.application_deadline).toLocaleDateString()}
                       </span>
                     )}
                     <span className="text-[10px] text-bridged-primary/40 dark:text-bridged-light/40 flex items-center gap-1">
                       <i className="fa-solid fa-location-dot" /> {job.location}
                     </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setSelectedJob(job)}
                    className="px-4 py-2 rounded-lg bg-bridged-teal/10 text-bridged-teal text-xs font-bold hover:bg-bridged-teal/20 transition-all border border-bridged-teal/20"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleDeleteJob(job.job_id, job.title)}
                    disabled={processingDeleteId === job.job_id}
                    className="px-4 py-2 rounded-lg border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-all"
                  >
                    {processingDeleteId === job.job_id ? (
                      <i className="fa-solid fa-spinner animate-spin" />
                    ) : 'Delete Listing'}
                  </button>
                </div>
              </div>
            ))
          )}

          {activeTab === 'contacts' && (
            contactRequests.length === 0 ? (
              <p className="py-12 text-center text-bridged-primary/40 dark:text-bridged-light/40">No contact requests found.</p>
            ) : contactRequests.map(cr => (
              <div key={cr.request_id} className={`${glassCls} p-6 flex flex-col sm:flex-row gap-6 items-start group`}>
                <div className="h-12 w-12 overflow-hidden rounded-xl bg-bridged-primary/5 dark:bg-bridged-light/5 ring-1 ring-bridged-primary/10 flex items-center justify-center text-lg font-bold text-bridged-teal/40">
                  <i className="fa-solid fa-headset" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-bridged-primary dark:text-bridged-light">{cr.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ring-1 ${
                      cr.is_resolved 
                        ? 'bg-green-500/10 text-green-500 ring-green-500/20' 
                        : 'bg-amber-500/10 text-amber-500 ring-amber-500/20'
                    }`}>
                      {cr.is_resolved ? 'Resolved' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-bridged-teal">{cr.email}</p>
                  <p className="text-sm font-bold text-bridged-primary/80 dark:text-bridged-light/80">{cr.subject || 'No Subject'}</p>
                  <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60">{cr.message}</p>
                  <div className="pt-2">
                    <span className="text-[10px] text-bridged-primary/40 dark:text-bridged-light/40">
                      <i className="fa-solid fa-clock mr-1" /> Submitted: {new Date(cr.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleResolve(cr.request_id)}
                  disabled={processingSuspendId === cr.request_id}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    cr.is_resolved 
                      ? 'border border-bridged-primary/10 dark:border-bridged-light/10 text-bridged-primary/60 dark:text-bridged-light/60 hover:bg-bridged-primary/5 dark:hover:bg-bridged-light/5' 
                      : 'bg-bridged-teal text-white hover:bg-bridged-teal-dark shadow-md'
                  }`}
                >
                  {processingSuspendId === cr.request_id ? (
                    <i className="fa-solid fa-spinner animate-spin" />
                  ) : (cr.is_resolved ? 'Reopen' : 'Mark Resolved')}
                </button>
              </div>
            ))
          )}

          {activeTab === 'reports' && (
            userReports.length === 0 ? (
              <p className="py-12 text-center text-bridged-primary/40 dark:text-bridged-light/40">No user reports found.</p>
            ) : userReports.map(rep => (
              <div key={rep.report_id} className={`${glassCls} p-6 flex flex-col sm:flex-row gap-6 items-start group`}>
                <div className="h-12 w-12 overflow-hidden rounded-xl bg-bridged-primary/5 dark:bg-bridged-light/5 ring-1 ring-bridged-primary/10 flex items-center justify-center text-lg font-bold text-bridged-teal/40">
                  <i className="fa-solid fa-flag" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-bridged-primary dark:text-bridged-light">
                      Report against <span className="text-bridged-teal">{rep.reported_user_email}</span>
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ring-1 ${
                      rep.is_resolved 
                        ? 'bg-green-500/10 text-green-500 ring-green-500/20' 
                        : 'bg-red-500/10 text-red-500 ring-red-500/20'
                    }`}>
                      {rep.is_resolved ? 'Resolved' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-semibold">
                    <span className="text-bridged-primary/60 dark:text-bridged-light/60">
                      Reporter: <span className="text-bridged-teal">{rep.reporter_email}</span>
                    </span>
                    <span className="bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-tighter text-[10px]">
                      {rep.reason.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-bridged-primary/60 dark:text-bridged-light/60 bg-white/5 p-3 rounded-lg border border-white/5">
                    {rep.description}
                  </p>
                  <div className="pt-2">
                    <span className="text-[10px] text-bridged-primary/40 dark:text-bridged-light/40">
                      <i className="fa-solid fa-clock mr-1" /> Submitted: {new Date(rep.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleResolveReport(rep.report_id)}
                  disabled={processingSuspendId === rep.report_id}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    rep.is_resolved 
                      ? 'border border-bridged-primary/10 dark:border-bridged-light/10 text-bridged-primary/60 dark:text-bridged-light/60 hover:bg-bridged-primary/5 dark:hover:bg-bridged-light/5' 
                      : 'bg-bridged-teal text-white hover:bg-bridged-teal-dark shadow-md'
                  }`}
                >
                  {processingSuspendId === rep.report_id ? (
                    <i className="fa-solid fa-spinner animate-spin" />
                  ) : (rep.is_resolved ? 'Reopen' : 'Mark Resolved')}
                </button>
              </div>
            ))
          )}

          {activeTab !== 'dashboard' && totalPages > 1 && (
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

          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-bridged-primary dark:text-bridged-light">Recent Employers</h2>
                </div>
                <div className="space-y-3">
                  {employers.map(userObj => {
                    const emp = userObj.employer_profile || {};
                    return (
                      <div key={userObj.user_id} className={`${glassCls} p-3 flex items-center gap-3`}>
                        <div className="h-8 w-8 rounded bg-bridged-teal/10 flex items-center justify-center text-xs font-bold text-bridged-teal">
                          {emp.company_name?.[0] || userObj.email[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate text-bridged-primary dark:text-bridged-light">{emp.company_name || 'Incomplete Profile'}</p>
                          <p className="text-[10px] text-bridged-primary/60 dark:text-bridged-light/60">{userObj.email}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-bridged-primary dark:text-bridged-light">Recent Students</h2>
                </div>
                <div className="space-y-3">
                  {students.map(userObj => {
                    const stu = userObj.student_profile || {};
                    return (
                      <div key={userObj.user_id} className={`${glassCls} p-3 flex items-center gap-3`}>
                        <div className="h-8 w-8 rounded-full bg-bridged-teal/10 flex items-center justify-center text-xs font-bold text-bridged-teal">
                          {stu.display_name?.[0] || userObj.email[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate text-bridged-primary dark:text-bridged-light">{stu.display_name || 'Anonymous'}</p>
                          <p className="text-[10px] text-bridged-primary/60 dark:text-bridged-light/60">{userObj.email}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {showDeleteModal && (
            <DeleteConfirmationModal 
              target={deleteTarget}
              onCancel={() => setShowDeleteModal(false)}
              onConfirm={deleteTarget.type === 'job' ? confirmDeleteJob : confirmDeleteUser}
              processing={processingDeleteId === deleteTarget.id}
            />
          )}

          {selectedJob && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-bridged-primary/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div 
                className={`${glassCls} max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 relative shadow-2xl animate-in zoom-in-95 duration-200`}
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="absolute top-6 right-6 h-10 w-10 rounded-full flex items-center justify-center hover:bg-bridged-primary/5 dark:hover:bg-bridged-light/5 transition-colors"
                >
                  <i className="fa-solid fa-xmark text-xl" />
                </button>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        selectedJob.is_open 
                          ? 'bg-bridged-teal/10 text-bridged-teal' 
                          : 'bg-bridged-accent text-bridged-primary'
                      }`}>
                        {selectedJob.is_open ? 'Open' : 'Closed'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-bridged-primary/5 dark:bg-bridged-light/5 text-bridged-primary/60 dark:text-bridged-light/60">
                        {selectedJob.contract_type?.replace('-', ' ') || 'Full time'}
                      </span>
                    </div>
                    <h2 className="text-4xl font-extrabold tracking-tight text-bridged-primary dark:text-bridged-light">
                      {selectedJob.title}
                    </h2>
                    <p className="text-xl font-bold text-bridged-teal">{selectedJob.company_name}</p>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-6 p-6 rounded-3xl bg-bridged-primary/5 dark:bg-bridged-light/5 border border-bridged-primary/10 dark:border-bridged-light/10">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-extrabold opacity-40">Location</p>
                      <p className="font-bold flex items-center gap-2">
                        <i className="fa-solid fa-location-dot text-bridged-teal" />
                        {selectedJob.location}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-extrabold opacity-40">Application Deadline</p>
                      <p className={`font-bold flex items-center gap-2 ${new Date(selectedJob.application_deadline) < new Date() ? 'text-red-500' : ''}`}>
                        <i className="fa-solid fa-calendar-check text-bridged-teal" />
                        {selectedJob.application_deadline ? new Date(selectedJob.application_deadline).toLocaleDateString() : 'No deadline'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-extrabold opacity-40">Job Length</p>
                      <p className="font-bold flex items-center gap-2">
                        <i className="fa-solid fa-clock text-bridged-teal" />
                        {selectedJob.job_length || 'Not specified'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-xl font-extrabold flex items-center gap-3">
                        <div className="h-8 w-1 bg-bridged-teal rounded-full" />
                        Job Description
                      </h3>
                      <div className="text-bridged-primary/80 dark:text-bridged-light/80 leading-relaxed whitespace-pre-wrap font-medium">
                        {selectedJob.description}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 pt-4">
                      <div className="space-y-4">
                        <h4 className="text-sm font-extrabold uppercase tracking-widest opacity-40">Required Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedJob.required_skills?.map((skill, idx) => (
                            <span key={idx} className="px-4 py-2 rounded-xl bg-bridged-teal/10 text-bridged-teal font-bold text-xs border border-bridged-teal/20">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-sm font-extrabold uppercase tracking-widest opacity-40">Nice to Have</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedJob.nice_to_have_skills?.map((skill, idx) => (
                            <span key={idx} className="px-4 py-2 rounded-xl bg-bridged-primary/5 dark:bg-bridged-light/5 text-bridged-primary/60 dark:text-bridged-light/60 font-bold text-xs border border-bridged-primary/10 dark:border-bridged-light/10">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-bridged-primary/10 dark:border-bridged-light/10 flex justify-between items-center">
                    <p className="text-xs text-bridged-primary/40 dark:text-bridged-light/40">
                      Internal ID: {selectedJob.job_id} • Created {new Date(selectedJob.created_at).toLocaleDateString()}
                    </p>
                    <button 
                      onClick={() => {
                        handleDeleteJob(selectedJob.job_id, selectedJob.title);
                      }}
                      className="px-6 py-2.5 rounded-xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                    >
                      Delete Listing
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
