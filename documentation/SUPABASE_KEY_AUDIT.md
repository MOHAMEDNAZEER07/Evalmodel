# Supabase Key Usage Audit Report

## 🔐 Current Key Configuration

### Frontend (.env)
```
VITE_SUPABASE_PUBLISHABLE_KEY = anon key (role: anon)
VITE_SUPABASE_URL = https://pohjbwazayfoynpbgfpn.supabase.co
```

### Backend (backend/.env)
```
SUPABASE_KEY = anon key (role: anon)
SUPABASE_SERVICE_ROLE_KEY = service_role key (role: service_role)
SUPABASE_URL = https://pohjbwazayfoynpbgfpn.supabase.co
```

## ⚠️ CRITICAL SECURITY ISSUE FOUND!

### Issue: Backend Using Service Role Key Without Proper Row Level Security

**Location:** `backend/app/core/supabase_client.py`

```python
# CURRENT (POTENTIALLY INSECURE):
cls._instance = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY  # ❌ BYPASSES RLS!
)
```

**Problem:**
The backend is using the `service_role` key, which **bypasses all Row Level Security (RLS) policies**. This means:
- Any user can potentially access any other user's data
- No database-level security enforcement
- Relies entirely on application-level checks (error-prone)

## 🎯 Recommended Architecture

### Option 1: Use User's Token (RECOMMENDED for user operations)
Pass the user's JWT token from frontend to backend, then use it for Supabase operations.

```python
# In route handler
def get_supabase_with_user_token(token: str) -> Client:
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_KEY,  # Use anon key
        options={"headers": {"Authorization": f"Bearer {token}"}}
    )
```

**Benefits:**
- ✅ RLS policies enforced
- ✅ Automatic user isolation
- ✅ Supabase Auth handles permissions
- ✅ More secure by default

### Option 2: Keep Service Role BUT Implement Strict Guards
If you need service_role for admin operations, add explicit user checks everywhere.

```python
# MUST verify user_id matches in EVERY query
result = supabase.table("models")\
    .select("*")\
    .eq("id", model_id)\
    .eq("user_id", current_user.get("id"))\  # ✅ CRITICAL!
    .execute()
```

## 📊 Current Usage Analysis

### ✅ CORRECT: Frontend
**File:** `src/integrations/supabase/client.ts`
```typescript
export const supabase = createClient<Database>(
  SUPABASE_URL, 
  SUPABASE_PUBLISHABLE_KEY  // ✅ Correct: Uses anon key
);
```
- Uses anon key (publicly safe)
- RLS policies will be enforced
- User authentication handled properly

### ⚠️ NEEDS REVIEW: Backend
**File:** `backend/app/core/supabase_client.py`
```python
cls._instance = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY  # ⚠️ Bypasses RLS
)
```

**Current Protection:** Backend routes check `current_user.get("id")` in queries
**Risk Level:** MEDIUM - Relies on developer remembering to add `.eq("user_id", ...)` everywhere

### Routes Using Supabase Client:

1. **evaluation.py** - ⚠️ Checks user_id in queries (good, but manual)
   ```python
   .eq("user_id", current_user.get("id"))
   ```

2. **auth.py** - ⚠️ Checks user_id in queries

3. **Fairness.tsx** - ✅ Uses frontend client with RLS

## 🔧 Recommended Fixes

### Option A: Switch to User Token Approach (BEST)

**1. Update supabase_client.py:**
```python
from supabase import create_client, Client
from app.core.config import settings

def get_supabase_admin() -> Client:
    """Admin client for system operations (use sparingly)"""
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY
    )

def get_supabase_with_token(token: str) -> Client:
    """User-scoped client (enforces RLS)"""
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_KEY,  # anon key
        options={"headers": {"Authorization": f"Bearer {token}"}}
    )

def get_supabase() -> Client:
    """Default client - uses service role (for backwards compatibility)"""
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY
    )
```

**2. Update routes to use user token:**
```python
from fastapi import Header

async def evaluate_model(
    request: EvaluationRequest,
    authorization: str = Header(...),
    current_user: dict = Depends(get_current_user),
):
    token = authorization.replace("Bearer ", "")
    supabase = get_supabase_with_token(token)
    # Now RLS is enforced automatically!
```

### Option B: Add Service Role Safety Wrapper

```python
class SecureSupabaseClient:
    """Wrapper that enforces user_id checks"""
    
    def __init__(self, client: Client, user_id: str):
        self.client = client
        self.user_id = user_id
    
    def table(self, name: str):
        return SecureTableProxy(self.client.table(name), self.user_id, name)

class SecureTableProxy:
    def __init__(self, table, user_id: str, table_name: str):
        self.table = table
        self.user_id = user_id
        self.table_name = table_name
    
    def select(self, *args, **kwargs):
        # Auto-add user_id filter
        return self.table.select(*args, **kwargs).eq("user_id", self.user_id)
```

## 🚨 Immediate Actions Required

### 1. CRITICAL: Review All Database Queries
Check every Supabase query in backend routes includes:
```python
.eq("user_id", current_user.get("id"))
```

**Files to audit:**
- ✅ `backend/app/routes/evaluation.py` - Has user_id checks
- ✅ `backend/app/routes/auth.py` - Has user_id checks
- ❓ Any other routes with Supabase queries

### 2. HIGH: Implement RLS Policies (Database Level)
Add policies in Supabase dashboard:

```sql
-- Models table
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own models"
ON models FOR SELECT
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can only insert their own models"
ON models FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

-- Repeat for: datasets, evaluations, users tables
```

### 3. MEDIUM: Consider Token-Based Approach
For new features, use user token method for automatic RLS enforcement.

## 📋 Key Usage Checklist

- [x] **Frontend uses anon key** ✅ Correct
- [x] **Backend has service_role key** ✅ Configured
- [ ] **RLS policies enabled** ❌ TODO
- [x] **Manual user_id checks in queries** ✅ Present (but fragile)
- [ ] **Token-based auth for Supabase** ❌ Not implemented
- [x] **Keys in .env files** ✅ Correct (not in code)
- [ ] **.env in .gitignore** ⚠️ Should verify

## 🔑 Key Differences

### Anon Key (Public)
- ✅ Safe to use in frontend
- ✅ RLS policies enforced
- ✅ Can be exposed in browser
- ❌ Limited to authenticated user operations

### Service Role Key (Secret)
- ❌ NEVER expose to frontend
- ❌ Bypasses ALL RLS policies
- ✅ Can perform admin operations
- ⚠️ Requires manual security checks

## 📝 Current Status: FUNCTIONAL BUT NOT OPTIMAL

**Security Level:** 🟡 MEDIUM RISK

**Why it works:**
- Manual user_id checks in all queries
- Backend auth middleware validates tokens

**Why it's risky:**
- One forgotten `.eq("user_id", ...)` = security breach
- No database-level enforcement
- Relies on developer discipline

**Recommendation:** 
1. Implement RLS policies (database level security)
2. Switch to token-based approach for new features
3. Keep service_role only for truly admin operations

## 🎯 Summary

**Current Setup:**
- Frontend: ✅ Correct (anon key with RLS)
- Backend: ⚠️ Works but bypasses RLS (service_role key)

**Security Status:**
- Protected by application-level checks
- No database-level security (RLS bypassed)
- Risk of data leaks if developer error

**Next Steps:**
1. Enable RLS policies in Supabase
2. Consider switching to token-based auth
3. Audit all queries for user_id checks
4. Document which operations need service_role vs user token
