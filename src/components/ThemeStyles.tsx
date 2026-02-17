import { useStorefront } from "../hooks/useStorefront";

const defaultStyles = {
  headerBg: "#111827",
  headerText: "#ffffff",
  bodyBg: "#000000",
  panelBg: "#1f2937",
  popupBg: "#111827",
  generalText: "#d1d5db",
  titleText: "#ffffff",
  buttonBg: "#10b981",
  buttonText: "#ffffff",
  footerBg: "#111827",
  footerText: "#9ca3af",
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontUrl: "",
};

export default function ThemeStyles() {
  const { businessConfig } = useStorefront();
  const s = defaultStyles;

  // Dynamically set favicon
  const faviconHref = businessConfig.favicon || "/vite.svg";

  return (
    <>
      {/* Favicon */}
      <link rel="icon" href={faviconHref} />
      {/* Google Fonts */}
      {s.fontUrl && <link rel="stylesheet" href={s.fontUrl} />}
      {/* CSS Variables */}
      <style>{`
        :root {
          --header-bg: ${s.headerBg};
          --header-text: ${s.headerText};
          --body-bg: ${s.bodyBg};
          --panel-bg: ${s.panelBg};
          --popup-bg: ${s.popupBg};
          --general-text: ${s.generalText};
          --title-text: ${s.titleText};
          --btn-bg: ${s.buttonBg};
          --btn-text: ${s.buttonText};
          --footer-bg: ${s.footerBg};
          --footer-text: ${s.footerText};
          --font-family: ${s.fontFamily};
        }
        body {
          background-color: var(--body-bg);
          color: var(--general-text);
          font-family: var(--font-family);
        }
      `}</style>
    </>
  );
}
