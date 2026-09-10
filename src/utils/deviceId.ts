// Identificador estable del navegador, en localStorage.
//
// Es la clave SECUNDARIA de la ruleta: la primaria es el teléfono. Sirve para
// que cambiar un dígito del celular no habilite una segunda tirada. Se puede
// borrar (y el modo incógnito arranca sin él), pero frena el intento casual,
// que es el caso real. Bloquear por IP no es opción: el tráfico móvil sale por
// CGNAT y miles de clientes comparten la misma IP saliente.
const KEY = "tp_did";

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      // randomUUID exige secure context: en http://<ip> durante desarrollo
      // no existe, por eso el fallback.
      id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Modo privado con storage bloqueado: sin device id, el teléfono sigue
    // siendo la defensa principal.
    return "";
  }
}
