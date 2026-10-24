const BASE = import.meta.env.VITE_API_URL || "";
export const session = {
  token: () => sessionStorage.getItem("token"),
  user: () => JSON.parse(sessionStorage.getItem("user") || "null"),
  set: (t, u) => { sessionStorage.setItem("token", t); sessionStorage.setItem("user", JSON.stringify(u)); },
  clear: () => sessionStorage.clear(),
};
export async function api(path, { method = "GET", body } = {}) {
  const form = body instanceof FormData;
  const headers = { ...(body && !form ? { "Content-Type": "application/json" } : {}), ...(session.token() ? { Authorization: `Bearer ${session.token()}` } : {}) };
  const r = await fetch(`${BASE}/api${path}`, { method, headers, body: body ? (form ? body : JSON.stringify(body)) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "Request failed");
  return d;
}
