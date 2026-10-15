/* UNIT II: external JS - tennis court geometry, IN/OUT decision logic, data generator */
const Court = (() => {
  const W = 8.23, L = 23.77, NET = 11.885, SVC = 6.4, LINE = 0.025, BALL = 0.033; // metres

  // target area [x0,x1,y0,y1] for a shot; "half" = which side of the net the ball lands on
  function area(s) {
    const top = s.half === "top";
    if (s.type === "Serve") {
      const b = s.box === "L" ? [0, W / 2] : [W / 2, W];
      return top ? [b[0], b[1], NET, NET + SVC] : [b[0], b[1], NET - SVC, NET];
    }
    return top ? [0, W, NET, L] : [0, W, 0, NET];
  }

  // ball touching any part of a line is IN (margin >= 0)
  function decide(s) {
    const [x0, x1, y0, y1] = area(s), top = s.half === "top";
    const edges = { left: s.bx - x0, right: x1 - s.bx };
    edges[top ? "far" : "near"] = top ? y1 - s.by : s.by - y0;   // net side is not a line
    let edge = "left", d = edges.left;
    for (const k in edges) if (edges[k] < d) { d = edges[k]; edge = k; }
    const margin = d + LINE + BALL;
    return { decision: margin >= 0 ? "IN" : "OUT", margin: Math.round(margin * 1000), edge, d };
  }

  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // simulated tracking data for one match (3 sets)
  function generate(n = 200, seed = 11) {
    const r = rng(seed), gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
    const out = [];
    for (let i = 1; i <= n; i++) {
      const player = i % 2 ? "Player A" : "Player B", half = player === "Player A" ? "top" : "bottom";
      const p = r(), type = p < 0.28 ? "Serve" : p < 0.55 ? "Forehand" : p < 0.8 ? "Backhand" : "Volley";
      const box = r() < 0.5 ? "L" : "R", set = 1 + Math.floor((i - 1) / (n / 3));
      let bx, depth, speed;
      if (type === "Serve") { bx = (box === "L" ? W / 4 : 3 * W / 4) + gauss() * 0.75; depth = SVC - 0.6 + gauss() * 0.75; speed = 165 + r() * 50 - (player === "Player B" ? 6 : 0); }
      else if (type === "Volley") { bx = W / 2 + gauss() * 2.2; depth = Math.max(1, 6 + gauss() * 2.5); speed = 70 + r() * 40; }
      else { bx = W / 2 + gauss() * 2.3; depth = Math.max(1.5, 10.4 + gauss() * 1.3); speed = 90 + r() * 55; }
      const by = half === "top" ? NET + depth : NET - depth;
      const s = { id: i, player, set, type, speed: +speed.toFixed(1), bx: +bx.toFixed(3), by: +by.toFixed(3), half, box };
      const d = decide(s);
      s.decision = d.decision; s.margin = d.margin;
      s.call = Math.abs(d.margin) < 130 && r() < 0.55 ? (d.decision === "IN" ? "OUT" : "IN") : d.decision;
      s.challenged = s.call !== s.decision ? r() < 0.85 : r() < 0.07;
      s.overturned = s.challenged && s.call !== s.decision;
      out.push(s);
    }
    return out;
  }
  return { W, L, NET, SVC, LINE, BALL, area, decide, generate };
})();
if (typeof module !== "undefined") module.exports = Court;
