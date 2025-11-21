# 🚀 DEPLOY AI MENTOR - DO THIS NOW!

## ⏱️ Time Required: 5 minutes

You're getting a **500 Internal Server Error** because the Edge Function isn't deployed yet. Follow these steps:

---

## 📋 STEP 1: Get Gemini API Key (2 minutes)

1. **Open this link**: https://makersuite.google.com/app/apikey
2. Click **"Create API key"**
3. Select **"Create API key in new project"**
4. **Copy the key** (looks like: `AIzaSy...`)
5. Save it in a notepad temporarily

---

## 📋 STEP 2: Deploy to Supabase (3 minutes)

### A. Open Supabase Dashboard
1. **Open**: https://supabase.com/dashboard/project/pohjbwazayfoynpbgfpn
2. Sign in if needed

### B. Go to Edge Functions
1. In the left sidebar, find **"Edge Functions"**
2. Click it

### C. Create New Function
1. Click **"Deploy a new function"** button
2. You'll see a code editor

### D. Configure Function
1. **Name**: Enter `ai-mentor` (exactly, no spaces)
2. **Code Editor**: 
   - Delete any existing code
   - Open this file on your computer: `C:\Users\moham\OneDrive\Desktop\evalmodel\evalmodel\supabase\functions\ai-mentor\index.ts`
   - Copy ALL the code (Ctrl+A, Ctrl+C)
   - Paste into Supabase editor (Ctrl+V)

### E. Deploy It!
1. Click **"Deploy"** button at bottom
2. Wait 10-30 seconds
3. You should see: ✅ "Function deployed successfully"

---

## 📋 STEP 3: Add Gemini API Key (1 minute)

### A. Open Function Settings
1. You should still be on the Edge Functions page
2. Click on **"ai-mentor"** in the list
3. Click the **"Settings"** tab

### B. Add Secret
1. Scroll to **"Secrets"** or **"Environment Variables"** section
2. Click **"Add new secret"**
3. Enter:
   - **Name**: `GEMINI_API_KEY` (exactly, all caps)
   - **Value**: Paste your Gemini API key from Step 1
4. Click **"Save"** or **"Add secret"**

---

## 🧪 STEP 4: Test It!

### Test via PowerShell:

Copy and paste this into PowerShell:

```powershell
$body = @{
    messages = @(
        @{
            role = "user"
            content = "What is ROC-AUC score?"
        }
    )
    context = @{
        page = "dashboard"
    }
} | ConvertTo-Json -Depth 10

$headers = @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvaGpid2F6YXlmb3lucGJnZnBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTM3NzYsImV4cCI6MjA3NzMyOTc3Nn0.J9pP8P-D_pPPKUrV1s4AHXgXDYdU4kGF25qzFUK2m1M"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "https://pohjbwazayfoynpbgfpn.supabase.co/functions/v1/ai-mentor" -Method Post -Headers $headers -Body $body
```

**Expected Result**: You'll see an AI response explaining ROC-AUC! 🎉

---

## ✅ VERIFICATION CHECKLIST

After deployment, verify:

- [ ] Edge Function shows "Active" status in Supabase
- [ ] Secret `GEMINI_API_KEY` is added (shows as `••••••••`)
- [ ] PowerShell test returns AI response (not error)
- [ ] Open your app at http://localhost:8080
- [ ] Click the bot icon in bottom-right corner
- [ ] Type a question and get a response

---

## 🐛 IF YOU GET ERRORS

### "GEMINI_API_KEY is not configured"
→ Go back to Step 3, add the secret

### "API key not valid"
→ Check your Gemini key is active at https://makersuite.google.com/app/apikey

### "Function not found"
→ Make sure function name is exactly `ai-mentor` (no spaces)

### Still 500 error after deployment?
→ Check function logs:
1. Supabase Dashboard → Edge Functions → ai-mentor
2. Click **"Logs"** tab
3. Look for error messages

---

## 🎯 QUICK LINKS

- **Supabase Dashboard**: https://supabase.com/dashboard/project/pohjbwazayfoynpbgfpn
- **Edge Functions**: https://supabase.com/dashboard/project/pohjbwazayfoynpbgfpn/functions
- **Get Gemini Key**: https://makersuite.google.com/app/apikey
- **Code to Deploy**: `C:\Users\moham\OneDrive\Desktop\evalmodel\evalmodel\supabase\functions\ai-mentor\index.ts`

---

## 💡 TIP

The code is already perfect and ready to deploy! Just copy-paste it into Supabase Dashboard. No changes needed!

**After deployment, your AI Mentor will be live and working! 🚀**
