import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000/api";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (expired/invalid tokens) by forcing re-login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid or expired - clear storage and reload to login
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      window.location.reload();
    }
    return Promise.reject(error);
  },
);

// API Methods
export const authAPI = {
  register: async (email, password) => {
    const response = await api.post("/auth/register", {
      email,
      password,
      password_confirm: password,
      role: "student", // Default to student role for testing
    });
    return response.data;
  },

  login: async (email, password) => {
    const response = await api.post("/auth/login", {
      email,
      password,
    });
    return response.data;
  },

  logout: async (refreshToken) => {
    const response = await api.post("/auth/logout", {
      refresh_token: refreshToken,
    });
    return response.data;
  },
};

export const resumeAPI = {
  upload: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/resumes/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
};

export default api;
