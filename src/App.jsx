import { useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";

// Test ke liye 2 dummy nodes (taake canvas par kuch dikhe)
const initialNodes = [
  { id: "1", position: { x: 250, y: 80 }, data: { label: "Start" }, type: "input" },
  { id: "2", position: { x: 250, y: 240 }, data: { label: "Send Text" } },
];
const initialEdges = [{ id: "e1-2", source: "1", target: "2" }];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0f1115" }}>
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          color: "#fff",
          fontFamily: "Arial, sans-serif",
          fontWeight: 700,
          fontSize: 18,
        }}
      >
        ChatsSync Builder
        <span style={{ fontWeight: 400, fontSize: 13, opacity: 0.6, marginLeft: 8 }}>
          (canvas test)
        </span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background color="#333" gap={16} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
