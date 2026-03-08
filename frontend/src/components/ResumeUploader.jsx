import { useState } from 'react';
import { resumeAPI } from '../api/api';
import './ResumeUploader.css';

const ResumeUploader = ({ user, onLogout }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState(null);

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

    try {
      const response = await resumeAPI.upload(file);
      setResult(response);
      setFile(null);
    } catch (err) {
      setError(
        err.response?.data?.error || 
        err.response?.data?.message || 
        'Failed to upload and parse resume. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    onLogout();
  };

  const toggleEditMode = () => {
    if (!editMode && result) {
      // Entering edit mode - initialize editedData
      setEditedData(JSON.parse(JSON.stringify(result.parsed_data)));
    } else if (editMode && editedData) {
      // Exiting edit mode - save changes
      setResult(prev => ({
        ...prev,
        parsed_data: editedData
      }));
    }
    setEditMode(!editMode);
  };

  const handleFieldChange = (field, value) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSkillsChange = (type, value) => {
    const skills = value.split(',').map(s => s.trim()).filter(s => s);
    setEditedData(prev => ({
      ...prev,
      [type]: skills
    }));
  };

  const handleJSONChange = (field, value) => {
    try {
      const parsed = JSON.parse(value);
      setEditedData(prev => ({
        ...prev,
        [field]: parsed
      }));
    } catch (e) {
      // Invalid JSON - just update the raw value for now
      console.log('Invalid JSON:', e);
    }
  };

  return (
    <div className="uploader-container">
      <div className="uploader-header">
        <div>
          <h1 className="uploader-title">CV Parser Tester</h1>
          <p className="uploader-subtitle">
            Welcome, {user.email} 👋
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
            <svg
              className="upload-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
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
          disabled={!file || uploading}
          className="upload-button"
        >
          {uploading ? (
            <>
              <span className="spinner"></span>
              Parsing Resume...
            </>
          ) : (
            'Upload & Parse Resume'
          )}
        </button>

        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="result-section">
            <div className="result-header">
              <h3 className="result-title">✨ Parsing Results</h3>
              <button onClick={toggleEditMode} className="edit-button">
                {editMode ? '💾 Save Changes' : '✏️ Edit Results'}
              </button>
            </div>
            
            <div className="result-grid">
              {/* Contact Info */}
              <div className="result-card">
                <h4 className="result-card-title">👤 Contact Info</h4>
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

              {/* Technical Skills */}
              {((editMode && editedData) || result.parsed_data?.technical_skills?.length > 0) && (
                <div className="result-card">
                  <h4 className="result-card-title">💻 Technical Skills</h4>
                  {editMode ? (
                    <textarea
                      value={editedData?.technical_skills?.join(', ') || ''}
                      onChange={(e) => handleSkillsChange('technical_skills', e.target.value)}
                      placeholder="Enter skills separated by commas"
                      className="edit-textarea"
                      rows="3"
                    />
                  ) : (
                    <div className="skills-container">
                      {result.parsed_data.technical_skills.map((skill, index) => (
                        <span key={index} className="skill-badge">{skill}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Soft Skills */}
              {((editMode && editedData) || result.parsed_data?.soft_skills?.length > 0) && (
                <div className="result-card">
                  <h4 className="result-card-title">🤝 Soft Skills</h4>
                  {editMode ? (
                    <textarea
                      value={editedData?.soft_skills?.join(', ') || ''}
                      onChange={(e) => handleSkillsChange('soft_skills', e.target.value)}
                      placeholder="Enter skills separated by commas"
                      className="edit-textarea"
                      rows="3"
                    />
                  ) : (
                    <div className="skills-container">
                      {result.parsed_data.soft_skills.map((skill, index) => (
                        <span key={index} className="skill-badge soft-skill">{skill}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Languages */}
              {((editMode && editedData) || result.parsed_data?.languages?.length > 0) && (
                <div className="result-card">
                  <h4 className="result-card-title">🌍 Languages</h4>
                  {editMode ? (
                    <textarea
                      value={editedData?.languages?.join(', ') || ''}
                      onChange={(e) => handleSkillsChange('languages', e.target.value)}
                      placeholder="Enter languages separated by commas"
                      className="edit-textarea"
                      rows="2"
                    />
                  ) : (
                    <div className="skills-container">
                      {result.parsed_data.languages.map((lang, index) => (
                        <span key={index} className="skill-badge language-badge">{lang}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Education */}
              {((editMode && editedData) || result.parsed_data?.education) && (
                <div className="result-card">
                  <h4 className="result-card-title">🎓 Education</h4>
                  {editMode ? (
                    <textarea
                      value={JSON.stringify(editedData?.education || [], null, 2)}
                      onChange={(e) => handleJSONChange('education', e.target.value)}
                      placeholder="Edit as JSON array"
                      className="edit-textarea json-editor"
                      rows="8"
                    />
                  ) : (
                    <pre className="json-display">
                      {JSON.stringify(result.parsed_data.education, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Experience */}
              {((editMode && editedData) || result.parsed_data?.experience) && (
                <div className="result-card">
                  <h4 className="result-card-title">💼 Experience</h4>
                  {editMode ? (
                    <textarea
                      value={JSON.stringify(editedData?.experience || [], null, 2)}
                      onChange={(e) => handleJSONChange('experience', e.target.value)}
                      placeholder="Edit as JSON array"
                      className="edit-textarea json-editor"
                      rows="10"
                    />
                  ) : (
                    <pre className="json-display">
                      {JSON.stringify(result.parsed_data.experience, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Certifications */}
              {((editMode && editedData) || (result.parsed_data?.certifications && result.parsed_data.certifications.length > 0)) && (
                <div className="result-card">
                  <h4 className="result-card-title">📜 Certifications</h4>
                  {editMode ? (
                    <textarea
                      value={JSON.stringify(editedData?.certifications || [], null, 2)}
                      onChange={(e) => handleJSONChange('certifications', e.target.value)}
                      placeholder="Edit as JSON array"
                      className="edit-textarea json-editor"
                      rows="6"
                    />
                  ) : result.parsed_data.certifications.length > 0 ? (
                    <pre className="json-display">
                      {JSON.stringify(result.parsed_data.certifications, null, 2)}
                    </pre>
                  ) : (
                    <p className="empty-state">None extracted</p>
                  )}
                </div>
              )}

              {/* Projects */}
              {((editMode && editedData) || (result.parsed_data?.projects && result.parsed_data.projects.length > 0)) && (
                <div className="result-card">
                  <h4 className="result-card-title">🚀 Projects</h4>
                  {editMode ? (
                    <textarea
                      value={JSON.stringify(editedData?.projects || [], null, 2)}
                      onChange={(e) => handleJSONChange('projects', e.target.value)}
                      placeholder="Edit as JSON array"
                      className="edit-textarea json-editor"
                      rows="8"
                    />
                  ) : result.parsed_data.projects.length > 0 ? (
                    <pre className="json-display">
                      {JSON.stringify(result.parsed_data.projects, null, 2)}
                    </pre>
                  ) : (
                    <p className="empty-state">None extracted</p>
                  )}
                </div>
              )}
  {result.parsing_accuracy && (
                <div className="result-card">
                  <h4 className="result-card-title">📊 Parsing Accuracy</h4>
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

            <div className="full-response">
              <h4 className="full-response-title">📋 Full API Response</h4>
              <pre className="json-display">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeUploader;
