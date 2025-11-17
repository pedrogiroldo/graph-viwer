// Helper para emitir eventos Socket.io nas APIs
export function emitSocketEvent(event: string, data?: any) {
  if (typeof global !== "undefined" && global.io) {
    global.io.emit(event, data);
  }
}
