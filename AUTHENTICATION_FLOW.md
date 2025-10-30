# Authentication Flow - Backend-First Architecture

## Overview
The application uses a **backend-first authentication** approach where all auth requests go through the FastAPI backend before interacting with Supabase.

## Flow Diagram

```
Frontend (React)  →  Backend (FastAPI)  →  Supabase Auth
     ↓                      ↓                    ↓
  API Client         Auth Routes            User Database
     ↓                      ↓                    ↓
  AuthContext         JWT Tokens           Session Storage
```

## Authentication Endpoints

### 1. Sign Up
**Frontend:** `AuthContext.signUp()` → `apiClient.signup()`  
**Backend:** `POST /api/auth/signup`  
**Process:**
1. Frontend sends email/password to backend
2. Backend creates user in Supabase Auth
3. Backend returns `access_token` + `refresh_token`
4. Frontend stores tokens and sets Supabase session

### 2. Login
**Frontend:** `AuthContext.signIn()` → `apiClient.login()`  
**Backend:** `POST /api/auth/login`  
**Process:**
1. Frontend sends credentials to backend
2. Backend validates with Supabase
3. Backend returns JWT tokens
4. Frontend sets session and stores token in API client

### 3. Logout
**Frontend:** `AuthContext.signOut()` → `apiClient.logout()`  
**Backend:** `POST /api/auth/logout`  
**Process:**
1. Frontend calls backend logout endpoint
2. Backend invalidates session
3. Frontend clears tokens and Supabase session

### 4. Get Current User
**Frontend:** Protected routes check auth  
**Backend:** `GET /api/auth/me` (with Bearer token)  
**Process:**
1. API client includes JWT in Authorization header
2. Backend validates token via `get_current_user` dependency
3. Returns user profile data

## Key Files

### Frontend
- `src/contexts/AuthContext.tsx` - Main auth state management
- `src/lib/api-client.ts` - API methods (signup, login, logout)
- `src/components/ProtectedRoute.tsx` - Route protection
- `src/pages/Login.tsx` - Login page
- `src/pages/Signup.tsx` - Signup page

### Backend
- `backend/app/routes/auth.py` - Auth endpoints
- `backend/main.py` - Request logging middleware
- `backend/app/core/supabase_client.py` - Supabase client

## Request Flow Example

### Sign Up Request:
```
1. User fills form at /signup
2. Frontend: AuthContext.signUp("user@email.com", "password123")
3. Frontend: apiClient.signup() → POST http://localhost:8000/api/auth/signup
4. Backend logs: ➡️  POST /api/auth/signup
5. Backend: Creates user in Supabase
6. Backend: Returns { access_token, refresh_token, user, message }
7. Backend logs: ⬅️  POST /api/auth/signup - Status: 200 - Time: 0.456s
8. Frontend: Stores tokens, sets Supabase session
9. Frontend: Redirects to dashboard
```

### Protected Route Access:
```
1. User visits /dashboard
2. ProtectedRoute checks: useAuth().user
3. If user exists → Render dashboard
4. If no user → Redirect to /login
5. Dashboard makes API call (e.g., fetch models)
6. apiClient includes: Authorization: Bearer <token>
7. Backend validates token via get_current_user dependency
8. Backend logs: ➡️  GET /api/models
9. Backend returns data
10. Backend logs: ⬅️  GET /api/models - Status: 200 - Time: 0.123s
```

## Testing the Flow

### 1. Start Backend
```powershell
cd backend
.\venv\Scripts\activate
python -m uvicorn main:app --reload
```
Backend will run on `http://localhost:8000`

### 2. Start Frontend
```powershell
npm run dev
```
Frontend will run on `http://localhost:8080`

### 3. Test Sign Up
1. Navigate to: `http://localhost:8080/signup`
2. Fill in email and password
3. Click "Sign Up"
4. Watch backend terminal for:
   ```
   ➡️  POST /api/auth/signup
   ⬅️  POST /api/auth/signup - Status: 200 - Time: X.XXXs
   ```
5. Should redirect to dashboard

### 4. Test Login
1. Navigate to: `http://localhost:8080/login`
2. Enter credentials
3. Click "Login"
4. Watch backend terminal for:
   ```
   ➡️  POST /api/auth/login
   ⬅️  POST /api/auth/login - Status: 200 - Time: X.XXXs
   ```

### 5. Test Protected Routes
1. Try accessing: `http://localhost:8080/upload`
2. If logged in → Page loads
3. If not logged in → Redirects to /login

### 6. Test Logout
1. Click user profile → Sign Out
2. Watch backend terminal for:
   ```
   ➡️  POST /api/auth/logout
   ⬅️  POST /api/auth/logout - Status: 200 - Time: X.XXXs
   ```
3. Should redirect to /login

## Benefits of Backend-First Approach

✅ **Centralized Control** - All auth logic in one place (backend)  
✅ **Request Visibility** - See all auth activity in backend logs  
✅ **Custom Validation** - Add business logic before Supabase  
✅ **Token Management** - Backend controls JWT issuance  
✅ **Audit Trail** - Log all authentication attempts  
✅ **Rate Limiting** - Implement on backend endpoints  
✅ **Middleware** - Add custom auth middleware easily

## Environment Variables

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://swjihpzlmwowqxfesiwc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
```

### Backend (.env)
```
SUPABASE_URL=https://swjihpzlmwowqxfesiwc.supabase.co
SUPABASE_KEY=eyJhbGci...
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173
```

## Troubleshooting

### No requests in backend terminal?
- Ensure backend is running on port 8000
- Check VITE_API_BASE_URL in frontend .env
- Verify CORS settings in backend

### Authentication fails?
- Check Supabase credentials in backend .env
- Verify email-validator is installed: `pip install email-validator`
- Check backend logs for detailed error messages

### Token errors?
- Ensure apiClient.setToken() is called after login
- Check Authorization header is included in requests
- Verify JWT secret is configured in Supabase

## Next Steps
- ✅ Authentication flow is complete
- ⏭️ Test the complete flow (signup → login → logout)
- ⏭️ Implement Evaluate page with authenticated API calls
- ⏭️ Implement Compare page with model selection
