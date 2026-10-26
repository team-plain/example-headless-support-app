import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "react-oidc-context";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { clientId, oidcConfig } from "./auth.ts";
import { AppShell } from "./components/AppShell.tsx";
import { Callback } from "./routes/Callback.tsx";
import { Queue } from "./routes/Queue.tsx";
import { RequireAuth } from "./routes/RequireAuth.tsx";
import { SetupRequired } from "./routes/SetupRequired.tsx";
import { SignIn } from "./routes/SignIn.tsx";
import { Thread } from "./routes/Thread.tsx";
import "./styles/globals.css";

function App() {
  if (!clientId) {
    return <SetupRequired />;
  }

  return (
    // AuthProvider completes the sign-in when Plain redirects back to
    // /callback?code=...&state=..., and keeps the access token fresh.
    <AuthProvider {...oidcConfig}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SignIn />} />
          <Route path="/callback" element={<Callback />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/threads" element={<Queue />} />
              <Route path="/threads/:threadId" element={<Thread />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
