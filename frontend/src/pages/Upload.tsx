import { useState } from "react";
import { Upload as UploadIcon, FileText, CheckCircle2, Database, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

type UploadType = 'model' | 'dataset';
type ModelType = 'classification' | 'regression' | 'nlp' | 'cv';
type ModelFramework = 'sklearn' | 'pytorch' | 'tensorflow' | 'keras' | 'onnx';

const Upload = () => {
  const [activeTab, setActiveTab] = useState<UploadType>('model');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Model metadata
  const [modelName, setModelName] = useState("");
  const [modelDescription, setModelDescription] = useState("");
  const [modelType, setModelType] = useState<ModelType>("classification");
  const [modelFramework, setModelFramework] = useState<ModelFramework>("sklearn");
  
  // Dataset metadata
  const [datasetName, setDatasetName] = useState("");
  const [datasetDescription, setDatasetDescription] = useState("");
  
  const { toast } = useToast();
  const { user } = useAuth();

  const getAcceptedFileTypes = () => {
    if (activeTab === 'model') {
      return '.pkl,.pt,.pth,.h5,.onnx';
    }
    return '.csv';
  };

  const validateFile = (file: File): boolean => {
    if (activeTab === 'model') {
      const validExtensions = ['.pkl', '.pt', '.pth', '.h5', '.onnx'];
      return validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }
    return file.name.toLowerCase().endsWith('.csv');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    
    if (file && validateFile(file)) {
      setUploadedFile(file);
      // Auto-populate name from filename
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      if (activeTab === 'model') {
        setModelName(nameWithoutExt);
      } else {
        setDatasetName(nameWithoutExt);
      }
      
      toast({
        title: "File selected",
        description: `${file.name} is ready for upload`,
      });
    } else {
      toast({
        title: "Invalid file type",
        description: activeTab === 'model' 
          ? "Please upload .pkl, .pt, .h5, or .onnx file"
          : "Please upload a CSV file",
        variant: "destructive",
      });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setUploadedFile(file);
      // Auto-populate name
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      if (activeTab === 'model') {
        setModelName(nameWithoutExt);
      } else {
        setDatasetName(nameWithoutExt);
      }
      
      toast({
        title: "File selected",
        description: `${file.name} is ready for upload`,
      });
    }
  };

  const handleUpload = async () => {
    if (!uploadedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    // Check if user is authenticated
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload files",
        variant: "destructive",
      });
      return;
    }

    // Ensure token is set in API client
    const token = localStorage.getItem('access_token');
    if (token) {
      apiClient.setToken(token);
    }

    try {
      setUploading(true);
      setUploadProgress(20);

      const formData = new FormData();
      formData.append('file', uploadedFile);

      if (activeTab === 'model') {
        if (!modelName.trim()) {
          toast({
            title: "Name required",
            description: "Please enter a model name",
            variant: "destructive",
          });
          setUploading(false);
          return;
        }

        formData.append('name', modelName);
        formData.append('type', modelType);
        formData.append('framework', modelFramework);
        if (modelDescription) {
          formData.append('description', modelDescription);
        }

        setUploadProgress(50);
        await apiClient.uploadModel(formData);
        setUploadProgress(100);

        toast({
          title: "Model uploaded successfully!",
          description: `${modelName} has been uploaded and is ready for evaluation`,
        });
      } else {
        if (!datasetName.trim()) {
          toast({
            title: "Name required",
            description: "Please enter a dataset name",
            variant: "destructive",
          });
          setUploading(false);
          return;
        }

        formData.append('name', datasetName);
        if (datasetDescription) {
          formData.append('description', datasetDescription);
        }

        setUploadProgress(50);
        await apiClient.uploadDataset(formData);
        setUploadProgress(100);

        toast({
          title: "Dataset uploaded successfully!",
          description: `${datasetName} has been uploaded`,
        });
      }

      // Reset form
      setTimeout(() => {
        setUploadedFile(null);
        setModelName("");
        setModelDescription("");
        setDatasetName("");
        setDatasetDescription("");
        setUploadProgress(0);
        setUploading(false);
      }, 1500);

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive",
      });
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClear = () => {
    setUploadedFile(null);
    setModelName("");
    setModelDescription("");
    setDatasetName("");
    setDatasetDescription("");
    setUploadProgress(0);
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Upload Files
          </h1>
          <p className="text-muted-foreground text-lg">
            Upload models or datasets to begin evaluation
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v as UploadType);
          setUploadedFile(null);
          handleClear();
        }}>
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="model" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Upload Model
            </TabsTrigger>
            <TabsTrigger value="dataset" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Upload Dataset
            </TabsTrigger>
          </TabsList>

          <TabsContent value="model" className="space-y-6">
            {/* Model Upload Area */}
            <Card
              className={`glass-card p-12 transition-all duration-300 ${
                isDragging
                  ? "border-primary glow-border scale-105"
                  : "border-border/50 hover:border-primary/30"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div
                  className={`p-6 rounded-full mb-6 transition-all duration-300 ${
                    uploadedFile
                      ? "bg-green-500/10 animate-glow-pulse"
                      : "bg-primary/10"
                  }`}
                >
                  {uploadedFile ? (
                    <CheckCircle2 className="h-16 w-16 text-green-400" />
                  ) : (
                    <UploadIcon className="h-16 w-16 text-primary" />
                  )}
                </div>

                {uploadedFile ? (
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-green-400">
                      File Selected!
                    </h3>
                    <p className="text-muted-foreground mb-4">{uploadedFile.name}</p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Size: {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      Drag and drop your model file here
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      or click to browse files
                    </p>
                  </div>
                )}

                <input
                  type="file"
                  id="file-upload-model"
                  className="hidden"
                  accept={getAcceptedFileTypes()}
                  onChange={handleFileInput}
                />
                <label htmlFor="file-upload-model">
                  <Button className="btn-glow" asChild disabled={uploading}>
                    <span>{uploadedFile ? "Change File" : "Browse Files"}</span>
                  </Button>
                </label>

                <p className="text-xs text-muted-foreground mt-4">
                  Supported formats: .pkl, .pt, .pth, .h5, .onnx (Max: 1GB)
                </p>
              </div>
            </Card>

            {/* Model Metadata Form */}
            {uploadedFile && (
              <Card className="glass-card p-6 animate-fade-in">
                <h3 className="text-lg font-semibold mb-4">Model Information</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="model-name">Model Name *</Label>
                    <Input
                      id="model-name"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder="e.g., BERT Classifier v1"
                      disabled={uploading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="model-description">Description</Label>
                    <Textarea
                      id="model-description"
                      value={modelDescription}
                      onChange={(e) => setModelDescription(e.target.value)}
                      placeholder="Brief description of your model..."
                      disabled={uploading}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="model-type">Model Type *</Label>
                      <Select 
                        value={modelType} 
                        onValueChange={(v) => setModelType(v as ModelType)}
                        disabled={uploading}
                      >
                        <SelectTrigger id="model-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="classification">Classification</SelectItem>
                          <SelectItem value="regression">Regression</SelectItem>
                          <SelectItem value="nlp">NLP</SelectItem>
                          <SelectItem value="cv">Computer Vision</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="framework">Framework *</Label>
                      <Select 
                        value={modelFramework} 
                        onValueChange={(v) => setModelFramework(v as ModelFramework)}
                        disabled={uploading}
                      >
                        <SelectTrigger id="framework">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sklearn">scikit-learn</SelectItem>
                          <SelectItem value="pytorch">PyTorch</SelectItem>
                          <SelectItem value="tensorflow">TensorFlow</SelectItem>
                          <SelectItem value="keras">Keras</SelectItem>
                          <SelectItem value="onnx">ONNX</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <Button 
                      className="btn-glow flex-1" 
                      onClick={handleUpload}
                      disabled={uploading || !modelName.trim()}
                    >
                      {uploading ? "Uploading..." : "Upload Model"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleClear}
                      disabled={uploading}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="dataset" className="space-y-6">
            {/* Dataset Upload Area */}
            <Card
              className={`glass-card p-12 transition-all duration-300 ${
                isDragging
                  ? "border-primary glow-border scale-105"
                  : "border-border/50 hover:border-primary/30"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div
                  className={`p-6 rounded-full mb-6 transition-all duration-300 ${
                    uploadedFile
                      ? "bg-green-500/10 animate-glow-pulse"
                      : "bg-primary/10"
                  }`}
                >
                  {uploadedFile ? (
                    <CheckCircle2 className="h-16 w-16 text-green-400" />
                  ) : (
                    <FileText className="h-16 w-16 text-primary" />
                  )}
                </div>

                {uploadedFile ? (
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-green-400">
                      File Selected!
                    </h3>
                    <p className="text-muted-foreground mb-4">{uploadedFile.name}</p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Size: {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      Drag and drop your dataset here
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      or click to browse files
                    </p>
                  </div>
                )}

                <input
                  type="file"
                  id="file-upload-dataset"
                  className="hidden"
                  accept={getAcceptedFileTypes()}
                  onChange={handleFileInput}
                />
                <label htmlFor="file-upload-dataset">
                  <Button className="btn-glow" asChild disabled={uploading}>
                    <span>{uploadedFile ? "Change File" : "Browse Files"}</span>
                  </Button>
                </label>

                <p className="text-xs text-muted-foreground mt-4">
                  Supported format: CSV (Max: 1GB)
                </p>
              </div>
            </Card>

            {/* Dataset Metadata Form */}
            {uploadedFile && (
              <Card className="glass-card p-6 animate-fade-in">
                <h3 className="text-lg font-semibold mb-4">Dataset Information</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="dataset-name">Dataset Name *</Label>
                    <Input
                      id="dataset-name"
                      value={datasetName}
                      onChange={(e) => setDatasetName(e.target.value)}
                      placeholder="e.g., Customer Reviews Test Set"
                      disabled={uploading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="dataset-description">Description</Label>
                    <Textarea
                      id="dataset-description"
                      value={datasetDescription}
                      onChange={(e) => setDatasetDescription(e.target.value)}
                      placeholder="Brief description of your dataset..."
                      disabled={uploading}
                    />
                  </div>

                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <Button 
                      className="btn-glow flex-1" 
                      onClick={handleUpload}
                      disabled={uploading || !datasetName.trim()}
                    >
                      {uploading ? "Uploading..." : "Upload Dataset"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleClear}
                      disabled={uploading}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Upload;
