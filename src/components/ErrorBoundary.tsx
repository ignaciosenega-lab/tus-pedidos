import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * Captura errores de render para que un fallo de runtime (ej. dato mal formado
 * en una sucursal) muestre un mensaje accionable en vez de desmontar la app a
 * pantalla negra.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Queda en consola para diagnóstico; no rompe la pantalla.
    console.error("ErrorBoundary atrapó un error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 24,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#fff",
            background: "#0a0a0a",
          }}
        >
          <p style={{ fontWeight: 600, fontSize: 18 }}>Algo salió mal</p>
          <p style={{ opacity: 0.7, fontSize: 14, marginTop: 6, maxWidth: 340 }}>
            No pudimos cargar la página. Probá recargar; si seguís con problemas,
            actualizá tu navegador o abrí el link en Chrome o Safari.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: "#10b981",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
