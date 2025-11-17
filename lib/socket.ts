// Helper para emitir eventos Socket.io nas APIs
export function emitSocketEvent(event: string, data?: any) {
  if (typeof global !== "undefined" && global.io) {
    console.log(`📤 Emitindo evento Socket.io: ${event}`, data || "");
    global.io.emit(event, data);
  } else {
    console.warn(`⚠️ Socket.io não disponível. Evento não emitido: ${event}`);
  }
}
