"use client";

import { useState, useRef, useEffect } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type Cytoscape from "cytoscape";
import { dijkstra, type GraphEdge } from "@/lib/dijkstra";

interface Node {
  id: string;
  label: string;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  weight: number;
}

export default function ShortPathPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [startNode, setStartNode] = useState<string>("");
  const [endNode, setEndNode] = useState<string>("");
  const [shortestPath, setShortestPath] = useState<string[]>([]);
  const [shortestDistance, setShortestDistance] = useState<number | null>(null);
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newEdgeSource, setNewEdgeSource] = useState("");
  const [newEdgeTarget, setNewEdgeTarget] = useState("");
  const [newEdgeWeight, setNewEdgeWeight] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cyRef = useRef<Cytoscape.Core | null>(null);

  // Calcular caminho mais curto sempre que mudar
  useEffect(() => {
    if (startNode && endNode && edges.length > 0) {
      calculateShortestPath();
    } else {
      setShortestPath([]);
      setShortestDistance(null);
    }
  }, [edges, startNode, endNode]);

  // Ajustar layout do cytoscape quando entrar/sair de tela cheia
  useEffect(() => {
    if (cyRef.current && isFullscreen) {
      setTimeout(() => {
        cyRef.current?.fit();
        cyRef.current?.center();
      }, 100);
    }
  }, [isFullscreen]);

  const calculateShortestPath = () => {
    if (!startNode || !endNode || edges.length === 0) {
      setShortestPath([]);
      setShortestDistance(null);
      return;
    }

    const graphEdges: GraphEdge[] = edges.map((edge) => ({
      from: edge.source,
      to: edge.target,
      weight: edge.weight,
    }));

    const result = dijkstra(graphEdges, startNode, endNode);

    if (result) {
      setShortestPath(result.path);
      setShortestDistance(result.distance);
    } else {
      setShortestPath([]);
      setShortestDistance(null);
    }
  };

  const addNode = () => {
    if (!newNodeLabel.trim()) return;
    const nodeId = newNodeLabel.trim().toUpperCase();
    
    // Verificar se já existe
    if (nodes.some((n) => n.id === nodeId)) {
      alert("Nó já existe!");
      return;
    }

    setNodes([...nodes, { id: nodeId, label: nodeId }]);
    setNewNodeLabel("");
  };

  const addEdge = () => {
    if (!newEdgeSource || !newEdgeTarget || !newEdgeWeight) return;
    
    const source = newEdgeSource.trim().toUpperCase();
    const target = newEdgeTarget.trim().toUpperCase();
    const weight = parseFloat(newEdgeWeight);

    if (isNaN(weight) || weight < 0) {
      alert("Peso deve ser um número positivo!");
      return;
    }

    // Verificar se os nós existem
    if (!nodes.some((n) => n.id === source) || !nodes.some((n) => n.id === target)) {
      alert("Um ou ambos os nós não existem!");
      return;
    }

    // Verificar se já existe aresta entre esses nós
    const edgeId = `${source}-${target}`;
    const reverseEdgeId = `${target}-${source}`;
    if (
      edges.some((e) => e.id === edgeId || e.id === reverseEdgeId)
    ) {
      alert("Aresta já existe entre esses nós!");
      return;
    }

    setEdges([
      ...edges,
      { id: edgeId, source, target, weight },
    ]);
    setNewEdgeSource("");
    setNewEdgeTarget("");
    setNewEdgeWeight("");
  };

  const removeNode = (nodeId: string) => {
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (startNode === nodeId) setStartNode("");
    if (endNode === nodeId) setEndNode("");
  };

  const removeEdge = (edgeId: string) => {
    setEdges(edges.filter((e) => e.id !== edgeId));
  };

  const loadInitialData = () => {
    const initialNodes: Node[] = [
      { id: "A", label: "A" },
      { id: "B", label: "B" },
      { id: "C", label: "C" },
      { id: "D", label: "D" },
      { id: "E", label: "E" },
      { id: "F", label: "F" },
    ];
    const initialEdges: Edge[] = [
      { id: "A-B", source: "A", target: "B", weight: 2 },
      { id: "B-D", source: "B", target: "D", weight: 1 },
      { id: "D-F", source: "D", target: "F", weight: 4 },
      { id: "A-C", source: "A", target: "C", weight: 5 },
      { id: "B-E", source: "B", target: "E", weight: 3 },
      { id: "C-E", source: "C", target: "E", weight: 1 },
      { id: "E-F", source: "E", target: "F", weight: 2 },
    ];
    setNodes(initialNodes);
    setEdges(initialEdges);
    setStartNode("A");
    setEndNode("F");
  };

  // Estilos do cytoscape
  const cyStylesheet: cytoscape.Stylesheet[] = [
    {
      selector: "node",
      style: {
        "background-color": "#5b5b5b",
        label: "data(label)",
        color: "white",
        width: 50,
        height: 50,
        "text-valign": "center",
        "text-halign": "center",
        "font-size": "16px",
        "font-weight": "bold",
        shape: "ellipse",
      },
    },
    {
      selector: "edge",
      style: {
        "line-color": "#777",
        width: 2,
        "target-arrow-color": "#777",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        label: "data(weight)",
        "font-size": "12px",
        "text-rotation": "autorotate",
        "text-margin-y": -10,
        color: "#999",
      },
    },
    {
      selector: "node:selected",
      style: {
        "background-color": "#3b82f6",
        "border-width": 3,
        "border-color": "#60a5fa",
      },
    },
    {
      selector: ".shortest-path-node",
      style: {
        "background-color": "#10b981",
        "border-width": 3,
        "border-color": "#34d399",
      },
    },
    {
      selector: ".shortest-path-edge",
      style: {
        "line-color": "#10b981",
        width: 4,
        "target-arrow-color": "#10b981",
      },
    },
  ];

  const cyLayout = {
    name: "cose",
    animate: true,
    animationDuration: 1000,
    fit: true,
    padding: 50,
  };

  // Preparar elementos do cytoscape
  const cyElements = [
    ...nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
      },
      classes: shortestPath.includes(node.id) ? "shortest-path-node" : "",
    })),
    ...edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
      },
      classes: isEdgeInShortestPath(edge) ? "shortest-path-edge" : "",
    })),
  ];

  function isEdgeInShortestPath(edge: Edge): boolean {
    if (shortestPath.length < 2) return false;
    for (let i = 0; i < shortestPath.length - 1; i++) {
      if (
        (shortestPath[i] === edge.source && shortestPath[i + 1] === edge.target) ||
        (shortestPath[i] === edge.target && shortestPath[i + 1] === edge.source)
      ) {
        return true;
      }
    }
    return false;
  }

  // Modo tela cheia
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col">
        {/* Header minimalista em tela cheia */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={() => setIsFullscreen(false)}
            className="px-4 py-2 bg-zinc-900/90 border border-zinc-800 rounded-lg text-zinc-100 hover:bg-zinc-800 transition-colors backdrop-blur-sm"
          >
            Sair da Tela Cheia
          </button>
        </div>
        {/* Grafo em tela cheia */}
        <div className="w-full h-full p-4">
          {cyElements.length > 0 ? (
            <CytoscapeComponent
              elements={cyElements}
              style={{ width: "100%", height: "100%" }}
              stylesheet={cyStylesheet}
              layout={cyLayout}
              cy={(cy: Cytoscape.Core) => {
                cyRef.current = cy;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400">
              Adicione nós e arestas para visualizar o grafo
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex-shrink-0">
        <div className="container mx-auto px-4 py-3 max-w-[1920px]">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Caminho Mais Curto - Algoritmo de Dijkstra
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 max-w-[1920px] flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Coluna 1: Visualização do Grafo */}
          <div className="lg:col-span-2 flex flex-col gap-4 h-full overflow-hidden">
            {/* Grafo */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm shadow-2xl flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h2 className="text-xl font-semibold text-zinc-100">
                  Visualização do Grafo
                </h2>
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors text-sm flex items-center gap-2"
                  title="Abrir em tela cheia"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  Tela Cheia
                </button>
              </div>
              <div className="bg-zinc-950 rounded-lg border border-zinc-800 flex-1 overflow-hidden shadow-inner min-h-0">
                {cyElements.length > 0 ? (
                  <CytoscapeComponent
                    elements={cyElements}
                    style={{ width: "100%", height: "100%" }}
                    stylesheet={cyStylesheet}
                    layout={cyLayout}
                    cy={(cy: Cytoscape.Core) => {
                      cyRef.current = cy;
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    Adicione nós e arestas para visualizar o grafo
                  </div>
                )}
              </div>
            </div>

            {/* Resultado do Caminho Mais Curto */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm shadow-xl flex-shrink-0">
              <h2 className="text-xl font-semibold text-zinc-100 mb-3">
                Caminho Mais Curto
              </h2>
              {shortestDistance !== null ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-400">Distância:</span>
                    <span className="text-green-400 font-bold text-2xl">
                      {shortestDistance}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-zinc-400">Caminho:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {shortestPath.map((node, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="px-3 py-1.5 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 font-semibold">
                            {node}
                          </span>
                          {index < shortestPath.length - 1 && (
                            <span className="text-zinc-500">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-zinc-400">
                  Não há caminho entre os nós selecionados.
                </p>
              )}
            </div>
          </div>

          {/* Coluna 2: Controles */}
          <div className="flex flex-col gap-4 h-full overflow-y-auto pr-2">
            {/* Botão Carregar Dados Iniciais */}
            {nodes.length === 0 && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm shadow-xl flex-shrink-0">
                <p className="text-sm text-zinc-400 mb-3 text-center">
                  Comece criando seus próprios nós e arestas, ou carregue um exemplo inicial.
                </p>
                <button
                  onClick={loadInitialData}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-lg transition-all text-sm"
                >
                  Carregar Dados Iniciais
                </button>
              </div>
            )}

            {/* Seleção de Nós - Compacto */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm shadow-xl flex-shrink-0">
              <h2 className="text-lg font-semibold text-zinc-100 mb-3">
                Caminho
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Inicial
                  </label>
                  <select
                    value={startNode}
                    onChange={(e) => setStartNode(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">--</option>
                    {nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Final
                  </label>
                  <select
                    value={endNode}
                    onChange={(e) => setEndNode(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">--</option>
                    {nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Adicionar Elementos - Agrupado */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm shadow-xl flex-shrink-0">
              <h2 className="text-lg font-semibold text-zinc-100 mb-3">
                Adicionar
              </h2>
              <div className="space-y-4">
                {/* Adicionar Nó */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Novo Nó
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newNodeLabel}
                      onChange={(e) => setNewNodeLabel(e.target.value)}
                      placeholder="Ex: G"
                      maxLength={5}
                      className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === "Enter" && addNode()}
                    />
                    <button
                      onClick={addNode}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all text-base"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Adicionar Aresta */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Nova Aresta
                  </label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newEdgeSource}
                        onChange={(e) => setNewEdgeSource(e.target.value)}
                        className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Origem</option>
                        {nodes.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newEdgeTarget}
                        onChange={(e) => setNewEdgeTarget(e.target.value)}
                        className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Destino</option>
                        {nodes.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={newEdgeWeight}
                        onChange={(e) => setNewEdgeWeight(e.target.value)}
                        placeholder="Peso"
                        min="0"
                        step="0.1"
                        className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === "Enter" && addEdge()}
                      />
                      <button
                        onClick={addEdge}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all text-base"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de Elementos - Com Tabs */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm shadow-xl flex-shrink-0">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <h2 className="text-lg font-semibold text-zinc-100">
                  Elementos
                </h2>
                <div className="flex gap-2 text-sm">
                  <span className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-sm">
                    {nodes.length} nós
                  </span>
                  <span className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded text-sm">
                    {edges.length} arestas
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Lista de Nós */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wide">
                    Nós
                  </h3>
                  <div className="space-y-2">
                    {nodes.length === 0 ? (
                      <p className="text-zinc-500 text-sm text-center py-4">
                        Nenhum nó
                      </p>
                    ) : (
                      nodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 hover:border-zinc-700 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              node.id === startNode ? 'bg-blue-500' :
                              node.id === endNode ? 'bg-green-500' :
                              'bg-zinc-600'
                            }`}></div>
                            <span className="text-zinc-100 font-medium text-sm">
                              {node.label}
                            </span>
                          </div>
                          <button
                            onClick={() => removeNode(node.id)}
                            className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm transition-colors"
                            title="Remover nó"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Lista de Arestas */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wide">
                    Arestas
                  </h3>
                  <div className="space-y-2">
                    {edges.length === 0 ? (
                      <p className="text-zinc-500 text-sm text-center py-4">
                        Nenhuma aresta
                      </p>
                    ) : (
                      edges.map((edge) => (
                        <div
                          key={edge.id}
                          className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 hover:border-zinc-700 transition-colors"
                        >
                          <span className="text-zinc-100 text-sm">
                            <span className="font-medium">{edge.source}</span>
                            <span className="text-zinc-500 mx-1.5">→</span>
                            <span className="font-medium">{edge.target}</span>
                            <span className="text-zinc-500 ml-2">({edge.weight})</span>
                          </span>
                          <button
                            onClick={() => removeEdge(edge.id)}
                            className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm transition-colors"
                            title="Remover aresta"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
