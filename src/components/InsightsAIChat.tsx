import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, MessageSquare, Send, Loader2, X, Minimize2, Maximize2, Sparkles } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface InsightsAIChatProps {
  datasetName?: string;
  qualityScore?: number;
  outlierCount?: number;
  correlationCount?: number;
  issues?: string[];
  summary?: string;
  initialQuestion?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Model evaluation props
  insightType?: "dataset" | "model";
  modelName?: string;
  modelType?: string;
  modelFramework?: string;
  evalScore?: number;
  modelMetrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    mae?: number;
    mse?: number;
    rmse?: number;
    r2_score?: number;
  };
}

export function InsightsAIChat({
  datasetName,
  qualityScore,
  outlierCount,
  correlationCount,
  issues,
  summary,
  initialQuestion,
  isOpen: externalIsOpen,
  onOpenChange,
  insightType = "dataset",
  modelName,
  modelType,
  modelFramework,
  evalScore,
  modelMetrics
}: InsightsAIChatProps) {
  const [isOpen, setIsOpen] = useState(externalIsOpen || false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Dynamic welcome message based on insight type
  const welcomeMessage = insightType === "model" 
    ? `Hi! I'm your **Model Performance Analyzer** 🎯

I'm analyzing YOUR SPECIFIC MODEL that's currently displayed in the Insights page.

**What I can help you with:**
• Interpret YOUR model's actual metrics (accuracy, precision, recall, F1)
• Explain why YOUR model performs the way it does
• Identify specific strengths and weaknesses in YOUR model
• Suggest concrete improvements based on YOUR actual performance
• Compare YOUR metrics against benchmarks
• Determine if YOUR model is overfitting or underfitting

**What I DON'T do:**
❌ General ML tutorials or code examples (use the purple AI icon for that)
❌ Discuss models you haven't uploaded
❌ Generic advice without looking at YOUR metrics

I have YOUR model's complete evaluation report. Let's dive into YOUR performance! What would you like to understand about YOUR model?`
    : `Hi! I'm your **Data Quality Analyzer** 📊

I'm analyzing YOUR SPECIFIC DATASET that's currently displayed in the Insights page.

**What I can help you with:**
• Interpret YOUR dataset's actual quality metrics
• Explain what YOUR outliers mean for YOUR data
• Analyze YOUR feature correlations
• Identify specific issues in YOUR data
• Suggest concrete data cleaning steps for YOUR dataset
• Determine if YOUR data is ready for modeling

**What I DON'T do:**
❌ General data science tutorials or code examples (use the purple AI icon for that)
❌ Discuss hypothetical datasets
❌ Generic advice without looking at YOUR data

I have YOUR dataset's complete quality report. Let's improve YOUR data! What would you like to know about YOUR dataset?`;

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: welcomeMessage,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState(initialQuestion || "");
  const [isLoading, setIsLoading] = useState(false);
  const [hasAutoSent, setHasAutoSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset messages when insightType changes
  useEffect(() => {
    console.log("🔄 Insight Type Changed to:", insightType);
    setMessages([
      {
        role: "assistant",
        content: welcomeMessage,
        timestamp: new Date()
      }
    ]);
  }, [insightType, welcomeMessage]);

  // Sync with external control
  useEffect(() => {
    if (externalIsOpen !== undefined) {
      setIsOpen(externalIsOpen);
    }
  }, [externalIsOpen]);

  // Update input when initialQuestion changes
  useEffect(() => {
    if (initialQuestion) {
      setInput(initialQuestion);
      setHasAutoSent(false); // Reset auto-send flag
    }
  }, [initialQuestion]);

  // Auto-send initial question
  useEffect(() => {
    if (initialQuestion && isOpen && !hasAutoSent && input === initialQuestion) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        setHasAutoSent(true);
        sendMessage();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialQuestion, isOpen, hasAutoSent, input]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (onOpenChange) {
      onOpenChange(open);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const buildContextMessage = () => {
    if (insightType === "model") {
      // Model evaluation context
      let context = "Current model evaluation analysis:\n";
      
      if (modelName) {
        context += `- Model: ${modelName}\n`;
      }
      
      if (modelType) {
        context += `- Model Type: ${modelType}\n`;
      }
      
      if (modelFramework) {
        context += `- Framework: ${modelFramework}\n`;
      }
      
      if (datasetName) {
        context += `- Dataset: ${datasetName}\n`;
      }
      
      if (evalScore !== undefined) {
        context += `- EvalScore: ${evalScore.toFixed(1)}/100\n`;
      }
      
      if (modelMetrics) {
        context += `- Performance Metrics:\n`;
        if (modelMetrics.accuracy !== undefined) {
          context += `  • Accuracy: ${(modelMetrics.accuracy * 100).toFixed(2)}%\n`;
        }
        if (modelMetrics.precision !== undefined) {
          context += `  • Precision: ${(modelMetrics.precision * 100).toFixed(2)}%\n`;
        }
        if (modelMetrics.recall !== undefined) {
          context += `  • Recall: ${(modelMetrics.recall * 100).toFixed(2)}%\n`;
        }
        if (modelMetrics.f1_score !== undefined) {
          context += `  • F1 Score: ${(modelMetrics.f1_score * 100).toFixed(2)}%\n`;
        }
        if (modelMetrics.mae !== undefined) {
          context += `  • MAE: ${modelMetrics.mae.toFixed(4)}\n`;
        }
        if (modelMetrics.mse !== undefined) {
          context += `  • MSE: ${modelMetrics.mse.toFixed(4)}\n`;
        }
        if (modelMetrics.rmse !== undefined) {
          context += `  • RMSE: ${modelMetrics.rmse.toFixed(4)}\n`;
        }
        if (modelMetrics.r2_score !== undefined) {
          context += `  • R² Score: ${modelMetrics.r2_score.toFixed(4)}\n`;
        }
      }
      
      return context;
    } else {
      // Dataset quality context
      let context = "Current dataset analysis:\n";
      
      if (datasetName) {
        context += `- Dataset: ${datasetName}\n`;
      }
      
      if (qualityScore !== undefined) {
        context += `- Overall Quality Score: ${qualityScore.toFixed(1)}%\n`;
      }
      
      if (outlierCount !== undefined && outlierCount > 0) {
        context += `- Outliers Detected: ${outlierCount} features with outliers\n`;
      }
      
      if (correlationCount !== undefined && correlationCount > 0) {
        context += `- Feature Correlations: ${correlationCount} significant correlations found\n`;
      }
      
      if (issues && issues.length > 0) {
        context += `- Issues Found:\n${issues.map(i => `  • ${i}`).join('\n')}\n`;
      }
      
      if (summary) {
        context += `- Summary: ${summary}\n`;
      }
      
      return context;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const contextInfo = buildContextMessage();
      
      const requestBody = {
        messages: [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: input }
        ],
        context: insightType === "model" ? {
          page: "insights",
          insightType: "model",
          modelInfo: {
            name: modelName,
            type: modelType,
            framework: modelFramework,
            dataset: datasetName,
            evalScore,
            metrics: modelMetrics
          },
          contextMessage: contextInfo
        } : {
          page: "insights",
          insightType: "dataset",
          datasetInfo: {
            name: datasetName,
            qualityScore,
            outlierCount,
            correlationCount,
            issues,
            summary
          },
          contextMessage: contextInfo
        }
      };
      
      // Debug logging
      console.log("🔍 AI Chat Debug - Insight Type:", insightType);
      console.log("🔍 AI Chat Debug - Model Metrics:", modelMetrics);
      console.log("🔍 AI Chat Debug - Full Context:", requestBody.context);
      
      const { data, error } = await supabase.functions.invoke("ai-mentor", {
        body: requestBody
      });

      if (error) {
        throw error;
      }

      // Handle streaming response
      if (data) {
        let assistantContent = "";
        
        // If data is a string (non-streaming response)
        if (typeof data === 'string') {
          assistantContent = data;
        } 
        // If data has choices array (OpenAI-like format)
        else if (data.choices && data.choices[0]) {
          assistantContent = data.choices[0].delta?.content || data.choices[0].message?.content || "";
        }
        // If data has candidates array (Gemini format)
        else if (data.candidates && data.candidates[0]) {
          assistantContent = data.candidates[0].content?.parts?.[0]?.text || "";
        }

        const assistantMessage: Message = {
          role: "assistant",
          content: assistantContent || "I'm sorry, I couldn't generate a response. Please try again.",
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again later.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = insightType === "model" ? [
    "What are MY model's strongest metrics?",
    "Where is MY model underperforming?",
    "How can I improve MY model's accuracy?",
    "Is MY model overfitting or underfitting?",
    "What features impact MY predictions most?",
  ] : [
    "What are MY main quality issues?",
    "Should I remove outliers in MY data?",
    "Is MY dataset ready for modeling?",
    "How can I improve MY data quality?",
    "What do MY correlations mean?",
  ];

  const handleQuickQuestion = (question: string) => {
    setInput(question);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => handleOpenChange(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-primary to-accent hover:shadow-xl hover:scale-110 transition-all z-50"
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className={`fixed ${isMinimized ? 'bottom-6 right-6 w-80' : 'bottom-6 right-6 w-96 h-[600px]'} shadow-2xl flex flex-col z-50 glass-card glow-border-primary`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Brain className="h-4 w-4 text-primary-foreground animate-glow-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Context-Aware Assistant</h3>
            <Badge variant="outline" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              {insightType === "model" ? "Analyzing YOUR Model" : "Analyzing YOUR Data"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            onClick={() => setIsMinimized(!isMinimized)}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button
            onClick={() => handleOpenChange(false)}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                    <Brain className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 border border-border/50"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <span className="text-xs opacity-50 mt-1 block">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {message.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                  <Brain className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="bg-muted/50 border border-border/50 rounded-xl p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-muted-foreground mb-2">Quick questions:</p>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.slice(0, 3).map((q, idx) => (
                  <Button
                    key={idx}
                    onClick={() => handleQuickQuestion(q)}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-border/50">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask about YOUR dataset quality, outliers, correlations..."
                disabled={isLoading}
                className="bg-muted/50 border-border/50 focus:border-primary/50"
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="flex-shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {isMinimized && (
        <div className="p-4">
          <p className="text-sm text-muted-foreground">Click to expand chat</p>
        </div>
      )}
    </Card>
  );
}
