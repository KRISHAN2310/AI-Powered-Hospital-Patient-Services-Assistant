import { useEffect, useState } from "react";
import { api } from "./api.js";

function useGet(path) {
  const [s, setS] = useState({ loading: true });
  const load = () => { setS({ loading: true }); api(path).then((data) => setS({ data }), (e) => setS({ error: e.message })); };
  useEffect(load, [path]);
  return [s, load];
}
const Box = ({ s, children }) => (s.loading ? <p>Loading...</p> : s.error ? <p className="err">{s.error}</p> : children(s.data));

export function Dashboard({ user, go }) {
  const adm = user.role === "admin";
  const [a] = useGet(adm ? "/audit" : "/appointments");
  const [x] = useGet(adm ? "/documents" : "/surgery-readiness");
  return (
    <div className="grid">
      <div className="card"><h3>{adm ? "Audit summary" : "Next appointment"}</h3>
        <Box s={a}>{(d) => adm ? <p>{d.count} requests logged. Latency p50 {d.p50_ms} ms, p95 {d.p95_ms} ms.</p> :
          d.appointments[0] ? <p>{d.appointments[0].slot}<br />{d.appointments[0].department} with {d.appointments[0].doctor}</p> : <p>None scheduled.</p>}</Box>
        {!adm && <button onClick={() => go("appointments")}>Manage</button>}</div>
      <div className="card"><h3>{adm ? "Knowledge base" : "Surgery checklist"}</h3>
        <Box s={x}>{(d) => adm ? <p>{d.documents.length} documents indexed.</p> : d.found ? <p>{d.procedure}: {d.items.filter((i) => i.status === "ok").length}/{d.items.length} items done</p> : <p>No planned surgery.</p>}</Box>
        <button onClick={() => go(adm ? "upload" : "surgery")}>Open</button></div>
      {!adm && <div className="card"><h3>Ask the assistant</h3><p>Policies, appointments, insurance, labs, surgery readiness.</p><button onClick={() => go("chat")}>Open chat</button></div>}
    </div>
  );
}

const Badge = ({ t }) => <span className={`badge ${t}`}>{t}</span>;

export function Chat() {
  const [msgs, setMsgs] = useState([]), [text, setText] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const send = async (e) => {
    e.preventDefault();
    const m = text.trim(); if (!m || busy) return;
    setMsgs((x) => [...x, { me: true, text: m }]); setText(""); setBusy(true); setErr("");
    try { const d = await api("/chat", { method: "POST", body: { message: m } }); setMsgs((x) => [...x, { ...d }]); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="card chat">
      <div className="msgs">
        {!msgs.length && <p className="muted">Try: "What are visiting hours for ICU patients?", "What is my latest HbA1c?", "Am I covered for knee replacement?", "Can I proceed with surgery next week?"</p>}
        {msgs.map((m, i) => m.me ? <div key={i} className="me">{m.text}</div> : (
          <div key={i} className="bot">
            <Badge t={m.answer_type} /> <small className="muted">{m.trace_id}</small>
            <p style={{ whiteSpace: "pre-wrap" }}>{m.answer}</p>
            {m.citations.length > 0 && <ul className="cites">{m.citations.map((c, j) => <li key={j}>{c.document ? `${c.document} - ${c.section} - v${c.version} - effective ${c.effective_date}` : c.system}</li>)}</ul>}
            {m.tools_invoked.length > 0 && <small className="muted">Tools: {m.tools_invoked.map((t) => t.tool).join(", ")}</small>}
            <p className="muted"><i>{m.explanation}</i></p>
          </div>))}
        {busy && <p className="muted">Thinking...</p>}
        {err && <p className="err">{err}</p>}
      </div>
      <form onSubmit={send} className="row"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question..." maxLength={1000} /><button disabled={busy}>Send</button></form>
    </div>
  );
}

export function Appointments() {
  const [s, load] = useGet("/appointments");
  const [sel, setSel] = useState(null), [slots, setSlots] = useState([]), [slot, setSlot] = useState(""), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [ask, setAsk] = useState(false);
  const open = async (a) => { setSel(a); setSlot(""); setMsg(""); setErr(""); setAsk(false); try { setSlots((await api(`/appointments/${a.id}/slots`)).slots); } catch (e) { setErr(e.message); } };
  const submit = async (confirm) => {
    try {
      const r = await api(`/appointments/${sel.id}/reschedule`, { method: "POST", body: { new_slot: slot, confirm } });
      setMsg(r.message); setErr("");
      if (r.status === "completed") { setSel(null); setAsk(false); load(); } else setAsk(true);
    } catch (e) { setErr(e.message); setAsk(false); }
  };
  return (
    <div className="card"><h3>Appointments</h3>
      <Box s={s}>{(d) => <table><thead><tr><th>When</th><th>Department</th><th>Doctor</th><th>Location</th><th /></tr></thead>
        <tbody>{d.appointments.map((a) => <tr key={a.id}><td>{a.slot}</td><td>{a.department}</td><td>{a.doctor}</td><td>{a.location}</td><td><button onClick={() => open(a)}>Reschedule</button></td></tr>)}</tbody></table>}</Box>
      {sel && <div className="panel"><b>Reschedule {sel.department} ({sel.slot})</b>
        <div className="row"><select value={slot} onChange={(e) => { setSlot(e.target.value); setAsk(false); setMsg(""); }}><option value="">Choose new slot</option>{slots.map((x) => <option key={x}>{x}</option>)}</select>
          <button disabled={!slot} onClick={() => submit(false)}>Review</button></div>
        {ask && <div className="row"><span>{msg}</span><button onClick={() => submit(true)}>Confirm</button></div>}</div>}
      {msg && !ask && <p className="ok">{msg}</p>}{err && <p className="err">{err}</p>}
    </div>
  );
}

export function Insurance() {
  const [p] = useGet("/insurance/procedures"), [proc, setProc] = useState(""), [r, setR] = useState(null), [err, setErr] = useState("");
  const check = async () => { setErr(""); setR(null); try { setR(await api(`/insurance?procedure=${encodeURIComponent(proc)}`)); } catch (e) { setErr(e.message); } };
  return (
    <div className="card"><h3>Insurance eligibility</h3>
      <Box s={p}>{(d) => <div className="row"><select value={proc} onChange={(e) => setProc(e.target.value)}><option value="">Select procedure</option>{d.procedures.map((x) => <option key={x}>{x}</option>)}</select><button disabled={!proc} onClick={check}>Check</button></div>}</Box>
      {err && <p className="err">{err}</p>}
      {r && <div className="panel"><p><span className={`badge ${r.eligible ? "action_completed" : "refused"}`}>{r.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}</span> {r.procedure} - {r.plan} (policy {r.policy_no})</p>
        <ul>{r.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
        <p>Pre-authorization: {r.preauth_required ? `required (${r.preauth_status})` : "not required"}</p>
        {r.estimated_cost && <p>Estimated cost {r.estimated_cost} / remaining limit {r.remaining_limit}</p>}<small className="muted">Deterministic rule check; not a guarantee of payment.</small></div>}
    </div>
  );
}

export function Labs() {
  const [s] = useGet("/labs");
  return (
    <div className="card"><h3>Latest lab results</h3>
      <Box s={s}>{(d) => <table><thead><tr><th>Test</th><th>Value</th><th>Reference</th><th>Flag</th><th>Date</th></tr></thead>
        <tbody>{d.labs.map((l) => <tr key={l.test}><td>{l.test}</td><td>{l.value} {l.unit}</td><td>{l.ref_range}</td><td>{l.flag}</td><td>{l.taken_on}</td></tr>)}</tbody></table>}</Box>
      <small className="muted">Please discuss results with your doctor.</small>
    </div>
  );
}

export function Surgery() {
  const [s] = useGet("/surgery-readiness");
  return (
    <div className="card"><h3>Surgery readiness</h3>
      <Box s={s}>{(d) => !d.found ? <p>No planned surgery on record.</p> : <>
        <p>{d.procedure} on {d.planned_date} with {d.surgeon}</p>
        <ul className="check">{d.items.map((i, k) => <li key={k} className={i.status}><b>{i.status.toUpperCase()}</b> {i.item} - {i.detail}</li>)}</ul>
        <p>{d.ready_for_clinician_review ? "All checklist items complete - ready for clinician review." : "Outstanding items remain."}</p>
        <p className="err">{d.disclaimer}</p></>}</Box>
    </div>
  );
}

export function Upload() {
  const [docs, load] = useGet("/documents"), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setMsg(""); setErr(""); setBusy(true);
    try { const r = await api("/documents", { method: "POST", body: new FormData(e.target) }); setMsg(`Indexed ${r.chunks} chunks. Suspicious lines removed: ${r.removed_suspicious_lines}.`); e.target.reset(); load(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="card"><h3>Upload policy PDF</h3>
      <form onSubmit={submit} className="col">
        <input name="file" type="file" accept="application/pdf" required />
        <input name="title" placeholder="Title" required /><input name="version" placeholder="Version e.g. 3.0" required />
        <label>Effective date <input name="effective_date" type="date" required /></label>
        <select name="authority"><option value="hospital_policy">hospital_policy</option><option value="clinical_guideline">clinical_guideline</option><option value="regulatory">regulatory</option></select>
        <input name="topic" placeholder="Topic key (same key = versions of one policy)" />
        <button disabled={busy}>{busy ? "Uploading..." : "Upload"}</button></form>
      {msg && <p className="ok">{msg}</p>}{err && <p className="err">{err}</p>}
      <Box s={docs}>{(d) => <table><thead><tr><th>Title</th><th>Ver</th><th>Effective</th><th>Authority</th><th>Topic</th><th>Chunks</th></tr></thead>
        <tbody>{d.documents.map((x) => <tr key={x.id}><td>{x.title}</td><td>{x.version}</td><td>{x.effective_date}</td><td>{x.authority}</td><td>{x.topic}</td><td>{x.chunks}</td></tr>)}</tbody></table>}</Box>
    </div>
  );
}
