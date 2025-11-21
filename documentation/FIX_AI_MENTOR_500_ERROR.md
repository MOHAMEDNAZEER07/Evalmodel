# 🔧 FIX: AI Mentor 500 Error - "AI service error"

## 🎯 Problem
You're getting: `{"error":"AI service error"}` with status 500

This means the Edge Function is deployed and the secret exists, but the **Gemini API call is failing**.

---

## 🔍 STEP 1: Check Supabase Logs

1. Go to: https://supabase.com/dashboard/project/pohjbwazayfoynpbgfpn/functions
2. Click on **"ai-mentor"**
3. Click **"Logs"** tab
4. Look at the most recent error entry
5. **Expand it** to see the detailed error message

### What to Look For:

**If you see:** `"Gemini API error: 400"`
- Your API key format is wrong or the request is malformed

**If you see:** `"Gemini API error: 401"` or `"API key not valid"`
- Your GEMINI_API_KEY is incorrect or expired

**If you see:** `"Gemini API error: 403"`
- Your API key doesn't have permission or the API isn't enabled

**If you see:** `"Gemini API error: 429"`
- You've hit the rate limit (15 requests/min on free tier)

---

## ✅ STEP 2: Verify Your Gemini API Key

### A. Check the Key in Google AI Studio

1. Go to: https://makersuite.google.com/app/apikey
2. Find your API key
3. Check the **Status** - it should say **"Active"**
4. If status is anything else, create a new key

### B. Test Your API Key Directly

Copy this PowerShell command (replace `YOUR_GEMINI_KEY` with your actual key):

```powershell
$testBody = @{
    contents = @(
        @{
            parts = @(
                @{ text = "Hello, are you working?" }
            )
        }
    )
} | ConvertTo-Json -Depth 10

$testHeaders = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_GEMINI_KEY" -Method Post -Headers $testHeaders -Body $testBody
    Write-Host "✅ SUCCESS! Your Gemini API key works!"
    Write-Host $response.candidates[0].content.parts[0].text
} catch {
    Write-Host "❌ FAILED! Your Gemini API key has an issue"
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host $reader.ReadToEnd()
}
```

**Expected Result:** You should see a friendly AI response!

**If this fails:** Your Gemini API key is the problem.

---

## 🔄 STEP 3: Update the Secret in Supabase

If your API key test above failed, get a new key and update Supabase:

### A. Get a Fresh API Key

1. Go to: https://makersuite.google.com/app/apikey
2. Click **"Create API key"**
3. Select **"Create API key in new project"**
4. **Copy the new key** immediately

### B. Update Supabase Secret

1. Go to: https://supabase.com/dashboard/project/pohjbwazayfoynpbgfpn/functions
2. Click on **"ai-mentor"**
3. Click **"Settings"** tab
4. Find **"Secrets"** section
5. Find `GEMINI_API_KEY` in the list
6. Click **"Edit"** or the **pencil icon**
7. **Paste your NEW Gemini API key**
8. Click **"Save"**
9. **Wait 10-15 seconds** for changes to propagate

### C. Test Again

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

---

## 🐛 STEP 4: Other Possible Issues

### Issue: API Key Has Wrong Permissions

**Solution:**
- Some Google Cloud projects have API restrictions
- Go to: https://console.cloud.google.com/apis/credentials
- Find your API key
- Click "Edit"
- Under "API restrictions", select "Don't restrict key" (for testing)
- Save and try again

### Issue: Gemini API Not Enabled

**Solution:**
1. Go to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
2. Make sure "Generative Language API" is **ENABLED**
3. If not, click **"Enable"**
4. Wait 1-2 minutes and try again

### Issue: Rate Limit

**Solution:**
- Free tier: 15 requests per minute, 1,500 per day
- Wait 60 seconds and try again
- Check usage at: https://makersuite.google.com/app/apikey

---

## 📊 STEP 5: Check the Actual Error

After trying the above, if it still fails:

1. Go to Supabase Dashboard → Edge Functions → ai-mentor → **Logs**
2. Copy the FULL error message
3. The error will tell you exactly what's wrong

### Common Error Messages:

**"API key not valid. Please pass a valid API key."**
→ Your key is wrong or expired

**"The request is missing a valid API key."**
→ The secret name is wrong (must be exactly `GEMINI_API_KEY`)

**"Quota exceeded"**
→ You've hit the free tier limit

**"Project has not enabled the API"**
→ Enable Generative Language API in Google Cloud Console

---

## ✅ VERIFICATION

Once fixed, you should see:

```json
{
  "choices": [{
    "delta": {
      "content": "ROC-AUC (Receiver Operating Characteristic - Area Under Curve)..."
    }
  }]
}
```

The response will stream in chunks with AI explaining your question! 🎉

---

## 🆘 STILL NOT WORKING?

1. **Delete and recreate the Edge Function:**
   - Go to Supabase Dashboard → Edge Functions
   - Delete `ai-mentor`
   - Create new function with same name
   - Copy code from `index.ts` again
   - Add `GEMINI_API_KEY` secret
   - Test

2. **Try a different Gemini model:**
   - In `index.ts`, change `gemini-1.5-flash` to `gemini-1.0-pro`
   - Redeploy function

3. **Check if Gemini is available in your region:**
   - Gemini API might have regional restrictions
   - Check: https://ai.google.dev/available_regions

---

**Need help? Share the exact error from Supabase Logs!**
