# 🔧 Troubleshooting Playwright Tests

## Common Issues & Solutions

### 🗄️ Database Paused/Inactive

**Problem:** Supabase database was paused
```
Error: connection refused / timeout
Login error: Invalid email or password
```

**Solution:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Check if database shows "Paused" status
4. Click "Resume" or "Restore" button
5. Wait 1-2 minutes for database to start
6. Re-run tests

---

### 🔑 Expired JWT Tokens

**Problem:** Old auth tokens in browser cache
```
401 Unauthorized
Could not validate credentials
```

**Solution:**
Tests now automatically clear auth state before each run. If issues persist:
```bash
# Clear Playwright cache
rm -rf .playwright-state
rm -rf test-results/

# Re-run tests
npm run test:e2e
```

---

### 👤 Test User Issues

**Problem:** Test user doesn't exist or has wrong password
```
Invalid email or password
User not found
```

**Solution:**
```bash
# Delete old test user from Supabase (if exists)
# Then create fresh one:
node tests/scripts/create-test-user.js
```

Or manually in Supabase SQL Editor:
```sql
-- Delete old user
DELETE FROM users WHERE email = 'e2etest@evalmodel.com';

-- Then run create-test-user.js script
```

---

### 🔌 Backend Not Running

**Problem:**
```
fetch failed
ECONNREFUSED 127.0.0.1:8000
```

**Solution:**
```bash
cd backend
uvicorn app.main:app --reload
```

Keep this terminal open while running tests!

---

### ⏱️ Timeouts

**Problem:** Tests timeout on slow connections

**Solution:** Increase timeouts in [playwright.config.ts](playwright.config.ts):
```typescript
timeout: 60 * 1000, // Change from 30s to 60s
```

---

### 🔐 Password Hash Errors

**Problem:**
```
password cannot be longer than 72 bytes
bcrypt error
```

**Root Cause:** Your actual user account has corrupted password hash

**Solution:**
1. This doesn't affect test user (`e2etest@evalmodel.com`)
2. If you need to fix your personal account:
   - Reset password through Supabase
   - Or delete and recreate account

**Test user will always work** - it uses proper short password (`Test123456`)

---

### 🌐 Port Already in Use

**Problem:**
```
Port 8080 already in use
Port 8000 already in use
```

**Solution:**
```bash
# Windows PowerShell - Kill processes
Get-Process -Name "node" | Stop-Process -Force
Get-Process -Name "python" | Stop-Process -Force

# Or find specific port
netstat -ano | findstr :8080
taskkill /PID <PID_NUMBER> /F
```

---

### 📦 Missing Dependencies

**Problem:**
```
Cannot find module '@playwright/test'
Playwright executable not found
```

**Solution:**
```bash
npm install
npx playwright install chromium
```

---

## 🔍 Debug Mode

Run tests step-by-step to see what's happening:
```bash
npm run test:e2e:debug
```

View detailed logs:
```bash
npm run test:e2e -- --reporter=line --debug
```

---

## ✅ Pre-Flight Checklist

Before running tests, verify:

- [ ] ✅ Supabase database is **ACTIVE** (not paused)
- [ ] ✅ Backend is running (`uvicorn app.main:app --reload`)
- [ ] ✅ Test user exists (`node tests/scripts/create-test-user.js`)
- [ ] ✅ Ports 8000 and 8080 are free
- [ ] ✅ `.env` has correct Supabase credentials

Run this quick check:
```bash
# Check backend health
curl http://localhost:8000/health

# Check if frontend builds
npm run build
```

---

## 🆘 Still Having Issues?

1. **Check backend logs** - Look at the terminal where `uvicorn` is running
2. **Check browser console** - Run with `--headed` to see browser errors
3. **Check Supabase logs** - Go to Supabase Dashboard → Logs
4. **Run single test** - Isolate the problem:
   ```bash
   npx playwright test tests/auth.spec.ts --headed
   ```

---

## 📚 Related Files

- [TESTING.md](TESTING.md) - How to run tests
- [playwright.config.ts](playwright.config.ts) - Test configuration
- [tests/README.md](tests/README.md) - Test structure and best practices
