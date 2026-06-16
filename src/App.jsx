import { useCallback, useRef, useState, useEffect, createContext, useContext } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Handle, Position,
  BaseEdge, EdgeLabelRenderer, getBezierPath,
} from "reactflow";
import "reactflow/dist/style.css";

const params = new URLSearchParams(window.location.search);
const API = (import.meta.env.VITE_API_URL || "http://kkzof1hiq0af5vngi0v689zi.5.75.237.171.sslip.io").replace(/\/$/, "");
const ACCOUNT_ID = parseInt(params.get("account_id") || import.meta.env.VITE_ACCOUNT_ID || "3", 10);

// Light theme (DASHBOARD)
const T = { blue: "#1f93ff", text: "#1f2d3d", sub: "#64748b", border: "#e5e7eb", bg: "#ffffff", soft: "#f8fafc", green: "#15803d", greenBg: "#e7f7ee", grayPill: "#64748b", grayPillBg: "#f1f5f9", font: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
// Dark theme (CANVAS / EDITOR)
const D = { bg: "#0a0d14", panel: "#0d1119", panel2: "#121826", card: "#141b27", border: "rgba(255,255,255,.08)", text: "#e8edf5", sub: "#9aa7bd", faint: "#5b6678", input: "#0f1622" };
const NC = { start: "#22d3ee", text: "#3b82f6", buttons: "#22c55e", question: "#a855f7", stop: "#f43f5e" };

function hexA(hex, a) { const h = hex.replace("#", ""); const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h; const n = parseInt(f, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

function injectFont() {
  if (!document.getElementById("cs-inter")) {
    const l = document.createElement("link"); l.id = "cs-inter"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }
  document.body.style.margin = "0"; document.body.style.fontFamily = T.font;
}
function injectStyles() {
  if (document.getElementById("cs-dark")) return;
  const s = document.createElement("style"); s.id = "cs-dark";
  s.textContent = `
  .react-flow__controls{box-shadow:0 8px 24px rgba(0,0,0,.5);border-radius:8px;overflow:hidden;}
  .react-flow__controls-button{background:#141b27;border-bottom:1px solid rgba(255,255,255,.08);}
  .react-flow__controls-button:hover{background:#1c2533;}
  .react-flow__controls-button svg{fill:#cbd5e1;}
  .react-flow__minimap{background:#0a0d14 !important;border:1px solid rgba(255,255,255,.06);border-radius:8px;}
  .react-flow__attribution{background:transparent;color:#475569;}
  .react-flow__edge-path{filter:drop-shadow(0 0 2.5px rgba(99,102,241,.55));}
  .cs-pal:hover{border-color:rgba(255,255,255,.22)!important;transform:translateY(-1px);box-shadow:0 8px 22px rgba(0,0,0,.5)!important;}
  .cs-in{background:#0f1622;border:1px solid rgba(255,255,255,.1);color:#e8edf5;}
  .cs-in:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.25);}
  .cs-in::placeholder{color:#5b6678;}
  .cs-pub:hover{box-shadow:0 0 22px rgba(34,197,94,.6)!important;}
  .cs-gcard:hover{border-color:rgba(255,255,255,.2)!important;transform:translateY(-2px);box-shadow:0 14px 32px rgba(0,0,0,.6)!important;}
  `;
  document.head.appendChild(s);
}

// ===== NODE bits (dark glow) =====
const nodeBox = (accent, sel) => ({ position: "relative", background: D.card, borderRadius: 14, width: 242, border: `1px solid ${sel ? accent : D.border}`, boxShadow: sel ? `0 0 0 1px ${accent}, 0 0 26px ${hexA(accent, .38)}, 0 14px 34px rgba(0,0,0,.6)` : `0 0 18px ${hexA(accent, .12)}, 0 12px 28px rgba(0,0,0,.55)`, fontFamily: T.font, overflow: "hidden", transition: "box-shadow .15s, border-color .15s" });
const nbody = { padding: "2px 12px 12px", color: D.sub, whiteSpace: "pre-wrap", minHeight: 14, lineHeight: 1.45, fontSize: 12 };
const hStyle = (accent) => ({ width: 11, height: 11, background: "#0a0d14", border: `2px solid ${accent}`, boxShadow: `0 0 8px ${hexA(accent, .8)}` });
const EdgeCtx = createContext(null);

function Hdr({ a, icon, title }) {
  return (<div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 12px 6px" }}>
    <div style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", background: hexA(a, .16), color: a, boxShadow: `0 0 12px ${hexA(a, .45)}`, fontSize: 13 }}>{icon}</div>
    <div style={{ color: D.text, fontWeight: 600, fontSize: 12.5 }}>{title}</div>
  </div>);
}
function Strip({ a }) { return <div style={{ height: 3, background: a, boxShadow: `0 0 12px ${a}` }} />; }

function StartNode({ data }) { const a = NC.start; return (<div style={nodeBox(a, false)}><Strip a={a} /><Hdr a={a} icon="⚡" title="On Message" /><div style={nbody}>{data.keywords ? `Keywords: ${data.keywords}` : "Pehle message par flow shuru"}</div><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function TextNode({ data, selected }) { const a = NC.text; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><Strip a={a} /><Hdr a={a} icon="💬" title="Send Text" /><div style={nbody}>{data.text || "…"}</div><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function ButtonsNode({ data, selected }) {
  const a = NC.buttons; const buttons = data.buttons || [];
  return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><Strip a={a} /><Hdr a={a} icon="🔘" title="Send Buttons" /><div style={nbody}>{data.text || "…"}</div>
    {buttons.map((b, i) => (<div key={i} style={{ position: "relative", margin: "6px 12px", padding: "7px 26px 7px 10px", border: `1px solid ${D.border}`, borderRadius: 8, background: "#0f1622", color: D.text, fontSize: 12 }}>{b.title || `Button ${i + 1}`}<Handle type="source" position={Position.Right} id={`btn-${i}`} style={{ top: "50%", right: -7, transform: "translateY(-50%)", ...hStyle(a) }} /></div>))}
    <div style={{ height: 6 }} /></div>);
}
function QuestionNode({ data, selected }) { const a = NC.question; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><Strip a={a} /><Hdr a={a} icon="❓" title="Ask Question" /><div style={nbody}>{data.text || "…"}{data.saveAs ? <div style={{ marginTop: 6, fontSize: 11, color: a }}>→ save as: {data.saveAs}</div> : null}</div><Handle type="source" position={Position.Bottom} style={hStyle(a)} /></div>); }
function StopNode({ data, selected }) { const a = NC.stop; return (<div style={nodeBox(a, selected)}><Handle type="target" position={Position.Top} style={hStyle(a)} /><Strip a={a} /><Hdr a={a} icon="🛑" title="Stop / Human" /><div style={nbody}>{data.text || "(koi message nahi)"}</div></div>); }
const nodeTypes = { start: StartNode, text: TextNode, buttons: ButtonsNode, question: QuestionNode, stop: StopNode };

function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style }) {
  const { onDeleteEdge } = useContext(EdgeCtx) || {};
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (<>
    <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: "#6366f1", strokeWidth: 2, opacity: .9 }} />
    <EdgeLabelRenderer>
      <button onClick={(e) => { e.stopPropagation(); onDeleteEdge && onDeleteEdge(id); }} title="Connection hatao"
        style={{ position: "absolute", transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: "all", width: 20, height: 20, borderRadius: "50%", border: "2px solid #0a0d14", background: "#f43f5e", color: "#fff", cursor: "pointer", fontSize: 11, lineHeight: "16px", boxShadow: `0 0 10px ${hexA("#f43f5e", .7)}`, padding: 0 }}>✕</button>
    </EdgeLabelRenderer>
  </>);
}
const edgeTypes = { deletable: DeletableEdge };

function defaultData(kind) {
  if (kind === "text") return { text: "Apna message yahan likhein…" };
  if (kind === "buttons") return { text: "Customer ko kya poochna hai?", buttons: [{ title: "Option 1" }, { title: "Option 2" }] };
  if (kind === "question") return { text: "Aapka sawaal…", saveAs: "answer" };
  if (kind === "stop") return { text: "Aapko ek agent se jod rahe hain 🙌" };
  return {};
}
const PALETTE = [
  { kind: "text", label: "Send Text", icon: "💬", color: NC.text },
  { kind: "buttons", label: "Send Buttons", icon: "🔘", color: NC.buttons },
  { kind: "question", label: "Ask Question", icon: "❓", color: NC.question },
  { kind: "stop", label: "Stop / Human", icon: "🛑", color: NC.stop },
];
const startNode = () => ({ id: "start", type: "start", position: { x: 320, y: 40 }, data: { keywords: "" }, deletable: false });

function toEngineFormat(nodes, edges) {
  const def = { start: null, nodes: {} }; const plainNext = {}; const btnNext = {};
  for (const e of edges) { if (e.sourceHandle && e.sourceHandle.startsWith("btn-")) { btnNext[e.source] = btnNext[e.source] || {}; btnNext[e.source][e.sourceHandle] = e.target; } else plainNext[e.source] = e.target; }
  def.start = plainNext["start"] || null;
  for (const n of nodes) {
    if (n.type === "start") continue;
    if (n.type === "text") def.nodes[n.id] = { type: "text", text: n.data.text || "", next: plainNext[n.id] || null };
    else if (n.type === "question") def.nodes[n.id] = { type: "question", text: n.data.text || "", save_as: n.data.saveAs || "answer", next: plainNext[n.id] || null };
    else if (n.type === "stop") def.nodes[n.id] = { type: "handover", text: n.data.text || "" };
    else if (n.type === "buttons") def.nodes[n.id] = { type: "buttons", text: n.data.text || "", buttons: (n.data.buttons || []).map((b, i) => ({ title: b.title || `Button ${i + 1}`, next: (btnNext[n.id] || {})[`btn-${i}`] || null })) };
  }
  return def;
}
function fromEngineFormat(def) {
  const nodes = [startNode()]; const edges = []; let y = 200;
  const ids = Object.keys((def && def.nodes) || {});
  ids.forEach((id, idx) => {
    const node = def.nodes[id]; const kind = node.type === "handover" ? "stop" : node.type; const data = {};
    if (kind === "text") data.text = node.text || "";
    if (kind === "question") { data.text = node.text || ""; data.saveAs = node.save_as || "answer"; }
    if (kind === "stop") data.text = node.text || "";
    if (kind === "buttons") { data.text = node.text || ""; data.buttons = (node.buttons || []).map((b) => ({ title: b.title })); }
    nodes.push({ id, type: kind, position: { x: 320 + (idx % 2) * 300, y: y + idx * 120 }, data });
    if (kind === "buttons") (node.buttons || []).forEach((b, i) => { if (b.next) edges.push({ id: `e-${id}-${i}`, source: id, sourceHandle: `btn-${i}`, target: b.next, type: "deletable", animated: true }); });
    else if (node.next) edges.push({ id: `e-${id}`, source: id, target: node.next, type: "deletable", animated: true });
  });
  if (def && def.start) edges.push({ id: "e-start", source: "start", target: def.start, type: "deletable", animated: true });
  return { nodes, edges };
}

export default function App() {
  // ?view=gallery  -> Gallery screen (Chatwoot sidebar tab iframe yahi kholta hai)
  const initialView = params.get("view") === "gallery" ? "gallery" : "dashboard";
  const [view, setView] = useState(initialView);
  const [editId, setEditId] = useState(null);
  useEffect(() => { injectFont(); injectStyles(); }, []);
  if (view === "gallery") return <Gallery />;
  if (view === "editor") return <Editor flowId={editId} onBack={() => setView("dashboard")} />;
  return <Dashboard onEdit={(id) => { setEditId(id); setView("editor"); }} />;
}

// ===================== DASHBOARD (light — unchanged) =====================
function Dashboard({ onEdit }) {
  const [flows, setFlows] = useState(null);
  const [inboxes, setInboxes] = useState([]);
  const [menuOpen, setMenuOpen] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [pendingInbox, setPendingInbox] = useState({});
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);

  const load = async () => {
    try { const j = await (await fetch(`${API}/api/flows?account_id=${ACCOUNT_ID}`)).json(); setFlows(j.flows || []); } catch { setFlows([]); }
    try { const j = await (await fetch(`${API}/api/inboxes?account_id=${ACCOUNT_ID}`)).json(); setInboxes(j.inboxes || []); } catch { setInboxes([]); }
  };
  useEffect(() => { load(); }, []);

  const createBot = async () => { try { const j = await (await fetch(`${API}/api/flows`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: ACCOUNT_ID, name: "New chatbot" }) })).json(); if (j.ok) onEdit(j.flow.id); } catch { setMsg("Create failed"); } };
  const duplicate = async (f) => { setMenuOpen(null); try { const full = await (await fetch(`${API}/api/flows/${f.id}`)).json(); const cr = await (await fetch(`${API}/api/flows`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: ACCOUNT_ID, name: (f.name || "Chatbot") + " (copy)" }) })).json(); if (cr.ok) await fetch(`${API}/api/flows/${cr.flow.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cr.flow.name, definition: full.flow.definition }) }); await load(); } catch { setMsg("Duplicate failed"); } };
  const exportBot = async (f) => { setMenuOpen(null); try { const full = await (await fetch(`${API}/api/flows/${f.id}`)).json(); const blob = new Blob([JSON.stringify({ name: full.flow.name, definition: full.flow.definition }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${(f.name || "chatbot").replace(/\s+/g, "-")}.json`; a.click(); URL.revokeObjectURL(url); } catch { setMsg("Export failed"); } };
  const doDelete = async () => { const f = confirmDel; setConfirmDel(null); if (!f) return; try { await fetch(`${API}/api/flows/${f.id}`, { method: "DELETE" }); await load(); } catch { setMsg("Delete failed"); } };
  const importBot = async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const data = JSON.parse(await file.text()); const cr = await (await fetch(`${API}/api/flows`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: ACCOUNT_ID, name: data.name || "Imported chatbot" }) })).json(); if (cr.ok && data.definition) await fetch(`${API}/api/flows/${cr.flow.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cr.flow.name, definition: data.definition }) }); await load(); } catch { setMsg("Import failed — galat JSON"); } e.target.value = ""; };
  const saveInbox = async (f) => { const val = pendingInbox[f.id]; try { await fetch(`${API}/api/flows/${f.id}/assign-inbox`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inbox_id: val === "" ? null : val }) }); setPendingInbox((p) => { const n = { ...p }; delete n[f.id]; return n; }); await load(); } catch { setMsg("Save failed"); } };

  const btnPrimary = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: T.blue, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: T.font };
  const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: T.font };
  const pill = (s) => ({ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: s === "published" ? T.greenBg : T.grayPillBg, color: s === "published" ? T.green : T.grayPill });

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font, color: T.text }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "24px 28px 12px" }}>
        <div><div style={{ fontSize: 22, fontWeight: 700 }}>Chatbots</div><div style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>Manage your chatbots</div></div>
        <div style={{ display: "flex", gap: 10 }}>
          <input ref={fileRef} type="file" accept="application/json" onChange={importBot} style={{ display: "none" }} />
          <button style={btnGhost} onClick={() => fileRef.current?.click()}>⬆ Import</button>
          <button style={btnPrimary} onClick={createBot}>＋ Create Chatbot</button>
        </div>
      </div>
      {msg && <div style={{ margin: "0 28px 8px", color: "#dc2626", fontSize: 13 }}>{msg}</div>}
      <div style={{ padding: "8px 28px 28px" }}>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.6fr 1.1fr", padding: "12px 16px", background: T.soft, fontSize: 12, fontWeight: 600, color: T.sub, textTransform: "uppercase", letterSpacing: ".03em", borderRadius: "12px 12px 0 0" }}>
            <div>Name</div><div>Status</div><div>Number / Inbox</div><div style={{ textAlign: "right" }}>Actions</div>
          </div>
          {flows === null && <div style={{ padding: 20, color: T.sub, fontSize: 13 }}>Loading…</div>}
          {flows && flows.length === 0 && <div style={{ padding: 24, color: T.sub, fontSize: 13 }}>Abhi koi chatbot nahi. “Create Chatbot” se shuru karein.</div>}
          {flows && flows.map((f) => {
            const cur = f.inbox_id ?? ""; const sel = pendingInbox[f.id] !== undefined ? pendingInbox[f.id] : cur;
            const dirty = pendingInbox[f.id] !== undefined && String(pendingInbox[f.id]) !== String(cur);
            return (
              <div key={f.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.6fr 1.1fr", alignItems: "center", padding: "14px 16px", borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                <div><span style={pill(f.status)}>{f.status}</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select value={sel} onChange={(e) => setPendingInbox((p) => ({ ...p, [f.id]: e.target.value }))} style={{ padding: "6px 8px", border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13, fontFamily: T.font, color: T.text, background: "#fff", maxWidth: 170 }}>
                    <option value="">— None (off)</option>
                    {inboxes.map((i) => (<option key={i.id} value={i.id}>{i.name}</option>))}
                  </select>
                  {dirty && <button onClick={() => saveInbox(f)} style={{ padding: "6px 12px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Save</button>}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                  <button style={{ ...btnGhost, padding: "6px 14px" }} onClick={() => onEdit(f.id)}>Edit</button>
                  <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuOpen(menuOpen && menuOpen.id === f.id ? null : { id: f.id, x: r.right, y: r.bottom }); }} style={{ width: 32, height: 32, border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 18, lineHeight: "16px", color: T.sub }}>⋮</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {menuOpen && (() => {
        const f = (flows || []).find((x) => x.id === menuOpen.id); if (!f) return null;
        const items = [["Edit", () => { setMenuOpen(null); onEdit(f.id); }], ["Duplicate", () => duplicate(f)], ["Export", () => exportBot(f)], ["Delete", () => { setMenuOpen(null); setConfirmDel(f); }]];
        return (<>
          <div onClick={() => setMenuOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div style={{ position: "fixed", top: menuOpen.y + 6, left: menuOpen.x - 160, width: 160, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,.16)", zIndex: 100, overflow: "hidden" }}>
            {items.map(([lbl, fn]) => (<div key={lbl} onClick={fn} style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: lbl === "Delete" ? "#dc2626" : T.text, borderTop: lbl === "Delete" ? `1px solid ${T.border}` : "none" }} onMouseEnter={(e) => (e.currentTarget.style.background = T.soft)} onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>{lbl}</div>))}
          </div>
        </>);
      })()}

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setConfirmDel(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: 24, width: 360, fontFamily: T.font }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Delete chatbot?</div>
            <div style={{ fontSize: 13, color: T.sub, marginBottom: 18 }}>“{confirmDel.name}” permanently delete ho jayega.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setConfirmDel(null)}>Cancel</button>
              <button style={{ ...btnPrimary, background: "#dc2626" }} onClick={doDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== GALLERY (DARK — media library) =====================
// iframe-safe clipboard (cross-origin + http par navigator.clipboard kaam nahi karta)
function copyText(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.top = "-9999px"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}
function fmtSize(b) {
  if (b == null) return "";
  if (b < 1024) return b + " B";
  if (b < 1048576) return Math.round(b / 1024) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}
const GTYPE = {
  image: { icon: "🖼️", label: "Image", color: NC.start },
  video: { icon: "🎬", label: "Video", color: NC.question },
  audio: { icon: "🎵", label: "Audio", color: NC.buttons },
  document: { icon: "📄", label: "Doc", color: "#f59e0b" },
};

function Gallery() {
  const [media, setMedia] = useState(null);     // null=loading, []=empty
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState(null);  // image lightbox
  const fileRef = useRef(null);

  const load = async () => {
    try { const j = await (await fetch(`${API}/api/media?account_id=${ACCOUNT_ID}`)).json(); setMedia(j.media || []); }
    catch { setMedia([]); setMsg("Media load nahi hui — bot engine band to nahi?"); }
  };
  useEffect(() => { load(); }, []);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    if (!files.length) return;
    setUploading(true); setMsg("");
    let fail = 0;
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("account_id", String(ACCOUNT_ID));
        const j = await (await fetch(`${API}/api/upload`, { method: "POST", body: fd })).json();
        if (!j.ok) fail++;
      } catch { fail++; }
    }
    setUploading(false);
    if (fail) setMsg(`${fail} file upload nahi hui.`);
    await load();
  };

  const doDelete = async () => {
    const m = confirmDel; setConfirmDel(null); if (!m) return;
    try { await fetch(`${API}/api/media/${m.id}`, { method: "DELETE" }); await load(); }
    catch { setMsg("Delete fail ho gaya."); }
  };

  const doCopy = (m) => {
    if (copyText(m.url)) { setCopiedId(m.id); setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1500); }
    else setMsg("Copy nahi hua — link manually copy karein.");
  };

  const list = (media || []).filter((m) => filter === "all" || m.type === filter);
  const counts = (media || []).reduce((acc, m) => { acc[m.type] = (acc[m.type] || 0) + 1; return acc; }, {});
  const filters = [["all", "All"], ["image", "Images"], ["video", "Videos"], ["audio", "Audio"], ["document", "Docs"]];

  const wrap = { minHeight: "100vh", background: D.bg, fontFamily: T.font, color: D.text, backgroundImage: "radial-gradient(circle at 30% 0%, rgba(99,102,241,.06), transparent 40%), radial-gradient(circle at 90% 100%, rgba(34,211,238,.05), transparent 45%)" };
  const primary = { display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 8, cursor: uploading ? "default" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: T.font, boxShadow: "0 0 16px rgba(34,197,94,.45)", opacity: uploading ? .75 : 1 };

  return (
    <div style={wrap}>
      {/* Top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: D.panel, borderBottom: `1px solid ${D.border}`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: D.text }}>Media Gallery</div>
          <div style={{ fontSize: 12.5, color: D.sub, marginTop: 2 }}>Images, videos, audio &amp; documents — chatbot mein bhejne ke liye</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,application/pdf" onChange={onFiles} style={{ display: "none" }} />
          <button className="cs-pub" style={primary} onClick={() => !uploading && fileRef.current?.click()}>{uploading ? "Uploading…" : "⬆ Upload media"}</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, padding: "16px 24px 0", flexWrap: "wrap" }}>
        {filters.map(([key, lbl]) => {
          const active = filter === key;
          const n = key === "all" ? (media || []).length : (counts[key] || 0);
          return (
            <button key={key} onClick={() => setFilter(key)} style={{ padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: T.font, border: `1px solid ${active ? "#3b82f6" : D.border}`, background: active ? hexA("#3b82f6", .18) : D.panel2, color: active ? "#93c5fd" : D.sub }}>
              {lbl}{media ? ` · ${n}` : ""}
            </button>
          );
        })}
      </div>

      {msg && <div style={{ margin: "14px 24px 0", padding: "10px 14px", background: hexA("#f43f5e", .12), border: `1px solid ${hexA("#f43f5e", .4)}`, color: "#fda4af", borderRadius: 8, fontSize: 13 }}>{msg}</div>}

      {/* Grid */}
      <div style={{ padding: 24 }}>
        {media === null && <div style={{ color: D.sub, fontSize: 14, padding: 20 }}>Loading…</div>}
        {media && list.length === 0 && (
          <div style={{ border: `1px dashed ${D.border}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", color: D.sub, background: D.panel2 }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🖼️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: D.text, marginBottom: 4 }}>{filter === "all" ? "Abhi koi media nahi" : "Is type ki koi file nahi"}</div>
            <div style={{ fontSize: 13 }}>Upar “Upload media” se files add karein.</div>
          </div>
        )}
        {media && list.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 16 }}>
            {list.map((m) => {
              const meta = GTYPE[m.type] || GTYPE.document;
              const name = m.original_name || m.filename || "file";
              return (
                <div key={m.id} className="cs-gcard" style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 26px rgba(0,0,0,.5)", transition: "transform .15s, border-color .15s, box-shadow .15s" }}>
                  <div style={{ position: "relative", height: 150, background: D.input, display: "grid", placeItems: "center", overflow: "hidden" }}>
                    {m.type === "image" ? (
                      <img src={m.url} alt={name} onClick={() => setPreview(m)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }} />
                    ) : m.type === "video" ? (
                      <video src={m.url} preload="metadata" muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ fontSize: 44 }}>{meta.icon}</div>
                    )}
                    <span style={{ position: "absolute", top: 8, left: 8, padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: hexA(meta.color, .22), color: meta.color, border: `1px solid ${hexA(meta.color, .5)}` }}>{meta.label}</span>
                  </div>
                  <div style={{ padding: "10px 12px 12px" }}>
                    <div title={name} style={{ fontSize: 13, fontWeight: 600, color: D.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                    <div style={{ fontSize: 11, color: D.faint, marginTop: 2 }}>{fmtSize(m.size)}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => doCopy(m)} style={{ flex: 1, padding: "7px 8px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: T.font, border: `1px solid ${D.border}`, background: copiedId === m.id ? hexA("#22c55e", .18) : D.panel2, color: copiedId === m.id ? "#4ade80" : D.text }}>{copiedId === m.id ? "✓ Copied" : "🔗 Copy link"}</button>
                      <button onClick={() => setConfirmDel(m)} title="Delete" style={{ width: 36, padding: "7px 0", borderRadius: 7, cursor: "pointer", fontSize: 13, border: "1px solid rgba(244,63,94,.5)", background: "rgba(244,63,94,.08)", color: "#fb7185" }}>🗑</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete modal (iframe-safe, no confirm()) */}
      {confirmDel && (
        <div onClick={() => setConfirmDel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: D.panel, border: `1px solid ${D.border}`, borderRadius: 14, padding: 22, width: 360, maxWidth: "100%", fontFamily: T.font, boxShadow: "0 24px 60px rgba(0,0,0,.7)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: D.text, marginBottom: 8 }}>Delete media?</div>
            <div style={{ fontSize: 13, color: D.sub, marginBottom: 18 }}>“{confirmDel.original_name || confirmDel.filename || "file"}” permanently delete ho jayegi.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDel(null)} style={{ padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: T.font, border: `1px solid ${D.border}`, background: D.panel2, color: D.text }}>Cancel</button>
              <button onClick={doDelete} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: T.font, border: "none", background: "#dc2626", color: "#fff" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 210, padding: 24, cursor: "zoom-out" }}>
          <img src={preview.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,.8)" }} />
        </div>
      )}
    </div>
  );
}

// ===================== EDITOR (DARK premium canvas) =====================
function Editor({ flowId, onBack }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([startNode()]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("Loading…");
  const [name, setName] = useState("");
  const [flowStatus, setFlowStatus] = useState("draft");
  const idRef = useRef(1);

  useEffect(() => {
    (async () => {
      try { const j = await (await fetch(`${API}/api/flows/${flowId}`)).json(); setName(j.flow.name || ""); setFlowStatus(j.flow.status); const { nodes: n, edges: e } = fromEngineFormat(j.flow.definition || { start: null, nodes: {} }); setNodes(n); setEdges(e); idRef.current = n.length + 5; setStatus("Loaded"); } catch { setStatus("Load failed"); }
    })();
  }, [flowId]);

  const onConnect = useCallback((p) => setEdges((eds) => addEdge({ ...p, type: "deletable", animated: true }, eds)), [setEdges]);
  const onDeleteEdge = useCallback((id) => setEdges((es) => es.filter((e) => e.id !== id)), [setEdges]);
  const addNode = (kind) => { const id = `n${++idRef.current}`; setNodes((nds) => [...nds, { id, type: kind, position: { x: 340 + Math.random() * 60, y: 200 + nds.length * 40 }, data: defaultData(kind) }]); };
  const updateData = (id, patch) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  const selected = nodes.find((n) => n.id === selectedId) || null;

  async function save(publish) {
    const definition = toEngineFormat(nodes, edges);
    if (publish && !definition.start) { setStatus("⚠️ Start ko kisi node se connect karein"); return; }
    setStatus(publish ? "Publishing…" : "Saving…");
    try {
      await fetch(`${API}/api/flows/${flowId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, definition }) });
      if (publish) { const j = await (await fetch(`${API}/api/flows/${flowId}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json(); if (j.ok) { setFlowStatus("published"); setStatus("✅ Published (live)"); } else setStatus("Error: " + (j.error || "")); }
      else setStatus("✅ Saved (draft)");
    } catch { setStatus("Save failed"); }
  }
  async function unpublish() { try { const j = await (await fetch(`${API}/api/flows/${flowId}/unpublish`, { method: "POST" })).json(); if (j.ok) { setFlowStatus("draft"); setStatus("Unpublished"); } } catch { setStatus("Failed"); } }

  const dGhost = { padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: T.font, border: `1px solid ${D.border}`, background: D.panel2, color: D.text };
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", fontFamily: T.font, background: D.bg }}>
      <div style={{ height: 56, background: D.panel, borderBottom: `1px solid ${D.border}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <button onClick={onBack} style={dGhost}>← Back</button>
        <input className="cs-in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chatbot ka naam" style={{ borderRadius: 8, padding: "7px 10px", fontSize: 14, fontWeight: 600, fontFamily: T.font, minWidth: 200 }} />
        <span style={{ fontSize: 12, color: D.sub }}>{status}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {flowStatus === "published" && <button onClick={unpublish} style={{ ...dGhost, color: D.sub }}>Unpublish</button>}
          <button onClick={() => save(false)} style={dGhost}>Save Draft</button>
          <button className="cs-pub" onClick={() => save(true)} style={{ padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: T.font, border: "none", background: "#16A34A", color: "#fff", fontWeight: 700, boxShadow: "0 0 16px rgba(34,197,94,.45)" }}>Publish</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: 214, background: D.panel, borderRight: `1px solid ${D.border}`, padding: 12, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: D.faint, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Actions</div>
          {PALETTE.map((p) => (
            <button key={p.kind} className="cs-pal" onClick={() => addNode(p.kind)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginBottom: 8, padding: "11px 12px", border: `1px solid ${D.border}`, borderLeft: `3px solid ${p.color}`, borderRadius: 10, background: D.panel2, color: D.text, cursor: "pointer", fontSize: 13, fontFamily: T.font, transition: "all .15s" }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", background: hexA(p.color, .16), color: p.color, boxShadow: `0 0 10px ${hexA(p.color, .4)}`, fontSize: 12 }}>{p.icon}</span>
              {p.label}
            </button>
          ))}
          <div style={{ fontSize: 11, color: D.faint, marginTop: 14, lineHeight: 1.6 }}>Node add karein, dots se connect karein. Line ke beech <b style={{ color: "#fb7185" }}>✕</b> se connection hatega.</div>
        </div>

        <div style={{ flex: 1, background: D.bg, backgroundImage: "radial-gradient(circle at 30% 20%, rgba(99,102,241,.06), transparent 40%), radial-gradient(circle at 80% 80%, rgba(34,211,238,.05), transparent 40%)" }}>
          <EdgeCtx.Provider value={{ onDeleteEdge }}>
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} edgeTypes={edgeTypes} defaultEdgeOptions={{ type: "deletable", animated: true }} onNodeClick={(_, n) => setSelectedId(n.id)} onPaneClick={() => setSelectedId(null)} fitView>
              <Background color="#1b2433" gap={18} size={1.3} />
              <Controls />
              <MiniMap pannable zoomable nodeColor={(n) => NC[n.type] || "#3b82f6"} maskColor="rgba(4,7,12,.65)" />
            </ReactFlow>
          </EdgeCtx.Provider>
        </div>

        <div style={{ width: 294, background: D.panel, borderLeft: `1px solid ${D.border}`, padding: 16, overflowY: "auto" }}>
          {!selected && <div style={{ color: D.faint, fontSize: 13 }}>Koi node select karein editing ke liye.</div>}
          {selected && selected.type === "start" && (<Ed title="⚡ On Message (Start)"><Lb>Keywords (optional)</Lb><In value={selected.data.keywords || ""} onChange={(v) => updateData(selected.id, { keywords: v })} placeholder="hi, hello, menu" /><Hn>Start ko kisi node se connect karein.</Hn></Ed>)}
          {selected && selected.type === "text" && (<Ed title="💬 Send Text"><Lb>Message</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /></Ed>)}
          {selected && selected.type === "buttons" && (<Ed title="🔘 Send Buttons"><Lb>Body text</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /><Lb>Buttons</Lb>
            {(selected.data.buttons || []).map((b, i) => (<div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}><In value={b.title} onChange={(v) => { const arr = [...selected.data.buttons]; arr[i] = { ...arr[i], title: v }; updateData(selected.id, { buttons: arr }); }} placeholder={`Button ${i + 1}`} /><button onClick={() => { const arr = selected.data.buttons.filter((_, j) => j !== i); updateData(selected.id, { buttons: arr }); }} style={{ border: "1px solid rgba(244,63,94,.5)", color: "#fb7185", background: "transparent", borderRadius: 6, cursor: "pointer", padding: "0 10px" }}>✕</button></div>))}
            <button onClick={() => updateData(selected.id, { buttons: [...(selected.data.buttons || []), { title: "" }] })} style={{ marginTop: 4, padding: "8px 12px", border: "1px dashed #22c55e", color: "#4ade80", background: "rgba(34,197,94,.08)", borderRadius: 8, cursor: "pointer", width: "100%" }}>+ Add Button</button><Hn>Har button ke right dot ko agle node se connect karein.</Hn></Ed>)}
          {selected && selected.type === "question" && (<Ed title="❓ Ask Question"><Lb>Sawaal</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /><Lb>Jawab kis naam se save ho</Lb><In value={selected.data.saveAs || ""} onChange={(v) => updateData(selected.id, { saveAs: v })} placeholder="naam, email…" /></Ed>)}
          {selected && selected.type === "stop" && (<Ed title="🛑 Stop / Talk to Human"><Lb>Message (optional)</Lb><Ar value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /></Ed>)}
          {selected && selected.deletable !== false && (<button onClick={() => { setNodes((nds) => nds.filter((n) => n.id !== selected.id)); setEdges((e) => e.filter((ed) => ed.source !== selected.id && ed.target !== selected.id)); setSelectedId(null); }} style={{ marginTop: 16, width: "100%", padding: "9px 12px", border: "1px solid rgba(244,63,94,.5)", color: "#fb7185", background: "rgba(244,63,94,.08)", borderRadius: 8, cursor: "pointer" }}>Delete node</button>)}
        </div>
      </div>
    </div>
  );
}

function Ed({ title, children }) { return (<div><div style={{ fontWeight: 700, marginBottom: 12, color: D.text }}>{title}</div>{children}</div>); }
function Lb({ children }) { return <div style={{ fontSize: 12, fontWeight: 600, color: D.sub, margin: "10px 0 4px" }}>{children}</div>; }
function Hn({ children }) { return <div style={{ fontSize: 11, color: D.faint, marginTop: 8, lineHeight: 1.5 }}>{children}</div>; }
function In({ value, onChange, placeholder }) { return (<input className="cs-in" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: T.font }} />); }
function Ar({ value, onChange }) { return (<textarea className="cs-in" value={value} onChange={(e) => onChange(e.target.value)} rows={4} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: T.font }} />); }
