import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Monitor from "./pages/Monitor";
import Scanner from "./pages/Scanner";
import Alerts from "./pages/Alerts";
import NotFound from "./pages/NotFound";
import { Web3Provider } from "./components/Web3Provider";
import { RequireAuth } from "./components/RequireAuth";

const App = () => (
  <Web3Provider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout isLandingPage={true}><Index /></Layout>} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Layout><Dashboard /></Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/monitor"
            element={
              <RequireAuth>
                <Layout><Monitor /></Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/scanner"
            element={
              <RequireAuth>
                <Layout><Scanner /></Layout>
              </RequireAuth>
            }
          />
          <Route
            path="/alerts"
            element={
              <RequireAuth>
                <Layout><Alerts /></Layout>
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </Web3Provider>
);

export default App;
