import { useState, useEffect } from "react";
import { Database, Upload, Download, Trash2, GitBranch, Tag, Clock, TrendingUp, Star, Copy, ExternalLink, MoreVertical } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { useSearch } from "@/hooks/use-search";
import SearchBar from "@/components/SearchBar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ModelVersion {
  id: string;
  model_id: string;
  version: string;
  description: string;
  file_path: string;
  file_size: number;
  metrics?: Record<string, number>;
  tags: string[];
  is_production: boolean;
  is_archived: boolean;
  created_at: string;
  created_by: string;
}

interface Model {
  id: string;
  name: string;
  description: string;
  model_type: string;
  framework: string;
  versions: ModelVersion[];
  latest_version: string;
  production_version?: string;
  total_downloads: number;
  is_starred: boolean;
  uploaded_at: string;
}

const MODEL_TYPES = [
  { value: 'classification', label: 'Classification', icon: '🎯' },
  { value: 'regression', label: 'Regression', icon: '📈' },
  { value: 'nlp', label: 'NLP', icon: '📝' },
  { value: 'cv', label: 'Computer Vision', icon: '👁️' },
];

const FRAMEWORKS = [
  { value: 'sklearn', label: 'scikit-learn' },
  { value: 'pytorch', label: 'PyTorch' },
  { value: 'tensorflow', label: 'TensorFlow' },
  { value: 'keras', label: 'Keras' },
];

export default function ModelRegistry() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTypeValue, setFilterTypeValue] = useState<string>('all');
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [registerModelId, setRegisterModelId] = useState<string>("");
  const [registerFile, setRegisterFile] = useState<File | null>(null);
  const [registerVersion, setRegisterVersion] = useState<string>("");
  const [registerDescription, setRegisterDescription] = useState<string>("");
  const [registerTags, setRegisterTags] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const { toast } = useToast();

  // Use modular search hook
  const {
    searchQuery,
    setSearchQuery,
    setFilter,
    filteredItems: filteredModels,
    resultCount,
  } = useSearch({
    items: models,
    searchFields: ['name', 'description', 'framework', 'model_type', 'production_version'],
    sortByRelevance: true,
  });

  // Handler for filter changes
  const handleFilterChange = (value: string) => {
    setFilterTypeValue(value);
    setFilter('model_type', value);
  };

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.listModels(100, 0);

      // Mock version data (in real implementation, fetch from model_versions table)
      const modelsWithVersions = (response.models || []).map((model: any) => ({
        ...model,
        versions: [
          {
            id: `${model.id}-v1`,
            model_id: model.id,
            version: '1.0.0',
            description: 'Initial version',
            file_path: model.file_path,
            file_size: model.file_size,
            tags: ['stable'],
            is_production: true,
            is_archived: false,
            created_at: model.uploaded_at,
            created_by: 'user',
          },
        ],
        latest_version: '1.0.0',
        production_version: '1.0.0',
        total_downloads: Math.floor(Math.random() * 1000),
        is_starred: false,
      }));

      setModels(modelsWithVersions);
    } catch (error: any) {
      console.error('Error loading models:', error);
      toast({
        title: "Error Loading Models",
        description: error.message || "Failed to load model registry.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterVersion = async () => {
    toast({
      title: "Feature Coming Soon",
      description: "Model version registration will be available in the next update.",
    });
  };

  const handleDownloadModel = async (model: Model, version: ModelVersion) => {
    try {
      toast({ title: "Preparing download...", description: `Requesting download URL for ${model.name} v${version.version}...` });
      const resp: any = await apiClient.getVersionDownloadUrl(model.id, version.file_path, 120);
      const signed = resp?.signed_url || resp?.signedURL || (typeof resp === 'string' ? resp : null);
      if (!signed) {
        throw new Error('No signed URL returned');
      }
      // Open in new tab to download
      window.open(signed, '_blank');
      toast({ title: 'Download started', description: 'A new tab has been opened for the file download' });
    } catch (error: any) {
      toast({ title: 'Download Failed', description: error?.message || 'Failed to create download URL', variant: 'destructive' });
    }
  };

  const handlePromoteToProduction = async (model: Model, version: ModelVersion) => {
    try {
      toast({ title: "Promoting to Production", description: `Promoting v${version.version} to production...` });
      await apiClient.promoteModelVersion(model.id, version.version);

      // Refresh versions for the selected model if open, and reload summary list
      if (selectedModel && selectedModel.id === model.id) {
        const res: any = await apiClient.listModelVersions(model.id);
        const versions = res?.versions || [];
        setSelectedModel({ ...model, versions, production_version: version.version });
      }

      // Also refresh the top-level models list
      await loadModels();

      toast({ title: "Production Update", description: `v${version.version} is now in production.` });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || 'Failed to promote version', variant: 'destructive' });
    }
  };

  const handleStarModel = (modelId: string) => {
    setModels(prev => prev.map(m => 
      m.id === modelId ? { ...m, is_starred: !m.is_starred } : m
    ));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Database className="h-8 w-8 text-primary animate-pulse" />
          <div>
            <h1 className="text-3xl font-bold">Model Registry</h1>
            <p className="text-muted-foreground">Loading models...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Model Registry</h1>
            <p className="text-muted-foreground">Centralized model versioning and management</p>
          </div>
        </div>
        <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Register New Version
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Register Model Version</DialogTitle>
              <DialogDescription>
                Register a new version of an existing model or create a new model entry.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="register-model-select">Model</Label>
                <select
                  id="register-model-select"
                  title="Select model to register a new version for"
                  className="w-full px-3 py-2 border rounded-md"
                  value={registerModelId || (models[0]?.id ?? '')}
                  onChange={(e) => setRegisterModelId(e.target.value)}
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Version</Label>
                <Input placeholder="2.0.0" value={registerVersion} onChange={(e) => setRegisterVersion(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Improved accuracy with new features..." rows={3} value={registerDescription} onChange={(e) => setRegisterDescription(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input placeholder="stable, production, optimized" value={registerTags} onChange={(e) => setRegisterTags(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-file">Model File</Label>
                <input id="register-file" title="Choose model file" type="file" accept=".pkl,.pt,.pth,.h5,.onnx" onChange={(e) => setRegisterFile(e.target.files?.[0] ?? null)} />
                <p id="register-file-help" className="text-xs text-muted-foreground mt-1">Supported: .pkl, .pt, .pth, .h5, .onnx — max {import.meta.env.VITE_MAX_UPLOAD_SIZE_MB || 50}MB</p>
              </div>

              <Button onClick={async () => {
                // perform upload
                if (!registerModelId && models.length > 0) setRegisterModelId(models[0].id);
                if (!registerModelId && models.length === 0) {
                  toast({ title: 'No model selected', description: 'Please select or create a model first', variant: 'destructive' });
                  return;
                }
                if (!registerFile) {
                  toast({ title: 'No file', description: 'Please select a model file to upload', variant: 'destructive' });
                  return;
                }
                if (!registerVersion) {
                  toast({ title: 'No version', description: 'Please specify a version string', variant: 'destructive' });
                  return;
                }

                try {
                  setIsUploading(true);
                  const fd = new FormData();
                  fd.append('file', registerFile as File);
                  fd.append('version', registerVersion);
                  if (registerDescription) fd.append('description', registerDescription);
                  if (registerTags) fd.append('tags', registerTags);

                  await apiClient.uploadModelVersion(registerModelId || models[0].id, fd);
                  toast({ title: 'Upload complete', description: `Version ${registerVersion} uploaded` });
                  setIsRegisterDialogOpen(false);
                  // reset
                  setRegisterFile(null);
                  setRegisterVersion('');
                  setRegisterDescription('');
                  setRegisterTags('');
                  await loadModels();
                } catch (err: any) {
                  toast({ title: 'Upload failed', description: err?.message || 'Failed to upload model version', variant: 'destructive' });
                } finally {
                  setIsUploading(false);
                }
              }} className="w-full" disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Register Version'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Models</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{models.length}</div>
            <p className="text-xs text-muted-foreground">Across all types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Versions</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {models.reduce((sum, m) => sum + m.versions.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground">All registered versions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Production</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {models.filter(m => m.production_version).length}
            </div>
            <p className="text-xs text-muted-foreground">Production deployments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {models.reduce((sum, m) => sum + m.total_downloads, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All time downloads</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <SearchBar
            placeholder="Search models by name, description, framework..."
            value={searchQuery}
            onChange={setSearchQuery}
            filterLabel="Filter by type"
            filterValue={filterTypeValue}
            filterOptions={[
              { label: 'All Types', value: 'all' },
              ...MODEL_TYPES.map(type => ({
                label: type.label,
                value: type.value
              }))
            ]}
            onFilterChange={handleFilterChange}
          />
        </CardContent>
      </Card>

      {/* Models Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Models</CardTitle>
          <CardDescription>
            {resultCount} model{resultCount !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Framework</TableHead>
                <TableHead>Latest Version</TableHead>
                <TableHead>Production</TableHead>
                <TableHead>Downloads</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredModels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No models found. Try adjusting your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredModels.map((model) => (
                  <TableRow key={model.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStarModel(model.id)}
                      >
                        <Star className={`h-4 w-4 ${model.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{model.name}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {model.description || 'No description'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {MODEL_TYPES.find(t => t.value === model.model_type)?.icon}{' '}
                        {MODEL_TYPES.find(t => t.value === model.model_type)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{model.framework}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        <span className="font-mono text-sm">v{model.latest_version}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {model.production_version ? (
                        <Badge className="bg-green-500">
                          <Tag className="h-3 w-3 mr-1" />
                          v{model.production_version}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Download className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{model.total_downloads.toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(model.uploaded_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setSelectedModel(model)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadModel(model, model.versions[0])}>
                            <Download className="h-4 w-4 mr-2" />
                            Download Latest
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePromoteToProduction(model, model.versions[0])}>
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Promote to Production
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Model
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Selected Model Details */}
      {selectedModel && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {selectedModel.name}
                  {selectedModel.is_starred && <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />}
                </CardTitle>
                <CardDescription>{selectedModel.description}</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setSelectedModel(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Model Type</Label>
                  <p className="font-medium">{selectedModel.model_type}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Framework</Label>
                  <p className="font-medium">{selectedModel.framework}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Total Versions</Label>
                  <p className="font-medium">{selectedModel.versions.length}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Total Downloads</Label>
                  <p className="font-medium">{selectedModel.total_downloads.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Version History</h4>
                <div className="space-y-2">
                  {selectedModel.versions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between border rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">v{version.version}</Badge>
                        {version.is_production && (
                          <Badge className="bg-green-500">Production</Badge>
                        )}
                        {version.tags.map(tag => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {formatFileSize(version.file_size)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadModel(selectedModel, version)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
