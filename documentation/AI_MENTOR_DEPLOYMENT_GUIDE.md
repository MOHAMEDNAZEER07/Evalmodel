# 🤖 AI MENTOR - DETAILED STEP-BY-STEP DEPLOYMENT GUIDE

## 📝 Overview
This guide will walk you through deploying the AI Mentor feature using Google Gemini API. Total time: **10 minutes**.

---

## 🔑 PART 1: Get Your Google Gemini API Key

### Step 1.1: Navigate to Google AI Studio
1. Open your web browser
2. Go to: **https://makersuite.google.com/app/apikey**
3. You'll be redirected to Google AI Studio

### Step 1.2: Sign In
1. Click **"Sign in with Google"**
2. Use your Google account (any Gmail account works)
3. Accept the terms of service if prompted

### Step 1.3: Create API Key
1. You'll see a page titled **"Get API Key"**
2. Click the blue button: **"Create API key"**
3. A dialog will appear with options:
   - **"Create API key in new project"** (recommended for first time)
   - OR select an existing Google Cloud project
4. Click **"Create API key in new project"**
5. Wait 5-10 seconds while it creates

### Step 1.4: Copy Your API Key
1. A new dialog appears showing your API key
2. It will look like: `AIzaSyB1234567890abcdefghijklmnopqrst`
3. Click the **"Copy"** button (clipboard icon)
4. **IMPORTANT**: Save this somewhere safe! You can also click "Show API key" later to retrieve it

### Step 1.5: Verify Key is Active
1. Your API key should now appear in the list
2. Status should show as **"Active"**
3. Keep this browser tab open - you'll need the key in a moment

**✅ Part 1 Complete!** You now have a Google Gemini API key.

---

## 🚀 PART 2: Deploy to Supabase Edge Functions

### Step 2.1: Open Supabase Dashboard
1. Open a new browser tab
2. Go to: **https://supabase.com/dashboard**
3. Sign in with your Supabase account

### Step 2.2: Select Your Project
1. You'll see a list of your projects
2. Find and click on your project: **"evalmodel"** or the one with reference `pohjbwazayfoynpbgfpn`
3. Wait for the project dashboard to load

### Step 2.3: Navigate to Edge Functions
1. In the left sidebar, scroll down to find **"Edge Functions"**
2. Click on **"Edge Functions"**
3. You'll see a page that may show:
   - "No functions deployed yet" (if first time)
   - OR a list of existing functions

### Step 2.4: Create New Function
1. Click the button: **"Deploy a new function"** or **"Create a new function"**
2. A modal/page will open with a code editor

### Step 2.5: Configure Function Details
1. **Function Name**: Enter `ai-mentor` (must be exactly this, no spaces)
2. **Region**: Leave as default (usually "US West")
3. You'll see a code editor below

### Step 2.6: Copy the Edge Function Code

**FROM YOUR COMPUTER:**

1. Open File Explorer
2. Navigate to: `C:\Users\moham\OneDrive\Desktop\evalmodel\evalmodel`
3. Go into folder: `supabase` → `functions` → `ai-mentor`
4. Open the file: `index.ts` (use Notepad, VS Code, or any text editor)
5. Press `Ctrl + A` to select all
6. Press `Ctrl + C` to copy

**IN SUPABASE DASHBOARD:**

7. Go back to the Supabase browser tab
8. Click inside the code editor
9. Press `Ctrl + A` to select any existing code
10. Press `Ctrl + V` to paste your code
11. Verify the code starts with: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";`

### Step 2.7: Deploy the Function
1. Scroll to the bottom of the page
2. Click the green button: **"Deploy function"** or **"Save and deploy"**
3. Wait 10-30 seconds while it deploys
4. You should see a success message: ✅ "Function deployed successfully"

**✅ Part 2 Complete!** Your Edge Function is deployed.

---

## 🔐 PART 3: Add the API Key as a Secret

### Step 3.1: Access Function Settings
1. You should now be on the Edge Functions page
2. Find your `ai-mentor` function in the list
3. Click on the function name **"ai-mentor"** to open it

### Step 3.2: Navigate to Secrets/Settings

**Option A - Via Settings Tab:**
1. Look for tabs at the top: Overview, Settings, Logs, etc.
2. Click on **"Settings"**
3. Scroll down to find **"Secrets"** or **"Environment Variables"**

**Option B - Via Edge Functions Menu:**
1. Go back to Edge Functions main page
2. Click the **"Settings"** icon (⚙️) or **"Manage secrets"** button
3. You'll see a secrets management interface

### Step 3.3: Add New Secret
1. Click **"Add new secret"** or **"New secret"** button
2. A form appears with two fields:

   **Field 1 - Secret Name:**
   ```
   GEMINI_API_KEY
   ```
   (Type this EXACTLY, all caps, with underscore)

   **Field 2 - Secret Value:**
   ```
   AIzaSyB1234567890abcdefghijklmnopqrst
   ```
   (Paste your actual Gemini API key from Part 1)

3. Click **"Add secret"** or **"Save"**

### Step 3.4: Verify Secret is Saved
1. You should see `GEMINI_API_KEY` in the list of secrets
2. The value will be hidden (shown as `••••••••••`)
3. This is normal for security reasons

**✅ Part 3 Complete!** Your API key is securely stored.

---

## 🧪 PART 4: Test the Deployment

### Step 4.1: Get Your Supabase Anon Key

1. In Supabase Dashboard, go to **Settings** (left sidebar)
2. Click **"API"**
3. Under "Project API keys", find **"anon public"**
4. Click the **"Copy"** button to copy the key
5. It looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Step 4.2: Test via PowerShell

1. Open **PowerShell** on your computer
2. Copy and paste these commands one by one:

```powershell
# Step 1: Create the request body
$body = @{
    messages = @(
        @{
            role = "user"
            content = "What is the difference between precision and recall in machine learning?"
        }
    )
    context = @{
        page = "dashboard"
    }
} | ConvertTo-Json -Depth 10

# Step 2: Set up headers with Bearer token (replace YOUR_ANON_KEY with your actual key)
$headers = @{
    "Authorization" = "Bearer YOUR_ANON_KEY"
    "Content-Type" = "application/json"
}

# Step 3: Make the request
Invoke-RestMethod -Uri "https://pohjbwazayfoynpbgfpn.supabase.co/functions/v1/ai-mentor" -Method Post -Headers $headers -Body $body
```

**IMPORTANT:** Replace `YOUR_ANON_KEY` in the Authorization header with your actual Supabase anon key from Step 4.1.

3. Press **Enter** after each command block
4. Wait 2-5 seconds after the final command

**Expected Result:**
You should see a streaming response about precision vs recall!

**If you get an error:**

**Error 401 Unauthorized:**
- You forgot to add `Bearer ` before the token
- Make sure it's: `"Authorization" = "Bearer YOUR_KEY_HERE"`
- Double-check you replaced `YOUR_ANON_KEY` with your actual key

**Error 500 Internal Server Error:**
- The function isn't deployed yet → Go back to Part 2
- The `GEMINI_API_KEY` secret isn't set → Go back to Part 3
- Check function logs in Supabase Dashboard for details

**Other errors:**
- Verify the URL matches your project reference
- Check the function shows "Active" status in dashboard

### Step 4.3: Test in Your App

1. Open a new PowerShell window
2. Navigate to your project:
   ```powershell
   cd C:\Users\moham\OneDrive\Desktop\evalmodel\evalmodel
   ```

3. Make sure your `.env` file has these values:
   ```powershell
   notepad .env
   ```

4. Verify these lines exist:
   ```
   VITE_SUPABASE_URL=https://pohjbwazayfoynpbgfpn.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
   ```

5. Start your frontend (if not already running):
   ```powershell
   npm run dev
   ```

6. Open your browser to: `http://localhost:8080`

### Step 4.4: Use the AI Mentor

1. Look at the **bottom-right corner** of your screen
2. You should see a **purple/blue floating button** with a robot icon 🤖
3. Click the button
4. A chat panel slides in from the right
5. Type a question in the input box, for example:
   - "What is ROC-AUC score?"
   - "Explain overfitting"
   - "How do I choose evaluation metrics?"
6. Press **Enter** or click the Send button
7. Watch the AI respond in real-time with streaming text!

**Expected Behavior:**
- ✅ Chat panel opens smoothly
- ✅ Loading dots appear while AI thinks
- ✅ Response appears word-by-word (streaming)
- ✅ You can ask follow-up questions
- ✅ Chat maintains conversation context

**✅ Part 4 Complete!** Your AI Mentor is live and working!

---

## 🎯 TESTING CHECKLIST

Use this to verify everything works:

- [ ] ✅ Gemini API key created and copied
- [ ] ✅ Supabase Edge Function deployed
- [ ] ✅ Secret `GEMINI_API_KEY` added
- [ ] ✅ PowerShell test returns AI response
- [ ] ✅ Floating bot button appears in app
- [ ] ✅ Chat panel opens when clicked
- [ ] ✅ AI responds to questions
- [ ] ✅ Streaming works (typewriter effect)
- [ ] ✅ Follow-up questions work
- [ ] ✅ No console errors in browser

---

## 🐛 TROUBLESHOOTING

### Problem: "GEMINI_API_KEY is not configured"

**Cause:** The secret wasn't added or has wrong name

**Solution:**
1. Go to Supabase Dashboard → Edge Functions → ai-mentor → Settings
2. Check the secret name is exactly: `GEMINI_API_KEY` (all caps)
3. Delete and re-add if needed
4. Wait 10 seconds for changes to propagate

### Problem: "API key not valid"

**Cause:** Wrong API key or key not enabled

**Solution:**
1. Go back to https://makersuite.google.com/app/apikey
2. Verify your key shows as "Active"
3. Copy the key again (click "Show API key")
4. Update the secret in Supabase with the correct key

### Problem: Floating button doesn't appear

**Cause:** Frontend env variables incorrect

**Solution:**
1. Check your `.env` file has:
   ```
   VITE_SUPABASE_URL=https://pohjbwazayfoynpbgfpn.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
   ```
2. Restart the frontend: `npm run dev`
3. Hard refresh browser: `Ctrl + Shift + R`

### Problem: Chat opens but no response

**Cause:** Function not deployed or CORS issue

**Solution:**
1. Check function is deployed:
   - Supabase Dashboard → Edge Functions
   - ai-mentor should show "Active" status
2. Check browser console (F12) for errors
3. Verify the function URL in AIMentor.tsx matches your project

### Problem: Error 429 "Rate limit exceeded"

**Cause:** Too many requests (free tier limit)

**Solution:**
1. Wait 60 seconds
2. Free tier limits:
   - 15 requests per minute
   - 1,500 requests per day
3. If needed, upgrade at https://makersuite.google.com

### Problem: Response is very slow

**Cause:** First request to Edge Function (cold start)

**Solution:**
1. This is normal for first request after inactivity
2. Subsequent requests will be faster (< 2 seconds)
3. Consider upgrading Supabase plan for faster cold starts

### Problem: Streaming stops midway

**Cause:** Network timeout or API issue

**Solution:**
1. Check your internet connection
2. Try asking a shorter question
3. Check Gemini API status at https://status.cloud.google.com

---

## 📊 MONITORING & LOGS

### View Edge Function Logs

1. Supabase Dashboard → Edge Functions
2. Click on `ai-mentor`
3. Click **"Logs"** tab
4. You'll see:
   - All requests
   - Response times
   - Any errors
   - Request/response bodies

### Useful Log Filters

- **Error only**: Filter by status `5xx` or `4xx`
- **Slow requests**: Look for requests > 5 seconds
- **Recent**: Last 1 hour, 24 hours, 7 days

---

## 💡 TIPS & BEST PRACTICES

### 1. API Key Security
- ✅ **DO**: Store in Supabase Secrets
- ❌ **DON'T**: Commit to GitHub
- ❌ **DON'T**: Put in frontend code
- ❌ **DON'T**: Share publicly

### 2. Rate Limits
- Free tier: 15 requests/min, 1,500/day
- Monitor usage in Google AI Studio
- Upgrade if needed for production

### 3. Cost Management
- Gemini 1.5 Flash is very cheap
- Estimated cost: ~$0.01 per 1,000 questions
- Set billing alerts in Google Cloud

### 4. Context Awareness
The AI Mentor receives context about:
- Current page (Dashboard, Insights, Compare, etc.)
- Model information (if viewing a specific model)
- Conversation history

To add more context, edit the `context` object in your frontend when calling the function.

### 5. Customization
Want to customize? Edit `supabase/functions/ai-mentor/index.ts`:

**Change the model:**
```typescript
// Line ~51: Replace gemini-1.5-flash with:
// - gemini-1.5-pro (smarter, slower, more expensive)
// - gemini-1.0-pro (older, cheaper)
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
```

**Adjust creativity:**
```typescript
// Line ~60: Increase temperature for more creative responses
generationConfig: {
  temperature: 0.9,  // 0.0 = factual, 1.0 = creative
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 4096,  // Max response length
}
```

**Modify expertise:**
Edit the `systemPrompt` variable to add/remove expertise areas or change the AI's personality.

---

## 🎉 SUCCESS!

If you've completed all steps and the checklist, congratulations! 🎊

Your AI Mentor is now:
- ✅ Deployed and running
- ✅ Integrated with your app
- ✅ Ready to help users with ML questions
- ✅ Context-aware and intelligent
- ✅ Streaming responses in real-time

### What Can Users Ask?

**Metrics & Evaluation:**
- "What's the difference between accuracy and precision?"
- "When should I use ROC-AUC vs F1 score?"
- "How do I interpret a confusion matrix?"

**Model Selection:**
- "How do I choose between two models?"
- "What metrics are best for imbalanced data?"
- "Should I optimize for precision or recall?"

**Best Practices:**
- "How do I avoid overfitting?"
- "What's a good train/test split ratio?"
- "How many samples do I need for validation?"

**Advanced Topics:**
- "Explain cross-validation"
- "What is hyperparameter tuning?"
- "How do I detect bias in my model?"

---

## 📞 NEED HELP?

If you're stuck:

1. **Check the logs**: Supabase Dashboard → Edge Functions → ai-mentor → Logs
2. **Review this guide**: Re-read the relevant section
3. **Check Gemini API status**: https://status.cloud.google.com
4. **Test the PowerShell command**: Isolate if it's frontend or backend issue
5. **Clear cache**: Hard refresh browser with `Ctrl + Shift + R`

---

**🚀 Happy evaluating with your AI Mentor!**
