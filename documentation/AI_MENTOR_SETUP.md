# AI Mentor Setup Guide - Google Gemini Edition

## Overview
The AI Mentor feature uses Google Gemini 1.5 Flash for fast, intelligent responses about ML model evaluation.

## 🔑 Step 1: Get Your Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Get API Key"
3. Create a new API key or use an existing one
4. Copy the API key (starts with `AIza...`)

**Important**: Keep this key secure! Never commit it to your code.

## 🚀 Step 2: Deploy via Supabase Dashboard

Since we don't have Supabase CLI installed, use the web dashboard:

### A. Navigate to Edge Functions
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **pohjbwazayfoynpbgfpn**
3. Click **Edge Functions** in the left sidebar
4. Click **"Create a new function"** or **"Deploy new function"**

### B. Create the Function
1. **Function name**: `ai-mentor`
2. **Copy and paste** the entire contents from:
   ```
   supabase\functions\ai-mentor\index.ts
   ```
3. Click **"Deploy function"**

### C. Set Environment Variable
1. In the Edge Functions page, find your `ai-mentor` function
2. Click on it, then go to **"Settings"** or **"Secrets"**
3. Add a new secret:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: Your Google Gemini API key (AIza...)
4. Save

## ✅ Step 3: Test the Deployment

### Test via curl (PowerShell):
```powershell
$body = @{
    messages = @(
        @{
            role = "user"
            content = "What is the difference between precision and recall?"
        }
    )
    context = @{
        page = "dashboard"
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "https://pohjbwazayfoynpbgfpn.supabase.co/functions/v1/ai-mentor" `
  -Method Post `
  -Headers @{
    "Authorization" = "Bearer YOUR_ANON_KEY"
    "Content-Type" = "application/json"
  } `
  -Body $body
```

### Test in Your App:
1. Run your frontend: `npm run dev`
2. Click the AI Mentor button (floating bot icon in bottom-right)
3. Ask a question like:
   - "Explain ROC-AUC score"
   - "How do I choose between models?"
   - "What metrics should I use for imbalanced data?"

## 🎯 What's Different with Gemini

**Model**: Gemini 1.5 Flash
- ✅ **Free tier**: 15 requests per minute, 1500 per day
- ✅ **Fast**: Optimized for speed
- ✅ **Smart**: Strong reasoning capabilities
- ✅ **Streaming**: Real-time token-by-token responses

**API**: Direct Google AI API
- No third-party dependencies
- Full control over configuration
- Better rate limits than Lovable

## 🐛 Troubleshooting

### Error: "GEMINI_API_KEY is not configured"
**Solution**: Add the secret in Supabase Edge Functions settings

### Error: "API key not valid"
**Solution**: 
1. Verify your API key is correct
2. Make sure it's enabled in Google AI Studio
3. Check if billing is set up (required for production use)

### Error: 429 "Rate limit exceeded"
**Solution**: 
- Free tier: Wait 1 minute
- Or upgrade to paid tier at [Google AI Studio](https://makersuite.google.com)

### CORS errors
**Solution**: The Edge Function has CORS headers configured. Make sure:
1. Your `VITE_SUPABASE_URL` in `.env` is correct
2. You're using the anon key (not service role key) in the frontend

## 📊 Monitoring

View logs in Supabase Dashboard:
1. Go to Edge Functions
2. Select `ai-mentor`  
3. Click "Logs" tab
4. View real-time requests and errors

## 💰 Pricing

**Free Tier** (More than enough for development):
- 15 RPM (requests per minute)
- 1,500 RPD (requests per day)  
- 1 million TPM (tokens per minute)

**Paid Tier** (if you need more):
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens
- See: [Google AI Pricing](https://ai.google.dev/pricing)

## 🎨 Customization

Edit `supabase/functions/ai-mentor/index.ts` to customize:

### Change the Model:
```typescript
// Replace "gemini-1.5-flash" with:
// - "gemini-1.5-pro" (more capable, slower)
// - "gemini-1.0-pro" (older, still good)
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
```

### Adjust Temperature (creativity):
```typescript
generationConfig: {
  temperature: 0.9,  // Higher = more creative (0.0 - 1.0)
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 4096,  // Increase for longer responses
}
```

### Modify System Prompt:
Change the expertise areas or tone in the `systemPrompt` variable.

## ✨ Features

### Context-Aware
- Knows what page you're on
- Can reference model information
- Maintains conversation history

### Expertise Areas
- ✅ Evaluation metrics explanation
- ✅ Model comparison strategies
- ✅ Bias & fairness analysis
- ✅ Feature importance
- ✅ Hyperparameter tuning
- ✅ Data quality
- ✅ Deployment best practices

### Smooth Streaming
- Token-by-token streaming
- Typewriter effect
- Real-time responses

## 🎉 You're All Set!

Once deployed, the AI Mentor will be available throughout your app. Users can ask questions and get instant, intelligent responses about ML evaluation!
