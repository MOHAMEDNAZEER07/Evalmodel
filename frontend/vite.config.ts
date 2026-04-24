import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    watch: {
      // Exclude backend folder to prevent Vite from scanning Python venv
      ignored: ['**/node_modules/**', '../backend/**', '../test_models/**']
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (normalizedId.includes("/node_modules/")) {
            if (normalizedId.includes("/@tanstack/react-query/")) {
              return "query-vendor";
            }

            if (normalizedId.includes("/@supabase/supabase-js/")) {
              return "supabase-vendor";
            }

            if (normalizedId.includes("/recharts/") || normalizedId.includes("/d3-")) {
              return "charts-vendor";
            }

            if (
              normalizedId.includes("/react-markdown/") ||
              normalizedId.includes("/remark-") ||
              normalizedId.includes("/rehype-")
            ) {
              return "markdown-vendor";
            }

            if (
              normalizedId.includes("/cmdk/") ||
              normalizedId.includes("/lucide-react/") ||
              normalizedId.includes("/date-fns/") ||
              normalizedId.includes("/tailwind-merge/") ||
              normalizedId.includes("/class-variance-authority/") ||
              normalizedId.includes("/clsx/") ||
              normalizedId.includes("/zod/") ||
              normalizedId.includes("/sonner/") ||
              normalizedId.includes("/next-themes/") ||
              normalizedId.includes("/react-hook-form/") ||
              normalizedId.includes("/@hookform/resolvers/")
            ) {
              return "ui-vendor";
            }

            if (normalizedId.includes("/@radix-ui/")) {
              return "radix-vendor";
            }

            if (
              normalizedId.includes("/react-router-dom/") ||
              normalizedId.includes("/react-dom/") ||
              normalizedId.includes("/react/")
            ) {
              return "react-vendor";
            }
          }

          return undefined;
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
