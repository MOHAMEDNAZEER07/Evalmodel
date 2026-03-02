import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TestConnection = () => {
  const [testing, setTesting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"idle" | "success" | "error">("idle");
  const [frontendStatus, setFrontendStatus] = useState<"idle" | "success" | "error">("idle");

  const testBackendConnection = async () => {
    setTesting(true);
    setBackendStatus("idle");
    setFrontendStatus("idle");

    try {
      // Test backend connectivity
      const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/auth/me`, {
        method: 'GET',
      });

      // We expect a 401/403 for unauthenticated requests - that's good!
      if (response.status === 401 || response.status === 403) {
        setBackendStatus("success");
        toast.success("Backend is running and responding!");
      } else if (response.ok) {
        setBackendStatus("success");
        toast.success("Backend is running!");
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }

      // Test frontend (Supabase connection)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        setFrontendStatus("success");
        toast.success("Frontend configuration is valid!");
      } else {
        throw new Error("Supabase URL not configured");
      }

    } catch (error) {
      setBackendStatus("error");
      toast.error(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: "idle" | "success" | "error") => {
    if (status === "success") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === "error") return <XCircle className="h-5 w-5 text-red-500" />;
    return <div className="h-5 w-5 rounded-full bg-muted" />;
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Connection Test</h1>
        <p className="text-muted-foreground">
          Verify that your frontend is properly connected to the backend API
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>
            Click the button below to test the connection between frontend and backend
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Display */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(backendStatus)}
                <div>
                  <p className="font-medium">Backend API</p>
                  <p className="text-sm text-muted-foreground">
                    {import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}
                  </p>
                </div>
              </div>
              <Badge variant={backendStatus === "success" ? "default" : "secondary"}>
                {backendStatus === "success" ? "Connected" : backendStatus === "error" ? "Failed" : "Not Tested"}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(frontendStatus)}
                <div>
                  <p className="font-medium">Frontend Config</p>
                  <p className="text-sm text-muted-foreground">
                    Supabase & Environment Variables
                  </p>
                </div>
              </div>
              <Badge variant={frontendStatus === "success" ? "default" : "secondary"}>
                {frontendStatus === "success" ? "Valid" : frontendStatus === "error" ? "Invalid" : "Not Tested"}
              </Badge>
            </div>
          </div>

          {/* Test Button */}
          <Button 
            onClick={testBackendConnection} 
            disabled={testing}
            className="w-full"
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {testing ? "Testing Connection..." : "Test Connection"}
          </Button>

          {/* Environment Info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">Environment Configuration</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Backend URL:</span>
              </div>
              <div className="font-mono">
                {import.meta.env.VITE_API_BASE_URL || 'Not Set'}
              </div>
              <div>
                <span className="text-muted-foreground">Supabase URL:</span>
              </div>
              <div className="font-mono truncate">
                {import.meta.env.VITE_SUPABASE_URL || 'Not Set'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestConnection;
