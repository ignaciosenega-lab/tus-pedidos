import { useAdmin } from "../store/adminContext";

export default function ThemeStyles() {
  const { styleConfig, businessConfig } = useAdmin();
  const s = styleConfig;

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
