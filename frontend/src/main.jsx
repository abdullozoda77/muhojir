import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./auth.jsx";
import { MotionProvider } from "./components/motion.jsx";
import { lang } from "./i18n.js";
import { registerServiceWorker } from "./pwa.js";
import "./index.css";

document.documentElement.lang = lang === "ru" ? "ru" : "tg";
registerServiceWorker();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MotionProvider>
          <App />
        </MotionProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
