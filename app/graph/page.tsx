"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type Cytoscape from "cytoscape";
import { io, Socket } from "socket.io-client";

interface Node {
  id: string;
  label: string;
}

interface Edge {
  source: string;
  target: string;
}

export default function GraphPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cyRef = useRef<Cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadGraph = useCallback(async () => {
    try {
      const response = await fetch("/api/graph");
      if (!response.ok) {
        // Só atualizar se o estado atual não estiver vazio
        setNodes((prevNodes) => {
          if (prevNodes.length === 0) return prevNodes;
          return [];
        });
        setEdges((prevEdges) => {
          if (prevEdges.length === 0) return prevEdges;
          return [];
        });
        return;
      }
      const data = await response.json();
      const newNodes = Array.isArray(data.nodes) ? data.nodes : [];
      const newEdges = Array.isArray(data.edges) ? data.edges : [];
      
      // Comparar dados de forma mais precisa usando JSON.stringify
      // Criar versões ordenadas para comparação estável
      const sortNodes = (arr: Node[]) => [...arr].sort((a, b) => a.id.localeCompare(b.id));
      const sortEdges = (arr: Edge[]) => [...arr].sort((a, b) => {
        const aKey = `${a.source}-${a.target}`;
        const bKey = `${b.source}-${b.target}`;
        return aKey.localeCompare(bKey);
      });
      
      const currentNodesSorted = sortNodes(nodes);
      const newNodesSorted = sortNodes(newNodes);
      const currentEdgesSorted = sortEdges(edges);
      const newEdgesSorted = sortEdges(newEdges);
      
      const nodesChanged = JSON.stringify(currentNodesSorted) !== JSON.stringify(newNodesSorted);
      const edgesChanged = JSON.stringify(currentEdgesSorted) !== JSON.stringify(newEdgesSorted);
      
      // Só atualizar estado se houver mudanças reais
      if (nodesChanged) {
        setNodes(newNodes);
      }
      
      if (edgesChanged) {
        setEdges(newEdges);
      }
      
      // Atualizar layout do Cytoscape apenas se houver mudanças significativas
      if ((nodesChanged || edgesChanged) && cyRef.current) {
        const hasNewNodes = newNodes.length > nodes.length;
        const hasNewEdges = newEdges.length > edges.length;
        
        if (hasNewNodes || hasNewEdges) {
          setTimeout(() => {
            const layout = {
              name: "cose",
              animate: true,
              animationDuration: 1000,
              fit: true,
              padding: 30,
            };
            cyRef.current?.layout(layout).run();
          }, 100);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar grafo:", error);
      // Só atualizar se o estado atual não estiver vazio
      setNodes((prevNodes) => {
        if (prevNodes.length === 0) return prevNodes;
        return [];
      });
      setEdges((prevEdges) => {
        if (prevEdges.length === 0) return prevEdges;
        return [];
      });
    } finally {
      setLoading(false);
    }
  }, [nodes, edges]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let socketTimeout: NodeJS.Timeout | null = null;
    let connectionAttempts = 0;
    const maxConnectionAttempts = 3;

    // Detectar ambientes que não suportam WebSocket (Vercel, etc)
    const isServerless =
      typeof window !== "undefined" &&
      (window.location.hostname.includes("vercel.app") ||
        window.location.hostname.includes("vercel.sh") ||
        window.location.hostname.includes(".vercel.app") ||
        window.location.hostname.includes("netlify.app") ||
        window.location.hostname.includes("cloudflarepages.com") ||
        window.location.hostname.includes("onrender.com") ||
        window.location.hostname.includes("railway.app"));

    // Carregar dados iniciais
    loadGraph();

    // Função para iniciar polling HTTP
    const startPolling = () => {
      console.log("🔄 Iniciando polling HTTP a cada 1 segundo");
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => {
        loadGraph();
      }, 1000); // Atualizar a cada 1 segundo
    };

    // Se estiver em ambiente serverless, usar polling direto
    if (isServerless) {
      console.log("⚠️ Ambiente serverless detectado - usando polling HTTP direto");
      startPolling();
      return () => {
        if (pollInterval) clearInterval(pollInterval);
      };
    }

    // Tentar conectar ao Socket.io apenas em ambientes que suportam
    const socketUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";

    console.log("🔌 Tentando conectar ao Socket.io em:", socketUrl);

    const newSocket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: maxConnectionAttempts,
      autoConnect: true,
      timeout: 5000, // Timeout de 5 segundos
    });

    // Timeout: se não conectar em 5 segundos, usar polling
    socketTimeout = setTimeout(() => {
      if (!newSocket.connected) {
        console.log("⏱️ Timeout ao conectar Socket.io - usando polling HTTP");
        newSocket.close();
        startPolling();
      }
    }, 5000);

    newSocket.on("connect", () => {
      console.log("✅ Conectado ao Socket.io - /graph, ID:", newSocket.id);
      connectionAttempts = 0;
      if (socketTimeout) clearTimeout(socketTimeout);
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    });

    newSocket.on("disconnect", (reason) => {
      console.log("❌ Desconectado do Socket.io, motivo:", reason);
      // Se desconectar, iniciar polling como fallback
      if (reason === "io server disconnect" || reason === "transport close") {
        startPolling();
      }
    });

    newSocket.on("connect_error", (error) => {
      connectionAttempts++;
      console.error(`❌ Erro ao conectar Socket.io (tentativa ${connectionAttempts}/${maxConnectionAttempts}):`, error.message);
      
      // Se exceder tentativas, usar polling
      if (connectionAttempts >= maxConnectionAttempts) {
        console.log("🔄 Máximo de tentativas excedido - usando polling HTTP");
        newSocket.close();
        startPolling();
      }
    });

    newSocket.on("reconnect", (attemptNumber) => {
      console.log("🔄 Reconectado ao Socket.io após", attemptNumber, "tentativas");
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    });

    // Escutar evento de atualização do grafo
    newSocket.on("graph-updated", () => {
      console.log("📡 Evento graph-updated recebido, atualizando grafo...");
      loadGraph();
    });

    setSocket(newSocket);

    return () => {
      if (socketTimeout) clearTimeout(socketTimeout);
      if (pollInterval) clearInterval(pollInterval);
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("connect_error");
      newSocket.off("reconnect");
      newSocket.off("graph-updated");
      newSocket.close();
    };
  }, [loadGraph]);

  // Função para entrar/sair de tela cheia
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      // Entrar em tela cheia
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      } else if ((containerRef.current as any).mozRequestFullScreen) {
        (containerRef.current as any).mozRequestFullScreen();
      } else if ((containerRef.current as any).msRequestFullscreen) {
        (containerRef.current as any).msRequestFullscreen();
      }
    } else {
      // Sair de tela cheia
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  };

  // Escutar mudanças de tela cheia
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  // Configuração do Cytoscape
  const cyStylesheet = [
    {
      selector: "node",
      style: {
        "background-color": "#5b5b5b",
        label: "data(label)",
        color: "white",
        width: 40,
        height: 40,
        "text-valign": "center",
        "text-halign": "center",
        "font-size": "12px",
        "font-weight": "bold",
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
      },
    },
  ];

  // Memoizar elementos do Cytoscape para evitar recálculos desnecessários
  const cyElements = useMemo(() => {
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    const safeEdges = Array.isArray(edges) ? edges : [];

    return [
      ...safeNodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
        },
      })),
      ...safeEdges.map((edge, index) => ({
        data: {
          id: `edge-${index}`,
          source: edge.source,
          target: edge.target,
        },
      })),
    ];
  }, [nodes, edges]);

  // Configuração do layout do Cytoscape
  const cyLayout = {
    name: "cose",
    animate: true,
    animationDuration: 1000,
    fit: true,
    padding: 30,
  };

  // Ajustar layout apenas quando entrar/sair de tela cheia
  useEffect(() => {
    if (cyRef.current && cyElements.length > 0 && isFullscreen !== undefined) {
      setTimeout(() => {
        cyRef.current?.layout(cyLayout).run();
      }, 100);
    }
  }, [isFullscreen]);

  return (
    <div
      ref={containerRef}
      className={`bg-zinc-950 text-zinc-50 ${
        isFullscreen ? "w-screen h-screen" : "min-h-screen"
      } relative`}
    >
      {/* Botão de tela cheia */}
      {!isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-10 p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-100 transition-all duration-200 backdrop-blur-sm shadow-lg hover:shadow-xl"
          title="Tela cheia"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      )}

      {/* Botão para sair de tela cheia */}
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-10 p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-100 transition-all duration-200 backdrop-blur-sm shadow-lg hover:shadow-xl"
          title="Sair de tela cheia"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* Container do grafo */}
      <div
        className={`${
          isFullscreen ? "w-full h-full" : "container mx-auto px-4 py-8"
        }`}
      >
        {loading ? (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-zinc-400">Carregando grafo...</p>
            </div>
          </div>
        ) : cyElements.length > 0 ? (
          <div className={`${isFullscreen ? "w-full h-full" : "h-[800px]"}`}>
            <CytoscapeComponent
              elements={cyElements}
              style={{ width: "100%", height: "100%" }}
              stylesheet={cyStylesheet}
              layout={cyLayout}
              cy={(cy: Cytoscape.Core) => {
                cyRef.current = cy;
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <p className="text-zinc-400 text-lg">
                Nenhum dado para exibir
              </p>
              <p className="text-zinc-500 text-sm mt-2">
                O grafo aparecerá aqui quando houver usuários e conexões
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
