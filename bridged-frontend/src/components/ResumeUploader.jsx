import { useState, useEffect, useRef } from 'react';
import { resumeAPI } from '../api/api';
import './ResumeUploader.css';

const SkillTagInput = ({ tags = [], onChange, placeholder, label }) => {
  const [input, setInput] = useState('');

  const addTag = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
      setInput('');
    }
  };

  const removeTag = (tag) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div className="full-width">
      {label && <label className="field-label">{label}</label>}
      <div className="tag-input-container">
        {tags.map((t, i) => (
          <span key={i} className="tag-badge">
            {t}
            <i className="fa-solid fa-xmark tag-remove" onClick={() => removeTag(t)} />
          </span>
        ))}
        <input
          className="tag-input-field"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
};

const ListEditor = ({ items = [], onChange, schema, title, icon }) => {
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const addItem = () => {
    const newItem = Object.keys(schema).reduce((acc, key) => ({ ...acc, [key]: '' }), {});
    onChange([...items, newItem]);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="result-card full-width">
      <h4 className="result-card-title"><i className={`${icon} mr-1.5`} /> {title}</h4>
      <div className="list-editor-container">
        {items.map((item, idx) => (
          <div key={idx} className="list-item-card">
            <button className="remove-item-btn" onClick={() => removeItem(idx)}>
              <i className="fa-solid fa-trash-can text-[10px]" />
            </button>
            <div className="list-item-grid">
              {Object.entries(schema).map(([field, label]) => (
                <div key={field} className={field === 'responsibilities' || field === 'description' ? 'full-width' : ''}>
                  <label className="field-label">{label}</label>
                  {field === 'responsibilities' || field === 'description' ? (
                    <textarea
                      className="edit-textarea"
                      value={item[field] || ''}
                      onChange={e => handleItemChange(idx, field, e.target.value)}
                      placeholder={label}
                    />
                  ) : (
                    <input
                      className="edit-input"
                      value={item[field] || ''}
                      onChange={e => handleItemChange(idx, field, e.target.value)}
                      placeholder={label}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className="add-item-btn" onClick={addItem}>
        <i className="fa-solid fa-plus mr-1" /> Add {title.slice(0, -1)}
      </button>
    </div>
  );
};

const POLL_INTERVAL_MS = 2000;
const PROGRESS_CAP = 90;
const PROGRESS_TICK_MS = 400;
const PROGRESS_RAMP_SEC = 25;

const transformCVData = (data) => {
  if (!data) return {};
  const d = { ...data };

  if (Array.isArray(d.education)) {
    d.education = d.education.map(edu => ({
      institution: edu.institution || edu.school || '',
      degree: edu.degree || edu.qualification || '',
      field: edu.field || edu.major || edu.field_of_study || '',
      start_date: edu.start_date || (edu.year ? edu.year.split('-')[0] : '') || '',
      end_date: edu.end_date || (edu.year ? edu.year.split('-')[1] || edu.year : '') || '',
      location: edu.location || '',
    }));
  }

  if (Array.isArray(d.experience)) {
    d.experience = d.experience.map(exp => ({
      company: exp.company || exp.organization || '',
      title: exp.title || exp.role || exp.position || '',
      location: exp.location || '',
      start_date: exp.start_date || (exp.period ? exp.period.split('-')[0] : '') || '',
      end_date: exp.end_date || (exp.period ? exp.period.split('-')[1] || exp.period : '') || '',
      responsibilities: exp.responsibilities || exp.description || '',
    }));
  }

  if (Array.isArray(d.projects)) {
    d.projects = d.projects.map(proj => ({
      name: proj.name || proj.title || '',
      description: proj.description || '',
      start_date: proj.start_date || '',
      end_date: proj.end_date || '',
      link: proj.link || '',
    }));
  }

  if (Array.isArray(d.certifications)) {
    d.certifications = d.certifications.map(cert => {
      if (typeof cert === 'string') return { name: cert, issuer: '' };
      return {
        name: cert.name || cert.title || '',
        issuer: cert.issuer || '',
      };
    });
  }

  return d;
};

const ResumeUploader = ({ user, onLogout }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState(null);
  const [pollingResumeId, setPollingResumeId] = useState(null);
  const [parseProgress, setParseProgress] = useState(0);
  const [savingEdits, setSavingEdits] = useState(false);
  const pollIntervalRef = useRef(null);
  const progressIntervalRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setResult(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError('');
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);
    setPollingResumeId(null);
    setParseProgress(0);

    try {
      const response = await resumeAPI.upload(file);
      if (response.status === 'processing' || response.status === 'pending') {
        setFile(null);
        setPollingResumeId(response.resume_id);
      } else {
        setParseProgress(100);
        setResult(response);
        setFile(null);
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to upload resume. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!pollingResumeId) return;

    const clearProgressInterval = () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };

    const increment = (PROGRESS_CAP / (PROGRESS_RAMP_SEC * 1000)) * PROGRESS_TICK_MS;
    progressIntervalRef.current = setInterval(() => {
      setParseProgress((p) => Math.min(PROGRESS_CAP, p + increment));
    }, PROGRESS_TICK_MS);

    const poll = async () => {
      try {
        const data = await resumeAPI.get(pollingResumeId);
        if (data.status === 'completed') {
          setParseProgress(100);
          setResult(data);
          setPollingResumeId(null);
          clearProgressInterval();
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (data.status === 'failed') {
          setError(data.parsing_error || 'Parsing failed.');
          setPollingResumeId(null);
          clearProgressInterval();
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (err) {
        const msg = err.response?.data?.error
          || err.response?.data?.detail
          || (err.response?.status === 403 ? 'Access denied to resume.' : 'Failed to check status.');
        setError(msg);
        setPollingResumeId(null);
        clearProgressInterval();
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    };

    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    poll();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      clearProgressInterval();
    };
  }, [pollingResumeId]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    onLogout();
  };

  const toggleEditMode = async () => {
    if (!editMode && result) {
      setEditedData(transformCVData(result.parsed_data || {}));
      setEditMode(true);
      return;
    }
    if (editMode && editedData != null && result?.resume_id) {
      setSavingEdits(true);
      setError('');
      try {
        const updated = await resumeAPI.updateParsedData(result.resume_id, {
          parsed_data: editedData,
          parsing_accuracy: result.parsing_accuracy,
        });
        setResult(prev => ({ ...prev, ...updated }));
        setEditMode(false);
      } catch (err) {
        setError(
          err.response?.data?.parsed_data?.[0] ||
          err.response?.data?.detail ||
          err.response?.data?.error ||
          'Failed to save changes. Please try again.'
        );
      } finally {
        setSavingEdits(false);
      }
      return;
    }
    setEditMode(!editMode);
  };

  const handleFieldChange = (field, value) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  const EDUCATION_SCHEMA = { institution: 'Institution', degree: 'Degree', field: 'Field of Study', start_date: 'Start Date', end_date: 'End Date', location: 'Location' };
  const EXPERIENCE_SCHEMA = { company: 'Company', title: 'Job Title', location: 'Location', start_date: 'Start Date', end_date: 'End Date', responsibilities: 'Responsibilities' };
  const PROJECT_SCHEMA = { name: 'Project Name', description: 'Description', start_date: 'Start Date', end_date: 'End Date' };
  const CERT_SCHEMA = { name: 'Name', issuer: 'Issuer' };

  return (
    <div className="uploader-container">
      <div className="uploader-header">
        <div>
          <h1 className="uploader-title">CV Parser Tester</h1>
          <p className="uploader-subtitle">
            <i className="fa-solid fa-hand mr-1.5" aria-hidden /> Welcome, {user.email}
          </p>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>

      <div className="uploader-card">
        <h2 className="card-title">Upload Resume</h2>
        
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="drop-zone-content">
            <i className="fa-solid fa-cloud-arrow-up upload-icon" aria-hidden />
            <p className="drop-zone-text">
              {file ? file.name : 'Drag and drop your resume here'}
            </p>
            <p className="drop-zone-hint">or</p>
            <label htmlFor="file-input" className="file-select-button">
              Browse Files
              <input
                id="file-input"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
            <p className="file-types">Supports: PDF, DOC, DOCX</p>
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || uploading || pollingResumeId}
          className="upload-button"
        >
          {uploading ? (
            <>
              <span className="spinner"></span>
              Uploading...
            </>
          ) : pollingResumeId ? (
            <>
              <span className="spinner"></span>
              Parsing Resume...
            </>
          ) : (
            'Upload & Parse Resume'
          )}
        </button>

        {(uploading || pollingResumeId) && (
          <div className="parse-progress-wrap">
            <div className="parse-progress-bar">
              <div
                className="parse-progress-fill"
                style={{ width: `${parseProgress}%` }}
              />
            </div>
            <span className="parse-progress-text">{Math.round(parseProgress)}%</span>
          </div>
        )}

        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="result-section">
            <div className="result-header">
              <h3 className="result-title"><i className="fa-solid fa-wand-magic-sparkles mr-1.5" aria-hidden /> Parsing Results</h3>
              <button
                onClick={toggleEditMode}
                className="edit-button"
                disabled={editMode && savingEdits}
              >
                {editMode
                  ? (savingEdits ? 'Saving...' : <><i className="fa-solid fa-floppy-disk mr-1" aria-hidden /> Save Changes</>)
                  : <><i className="fa-solid fa-pen mr-1" aria-hidden /> Edit Results</>}
              </button>
            </div>
            
            <div className="result-grid">
              <div className="result-card">
                <h4 className="result-card-title"><i className="fa-solid fa-user mr-1.5" aria-hidden /> Contact Info</h4>
                {editMode ? (
                  <div className="editable-fields">
                    <input 
                      type="text" 
                      value={editedData?.name || ''} 
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      placeholder="Name"
                      className="edit-input"
                    />
                    <input 
                      type="email" 
                      value={editedData?.email || ''} 
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      placeholder="Email"
                      className="edit-input"
                    />
                    <input 
                      type="tel" 
                      value={editedData?.phone || ''} 
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      placeholder="Phone"
                      className="edit-input"
                    />
                  </div>
                ) : (
                  <div className="contact-info">
                    <p><strong>Name:</strong> {result.parsed_data?.name || 'N/A'}</p>
                    <p><strong>Email:</strong> {result.parsed_data?.email || 'N/A'}</p>
                    <p><strong>Phone:</strong> {result.parsed_data?.phone || 'N/A'}</p>
                  </div>
                )}
              </div>

              {editMode ? (
                <div className="result-card full-width">
                  <h4 className="result-card-title"><i className="fa-solid fa-tags mr-1.5" aria-hidden /> Skills & Languages</h4>
                  <div className="editable-fields">
                    <SkillTagInput
                      label="Technical Skills"
                      tags={editedData?.technical_skills || []}
                      onChange={val => handleFieldChange('technical_skills', val)}
                      placeholder="Type skill and press Enter"
                    />
                    <SkillTagInput
                      label="Soft Skills"
                      tags={editedData?.soft_skills || []}
                      onChange={val => handleFieldChange('soft_skills', val)}
                      placeholder="Type skill and press Enter"
                    />
                    <SkillTagInput
                      label="Languages"
                      tags={editedData?.languages || []}
                      onChange={val => handleFieldChange('languages', val)}
                      placeholder="Type language and press Enter"
                    />
                  </div>
                </div>
              ) : (
                <>
                  {((editMode && editedData) || result.parsed_data?.technical_skills?.length > 0) && (
                    <div className="result-card">
                      <h4 className="result-card-title"><i className="fa-solid fa-laptop-code mr-1.5" aria-hidden /> Technical Skills</h4>
                      <div className="skills-container">
                        {result.parsed_data.technical_skills.map((skill, index) => (
                          <span key={index} className="skill-badge">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {((editMode && editedData) || result.parsed_data?.soft_skills?.length > 0) && (
                    <div className="result-card">
                      <h4 className="result-card-title"><i className="fa-solid fa-people-group mr-1.5" aria-hidden /> Soft Skills</h4>
                      <div className="skills-container">
                        {result.parsed_data.soft_skills.map((skill, index) => (
                          <span key={index} className="skill-badge soft-skill">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {((editMode && editedData) || result.parsed_data?.languages?.length > 0) && (
                    <div className="result-card">
                      <h4 className="result-card-title"><i className="fa-solid fa-globe mr-1.5" aria-hidden /> Languages</h4>
                      <div className="skills-container">
                        {result.parsed_data.languages.map((lang, index) => (
                          <span key={index} className="skill-badge language-badge">{lang}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {editMode ? (
                <>
                  <ListEditor
                    title="Education"
                    icon="fa-solid fa-graduation-cap"
                    items={editedData?.education || []}
                    schema={EDUCATION_SCHEMA}
                    onChange={val => handleFieldChange('education', val)}
                  />
                  <ListEditor
                    title="Experience"
                    icon="fa-solid fa-briefcase"
                    items={editedData?.experience || []}
                    schema={EXPERIENCE_SCHEMA}
                    onChange={val => handleFieldChange('experience', val)}
                  />
                  <ListEditor
                    title="Projects"
                    icon="fa-solid fa-rocket"
                    items={editedData?.projects || []}
                    schema={PROJECT_SCHEMA}
                    onChange={val => handleFieldChange('projects', val)}
                  />
                  <ListEditor
                    title="Certifications"
                    icon="fa-solid fa-certificate"
                    items={editedData?.certifications || []}
                    schema={CERT_SCHEMA}
                    onChange={val => handleFieldChange('certifications', val)}
                  />
                </>
              ) : (
                <>
                  {((editMode && editedData) || (result.parsed_data?.education && result.parsed_data.education.length > 0)) && (
                    <div className="result-card full-width">
                      <h4 className="result-card-title"><i className="fa-solid fa-graduation-cap mr-1.5" aria-hidden /> Education</h4>
                      <div className="list-display">
                        {transformCVData(result.parsed_data).education.map((edu, idx) => (
                          <div key={idx} className="list-item">
                            <div className="list-item-header">
                              <span className="list-item-main">{edu.institution || 'Institution N/A'}</span>
                              <span className="list-item-side">{edu.start_date}{edu.end_date ? ` - ${edu.end_date}` : ''}</span>
                            </div>
                            <div className="list-item-sub">{edu.degree || ''} {edu.field ? `in ${edu.field}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {((editMode && editedData) || (result.parsed_data?.experience && result.parsed_data.experience.length > 0)) && (
                    <div className="result-card full-width">
                      <h4 className="result-card-title"><i className="fa-solid fa-briefcase mr-1.5" aria-hidden /> Experience</h4>
                      <div className="list-display">
                        {transformCVData(result.parsed_data).experience.map((exp, idx) => (
                          <div key={idx} className="list-item">
                            <div className="list-item-header">
                              <span className="list-item-main">{exp.company || 'Company N/A'}</span>
                              <span className="list-item-side">{exp.start_date}{exp.end_date ? ` - ${exp.end_date}` : ''}</span>
                            </div>
                            <div className="list-item-sub font-bold">{exp.title}</div>
                            {exp.responsibilities && <p className="list-item-desc">{exp.responsibilities}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {((editMode && editedData) || (result.parsed_data?.certifications && result.parsed_data.certifications.length > 0)) && (
                    <div className="result-card">
                      <h4 className="result-card-title"><i className="fa-solid fa-certificate mr-1.5" aria-hidden /> Certifications</h4>
                      <div className="list-display">
                        {result.parsed_data.certifications.map((cert, idx) => (
                          <div key={idx} className="simple-list-item">
                             <span className="font-medium text-bridged-primary dark:text-bridged-light">{typeof cert === 'string' ? cert : (cert.name || cert.title)}</span>
                             {cert.issuer && <span className="text-xs text-bridged-primary/60 dark:text-bridged-light/60 ml-2">({cert.issuer})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {((editMode && editedData) || (result.parsed_data?.projects && result.parsed_data.projects.length > 0)) && (
                    <div className="result-card">
                      <h4 className="result-card-title"><i className="fa-solid fa-rocket mr-1.5" aria-hidden /> Projects</h4>
                      <div className="list-display">
                        {transformCVData(result.parsed_data).projects.map((proj, idx) => (
                          <div key={idx} className="list-item">
                            <div className="font-bold text-bridged-primary dark:text-bridged-light">{proj.name}</div>
                            {proj.description && <p className="list-item-desc">{proj.description}</p>}
                            {proj.link && <a href={proj.link} target="_blank" rel="noreferrer" className="text-xs text-bridged-teal hover:underline mt-1 inline-block">View Project</a>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
  {result.parsing_accuracy && (
                <div className="result-card">
                  <h4 className="result-card-title"><i className="fa-solid fa-chart-pie mr-1.5" aria-hidden /> Parsing Accuracy</h4>
                  <div className="accuracy-display">
                    <div className="accuracy-bar">
                      <div
                        className="accuracy-fill"
                        style={{ width: `${result.parsing_accuracy * 100}%` }}
                      ></div>
                    </div>
                    <p className="accuracy-text">
                      {(result.parsing_accuracy * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeUploader;
