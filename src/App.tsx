import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Evaluate from "./pages/Evaluate";
import Compare from "./pages/Compare";
import Insights from "./pages/Insights";
import Explainability from "./pages/Explainability";
import Fairness from "./pages/Fairness";
import ModelRegistry from "./pages/ModelRegistry";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import TestConnection from "./pages/TestConnection";
import { AIMentor } from "./components/AIMentor";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

const App = () => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SidebarProvider>
              <div className="min-h-screen flex w-full">
                <AppSidebar />
                <div className="flex-1 flex flex-col w-full">
                  <Navbar />
                  <main className="flex-1">
                    <Routes>
                      {/* Public routes */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/pricing" element={<Pricing />} />
                      <Route path="/test-connection" element={<TestConnection />} />
                      
                      {/* Protected routes */}
                      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                      <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
                      <Route path="/evaluate" element={<ProtectedRoute><Evaluate /></ProtectedRoute>} />
                      <Route path="/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
                      <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
                      <Route path="/explainability" element={<ProtectedRoute><Explainability /></ProtectedRoute>} />
                      <Route path="/fairness" element={<ProtectedRoute><Fairness /></ProtectedRoute>} />
                      <Route path="/autotune" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                      <Route path="/registry" element={<ProtectedRoute><ModelRegistry /></ProtectedRoute>} />
                      <Route path="/team" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                      <Route path="/reports" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                      <Route path="/batch" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                      <Route path="/settings" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
                      
                      {/* 404 */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <AIMentor />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
