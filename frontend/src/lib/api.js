// Thin API client for the MACI FastAPI backend.
// No secrets here - only the public base URL. All LLM/OCR/vector calls happen
// server-side.

const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = "GET", body, params, signal, isForm = false } = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });
  }

  const headers = {};
  let payload;
  if (isForm) {
    payload = body; // FormData
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url.toString(), { method, headers, body: payload, signal });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("Cannot reach the MACI server. Check that the backend is running.", {
      status: 0,
      code: "network_error",
    });
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const e = data?.error || {};
    throw new ApiError(e.message || `Request failed (${res.status})`, {
      status: res.status,
      code: e.code || "http_error",
      details: e.details,
    });
  }
  return data;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export const api = {
  health: () => request("/api/health"),

  // Patients + consent
  createPatient: (body) => request("/api/patients", { method: "POST", body }),
  getPatient: (id) => request(`/api/patients/${id}`),
  updatePatient: (id, body) => request(`/api/patients/${id}`, { method: "PATCH", body }),
  recordConsent: (patientId, body) =>
    request(`/api/patients/${patientId}/consent`, { method: "POST", body }),

  // Sessions
  createSession: (body) => request("/api/sessions", { method: "POST", body }),
  getSession: (id) => request(`/api/sessions/${id}`),
  updateSession: (id, body) => request(`/api/sessions/${id}`, { method: "PATCH", body }),
  sessionIntro: (id) => request(`/api/sessions/${id}/intro`),
  getInterview: (id) => request(`/api/sessions/${id}/interview`),
  submitSession: (id) => request(`/api/sessions/${id}/submit`, { method: "POST" }),
  getSessionSummary: (id) => request(`/api/sessions/${id}/summary`),

  // Interview + summary
  sendMessage: (body) => request("/api/history/message", { method: "POST", body }),
  generateSummary: (body) => request("/api/history/generate-summary", { method: "POST", body }),

  // Voice
  voiceTranscript: (body) => request("/api/voice/transcript", { method: "POST", body }),
  voiceSpeak: (body) => request("/api/voice/speak", { method: "POST", body }),

  // Documents
  uploadDocument: ({ sessionId, patientId, documentType, file }) => {
    const fd = new FormData();
    fd.append("session_id", sessionId);
    fd.append("patient_id", patientId);
    if (documentType) fd.append("document_type", documentType);
    fd.append("file", file);
    return request("/api/documents/upload", { method: "POST", body: fd, isForm: true });
  },
  processDocument: (id, patientId) =>
    request(`/api/documents/${id}/process`, { method: "POST", params: { patient_id: patientId } }),
  getDocument: (id, patientId) => request(`/api/documents/${id}`, { params: { patient_id: patientId } }),
  listDocuments: (sessionId, patientId) =>
    request("/api/documents", { params: { session_id: sessionId, patient_id: patientId } }),
  correctDocument: (id, patientId, body) =>
    request(`/api/documents/${id}`, { method: "PATCH", params: { patient_id: patientId }, body }),

  // Triage
  triageCheck: (body, useLlm = false) =>
    request("/api/triage/check", { method: "POST", params: { use_llm: useLlm }, body }),

  // AYUSH
  saveAyush: (body) => request("/api/ayush/assessment", { method: "POST", body }),
  getAyush: (sessionId) => request(`/api/ayush/assessment/${sessionId}`),

  // Doctor
  doctorQueue: (params) => request("/api/doctor/queue", { params }),
  doctorAnalytics: () => request("/api/doctor/analytics"),
  doctorPatientSummary: (patientId, sessionId) =>
    request(`/api/doctor/patients/${patientId}/summary`, { params: { session_id: sessionId } }),
  markReviewed: (sessionId, body) =>
    request(`/api/doctor/sessions/${sessionId}/reviewed`, { method: "POST", body }),

  // Summaries
  getSummary: (id) => request(`/api/summaries/${id}`),
  patchSummary: (id, body) => request(`/api/summaries/${id}`, { method: "PATCH", body }),
  confirmSummary: (id, body) => request(`/api/summaries/${id}/confirm`, { method: "POST", body }),
  rejectSummary: (id, body) => request(`/api/summaries/${id}/reject`, { method: "POST", body }),

  // ABDM (future / sandbox)
  abdmStatus: () => request("/api/abdm/status"),
};

export { BASE as API_BASE };
