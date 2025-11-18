/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Utilitário client-side para animar o favicon alternando entre múltiplos frames.
 *
 * Como usar (em um Client Component do Next.js):
 *
 * "use client";
 * import { startFaviconAnimation, stopFaviconAnimation } from "@/lib/mouth-fuckin-cat";
 *
 * const controller = startFaviconAnimation({
 *   frames: [
 *     "/frame1.png",
 *     "/frame2.png",
 *     "/frame3.png",
 *   ],
 *   intervalMs: 300,
 *   takeoverExistingIcons: true, // remove temporariamente os favicons existentes para garantir prioridade
 *   pauseWhenHidden: true,       // pausa quando a aba não está visível
 * });
 *
 * // Para parar e restaurar o favicon original:
 * controller.stop();
 *
 * // Ou simplesmente:
 * stopFaviconAnimation();
 */

type Nullable<T> = T | null;

export type FaviconAnimationOptions = {
  frames: string[];
  intervalMs?: number;
  takeoverExistingIcons?: boolean;
  pauseWhenHidden?: boolean;
  alsoSetShortcutIcon?: boolean;
  immediate?: boolean;
  preloadImages?: boolean; // pré-carrega e converte para Data URIs
};

export type FaviconAnimationController = {
  stop: () => void;
  isRunning: () => boolean;
  setFrames: (frames: string[]) => void;
  setIntervalMs: (ms: number) => void;
};

const IS_BROWSER =
  typeof window !== "undefined" && typeof document !== "undefined";

type SavedIcon = {
  el: HTMLLinkElement;
  parent: Node;
  nextSibling: ChildNode | null;
};

const STATE = {
  timerId: null as Nullable<number>,
  index: 0,
  frames: [] as string[],
  intervalMs: 300,
  running: false,
  pauseWhenHidden: true,
  takeoverExistingIcons: true,
  alsoSetShortcutIcon: true,
  // Links criados por este animador
  animatedLinks: [] as HTMLLinkElement[],
  // Links removidos (originais) quando em takeover
  removedOriginals: [] as SavedIcon[],
  // Handler de visibilitychange
  visibilityHandler: null as Nullable<() => void>,
  // Cache de imagens pré-carregadas como Data URIs
  preloadedFrames: new Map<string, string>(),
};

function isValidDataUri(href: string): boolean {
  return /^data:/.test(href);
}

function guessMimeTypeFromHref(href: string): string | undefined {
  if (isValidDataUri(href)) {
    // Data URIs já incluem o mime-type
    return undefined;
  }
  const lower = href.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg") || lower.includes("image/svg+xml"))
    return "image/svg+xml";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return undefined;
}

function queryIconLinks(): HTMLLinkElement[] {
  if (!IS_BROWSER) return [];
  // captura link[rel=icon] e também "shortcut icon"
  const list = document.head?.querySelectorAll<HTMLLinkElement>(
    'link[rel~="icon"], link[rel="shortcut icon"]',
  );
  return list ? Array.from(list) : [];
}

function createAnimatedLink(rel: "icon" | "shortcut icon"): HTMLLinkElement {
  const link = document.createElement("link");
  link.setAttribute("rel", rel);
  link.setAttribute("data-animated-favicon", "true");
  // Browsers tendem a considerar o último link no head,
  // então adicionamos no final para priorizar.
  document.head.appendChild(link);
  return link;
}

function ensureAnimatedLinks(alsoSetShortcutIcon: boolean): HTMLLinkElement[] {
  if (!IS_BROWSER) return [];
  const created: HTMLLinkElement[] = [];

  // Sempre cria um rel="icon"
  const mainIcon = createAnimatedLink("icon");
  created.push(mainIcon);

  if (alsoSetShortcutIcon) {
    const shortcut = createAnimatedLink("shortcut icon");
    created.push(shortcut);
  }

  return created;
}

function updateAnimatedLinksHref(href: string) {
  if (!IS_BROWSER) return;
  const type = guessMimeTypeFromHref(href);

  for (const link of STATE.animatedLinks) {
    link.href = href;
    if (type) link.type = type;
    else link.removeAttribute("type");
    // limpa tamanhos, pois frames podem variar
    link.removeAttribute("sizes");
  }

  // Alguns navegadores só atualizam depois de remover e re-adicionar
  // (workaround defensivo)
  for (const link of STATE.animatedLinks) {
    document.head.removeChild(link);
    document.head.appendChild(link);
  }
}

function removeAnimatedLinks() {
  if (!IS_BROWSER) return;
  for (const link of STATE.animatedLinks) {
    if (link && link.parentNode) {
      link.parentNode.removeChild(link);
    }
  }
  STATE.animatedLinks = [];
}

function takeoverExistingIcons() {
  if (!IS_BROWSER) return;
  const originals = queryIconLinks();
  for (const el of originals) {
    // Não remover os que já são do animador (caso alguma execução anterior não limpou)
    if (el.getAttribute("data-animated-favicon") === "true") continue;
    const parent = el.parentNode;
    if (!parent) continue;
    const nextSibling = el.nextSibling as ChildNode | null;
    parent.removeChild(el);
    STATE.removedOriginals.push({ el, parent, nextSibling });
  }
}

function restoreOriginalIcons() {
  if (!IS_BROWSER) return;
  for (const saved of STATE.removedOriginals) {
    const { el, parent, nextSibling } = saved;
    if (nextSibling && nextSibling.parentNode === parent) {
      parent.insertBefore(el, nextSibling);
    } else {
      parent.appendChild(el);
    }
  }
  STATE.removedOriginals = [];
}

function clearTimer() {
  if (STATE.timerId != null) {
    window.clearInterval(STATE.timerId);
    STATE.timerId = null;
  }
}

function startTimer() {
  if (!IS_BROWSER) return;
  if (STATE.frames.length <= 1) {
    // Sem animação, apenas seta o frame único se existir
    if (STATE.frames.length === 1) {
      updateAnimatedLinksHref(STATE.frames[0]);
    }
    return;
  }

  clearTimer();
  STATE.timerId = window.setInterval(() => {
    STATE.index = (STATE.index + 1) % STATE.frames.length;
    const href = STATE.frames[STATE.index];
    updateAnimatedLinksHref(href);
  }, STATE.intervalMs);
}

function attachVisibilityHandler() {
  if (!IS_BROWSER || STATE.visibilityHandler) return;

  STATE.visibilityHandler = () => {
    if (document.hidden) {
      clearTimer();
    } else if (STATE.running) {
      // retoma o timer
      startTimer();
    }
  };

  document.addEventListener("visibilitychange", STATE.visibilityHandler);
}

function detachVisibilityHandler() {
  if (!IS_BROWSER || !STATE.visibilityHandler) return;
  document.removeEventListener("visibilitychange", STATE.visibilityHandler);
  STATE.visibilityHandler = null;
}

/**
 * Converte uma URL de imagem para Data URI.
 */
async function imageUrlToDataUri(url: string): Promise<string> {
  // Se já for um Data URI, retorna direto
  if (isValidDataUri(url)) {
    return url;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Não foi possível obter contexto do canvas"));
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Tenta PNG primeiro, depois JPEG como fallback
        let dataUri = canvas.toDataURL("image/png");
        if (!dataUri || dataUri === "data:,") {
          dataUri = canvas.toDataURL("image/jpeg", 0.95);
        }

        resolve(dataUri);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error(`Falha ao carregar imagem: ${url}`));
    };

    img.src = url;
  });
}

/**
 * Pré-carrega todos os frames e os converte para Data URIs.
 */
async function preloadFrames(frames: string[]): Promise<string[]> {
  if (!IS_BROWSER) return frames;

  const loadedFrames: string[] = [];

  for (const frame of frames) {
    try {
      // Verifica se já está no cache
      if (STATE.preloadedFrames.has(frame)) {
        loadedFrames.push(STATE.preloadedFrames.get(frame)!);
        continue;
      }

      // Carrega e converte
      const dataUri = await imageUrlToDataUri(frame);
      STATE.preloadedFrames.set(frame, dataUri);
      loadedFrames.push(dataUri);
    } catch (error) {
      console.warn(`Falha ao pré-carregar frame ${frame}:`, error);
      // Em caso de erro, usa a URL original
      loadedFrames.push(frame);
    }
  }

  return loadedFrames;
}

/**
 * Seta (uma única vez) o favicon atual.
 * Não inicia animação.
 */
export function setFavicon(href: string, alsoSetShortcutIcon = true) {
  if (!IS_BROWSER) return;

  // remove links animados anteriores
  removeAnimatedLinks();

  // cria novos e define href
  STATE.animatedLinks = ensureAnimatedLinks(alsoSetShortcutIcon);
  updateAnimatedLinksHref(href);
}

/**
 * Inicia a animação do favicon.
 */
export function startFaviconAnimation(
  options: FaviconAnimationOptions,
): FaviconAnimationController {
  if (!IS_BROWSER) {
    // No SSR, retornar um controller no-op
    return {
      stop: () => {},
      isRunning: () => false,
      setFrames: () => {},
      setIntervalMs: () => {},
    };
  }

  const {
    frames,
    intervalMs = 300,
    takeoverExistingIcons = true,
    pauseWhenHidden = true,
    alsoSetShortcutIcon = true,
    immediate = true,
    preloadImages = true, // por padrão, pré-carrega
  } = options;

  // Se já estiver rodando, para e reinicia com novos parâmetros
  if (STATE.running) {
    internalStop(false); // não restaurar originais ainda; vamos continuar takeover
  }

  STATE.intervalMs = Math.max(10, intervalMs | 0); // clamp leve
  STATE.index = 0;
  STATE.pauseWhenHidden = !!pauseWhenHidden;
  STATE.takeoverExistingIcons = !!takeoverExistingIcons;
  STATE.alsoSetShortcutIcon = !!alsoSetShortcutIcon;

  // Função assíncrona interna para configurar os frames
  const initializeFrames = async () => {
    let processedFrames = Array.isArray(frames) ? frames.slice() : [];

    // Pré-carrega as imagens se solicitado
    if (preloadImages && processedFrames.length > 0) {
      processedFrames = await preloadFrames(processedFrames);
    }

    STATE.frames = processedFrames;

    // cria ou recria os links animados
    removeAnimatedLinks();
    STATE.animatedLinks = ensureAnimatedLinks(STATE.alsoSetShortcutIcon);

    if (STATE.frames.length > 0 && immediate) {
      updateAnimatedLinksHref(STATE.frames[0]);
    }

    if (STATE.pauseWhenHidden) {
      attachVisibilityHandler();
    } else {
      detachVisibilityHandler();
    }

    STATE.running = true;
    startTimer();
  };

  // Inicia o carregamento de forma assíncrona
  initializeFrames().catch((error) => {
    console.error("Erro ao inicializar animação do favicon:", error);
    // Em caso de erro, tenta usar os frames originais
    STATE.frames = Array.isArray(frames) ? frames.slice() : [];
    removeAnimatedLinks();
    STATE.animatedLinks = ensureAnimatedLinks(STATE.alsoSetShortcutIcon);
    if (STATE.frames.length > 0 && immediate) {
      updateAnimatedLinksHref(STATE.frames[0]);
    }
    STATE.running = true;
    startTimer();
  });

  const controller: FaviconAnimationController = {
    stop: () => {
      internalStop(true);
    },
    isRunning: () => STATE.running,
    setFrames: (newFrames: string[]) => {
      // Também pré-carrega os novos frames se necessário
      const updateFrames = async () => {
        let processedFrames = newFrames.slice();
        if (preloadImages && processedFrames.length > 0) {
          processedFrames = await preloadFrames(processedFrames);
        }
        STATE.frames = processedFrames;
        // Ajusta índice se necessário
        if (STATE.index >= STATE.frames.length) STATE.index = 0;

        // Se só tiver 1 frame agora, limpa o timer e seta apenas o único frame
        if (STATE.frames.length <= 1) {
          clearTimer();
          if (STATE.frames.length === 1)
            updateAnimatedLinksHref(STATE.frames[0]);
        } else {
          // Reinicia o timer para aplicar imediatamente
          startTimer();
        }
      };
      updateFrames().catch(console.error);
    },
    setIntervalMs: (ms: number) => {
      STATE.intervalMs = Math.max(10, ms | 0);
      if (STATE.running && STATE.frames.length > 1) {
        startTimer();
      }
    },
  };

  return controller;
}

/**
 * Para a animação e restaura os favicons originais (se takeover estiver ativo).
 */
export function stopFaviconAnimation() {
  internalStop(true);
}

function internalStop(restoreOriginals: boolean) {
  if (!IS_BROWSER) return;

  clearTimer();
  detachVisibilityHandler();
  removeAnimatedLinks();

  if (restoreOriginals) {
    restoreOriginalIcons();
  }

  STATE.running = false;
  STATE.frames = [];
  STATE.index = 0;
  // Mantém o cache de imagens pré-carregadas para reutilização futura
  // STATE.preloadedFrames.clear(); // descomente se quiser limpar o cache
}

/**
 * Indica se a animação está ativa.
 */
export function isFaviconAnimating(): boolean {
  return !!STATE.running;
}

/**
 * Export default com uma interface agrupada.
 */
const FaviconAnimator = {
  start: startFaviconAnimation,
  stop: stopFaviconAnimation,
  set: setFavicon,
  isAnimating: isFaviconAnimating,
};

export default FaviconAnimator;
