import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Save, ToggleLeft, ToggleRight, ArrowLeft, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { getFlow, saveFlow, toggleFlow } from "../api";
import Button from "../components/ui/Button";
import { nodeTypes, NODE_CATEGORIES, NODE_META } from "../components/flow/NodeTypes";
import ConfigPanel from "../components/flow/ConfigPanel";

let nodeIdCounter = 100;

export default function FlowBuilder() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { workspace } = useAuthStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [flowName, setFlowName] = useState("Untitled Flow");
  const [isActive, setIsActive] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!workspace || !flowId) return;
    getFlow(workspace.id, flowId).then((data) => {
      setFlowName(data.name);
      setIsActive(data.is_active);
      if (data.nodes?.length) setNodes(data.nodes);
      if (data.edges?.length) setEdges(data.edges);
    });
  }, [workspace?.id, flowId]);

  const onConnect = useCallback(
    (conn: Connection) => setEdges((eds) => addEdge({ ...conn, animated: true, style: { stroke: "#22c55e" } }, eds)),
    []
  );

  const onNodeClick = useCallback((_: any, node: Node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("nodeType");
    const label = e.dataTransfer.getData("nodeLabel");
    if (!type) return;
    const bounds = (e.target as HTMLElement).closest(".react-flow")?.getBoundingClientRect();
    if (!bounds) return;
    const newNode: Node = {
      id: `node_${++nodeIdCounter}`,
      type,
      position: { x: e.clientX - bounds.left - 95, y: e.clientY - bounds.top - 30 },
      data: { label },
    };
    setNodes((nds) => [...nds, newNode]);
  }, []);

  const onNodeDataChange = useCallback((id: string, data: object) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
    setSelectedNode((prev) => prev?.id === id ? { ...prev, data: { ...prev.data, ...data } } : prev);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => handleSave(), 2000);
  }, []);

  const handleSave = async () => {
    if (!workspace || !flowId) return;
    setSaving(true);
    try {
      await saveFlow(workspace.id, flowId, { name: flowName, nodes, edges });
    } finally { setSaving(false); }
  };

  const handleToggle = async () => {
    if (!workspace || !flowId) return;
    const updated = await toggleFlow(workspace.id, flowId);
    setIsActive(updated.is_active);
  };

  const toggleCategory = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div className="flex flex-col h-full -m-6 overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0 z-10">
        <button onClick={() => navigate("/automations")} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={18} />
        </button>
        <input
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          className="font-semibold text-gray-900 bg-transparent border-none outline-none text-sm w-52"
        />
        <div className="flex-1" />
        <span className="text-xs text-gray-400 hidden sm:block">
          {nodes.length} nodes · {edges.length} connections
        </span>
        <button
          onClick={handleToggle}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-green-600"
        >
          {isActive
            ? <ToggleRight size={20} className="text-green-600" />
            : <ToggleLeft size={20} />}
          <span className="text-xs">{isActive ? "Active" : "Inactive"}</span>
        </button>
        <Button size="sm" onClick={handleSave} loading={saving}>
          <Save size={14} /> Save
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Node Palette ── */}
        <div className="w-52 border-r border-gray-200 bg-white flex-shrink-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Node Library</p>
            {NODE_CATEGORIES.map((cat) => (
              <div key={cat.category} className="mb-2">
                <button
                  onClick={() => toggleCategory(cat.category)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-gray-500 uppercase tracking-wide py-1 hover:text-gray-700"
                >
                  {cat.category}
                  {collapsed[cat.category]
                    ? <ChevronRight size={12} />
                    : <ChevronDown size={12} />}
                </button>
                {!collapsed[cat.category] && (
                  <div className="space-y-1 mt-1">
                    {cat.nodes.map(({ type, label, icon: Icon, bg, text }) => (
                      <div
                        key={type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("nodeType", type);
                          e.dataTransfer.setData("nodeLabel", label);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 cursor-grab hover:border-gray-300 hover:shadow-sm transition-all bg-white"
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${bg}`}>
                          <Icon size={11} className={text} />
                        </div>
                        <span className="text-gray-700 text-xs truncate">{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Canvas ── */}
        <div className="flex-1 relative" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            className="bg-gray-50"
          >
            <Background gap={20} color="#e5e7eb" />
            <Controls />
            <MiniMap
              nodeColor={(n) => NODE_META[n.type ?? ""]?.text?.replace("text-", "#") ?? "#22c55e"}
              className="!bg-white !border !border-gray-200 !rounded-lg"
            />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400">
                <Zap size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Drag nodes from the left panel</p>
                <p className="text-xs mt-1 opacity-70">Start with a Trigger node, then add actions</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Config Panel ── */}
        {selectedNode && (
          <ConfigPanel
            node={selectedNode}
            onChange={onNodeDataChange}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
