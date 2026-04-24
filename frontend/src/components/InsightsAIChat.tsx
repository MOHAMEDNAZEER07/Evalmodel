import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, MessageSquare, Send, Loader2, X, Minimize2, Maximize2, Sparkles } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { ChatMarkdown } from "@/components/ChatMarkdownRenderer";
import type { Message, InsightsAIChatProps } from "@/types/insights-chat";
import { buildAllEvaluationsContext, buildContextMessage } from "@/utils/chat-context-builder";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

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
  modelMetrics,
  // Hybrid Trust Framework props
  trustScore,
  metaScore,
  dii,
  componentScores,
  riskValues,
  hybridWeights,
  datasetHealthScore,
  metaFlags,
  metaRecommendations,
  metaVerdict,
  // Explainability props
  featureImportance,
  explainabilityMethod,
  shapSummary,
  // Fairness props
  fairnessMetrics,
  groupMetrics,
  sensitiveAttribute,
  inline = false,
  allEvaluations = [],
  allModels = [],
  allDatasets = []
}: InsightsAIChatProps) {
  const [isOpen, setIsOpen] = useState(externalIsOpen || inline || false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Dynamic welcome message based on insight type
  const welcomeMessage = insightType === "model" 
    ? `Hi! I'm your **Model Performance Analyzer** 🎯

I'm analyzing YOUR SPECIFIC MODELS and have access to ALL your evaluation results.

**What I can help you with:**
• Interpret YOUR model's actual metrics (accuracy, precision, recall, F1)
• Explain why YOUR model performs the way it does
• Identify specific strengths and weaknesses in YOUR models
• Suggest concrete improvements based on YOUR actual performance
• Compare different models against each other
• Explain any evaluation result from your history
• Determine if YOUR model is overfitting or underfitting

**What I DON'T do:**
❌ General ML tutorials or code examples (use the purple AI icon for that)
❌ Discuss models you haven't uploaded
❌ Generic advice without looking at YOUR metrics

I have YOUR complete evaluation history. Ask me about any model's performance! What would you like to understand?`
    : `Hi! I'm your **Data Quality Analyzer** 📊

I'm analyzing YOUR SPECIFIC DATASET and have access to all your model evaluation results.

**What I can help you with:**
• Interpret YOUR dataset's actual quality metrics
• Explain what YOUR outliers mean for YOUR data
• Analyze YOUR feature correlations
• Identify specific issues in YOUR data
• Suggest concrete data cleaning steps for YOUR dataset
• Explain how data quality affects your model performance
• Determine if YOUR data is ready for modeling

**What I DON'T do:**
❌ General data science tutorials or code examples (use the purple AI icon for that)
❌ Discuss hypothetical datasets
❌ Generic advice without looking at YOUR data

I have YOUR dataset's complete quality report. Let's improve YOUR data! What would you like to know?`;

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

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (onOpenChange) {
      onOpenChange(open);
    }
  };

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (inline) {
      // For inline mode, scroll within the container only
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    } else {
      // For floating mode, use scrollIntoView
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [inline]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const getContextInfo = useCallback(() => {
    const allEvalsContext = buildAllEvaluationsContext(allEvaluations, allModels, allDatasets);
    return buildContextMessage(insightType, allEvalsContext, {
      modelName, modelType, modelFramework, datasetName, evalScore, modelMetrics,
      trustScore, metaScore, dii, componentScores, riskValues, hybridWeights,
      datasetHealthScore, metaFlags, metaRecommendations, metaVerdict,
      featureImportance, explainabilityMethod, shapSummary,
      fairnessMetrics, groupMetrics, sensitiveAttribute,
      qualityScore, outlierCount, correlationCount, issues, summary,
    });
  }, [
    allEvaluations,
    allModels,
    allDatasets,
    insightType,
    modelName,
    modelType,
    modelFramework,
    datasetName,
    evalScore,
    modelMetrics,
    trustScore,
    metaScore,
    dii,
    componentScores,
    riskValues,
    hybridWeights,
    datasetHealthScore,
    metaFlags,
    metaRecommendations,
    metaVerdict,
    featureImportance,
    explainabilityMethod,
    shapSummary,
    fairnessMetrics,
    groupMetrics,
    sensitiveAttribute,
    qualityScore,
    outlierCount,
    correlationCount,
    issues,
    summary,
  ]);

  const sendMessage = useCallback(async () => {
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
      const contextInfo = getContextInfo();
      
      // Build comprehensive evaluations data with model/dataset names
      const evaluationsWithNames = allEvaluations.map(ev => {
        const model = allModels.find(m => m.id === ev.model_id);
        const dataset = allDatasets.find(d => d.id === ev.dataset_id);
        return {
          ...ev,
          model_name: model?.name || 'Unknown Model',
          model_type: model?.model_type || 'unknown',
          model_framework: model?.framework || 'unknown',
          dataset_name: dataset?.name || 'Unknown Dataset'
        };
      });
      
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
          // Include all evaluations for comprehensive answers
          allEvaluations: evaluationsWithNames,
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
          // Include all evaluations even for dataset insights
          allEvaluations: evaluationsWithNames,
          contextMessage: contextInfo
        }
      };
      
      // Debug logging
      console.log("🔍 AI Chat Debug - Insight Type:", insightType);
      console.log("🔍 AI Chat Debug - Model Metrics:", modelMetrics);
      console.log("🔍 AI Chat Debug - All Evaluations Count:", allEvaluations.length);
      console.log("🔍 AI Chat Debug - All Models Count:", allModels.length);
      console.log("🔍 AI Chat Debug - All Datasets Count:", allDatasets.length);
      console.log("🔍 AI Chat Debug - Evaluations With Names:", evaluationsWithNames);
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
    } catch (error: unknown) {
      console.error("Error sending message:", error);
      
      // Extract meaningful error info
      let errorDetail = "";
      if (error instanceof Error) {
        errorDetail = error.message;
      }
      if (typeof error === "object" && error !== null && "context" in error) {
        try {
          const contextValue = (error as { context?: unknown }).context;
          const body = typeof contextValue === 'string' ? JSON.parse(contextValue) : contextValue;
          if (body?.error) errorDetail = body.error;
          if (body?.code) errorDetail += ` (${body.code})`;
        } catch { /* ignore parse errors */ }
      }
      
      let userMessage = "I'm sorry, I encountered an error.";
      if (errorDetail.includes("GEMINI_API_KEY") || errorDetail.includes("NO_API_KEY")) {
        userMessage += " The AI service API key is not configured. Please contact the administrator.";
      } else if (errorDetail.includes("Rate limit") || errorDetail.includes("429")) {
        userMessage += " You're sending messages too quickly. Please wait a moment and try again.";
      } else if (errorDetail.includes("circuit") || errorDetail.includes("503")) {
        userMessage += " The AI service is temporarily unavailable. Please try again in a few minutes.";
      } else if (errorDetail.includes("Failed to fetch") || errorDetail.includes("NetworkError") || errorDetail.includes("TypeError")) {
        userMessage += " Could not reach the AI service. Please check your internet connection and try again.";
      } else if (errorDetail) {
        userMessage += ` Details: ${errorDetail}`;
      } else {
        userMessage += " Please try again later.";
      }
      
      console.error("🔍 AI Chat Error Detail:", errorDetail || "No details available");
      
      const errorMessage: Message = {
        role: "assistant",
        content: userMessage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [
    input,
    isLoading,
    messages,
    insightType,
    modelName,
    modelType,
    modelFramework,
    datasetName,
    evalScore,
    modelMetrics,
    qualityScore,
    outlierCount,
    correlationCount,
    issues,
    summary,
    allEvaluations,
    allModels,
    allDatasets,
    getContextInfo,
  ]);

  // Auto-send initial question
  useEffect(() => {
    if (initialQuestion && isOpen && !hasAutoSent && input === initialQuestion) {
      const timer = setTimeout(() => {
        setHasAutoSent(true);
        void sendMessage();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initialQuestion, isOpen, hasAutoSent, input, sendMessage]);

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

  // Floating button mode (when not inline and not open)
  if (!isOpen && !inline) {
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

  // Inline mode - embedded in the page
  if (inline) {
    return (
      <div className="flex flex-col h-[500px]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary-foreground animate-glow-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Ask EvalModel</h2>
              <Badge className="bg-accent/20 text-accent-foreground border-accent/30">
                <Sparkles className="h-3 w-3 mr-1" />
                {insightType === "model" ? "Analyzing YOUR Model" : "Analyzing YOUR Data"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
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
                className={`max-w-[85%] rounded-xl p-4 ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-primary to-accent text-white"
                    : "bg-muted/50 border border-border/50"
                }`}
              >
                {message.role === "assistant" ? (
                  <ChatMarkdown content={message.content} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                <span className={`text-xs mt-2 block ${message.role === "user" ? "text-white/70" : "opacity-50"}`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {message.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center flex-shrink-0">
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
              <div className="bg-muted/50 border border-border/50 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Analyzing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Questions */}
        {messages.length <= 1 && (
          <div className="pt-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">Quick questions:</p>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q, idx) => (
                <Button
                  key={idx}
                  onClick={() => handleQuickQuestion(q)}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="pt-4 border-t border-border/50 mt-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder={insightType === "model" 
                ? "Ask about your model's performance, metrics, improvements..."
                : "Ask about your data quality, outliers, correlations..."
              }
              disabled={isLoading}
              className="bg-muted/50 border-border/50 focus:border-primary/50"
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="btn-glow"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Ask
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Floating card mode (original behavior)
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
                      ? "bg-gradient-to-r from-primary to-accent text-white"
                      : "bg-muted/50 border border-border/50"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <ChatMarkdown content={message.content} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  <span className={`text-xs mt-1 block ${message.role === "user" ? "text-white/70" : "opacity-50"}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {message.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center flex-shrink-0">
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
