const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function withQuery(path, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
  ).toString();
  return query ? `${path}?${query}` : path;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }

  return response.json();
}

export const api = {
  login: (payload) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  register: (payload) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  lots: () => request("/lots"),
  sessions: () => request("/sessions"),
  summary: (params) => request(withQuery("/analytics/summary", params)),
  peakHours: (params) => request(withQuery("/analytics/peak-hours", params)),
  lotPerformance: (params) => request(withQuery("/analytics/lot-performance", params)),
  vehicleMix: (params) => request(withQuery("/analytics/vehicle-mix", params)),
  paymentStatus: (params) => request(withQuery("/analytics/payment-status", params)),
  durationBuckets: (params) => request(withQuery("/analytics/duration-buckets", params)),
  revenueByVehicleType: (params) => request(withQuery("/analytics/revenue-by-vehicle-type", params)),
  dailyTrend: (params) => request(withQuery("/analytics/daily-trend", params)),
  turnover: (params) => request(withQuery("/analytics/turnover", params)),
  checkIn: (payload) =>
    request("/sessions/check-in", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  checkOut: (id) =>
    request(`/sessions/${id}/check-out`, {
      method: "POST"
    })
};
