/* LineCall Analytics - React front end (Units II, IV, V) */
const { useState, useEffect, useRef, useMemo } = React;
const API = "api.php", KEY = "linecall.shots";
const TYPES = ["Serve", "Forehand", "Backhand", "Volley"];
const COL = { IN: "#a3e635", OUT: "#ff4d6d", cyan: "#22d3ee", amber: "#fbbf24" };

/* ---------- hooks ---------- */
function useShots() {
  const [shots, setShots] = useState([]);
  const [demo, setDemo] = useState(false);
  const demoRef = useRef(false);
  const load = async () => {
    try {
      let d = await fetch(API).then((r) => r.json());
      if (!Array.isArray(d)) throw 0;
      if (d.length === 0) {                                  // first run: seed the database in one request
        await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Court.generate()) });
        d = await fetch(API).then((r) => r.json());
      }
      setShots(d);
    } catch (e) {                                            // no PHP -> demo mode (browser storage)
      demoRef.current = true; setDemo(true);
      const raw = localStorage.getItem(KEY), list = raw ? JSON.parse(raw) : Court.generate();
      localStorage.setItem(KEY, JSON.stringify(list)); setShots(list);
    }
  };
  useEffect(() => { load(); }, []);
  const keep = (l) => { setShots(l); if (demoRef.current) localStorage.setItem(KEY, JSON.stringify(l)); };
  const add = async (s) => {
    if (demoRef.current) return keep([...shots, { ...s, id: Date.now() }]);
    await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    setShots(await fetch(API).then((r) => r.json()));
  };
  const reset = async () => {
    if (demoRef.current) return keep(Court.generate(200, Math.floor(Math.random() * 999)));
    await fetch(API, { method: "DELETE" }); await load();
  };
  return { shots, demo, add, reset };
}
function useRoute() {
  const get = () => window.location.hash.slice(1) || "/";
  const [r, setR] = useState(get);
  useEffect(() => { const h = () => setR(get()); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  return r;
}
const summary = (list) => {
  const sv = list.filter((s) => s.type === "Serve"), ch = list.filter((s) => s.challenged), ov = ch.filter((s) => s.overturned);
  return { n: list.length, avg: sv.length ? sv.reduce((a, s) => a + s.speed, 0) / sv.length : 0, max: Math.max(0, ...sv.map((s) => s.speed)),
    ch: ch.length, ov: ov.length, rate: ch.length ? Math.round(ov.length / ch.length * 100) : 0, out: list.filter((s) => s.decision === "OUT").length };
};

/* ---------- class component with lifecycle ---------- */
class Clock extends React.Component {
  constructor(props) { super(props); this.state = { now: new Date() }; }
  componentDidMount() { this.t = setInterval(() => this.setState({ now: new Date() }), 1000); }
  componentWillUnmount() { clearInterval(this.t); }
  render() { return <span className="chip"><b>{this.state.now.toLocaleTimeString()}</b></span>; }
}

/* ---------- presentational components ---------- */
function Kpi({ label, value, sub }) {
  return <div className="col-6 col-lg-3"><div className="panel kpi"><div className="num">{value}</div><div className="lbl">{label}</div><small>{sub}</small></div></div>;
}
Kpi.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, sub: PropTypes.string };
Kpi.defaultProps = { sub: "" };

function BarChart({ data, title }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, g = c.getContext("2d"), W = c.width, H = c.height; g.clearRect(0, 0, W, H);
    const max = Math.max(1, ...data.map((d) => d.value)), bw = (W - 40) / data.length;
    data.forEach((d, i) => { const h = d.value / max * (H - 70), x = 24 + i * bw;
      g.fillStyle = d.color || COL.cyan; g.beginPath(); g.roundRect(x, H - 36 - h, bw - 18, h, 8); g.fill();
      g.fillStyle = "#e8ecff"; g.font = "600 13px Poppins"; g.textAlign = "center"; g.fillText(d.value, x + (bw - 18) / 2, H - 42 - h);
      g.fillStyle = "#8d99c7"; g.font = "11px Poppins"; g.fillText(d.label, x + (bw - 18) / 2, H - 16); });
  }, [data]);
  return <><h2>{title}</h2><canvas ref={ref} width="420" height="230" aria-label={title} /></>;
}
BarChart.propTypes = { data: PropTypes.array.isRequired, title: PropTypes.string.isRequired };

function Donut({ inN, outN }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
    const tot = Math.max(1, inN + outN), a = (inN / tot) * Math.PI * 2;
    g.lineWidth = 26; g.strokeStyle = COL.IN; g.beginPath(); g.arc(110, 115, 70, -Math.PI / 2, -Math.PI / 2 + a); g.stroke();
    g.strokeStyle = COL.OUT; g.beginPath(); g.arc(110, 115, 70, -Math.PI / 2 + a, Math.PI * 1.5); g.stroke();
    g.fillStyle = "#e8ecff"; g.font = "700 26px Poppins"; g.textAlign = "center"; g.fillText(Math.round(inN / tot * 100) + "%", 110, 124);
    g.font = "12px Poppins"; g.fillStyle = "#8d99c7"; g.fillText("IN: " + inN + "   OUT: " + outN, 110, 215);
  }, [inN, outN]);
  return <><h2>Ball IN vs OUT</h2><canvas ref={ref} width="220" height="230" aria-label="IN vs OUT" /></>;
}
Donut.propTypes = { inN: PropTypes.number.isRequired, outN: PropTypes.number.isRequired };

/* tennis court bounce map: lines, bounce marks, heat map, click to select */
function CourtMap({ shots, heat, selected, onSelect }) {
  const ref = useRef(null), S = 29, M = 30;
  const X = (y) => M + y * S, Y = (x) => M + x * S;
  useEffect(() => {
    const c = ref.current, g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = "#14307a"; g.fillRect(X(0) - 18, Y(0) - 18, Court.L * S + 36, Court.W * S + 36);
    g.fillStyle = "#1d4ed8"; g.fillRect(X(0), Y(0), Court.L * S, Court.W * S);
    g.strokeStyle = "#e8ecff"; g.lineWidth = 2; g.strokeRect(X(0), Y(0), Court.L * S, Court.W * S);
    [Court.NET - Court.SVC, Court.NET + Court.SVC].forEach((y) => { g.beginPath(); g.moveTo(X(y), Y(0)); g.lineTo(X(y), Y(Court.W)); g.stroke(); });
    g.beginPath(); g.moveTo(X(Court.NET - Court.SVC), Y(Court.W / 2)); g.lineTo(X(Court.NET + Court.SVC), Y(Court.W / 2)); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(X(Court.NET), Y(-0.5)); g.lineTo(X(Court.NET), Y(Court.W + 0.5)); g.stroke();
    if (heat) shots.forEach((s) => { const gr = g.createRadialGradient(X(s.by), Y(s.bx), 0, X(s.by), Y(s.bx), 40);
      gr.addColorStop(0, "rgba(251,191,36,.35)"); gr.addColorStop(1, "rgba(251,191,36,0)"); g.fillStyle = gr; g.beginPath(); g.arc(X(s.by), Y(s.bx), 40, 0, 7); g.fill(); });
    else shots.forEach((s) => { g.fillStyle = s.decision === "IN" ? COL.IN : COL.OUT; g.globalAlpha = 0.85; g.beginPath(); g.arc(X(s.by), Y(s.bx), 4.5, 0, 7); g.fill(); g.globalAlpha = 1;
      if (s.challenged) { g.strokeStyle = COL.amber; g.lineWidth = 2; g.beginPath(); g.arc(X(s.by), Y(s.bx), 8, 0, 7); g.stroke(); } });
    if (selected) { g.strokeStyle = "#fff"; g.lineWidth = 2.5; g.beginPath(); g.arc(X(selected.by), Y(selected.bx), 12, 0, 7); g.stroke(); }
  }, [shots, heat, selected]);
  const click = (e) => {
    const c = ref.current, b = c.getBoundingClientRect(), k = c.width / b.width;
    const px = (e.clientX - b.left) * k, py = (e.clientY - b.top) * k;
    let best = null, bd = 16; shots.forEach((s) => { const d = Math.hypot(X(s.by) - px, Y(s.bx) - py); if (d < bd) { bd = d; best = s; } });
    if (best) onSelect(best);
  };
  return <canvas ref={ref} width="760" height="330" onClick={click} style={{ cursor: "crosshair" }} aria-label="Court bounce map" />;
}
CourtMap.propTypes = { shots: PropTypes.array.isRequired, heat: PropTypes.bool, selected: PropTypes.object, onSelect: PropTypes.func.isRequired };

/* zoomed challenge review: the ball mark against the nearest line */
function Review({ shot }) {
  const ref = useRef(null);
  const d = useMemo(() => (shot ? Court.decide(shot) : null), [shot]);
  useEffect(() => {
    const c = ref.current;
    if (!shot || !c) return;               // canvas does not exist until a shot is selected
    const g = c.getContext("2d"), W = c.width, H = c.height, cy = H / 2, S = 700; g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(255,77,109,.10)"; g.fillRect(0, 0, W, cy); g.fillStyle = "#1d4ed8"; g.fillRect(0, cy, W, H - cy);
    g.fillStyle = "#fff"; g.fillRect(0, cy - Court.LINE * S, W, 2 * Court.LINE * S);
    g.strokeStyle = "#8d99c7"; g.fillStyle = "#8d99c7"; g.font = "11px Poppins"; g.textAlign = "right"; g.lineWidth = 1;
    for (let mm = -250; mm <= 250; mm += 50) { const y = cy + mm / 1000 * S; g.beginPath(); g.moveTo(W - 14, y); g.lineTo(W - 4, y); g.stroke(); if (mm) g.fillText(mm, W - 18, y + 4); }
    const by = Math.max(14, Math.min(H - 14, cy + d.d * S)), bx = W / 2;
    g.fillStyle = "rgba(251,191,36,.75)"; g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.ellipse(bx, by, Court.BALL * S * 1.3, Court.BALL * S, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#e8ecff"; g.font = "600 12px Poppins"; g.textAlign = "left"; g.fillText("OUT side", 10, 18); g.fillText("IN side", 10, H - 10);
  }, [shot, d]);
  if (!shot) return <p style={{ color: "#8d99c7" }}>Click a bounce mark on the court to review it.</p>;
  const ov = shot.call !== shot.decision;
  return (
    <>
      <canvas ref={ref} width="330" height="300" aria-label="Zoomed review" />
      <div className={`verdict mt-3 ${shot.decision === "IN" ? "v-NOT" : "v-OUT"}`}>{shot.decision}<small>Margin {d.margin >= 0 ? "+" : ""}{d.margin} mm from the {d.edge === "far" || d.edge === "near" ? "baseline / service line" : "side / centre line"}</small></div>
      <table className="table table-sm mt-3 mb-2" style={{ fontSize: ".8rem" }}><tbody>
        <tr><td>Ball bounced at</td><td className="text-end">x = {shot.bx} m, y = {shot.by} m</td></tr>
        <tr><td>Nearest line</td><td className="text-end">{{ left: "left side / centre line", right: "right side / centre line", far: "far baseline / service line", near: "near baseline / service line" }[d.edge]}</td></tr>
        <tr><td>Distance to line centre</td><td className="text-end">{Math.round(d.d * 1000)} mm {d.d >= 0 ? "(inside)" : "(outside)"}</td></tr>
        <tr><td>+ half line width</td><td className="text-end">25 mm</td></tr>
        <tr><td>+ ball radius</td><td className="text-end">33 mm</td></tr>
        <tr><td><b>= Margin</b></td><td className="text-end"><b>{d.margin} mm</b></td></tr>
        <tr><td colSpan="2" style={{ color: "#8d99c7" }}>Margin ≥ 0 means the ball touched the line or landed inside, so the call is IN.</td></tr>
      </tbody></table>
      <p className="mt-2 mb-0" style={{ fontSize: ".85rem" }}>On-court call: <b>{shot.call}</b> {ov ? <span className="tag-ov">· OVERTURNED</span> : <span style={{ color: "#8d99c7" }}>· call confirmed</span>}</p>
    </>
  );
}
Review.propTypes = { shot: PropTypes.object };

/* ---------- pages ---------- */
function Dashboard({ shots, onReset }) {
  const s = useMemo(() => summary(shots), [shots]);
  const byType = TYPES.map((t) => { const l = shots.filter((x) => x.type === t); return { label: t, value: l.length ? Math.round(l.reduce((a, x) => a + x.speed, 0) / l.length) : 0, color: COL.cyan }; });
  const bySet = [1, 2, 3].map((n) => { const l = shots.filter((x) => x.type === "Serve" && x.set === n); return { label: "Set " + n, value: l.length ? Math.round(l.reduce((a, x) => a + x.speed, 0) / l.length) : 0, color: "#a78bfa" }; });
  return (
    <>
      <div className="row">
        <Kpi label="Shots tracked" value={s.n} sub={s.out + " landed OUT"} />
        <Kpi label="Avg serve" value={Math.round(s.avg) + " km/h"} sub={"Fastest " + Math.round(s.max) + " km/h"} />
        <Kpi label="Challenges" value={s.ch} sub={s.ov + " overturned"} />
        <Kpi label="Overturn rate" value={s.rate + "%"} sub="of challenges" />
      </div>
      <div className="row">
        <div className="col-lg-4"><div className="panel"><BarChart data={byType} title="Avg speed by shot (km/h)" /></div></div>
        <div className="col-lg-4"><div className="panel"><BarChart data={bySet} title="Avg serve speed by set" /></div></div>
        <div className="col-lg-4"><div className="panel"><Donut inN={s.n - s.out} outN={s.out} /></div></div>
      </div>
      <button className="btn-ghost" onClick={onReset}>Regenerate sample match data</button>
    </>
  );
}
Dashboard.propTypes = { shots: PropTypes.array.isRequired, onReset: PropTypes.func.isRequired };

function CourtPage({ shots }) {
  const [f, setF] = useState({ player: "All", dec: "All", heat: false, chOnly: false, types: [...TYPES] });
  const [sel, setSel] = useState(null);
  const shown = useMemo(() => shots.filter((s) => (f.player === "All" || s.player === f.player) && (f.dec === "All" || s.decision === f.dec)
    && (!f.chOnly || s.challenged) && f.types.includes(s.type)), [shots, f]);
  const toggle = (t) => setF({ ...f, types: f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t] });
  return (
    <div className="row">
      <div className="col-lg-8"><div className="panel">
        <h2>Court bounce map · {shown.length} shots</h2>
        <CourtMap shots={shown} heat={f.heat} selected={sel} onSelect={setSel} />
        <p className="mb-0 mt-2" style={{ fontSize: ".8rem", color: "#8d99c7" }}>Green = IN · Red = OUT · Amber ring = challenged · click a mark to review it.</p>
      </div>
      <div className="panel">
        <h2>Filters</h2>
        <div className="row g-3">
          <div className="col-md-4"><label className="form-label">Player</label>
            <select className="form-select" value={f.player} onChange={(e) => setF({ ...f, player: e.target.value })}><option>All</option><option>Player A</option><option>Player B</option></select></div>
          <div className="col-md-8"><fieldset><legend>Decision</legend>
            {["All", "IN", "OUT"].map((d) => <div className="form-check form-check-inline" key={d}><input className="form-check-input" type="radio" name="dec" id={"d" + d} checked={f.dec === d} onChange={() => setF({ ...f, dec: d })} /><label className="form-check-label" htmlFor={"d" + d}>{d}</label></div>)}
          </fieldset></div>
        </div>
        <fieldset><legend>Shot type</legend>
          {TYPES.map((t) => <div className="form-check form-check-inline" key={t}><input className="form-check-input" type="checkbox" id={"t" + t} checked={f.types.includes(t)} onChange={() => toggle(t)} /><label className="form-check-label" htmlFor={"t" + t}>{t}</label></div>)}
        </fieldset>
        <div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" id="heat" checked={f.heat} onChange={(e) => setF({ ...f, heat: e.target.checked })} /><label className="form-check-label" htmlFor="heat">Heat map</label></div>
        <div className="form-check form-check-inline"><input className="form-check-input" type="checkbox" id="ch" checked={f.chOnly} onChange={(e) => setF({ ...f, chOnly: e.target.checked })} /><label className="form-check-label" htmlFor="ch">Challenged only</label></div>
      </div></div>
      <aside className="col-lg-4"><div className="panel"><h2>Challenge review</h2>
        {sel && <p style={{ fontSize: ".85rem", color: "#8d99c7" }}>#{sel.id} · {sel.player} · {sel.type} · {sel.speed} km/h</p>}
        <Review shot={sel} /></div></aside>
    </div>
  );
}
CourtPage.propTypes = { shots: PropTypes.array.isRequired };

function Challenges({ shots }) {
  const ch = shots.filter((s) => s.challenged);
  const per = ["Player A", "Player B"].map((p) => { const l = ch.filter((s) => s.player === p); const o = l.filter((s) => s.overturned).length; return [p, l.length, o]; });
  return (
    <>
      <div className="row">{per.map((p) => <Kpi key={p[0]} label={p[0] + " challenges"} value={p[1]} sub={p[2] + " overturned"} />)}
        <Kpi label="Total challenges" value={ch.length} sub="" /><Kpi label="Overturned" value={ch.filter((s) => s.overturned).length} sub="system disagreed with the call" /></div>
      <div className="panel"><h2>Challenge log</h2>
        <div className="table-responsive"><table className="table align-middle"><thead><tr><th>#</th><th>Player</th><th>Shot</th><th>Call</th><th>System</th><th>Margin</th><th>Result</th></tr></thead>
          <tbody>{ch.map((s) => <tr key={s.id}><td>{s.id}</td><td>{s.player}</td><td>{s.type}</td><td>{s.call}</td><td className={"tag-" + s.decision}>{s.decision}</td><td>{s.margin} mm</td>
            <td>{s.overturned ? <span className="tag-ov">Overturned</span> : <span style={{ color: "#8d99c7" }}>Upheld</span>}</td></tr>)}</tbody></table></div>
        {ch.length === 0 && <p style={{ color: "#8d99c7" }}>No challenges recorded.</p>}
      </div>
    </>
  );
}
Challenges.propTypes = { shots: PropTypes.array.isRequired };

function LogShot({ onAdd }) {
  const empty = { player: "Player A", type: "Rally", set: 1, speed: 110, bx: 4.1, by: 20, notes: "" };
  const [f, setF] = useState({ ...empty, type: "Forehand" });
  const [msg, setMsg] = useState(""), nref = useRef(null);
  const ch = (e) => setF({ ...f, [e.target.name]: e.target.type === "number" || e.target.type === "range" ? parseFloat(e.target.value) : e.target.value });
  const half = f.player === "Player A" ? "top" : "bottom";
  const shot = { ...f, half, box: f.bx < Court.W / 2 ? "L" : "R" };
  const r = Court.decide(shot);
  const submit = async (e) => {
    e.preventDefault();
    if (!(f.speed > 0)) { setMsg("Enter a valid speed."); nref.current.focus(); return; }
    await onAdd({ player: f.player, set: f.set, type: f.type, speed: f.speed, bx: f.bx, by: f.by, half, box: shot.box, call: r.decision, decision: r.decision, margin: r.margin, challenged: false, overturned: false });
    setMsg("Shot saved ✔");
  };
  return (
    <div className="row"><div className="col-lg-6"><div className="panel"><h2>Log a tracked shot</h2>
      <form onSubmit={submit} onReset={() => { setF({ ...empty, type: "Forehand" }); setMsg(""); }} noValidate>
        <div className="row g-2 mb-2">
          <div className="col-6"><label className="form-label">Player</label><select name="player" className="form-select" value={f.player} onChange={ch}><option>Player A</option><option>Player B</option></select></div>
          <div className="col-6"><label className="form-label">Speed (km/h)</label><input ref={nref} name="speed" type="number" className="form-control" value={f.speed} onChange={ch} /></div>
        </div>
        <fieldset><legend>Shot type</legend>{TYPES.map((t) => <div className="form-check form-check-inline" key={t}><input className="form-check-input" type="radio" name="type" id={"l" + t} value={t} checked={f.type === t} onChange={ch} /><label className="form-check-label" htmlFor={"l" + t}>{t}</label></div>)}</fieldset>
        <label className="form-label">Bounce across court (x): {f.bx} m</label><input name="bx" type="range" min="0" max={Court.W} step="0.05" className="w-100" value={f.bx} onChange={ch} />
        <label className="form-label">Bounce along court (y): {f.by} m</label><input name="by" type="range" min="0" max={Court.L} step="0.05" className="w-100 mb-2" value={f.by} onChange={ch} />
        <label className="form-label">Notes</label><textarea name="notes" rows="2" className="form-control mb-3" value={f.notes} onChange={ch} />
        {msg && <div className="err mb-2" style={{ color: msg.includes("✔") ? COL.IN : COL.OUT }}>{msg}</div>}
        <button className="btn-hv me-2" type="submit">Save shot</button><button className="btn-ghost" type="reset">Reset</button>
      </form></div></div>
      <div className="col-lg-6"><div className="panel"><h2>Live decision preview</h2>
        <div className={`verdict ${r.decision === "IN" ? "v-NOT" : "v-OUT"}`}>{r.decision}<small>Margin {r.margin >= 0 ? "+" : ""}{r.margin} mm to the nearest line</small></div>
        <p className="mt-3 mb-0" style={{ color: "#8d99c7", fontSize: ".85rem" }}>Player A hits into the far half, Player B into the near half. A ball touching any part of a line is IN.</p>
      </div></div></div>
  );
}
LogShot.propTypes = { onAdd: PropTypes.func.isRequired };

function App() {
  const route = useRoute();
  const { shots, demo, add, reset } = useShots();
  const [toast, setToast] = useState("");
  const links = [["/", "Dashboard"], ["/court", "Court & Review"], ["/challenges", "Challenges"], ["/log", "Log Shot"]];
  const titles = { "/": "Match analytics", "/court": "Ball tracking & challenge review", "/challenges": "Challenge statistics", "/log": "Log a shot" };
  let page = <Dashboard shots={shots} onReset={reset} />;
  if (route === "/court") page = <CourtPage shots={shots} />;
  if (route === "/challenges") page = <Challenges shots={shots} />;
  if (route === "/log") page = <LogShot onAdd={async (s) => { await add(s); setToast("Shot saved"); setTimeout(() => setToast(""), 2000); }} />;
  return (
    <>
      <nav className="topbar"><div className="container d-flex align-items-center flex-wrap gap-2">
        <a className="logo" href="#/">LineCall<span>Analytics</span></a>
        <ul className="nav ms-auto align-items-center">
          {links.map(([to, t]) => <li className="nav-item" key={to}><a className={`nav-link ${route === to ? "active" : ""}`} href={`#${to}`}>{t}</a></li>)}
          <li className="nav-item ms-2 d-none d-lg-block"><Clock /></li></ul></div></nav>
      <header id="hero"><div className="container">
        {demo && <span className="demo-pill">Demo mode · saved in browser</span>}
        <h1>{titles[route] || titles["/"]}</h1>
        <p>Electronic line-calling dashboard for tennis: tracked bounces, IN/OUT decisions, challenge reviews and match statistics.</p></div></header>
      <main className="container pb-4">{page}</main>
      <footer>LineCall Analytics · Web Technologies project</footer>
      {toast && <div className="toast-box" role="status">{toast}</div>}
    </>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
