export interface GraphEdge {
  from: string;
  to: string;
  weight: number;
}

export interface ShortestPathResult {
  path: string[];
  distance: number;
}

/**
 * Implementação do algoritmo de Dijkstra para encontrar o caminho mais curto
 * entre dois nós em um grafo ponderado.
 * 
 * @param edges - Array de arestas do grafo com pesos
 * @param startNode - Nó de origem
 * @param endNode - Nó de destino
 * @returns Objeto contendo o caminho mais curto e a distância total, ou null se não houver caminho
 */
export function dijkstra(
  edges: GraphEdge[],
  startNode: string,
  endNode: string
): ShortestPathResult | null {
  // Construir grafo como um mapa de adjacência
  const graph = new Map<string, Map<string, number>>();
  
  // Adicionar todas as arestas ao grafo (grafo não direcionado)
  for (const edge of edges) {
    if (!graph.has(edge.from)) {
      graph.set(edge.from, new Map());
    }
    if (!graph.has(edge.to)) {
      graph.set(edge.to, new Map());
    }
    
    // Adicionar aresta em ambas as direções (grafo não direcionado)
    graph.get(edge.from)!.set(edge.to, edge.weight);
    graph.get(edge.to)!.set(edge.from, edge.weight);
  }

  // Verificar se os nós existem no grafo
  if (!graph.has(startNode) || !graph.has(endNode)) {
    return null;
  }

  // Se o nó inicial e final são o mesmo
  if (startNode === endNode) {
    return { path: [startNode], distance: 0 };
  }

  // Estruturas para o algoritmo
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set<string>();

  // Inicializar distâncias
  for (const node of graph.keys()) {
    distances.set(node, Infinity);
    previous.set(node, null);
    unvisited.add(node);
  }
  
  distances.set(startNode, 0);

  // Algoritmo de Dijkstra
  while (unvisited.size > 0) {
    // Encontrar o nó não visitado com menor distância
    let currentNode: string | null = null;
    let minDistance = Infinity;

    for (const node of unvisited) {
      const distance = distances.get(node)!;
      if (distance < minDistance) {
        minDistance = distance;
        currentNode = node;
      }
    }

    // Se não encontrou nó alcançável, não há caminho
    if (currentNode === null || minDistance === Infinity) {
      break;
    }

    // Se chegamos ao destino, podemos parar
    if (currentNode === endNode) {
      break;
    }

    unvisited.delete(currentNode!);

    // Atualizar distâncias dos vizinhos
    const neighbors = graph.get(currentNode!);
    if (neighbors) {
      for (const [neighbor, weight] of neighbors.entries()) {
        if (unvisited.has(neighbor)) {
          const alt = distances.get(currentNode!)! + weight;
          if (alt < distances.get(neighbor)!) {
            distances.set(neighbor, alt);
            previous.set(neighbor, currentNode!);
          }
        }
      }
    }
  }

  // Reconstruir o caminho
  const path: string[] = [];
  let current: string | null = endNode;

  // Se não há caminho até o destino
  if (previous.get(endNode) === null && startNode !== endNode) {
    return null;
  }

  while (current !== null) {
    path.unshift(current);
    current = previous.get(current) || null;
  }

  const distance = distances.get(endNode)!;

  // Se a distância é infinita, não há caminho
  if (distance === Infinity || path.length === 0) {
    return null;
  }

  return {
    path,
    distance,
  };
}
