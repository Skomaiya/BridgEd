import axios from "axios";
import { enqueue as offlineQueueEnqueue } from "../utils/offlineQueue";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;

// Plain axios for auth — no custom adapter, so login/register always hit the server
const authClient = axios.create({
  baseURL: API_BASE_URL,
});

// Client for authenticated requests that must reach the server (no custom adapter)
const serverClient = axios.create({
  baseURL: API_BASE_URL,
});
serverClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
serverClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = (error.config?.url || "").replace(/^\//, "");
      const isAuthEndpoint = url === "auth/login" || url === "auth/register";
      if (!isAuthEndpoint) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        window.location.reload();
      }
    }
    return Promise.reject(error);
  },
);

function isQueueable(config) {
  const method = (config.method || "get").toUpperCase();
  const url = (config.url || "").replace(/^\//, "");
  if (
    method === "PUT" &&
    (url === "students/profile" || url === "employers/profile")
  )
    return true;
  if (method === "PATCH" && /^resumes\/[^/]+$/.test(url.replace(/\/$/, "")))
    return true;
  if (method === "POST" && url === "jobs/") return true;
  if (method === "PATCH" && /^jobs\/[^/]+\/?$/.test(url.replace(/\/$/, "")))
    return true;
  if (
    method === "POST" &&
    /^notifications\/[^/]+\/read\/?$/.test(url.replace(/\/$/, ""))
  )
    return true;
  return false;
}

function buildFullUrl(config) {
  const u = config.url || "";
  if (u.startsWith("http")) return u;
  const base = (config.baseURL || "").replace(/\/$/, "");
  return base + (u.startsWith("/") ? u : "/" + u);
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Use axios's default adapter (XHR/fetch) for real requests. Do not use config.adapter — that is our custom adapter and would recurse.
function getRealAdapter(config) {
  const defaultAdapter = axios.defaults.adapter;
  if (typeof axios.getAdapter === "function") {
    return axios.getAdapter(defaultAdapter, config);
  }
  return typeof defaultAdapter === "function" ? defaultAdapter : null;
}

// When offline, queue queueable writes and return synthetic success; otherwise use real adapter
api.defaults.adapter = function (config) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  if (offline && isQueueable(config)) {
    const fullUrl = buildFullUrl(config);
    return offlineQueueEnqueue({
      method: (config.method || "get").toUpperCase(),
      url: fullUrl,
      body: config.data,
      headers: { Authorization: config.headers?.Authorization },
    }).then(() =>
      Promise.resolve({
        data: { _queued: true, message: "Queued for sync" },
        status: 202,
        statusText: "Accepted",
        headers: {},
        config,
        request: {},
      }),
    );
  }
  const realAdapter = getRealAdapter(config);
  if (typeof realAdapter !== "function") {
    return Promise.reject(new Error("HTTP adapter not available"));
  }
  return realAdapter(config);
};

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 on authenticated requests (expired/invalid token) by forcing re-login; don't reload on login/register 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = (error.config?.url || "").replace(/^\//, "");
      const isAuthEndpoint = url === "auth/login" || url === "auth/register";
      if (!isAuthEndpoint) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        window.location.reload();
      }
    }
    return Promise.reject(error);
  },
);

// API Methods
export const authAPI = {
  register: async (
    email,
    password,
    passwordConfirm,
    role,
    companyName = null,
  ) => {
    const payload = {
      email,
      password,
      password_confirm: passwordConfirm,
      role,
    };
    if (role === "employer" && companyName) payload.company_name = companyName;
    const response = await authClient.post("/auth/register", payload);
    return response.data;
  },

  login: async (email, password) => {
    const response = await authClient.post("/auth/login", {
      email,
      password,
    });
    return response.data;
  },

  logout: async (refreshToken) => {
    const response = await serverClient.post("/auth/logout", {
      refresh_token: refreshToken,
    });
    return response.data;
  },
  deleteAccount: async () => {
    const response = await serverClient.post("/auth/delete-account");
    return response.data;
  },
};

export const profileAPI = {
  getStudentProfile: () =>
    serverClient.get("/students/profile").then((r) => r.data),
  updateStudentProfile: (data) =>
    api.put("/students/profile", data).then((r) => r.data),
  getEmployerProfile: () =>
    serverClient.get("/employers/profile").then((r) => r.data),
  updateEmployerProfile: (data) =>
    api.put("/employers/profile", data).then((r) => r.data),
  getUserProfile: () => serverClient.get("/user/profile").then((r) => r.data),
  updateUserProfile: (data) =>
    api.patch("/user/profile", data).then((r) => r.data),
};

export const resumeAPI = {
  upload: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await serverClient.post("/resumes/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  get: async (resumeId) => {
    const response = await serverClient.get(`/resumes/${resumeId}`);
    return response.data;
  },

  updateParsedData: async (resumeId, { parsed_data, parsing_accuracy }) => {
    const payload = {};
    if (parsed_data !== undefined) payload.parsed_data = parsed_data;
    if (parsing_accuracy !== undefined)
      payload.parsing_accuracy = parsing_accuracy;
    const response = await api.patch(`/resumes/${resumeId}`, payload);
    return response.data;
  },
};

export const jobsAPI = {
  list: (params = {}) =>
    serverClient.get("/jobs/", { params }).then((r) => r.data),
  getMyJobs: (search = "") =>
    serverClient
      .get("/jobs/my_jobs/", { params: { search } })
      .then((r) => r.data),
  get: (jobId) => serverClient.get(`/jobs/${jobId}/`).then((r) => r.data),
  create: (payload) => api.post("/jobs/", payload).then((r) => r.data),
  update: (jobId, payload) =>
    api.patch(`/jobs/${jobId}/`, payload).then((r) => r.data),
  delete: (jobId) => serverClient.delete(`/jobs/${jobId}/`).then((r) => r.data),
  getShortlist: (jobId, params = {}) =>
    serverClient
      .get(`/jobs/${jobId}/shortlist/`, { params })
      .then((r) => r.data),
};

export const employerAPI = {
  getMatches: (params = {}) =>
    serverClient.get("/employer/matches", { params }).then((r) => r.data),
  getMatchStudentProfile: (matchId) =>
    serverClient
      .get(`/employer/matches/${matchId}/student`)
      .then((r) => r.data),
  getMatchResumeDownload: (matchId) =>
    serverClient.get(`/employer/matches/${matchId}/resume-download`, {
      responseType: "blob",
    }),
  employCandidate: (matchId) =>
    serverClient.post(`/matches/${matchId}/employ/`).then((r) => r.data),
  dismissCandidate: (matchId) =>
    serverClient.post(`/matches/${matchId}/dismiss/`).then((r) => r.data),
};

export const matchAPI = {
  getMyMatches: (params = {}) =>
    serverClient.post("/match", params).then((r) => r.data),
  indicateInterest: (matchId) =>
    serverClient.post(`/matches/${matchId}/interest`).then((r) => r.data),
  decline: (matchId) =>
    serverClient.post(`/matches/${matchId}/decline`).then((r) => r.data),
};

// Notifications: list and mark as read
export const notificationsAPI = {
  list: () => serverClient.get("/notifications").then((r) => r.data),
  markRead: (notificationId) =>
    api.post(`/notifications/${notificationId}/read`).then((r) => r.data),
};

// Paystack payment initialization and verification
export const paystackAPI = {
  initialize: (plan, callbackUrl) =>
    serverClient
      .post("/payments/paystack/initialize", {
        plan,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      })
      .then((r) => r.data),
  verify: (reference) =>
    serverClient
      .post("/payments/paystack/verify", { reference })
      .then((r) => r.data),
};

/** Admin-only management endpoints */
export const adminAPI = {
  listUsers: () => serverClient.get("/admin/users/").then((r) => r.data),
  listStudents: (params = {}) =>
    serverClient.get("/admin/users/students/", { params }).then((r) => r.data),
  listEmployers: (params = {}) =>
    serverClient.get("/admin/users/employers/", { params }).then((r) => r.data),
  listAdmins: (params = {}) =>
    serverClient.get("/admin/users/admins/", { params }).then((r) => r.data),
  verifyEmployer: (userId) =>
    serverClient
      .post(`/admin/users/${userId}/verify-employer/`)
      .then((r) => r.data),
  deleteUser: (userId) =>
    serverClient.delete(`/admin/users/${userId}/`).then((r) => r.data),
  updateUser: (userId, data) =>
    serverClient.patch(`/admin/users/${userId}/`, data).then((r) => r.data),
  updateEmail: (userId, email) =>
    serverClient
      .post(`/admin/users/${userId}/update-email/`, { email })
      .then((r) => r.data),
  toggleActive: (userId) =>
    serverClient
      .post(`/admin/users/${userId}/toggle-active/`)
      .then((r) => r.data),
  updatePlan: (userId, plan) =>
    serverClient
      .post(`/admin/users/${userId}/update-plan/`, { plan })
      .then((r) => r.data),
  listContactRequests: (params = {}) =>
    serverClient.get("/admin/contacts/", { params }).then((r) => r.data),
  resolveContactRequest: (pk) =>
    serverClient.post(`/admin/contacts/${pk}/resolve/`).then((r) => r.data),
  listReports: (params = {}) =>
    serverClient.get("/reports/", { params }).then((r) => r.data),
  resolveReport: (reportId) =>
    serverClient
      .patch(`/reports/${reportId}/`, { is_resolved: true })
      .then((r) => r.data),
};

export const supportAPI = {
  submitContact: (data) =>
    authClient.post("/contact/submit", data).then((r) => r.data),
};

export const messagesAPI = {
  listConversations: () =>
    serverClient.get("/conversations/").then((r) => r.data),
  startConversation: (matchId) =>
    serverClient
      .post("/conversations/", { match_id: matchId })
      .then((r) => r.data),
  getMessages: (conversationId) =>
    serverClient
      .get(`/conversations/${conversationId}/messages/`)
      .then((r) => r.data),
  sendMessage: (conversationId, body) =>
    serverClient
      .post(`/conversations/${conversationId}/messages/`, { body })
      .then((r) => r.data),
  editMessage: (conversationId, messageId, body) =>
    serverClient
      .patch(`/conversations/${conversationId}/messages/`, {
        message_id: messageId,
        body,
      })
      .then((r) => r.data),
  getUnreadCount: () =>
    serverClient.get("/conversations/").then((r) => {
      const list = Array.isArray(r.data) ? r.data : (r.data?.results ?? []);
      return list.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    }),
};

export const reportsAPI = {
  reportUser: (data) =>
    serverClient.post("/reports/", data).then((r) => r.data),
};

export const statsAPI = {
  getPlatformStats: () =>
    authClient.get("/stats/platform").then((r) => r.data),
  getEmployerMatchStats: (params = {}) =>
    serverClient.get("/employer/matches/stats", { params }).then((r) => r.data),
};

export default serverClient;
