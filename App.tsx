import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DesktopOS } from "./pages/DesktopOS";
import BillingPage from "./pages/BillingPage";
import LandingPage from "./pages/LandingPage";
import CommandCenter from "./pages/CommandCenter";
import LoginPage from "./pages/LoginPage";
import { WindowProvider } from "./contexts/WindowContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { DesktopThemeProvider } from "./contexts/DesktopThemeContext";
import { BootSequence } from "./components/BootSequence";
import { initPlugins } from "./lib/initPlugins";

// Initialize plugin registry once at module load
initPlugins();

// Show boot sequence once per browser session
// Skip boot for standalone pages that don't need it
const isStandalonePage = ['/command-center', '/about', '/billing', '/login'].some(p => window.location.pathname.startsWith(p));
const hasBooted = isStandalonePage || sessionStorage.getItem("sentinel_booted") === "true";

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={LoginPage} />
      <Route path={"/"} component={DesktopOS} />
      <Route path={"/billing"} component={BillingPage} />
      <Route path={"/about"} component={LandingPage} />
      <Route path={"/command-center"} component={CommandCenter} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [booted, setBooted] = useState(hasBooted);

  function handleBootComplete() {
    sessionStorage.setItem("sentinel_booted", "true");
    setBooted(true);
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <DesktopThemeProvider>
          <WindowProvider>
            <WorkspaceProvider>
              <TooltipProvider>
                <Toaster />
                {!booted && <BootSequence onComplete={handleBootComplete} />}
                <div
                  style={{
                    opacity: booted ? 1 : 0,
                    transition: "opacity 0.6s ease",
                    pointerEvents: booted ? "auto" : "none",
                  }}
                >
                  <Router />
                </div>
              </TooltipProvider>
            </WorkspaceProvider>
          </WindowProvider>
        </DesktopThemeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
