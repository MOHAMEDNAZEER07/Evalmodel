import { Search, Bot, Bell, User, Moon, Sun, LogIn, Database, Brain, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearchService } from "@/lib/global-search";

const Navbar = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{models: any[], datasets: any[]}>({ models: [], datasets: [] });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Global search - Cmd/Ctrl + K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fetch search results
  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!searchQuery.trim() || !user) {
        setSearchResults({ models: [], datasets: [] });
        return;
      }
      
      try {
        const results = await globalSearchService.search({
          query: searchQuery,
          includeModels: true,
          includeDatasets: true,
          includeEvaluations: false,
          limit: 5,
        });
        
        setSearchResults({ 
          models: results.models, 
          datasets: results.datasets 
        });
      } catch (error) {
        console.error('Search error:', error);
      }
    };
    
    const debounce = setTimeout(fetchSearchResults, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  return (
    <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Left: Sidebar Toggle & Search */}
        <div className="flex items-center gap-4 flex-1">
          <SidebarTrigger className="text-foreground hover:text-primary transition-colors" />
          
          <div className="relative max-w-md w-full hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search models, datasets... (Ctrl+K)"
              className="pl-10 bg-muted/50 border-border/50 focus:border-primary/50 transition-colors cursor-pointer"
              onClick={() => setSearchOpen(true)}
              readOnly
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {!user ? (
            <>
              <Button variant="ghost" onClick={() => navigate("/login")}>
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Button>
              <Button onClick={() => navigate("/signup")}>
                Sign Up
              </Button>
            </>
          ) : (
            <>
              {/* AI Assistant */}
              <Button variant="ghost" size="icon" className="relative group">
                <Bot className="h-5 w-5 text-primary group-hover:text-primary/80 transition-colors" />
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-accent rounded-full animate-pulse" />
              </Button>

              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-destructive">
                      3
                    </Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 glass-card">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">Model Evaluation Complete</p>
                      <p className="text-xs text-muted-foreground">BERT Classifier achieved 94.2% accuracy</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">Batch Job Finished</p>
                      <p className="text-xs text-muted-foreground">3 models evaluated successfully</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">Report Generated</p>
                      <p className="text-xs text-muted-foreground">Q4 Model Performance Report is ready</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>

              {/* Profile */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-card">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>My Account</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {user?.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/team")}>
                    Team Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>API Keys</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Global Search Dialog */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput 
          placeholder="Search models, datasets, evaluations..." 
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {searchResults.models.length > 0 && (
            <CommandGroup heading="Models">
              {searchResults.models.map((model: any) => (
                <CommandItem
                  key={model.id}
                  onSelect={() => {
                    navigate('/models');
                    setSearchOpen(false);
                  }}
                >
                  <Brain className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{model.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {model.framework} • {model.model_type}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          {searchResults.datasets.length > 0 && (
            <CommandGroup heading="Datasets">
              {searchResults.datasets.map((dataset: any) => (
                <CommandItem
                  key={dataset.id}
                  onSelect={() => {
                    navigate('/insights');
                    setSearchOpen(false);
                  }}
                >
                  <Database className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{dataset.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {dataset.row_count} rows
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          {searchQuery && (searchResults.models.length > 0 || searchResults.datasets.length > 0) && (
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => { navigate('/models'); setSearchOpen(false); }}>
                <BarChart className="mr-2 h-4 w-4" />
                View all models
              </CommandItem>
              <CommandItem onSelect={() => { navigate('/upload'); setSearchOpen(false); }}>
                <Database className="mr-2 h-4 w-4" />
                View all datasets
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </nav>
  );
};

export default Navbar;
