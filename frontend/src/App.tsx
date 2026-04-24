import { Suspense, lazy, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import Navbar from "./components/Navbar";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Upload = lazy(() => import("./pages/Upload"));
const Evaluate = lazy(() => import("./pages/Evaluate"));
const Compare = lazy(() => import("./pages/Compare"));
const Insights = lazy(() => import("./pages/Insights"));
const Explainability = lazy(() => import("./pages/Explainability"));
const Fairness = lazy(() => import("./pages/Fairness"));
const ModelRegistry = lazy(() => import("./pages/ModelRegistry"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const TestConnection = lazy(() => import("./pages/TestConnection"));
const AIMentor = lazy(async () => {
  const module = await import("./components/AIMentor");
  return { default: module.AIMentor };
});

const RouteFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center text-sm text-muted-foreground">
    Loading page...
  </div>
);

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
                    <Suspense fallback={<RouteFallback />}>
                      <Routes>
                        {/* Public routes */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
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
                        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                        
                        {/* 404 */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <Suspense fallback={null}>
              <AIMentor />
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
