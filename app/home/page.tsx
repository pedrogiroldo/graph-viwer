"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
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

interface User {
  id: number;
  username: string;
  name: string;
  isFollowing?: boolean;
  _count?: {
    following: number;
    followers: number;
  };
}

interface Post {
  id: number;
  follower: { id: number; username: string; name: string };
  following: { id: number; username: string; name: string };
  action: string;
  createdAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const cyRef = useRef<any>(null);
  const currentUserRef = useRef<any>(null);

  useEffect(() => {
    // Verificar autenticação
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      router.push("/login");
      return;
    }

    const user = JSON.parse(userStr);
    setCurrentUser(user);
    currentUserRef.current = user; // Atualizar ref também

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
    loadPosts();
    loadUsers();

    // Função para iniciar polling HTTP
    const startPolling = () => {
      console.log("🔄 Iniciando polling HTTP a cada 1 segundo");
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => {
        loadGraph();
        loadPosts();
        if (currentUserRef.current?.id) {
          loadUsers();
        }
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
      console.log("✅ Conectado ao Socket.io, ID:", newSocket.id);
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

    newSocket.on("graph-updated", () => {
      loadGraph();
    });

    newSocket.on("posts-updated", () => {
      loadPosts();
    });

    newSocket.on("users-updated", () => {
      // Usar ref para acessar o valor atual
      if (currentUserRef.current?.id) {
        loadUsers();
      }
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
      newSocket.off("posts-updated");
      newSocket.off("users-updated");
      newSocket.close();
    };
  }, [router]);

  // Manter ref sincronizada com o estado
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const loadGraph = async () => {
    try {
      const response = await fetch("/api/graph");
      if (!response.ok) {
        setNodes([]);
        setEdges([]);
        return;
      }
      const data = await response.json();
      setNodes(Array.isArray(data.nodes) ? data.nodes : []);
      setEdges(Array.isArray(data.edges) ? data.edges : []);
    } catch (error) {
      console.error("Erro ao carregar grafo:", error);
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      const response = await fetch("/api/posts?limit=20");
      if (response.ok) {
        const data = await response.json();
        setPosts(Array.isArray(data.posts) ? data.posts : []);
      }
    } catch (error) {
      console.error("Erro ao carregar posts:", error);
    }
  };

  const loadUsers = async () => {
    try {
      // Usar ref para garantir que sempre temos o valor atual
      const userId = currentUserRef.current?.id || currentUser?.id;
      if (!userId) return;
      
      const response = await fetch(`/api/users?currentUserId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.users)) {
          setUsers(data.users);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  };

  const handleFollow = async (followingId: number) => {
    const userId = currentUserRef.current?.id || currentUser?.id;
    if (!userId) return;

    // Atualizar estado local imediatamente (otimista)
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === followingId ? { ...user, isFollowing: true } : user
      )
    );

    try {
      const response = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followerId: userId,
          followingId,
        }),
      });

      if (response.ok) {
        // Recarregar para sincronizar com o servidor
        await loadUsers();
        await loadGraph();
        await loadPosts();
        // Socket emitirá evento automaticamente via API
      } else {
        // Reverter se houver erro
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.id === followingId ? { ...user, isFollowing: false } : user
          )
        );
      }
    } catch (error) {
      console.error("Erro ao seguir:", error);
      // Reverter em caso de erro
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === followingId ? { ...user, isFollowing: false } : user
        )
      );
    }
  };

  const handleUnfollow = async (followingId: number) => {
    const userId = currentUserRef.current?.id || currentUser?.id;
    if (!userId) return;

    // Atualizar estado local imediatamente (otimista)
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === followingId ? { ...user, isFollowing: false } : user
      )
    );

    try {
      const response = await fetch("/api/unfollow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followerId: userId,
          followingId,
        }),
      });

      if (response.ok) {
        // Recarregar para sincronizar com o servidor
        await loadUsers();
        await loadGraph();
        await loadPosts();
      } else {
        // Reverter se houver erro
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.id === followingId ? { ...user, isFollowing: true } : user
          )
        );
      }
    } catch (error) {
      console.error("Erro ao deixar de seguir:", error);
      // Reverter em caso de erro
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === followingId ? { ...user, isFollowing: true } : user
        )
      );
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/login");
  };

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

  const cyLayout = {
    name: "cose",
    animate: true,
    animationDuration: 1000,
    fit: true,
    padding: 30,
  };

  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];

  const cyElements = [
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return "agora";
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return `${days}d atrás`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Grafogram
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-zinc-400">
                Olá,{" "}
                <span className="text-zinc-100 font-medium">
                  {currentUser?.name}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1: Grafo */}
          <div className="lg:col-span-2 space-y-6">
            {/* Grafo */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur-sm shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-zinc-100">
                  Grafo de Relacionamentos
                </h2>
                <div className="flex gap-2 items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-zinc-400">Live</span>
                </div>
              </div>
              <div className="bg-zinc-950 rounded-lg border border-zinc-800 h-[500px] overflow-hidden shadow-inner">
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
                    Nenhum dado para exibir
                  </div>
                )}
              </div>
            </div>

            {/* Posts */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm shadow-xl">
              <h2 className="text-xl font-semibold text-zinc-100 mb-4">
                Atividade Recente
              </h2>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {posts.length === 0 ? (
                  <p className="text-zinc-400 text-center py-8">
                    Nenhuma atividade ainda
                  </p>
                ) : (
                  posts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                          {post.follower.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-zinc-100">
                            <span className="font-semibold">
                              {post.follower.name}
                            </span>{" "}
                            {post.action === "follow"
                              ? "seguiu"
                              : "deixou de seguir"}{" "}
                            <span className="font-semibold">
                              {post.following.name}
                            </span>
                          </p>
                          <p className="text-zinc-400 text-sm mt-1">
                            {formatDate(post.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Coluna 2: Lista de Usuários */}
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm shadow-xl">
              <h2 className="text-xl font-semibold text-zinc-100 mb-4">
                Usuários
              </h2>
              <div className="space-y-3 max-h-[800px] overflow-y-auto">
                {users.length === 0 ? (
                  <p className="text-zinc-400 text-center py-8">
                    Nenhum usuário encontrado
                  </p>
                ) : (
                  users
                    .filter((user) => user.id !== currentUser?.id)
                    .map((user) => (
                      <div
                        key={user.id}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-100">
                                {user.name}
                              </p>
                              <p className="text-sm text-zinc-400">
                                @{user.username}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              user.isFollowing
                                ? handleUnfollow(user.id)
                                : handleFollow(user.id)
                            }
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              user.isFollowing
                                ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                                : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                            }`}
                          >
                            {user.isFollowing ? "Seguindo" : "Seguir"}
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
