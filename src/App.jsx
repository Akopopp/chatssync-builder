import { useCallback, useRef, useState, useEffect } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Handle, Position,
} from "reactflow";
import "reactflow/dist/style.css";

// Engine API base + account (env se; fallback hardcoded)
const API = (import.meta.env.VITE_API_URL || "https://kkzof1hiq0af5vngi0v689zi.5.75.237.171.sslip.io").replace(/\/$/, "");
const ACCOUNT_ID = parseInt(import.meta.env.VITE_ACCOUNT_ID || "3", 10);

const C = { start: "#0EA5E9", text: "#2781F6", buttons: "#16A34A", question: "#9333EA", stop: "#DC2626" };
const box = (sel) => ({ background: "#fff", borderRadius: 10, width: 230, border: sel ? "2px solid #2781F6" : "1px solid #e2e8f0", boxShadow: "0 2px 6px rgba(0,0,0,.12)", fontFamily: "Arial, sans-serif", fontSize: 12, overflow: "hidden" });
const head = (bg) => ({ background: bg, color: "#fff", padding: "8px 10px", fontWeight: 700, fontSize: 12 });
const body = { padding: 10, color: "#334155", whiteSpace: "pre-wrap", minHeight: 18, lineHeight: 1.4 };
const btnRow = { position: "relative", margin: "6px 10px", padding: "6px 24px 6px 8px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#f1f5f9", color: "#1e293b" };

function StartNode({ data }) {
  return (<div style={box(false)}><div style={head(C.start)}>⚡ On Message (Start)</div><div style={body}>{data.keywords ? `Keywords: ${data.keywords}` : "Pehle message par flow shuru"}</div><Handle type="source" position={Position.Bottom} /></div>);
}
function TextNode({ data, selected }) {
  return (<div style={box(selected)}><Handle type="target" position={Position.Top} /><div style={head(C.text)}>💬 Send Text</div><div style={body}>{data.text || "…"}</div><Handle type="source" position={Position.Bottom} /></div>);
}
function ButtonsNode({ data, selected }) {
  const buttons = data.buttons || [];
  return (<div style={box(selected)}><Handle type="target" position={Position.Top} /><div style={head(C.buttons)}>🔘 Send Buttons</div><div style={body}>{data.text || "…"}</div>
    {buttons.map((b, i) => (<div key={i} style={btnRow}>{b.title || `Button ${i + 1}`}<Handle type="source" position={Position.Right} id={`btn-${i}`} style={{ top: "50%", right: -7, transform: "translateY(-50%)", background: C.buttons, width: 10, height: 10 }} /></div>))}
    <div style={{ height: 6 }} /></div>);
}
function QuestionNode({ data, selected }) {
  return (<div style={box(selected)}><Handle type="target" position={Position.Top} /><div style={head(C.question)}>❓ Ask Question</div><div style={body}>{data.text || "…"}{data.saveAs ? <div style={{ marginTop: 6, fontSize: 11, color: "#7c3aed" }}>→ save as: {data.saveAs}</div> : null}</div><Handle type="source" position={Position.Bottom} /></div>);
}
function StopNode({ data, selected }) {
  return (<div style={box(selected)}><Handle type="target" position={Position.Top} /><div style={head(C.stop)}>🛑 Stop / Talk to Human</div><div style={body}>{data.text || "(koi message nahi)"}</div></div>);
}
const nodeTypes = { start: StartNode, text: TextNode, buttons: ButtonsNode, question: QuestionNode, stop: StopNode };

function defaultData(kind) {
  if (kind === "text") return { text: "Apna message yahan likhein…" };
  if (kind === "buttons") return { text: "Customer ko kya poochna hai?", buttons: [{ title: "Option 1" }, { title: "Option 2" }] };
  if (kind === "question") return { text: "Aapka sawaal…", saveAs: "answer" };
  if (kind === "stop") return { text: "Aapko ek agent se jod rahe hain 🙌" };
  return {};
}
const PALETTE = [
  { kind: "text", label: "💬 Send Text", color: C.text },
  { kind: "buttons", label: "🔘 Send Buttons", color: C.buttons },
  { kind: "question", label: "❓ Ask Question", color: C.question },
  { kind: "stop", label: "🛑 Stop / Human", color: C.stop },
];
const initialNodes = [{ id: "start", type: "start", position: { x: 320, y: 40 }, data: { keywords: "" }, deletable: false }];

// ============ CONVERTERS ============
// Builder (nodes+edges) -> engine format {start, nodes}
function toEngineFormat(nodes, edges) {
  const def = { start: null, nodes: {} };
  // edge map: source(+handle) -> target
  const plainNext = {}; // nodeId -> targetId (single handle: text/question/start)
  const btnNext = {};   // nodeId -> { handleId -> targetId }
  for (const e of edges) {
    if (e.sourceHandle && e.sourceHandle.startsWith("btn-")) {
      btnNext[e.source] = btnNext[e.source] || {};
      btnNext[e.source][e.sourceHandle] = e.target;
    } else {
      plainNext[e.source] = e.target;
    }
  }
  // start = jis node se "start" connect hota hai
  def.start = plainNext["start"] || null;

  for (const n of nodes) {
    if (n.type === "start") continue;
    if (n.type === "text") {
      def.nodes[n.id] = { type: "text", text: n.data.text || "", next: plainNext[n.id] || null };
    } else if (n.type === "question") {
      def.nodes[n.id] = { type: "question", text: n.data.text || "", save_as: n.data.saveAs || "answer", next: plainNext[n.id] || null };
    } else if (n.type === "stop") {
      def.nodes[n.id] = { type: "handover", text: n.data.text || "" };
    } else if (n.type === "buttons") {
      const buttons = (n.data.buttons || []).map((b, i) => ({ title: b.title || `Button ${i + 1}`, next: (btnNext[n.id] || {})[`btn-${i}`] || null }));
      def.nodes[n.id] = { type: "buttons", text: n.data.text || "", buttons };
    }
  }
  return def;
}

// Engine format -> builder (nodes+edges) for loading
function fromEngineFormat(def) {
  const nodes = [{ id: "start", type: "start", position: { x: 320, y: 40 }, data: { keywords: "" }, deletable: false }];
  const edges = [];
  let y = 200;
  const ids = Object.keys(def.nodes || {});
  ids.forEach((id, idx) => {
    const node = def.nodes[id];
    const kind = node.type === "handover" ? "stop" : node.type;
    const data = {};
    if (kind === "text") data.text = node.text || "";
    if (kind === "question") { data.text = node.text || ""; data.saveAs = node.save_as || "answer"; }
    if (kind === "stop") data.text = node.text || "";
    if (kind === "buttons") { data.text = node.text || ""; data.buttons = (node.buttons || []).map((b) => ({ title: b.title })); }
    nodes.push({ id, type: kind, position: { x: 320 + (idx % 2) * 300, y: y + idx * 120 }, data });

    // edges
    if (kind === "buttons") {
      (node.buttons || []).forEach((b, i) => { if (b.next) edges.push({ id: `e-${id}-${i}`, source: id, sourceHandle: `btn-${i}`, target: b.next, animated: true }); });
    } else if (node.next) {
      edges.push({ id: `e-${id}`, source: id, target: node.next, animated: true });
    }
  });
  // start edge
  if (def.start) edges.push({ id: "e-start", source: "start", target: def.start, animated: true });
  return { nodes, edges };
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("Loading…");
  const idRef = useRef(1);

  // Load existing flow on open
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/flow?account_id=${ACCOUNT_ID}`);
        const j = await r.json();
        if (j.flow && j.flow.definition) {
          const { nodes: n, edges: e } = fromEngineFormat(j.flow.definition);
          setNodes(n); setEdges(e);
          // id counter ko bara karo taake naye ids clash na karein
          idRef.current = n.length + 5;
          setStatus(`Loaded (${j.flow.status})`);
        } else {
          setStatus("New flow");
        }
      } catch (err) {
        setStatus("Load failed");
        console.error(err);
      }
    })();
  }, []);

  const onConnect = useCallback((p) => setEdges((eds) => addEdge({ ...p, animated: true }, eds)), [setEdges]);

  const addNode = (kind) => {
    const id = `n${++idRef.current}`;
    setNodes((nds) => [...nds, { id, type: kind, position: { x: 320 + Math.random() * 60, y: 200 + nds.length * 40 }, data: defaultData(kind) }]);
  };
  const updateData = (id, patch) => setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  const selected = nodes.find((n) => n.id === selectedId) || null;

  async function save(publish) {
    const definition = toEngineFormat(nodes, edges);
    if (!definition.start) { setStatus("⚠️ Start kisi node se connect karein"); return; }
    setStatus(publish ? "Publishing…" : "Saving…");
    try {
      const r = await fetch(`${API}/api/flow`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: ACCOUNT_ID, name: "My flow", definition, publish }),
      });
      const j = await r.json();
      if (j.ok) setStatus(publish ? "✅ Published (live)" : "✅ Saved (draft)");
      else setStatus("Error: " + (j.error || "unknown"));
    } catch (err) { setStatus("Save failed"); console.error(err); }
  }

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "Arial, sans-serif" }}>
      <div style={{ height: 48, background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <b>ChatsSync Builder</b>
        <span style={{ fontSize: 12, opacity: .6 }}>{status}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => save(false)} style={{ padding: "7px 14px", border: "1px solid #475569", background: "#1e293b", color: "#fff", borderRadius: 7, cursor: "pointer", fontSize: 13 }}>Save Draft</button>
          <button onClick={() => save(true)} style={{ padding: "7px 16px", border: "none", background: "#16A34A", color: "#fff", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Publish</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: 210, background: "#f8fafc", borderRight: "1px solid #e2e8f0", padding: 12, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase" }}>Actions</div>
          {PALETTE.map((p) => (
            <button key={p.kind} onClick={() => addNode(p.kind)} style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8, padding: "10px 12px", border: "1px solid #e2e8f0", borderLeft: `4px solid ${p.color}`, borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13, color: "#1e293b" }}>{p.label}</button>
          ))}
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 12, lineHeight: 1.5 }}>Node add → connect → edit. Phir <b>Publish</b> dabायें — bot live chalega.</div>
        </div>

        <div style={{ flex: 1, background: "#0f1115" }}>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} onNodeClick={(_, n) => setSelectedId(n.id)} onPaneClick={() => setSelectedId(null)} fitView>
            <Background color="#333" gap={16} /><Controls /><MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        <div style={{ width: 290, background: "#fff", borderLeft: "1px solid #e2e8f0", padding: 16, overflowY: "auto" }}>
          {!selected && <div style={{ color: "#94a3b8", fontSize: 13 }}>Koi node select karein editing ke liye.</div>}
          {selected && selected.type === "start" && (<Editor title="On Message (Start)"><Label>Keywords (optional)</Label><Input value={selected.data.keywords || ""} onChange={(v) => updateData(selected.id, { keywords: v })} placeholder="hi, hello, menu" /><Hint>Start ko kisi node se connect karein — wahीं se flow shuru hoga.</Hint></Editor>)}
          {selected && selected.type === "text" && (<Editor title="💬 Send Text"><Label>Message</Label><Area value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /></Editor>)}
          {selected && selected.type === "buttons" && (<Editor title="🔘 Send Buttons"><Label>Body text</Label><Area value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /><Label>Buttons</Label>
            {(selected.data.buttons || []).map((b, i) => (<div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}><Input value={b.title} onChange={(v) => { const arr = [...selected.data.buttons]; arr[i] = { ...arr[i], title: v }; updateData(selected.id, { buttons: arr }); }} placeholder={`Button ${i + 1}`} /><button onClick={() => { const arr = selected.data.buttons.filter((_, j) => j !== i); updateData(selected.id, { buttons: arr }); }} style={{ border: "1px solid #fca5a5", color: "#dc2626", background: "#fff", borderRadius: 6, cursor: "pointer", padding: "0 10px" }}>✕</button></div>))}
            <button onClick={() => updateData(selected.id, { buttons: [...(selected.data.buttons || []), { title: "" }] })} style={{ marginTop: 4, padding: "8px 12px", border: "1px dashed #16A34A", color: "#16A34A", background: "#f0fdf4", borderRadius: 8, cursor: "pointer", width: "100%" }}>+ Add Button</button><Hint>Har button ke right dot ko agle node se connect karein.</Hint></Editor>)}
          {selected && selected.type === "question" && (<Editor title="❓ Ask Question"><Label>Sawaal</Label><Area value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /><Label>Jawab kis naam se save ho</Label><Input value={selected.data.saveAs || ""} onChange={(v) => updateData(selected.id, { saveAs: v })} placeholder="naam, email…" /></Editor>)}
          {selected && selected.type === "stop" && (<Editor title="🛑 Stop / Talk to Human"><Label>Message (optional)</Label><Area value={selected.data.text || ""} onChange={(v) => updateData(selected.id, { text: v })} /></Editor>)}
          {selected && selected.deletable !== false && (<button onClick={() => { setNodes((nds) => nds.filter((n) => n.id !== selected.id)); setEdges((e) => e.filter((ed) => ed.source !== selected.id && ed.target !== selected.id)); setSelectedId(null); }} style={{ marginTop: 16, width: "100%", padding: "8px 12px", border: "1px solid #fca5a5", color: "#dc2626", background: "#fef2f2", borderRadius: 8, cursor: "pointer" }}>Delete node</button>)}
        </div>
      </div>
    </div>
  );
}

function Editor({ title, children }) { return (<div><div style={{ fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>{title}</div>{children}</div>); }
function Label({ children }) { return <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", margin: "10px 0 4px" }}>{children}</div>; }
function Hint({ children }) { return <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>{children}</div>; }
function Input({ value, onChange, placeholder }) { return (<input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />); }
function Area({ value, onChange }) { return (<textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: "Arial, sans-serif" }} />); }
