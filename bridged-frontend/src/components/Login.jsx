import { useState } from 'react';
import { authAPI } from '../api/api';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("You're offline. Please connect to a network and try again.");
      return;
    }
    setLoading(true);

    try {
      let response;
      if (isLogin) {
        response = await authAPI.login(email, password);
      } else {
        response = await authAPI.register(email, password);
      }

      localStorage.setItem('access_token', response.tokens.access);
      localStorage.setItem('refresh_token', response.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.user));

      onLoginSuccess(response.user);
    } catch (err) {
      const isOffline =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        err.code === 'ERR_NETWORK' ||
        err.message === 'Network Error' ||
        (err.request && !err.response);
      setError(
        isOffline
          ? "You're offline. Please connect to a network and try again."
          : (err.response?.data?.error ||
             err.response?.data?.message ||
             'An error occurred. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">CV Parser Tester</h1>
          <p className="login-subtitle">Test your resume parsing API</p>
        </div>

        <div className="tab-buttons">
          <button
            className={`tab-button ${isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button
            className={`tab-button ${!isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(false)}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
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
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="info-message">
          <p><i className="fa-solid fa-lock mr-1.5" aria-hidden /> For testing purposes only</p>
          <p>Default role: Student</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
