import { useState } from "react";
import { api, session } from "./api.js";
import { Dashboard, Chat, Appointments, Insurance, Labs, Surgery, Upload } from "./pages.jsx";

const PATIENT = { dashboard: Dashboard, chat: Chat, appointments: Appointments, insurance: Insurance, labs: Labs, surgery: Surgery };
const ADMIN = { dashboard: Dashboard, upload: Upload };

function Login({ onDone }) {
  const [uid, setUid] = useState("P1001"), [pw, setPw] = useState("demo123"), [err, setErr] = useState("");
  const go = async (e) => {
    e.preventDefault();
    try { const d = await api("/login", { method: "POST", body: { user_id: uid, password: pw } }); session.set(d.token, d.user); onDone(d.user); }
    catch (x) { setErr(x.message); }
  };
  return (
    <form className="card login" onSubmit={go}>
      <h2>Hospital Patient Services <small>DEMO</small></h2>
      <select value={uid} onChange={(e) => { setUid(e.target.value); setPw(e.target.value === "ADMIN1" ? "admin123" : "demo123"); }}>
        <option value="P1001">P1001 - Asha Verma (patient)</option>
        <option value="P1002">P1002 - Rohan Mehta (patient)</option>
        <option value="ADMIN1">ADMIN1 - Hospital Admin</option>
      </select>
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" />
      <button>Sign in</button>
      {err && <p className="err">{err}</p>}
      <p className="muted">Synthetic data only. Not a production healthcare system.</p>
    </form>
  );
}

export default function App() {
  const [user, setUser] = useState(session.user());
  const [page, setPage] = useState("dashboard");
  if (!user) return <Login onDone={(u) => { setUser(u); setPage("dashboard"); }} />;
  const pages = user.role === "admin" ? ADMIN : PATIENT;
  const Page = pages[page] || Dashboard;
  return (
    <>
      <header>
        <b>Hospital Services <small>DEMO</small></b>
        <nav>{Object.keys(pages).map((p) => <button key={p} className={p === page ? "on" : ""} onClick={() => setPage(p)}>{p}</button>)}</nav>
        <span>{user.name} <button onClick={() => { session.clear(); setUser(null); }}>Logout</button></span>
      </header>
      <main><Page user={user} go={setPage} /></main>
    </>
  );
}
