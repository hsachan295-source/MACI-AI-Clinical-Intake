import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "./lib/theme.jsx";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <App />
          <Toaster
            position="top-right"
            gutter={10}
            toastOptions={{
              duration: 4200,
              className: "maci-toast",
              style: {
                background: "rgb(var(--surface-elevated))",
                color: "rgb(var(--text-primary))",
                border: "1px solid rgb(var(--border))",
                borderRadius: "0.9rem",
                boxShadow: "0 24px 70px -12px rgb(var(--shadow) / 0.35)",
                padding: "10px 14px",
                fontSize: "13.5px",
                fontWeight: 500,
                maxWidth: "380px",
              },
              success: { iconTheme: { primary: "rgb(var(--success))", secondary: "rgb(var(--surface-elevated))" } },
              error: { iconTheme: { primary: "rgb(var(--danger))", secondary: "rgb(var(--surface-elevated))" } },
            }}
          />
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  </React.StrictMode>
);
