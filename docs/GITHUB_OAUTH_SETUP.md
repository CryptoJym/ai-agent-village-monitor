# GitHub OAuth Authentication Setup Guide

This guide provides step-by-step instructions for setting up GitHub OAuth authentication for the AI Agent Village Monitor application.

## Prerequisites

- GitHub account with admin access to create OAuth applications
- Node.js and pnpm installed
- AI Agent Village Monitor project running locally

## 1. Create GitHub OAuth Application

### Step 1: Access GitHub Developer Settings

1. Go to [GitHub Settings](https://github.com/settings/profile)
2. Navigate to **Developer settings** (bottom of left sidebar)
3. Click **OAuth Apps**
4. Click **New OAuth App**

### Step 2: Configure OAuth Application

Fill in the application details:

- **Application name**: `AI Agent Village Monitor - [Environment]`
  - Use different names for development/production (e.g., "AI Agent Village Monitor - Development")
- **Homepage URL**:
  - Development: `http://localhost:5173`
  - Production: `https://your-domain.com`
- **Application description**: `Authentication for AI Agent Village Monitor - Multi-agent monitoring and management platform`
- **Authorization callback URL**:
  - Development: `http://localhost:3000/auth/callback`
  - Production: `https://your-api-domain.com/auth/callback`

### Step 3: Generate Client Credentials

1. Click **Register application**
2. Copy the **Client ID** (you'll need this for environment variables)
3. Click **Generate a new client secret**
4. Copy the **Client Secret** immediately (it won't be shown again)

## 2. Environment Configuration

### Required Environment Variables

Add these variables to your `.env` file in the project root:

```env
# GitHub OAuth Configuration (Required for authentication)
GITHUB_OAUTH_CLIENT_ID="your_github_oauth_client_id_here"
GITHUB_OAUTH_CLIENT_SECRET="your_github_oauth_client_secret_here"

# JWT Configuration
JWT_SECRET="your_secure_jwt_secret_here"
JWT_ACCESS_TOKEN_EXPIRES_IN="1h"
JWT_REFRESH_TOKEN_EXPIRES_IN="30d"

# Application URLs
PUBLIC_SERVER_URL="http://localhost:3000"
PUBLIC_APP_URL="http://localhost:5173"

# Cookie Configuration
COOKIE_SECRET="your_secure_cookie_secret_here"

# Development mode settings (for testing bypass)
NODE_ENV="development"
E2E_TEST_MODE="true"
```

### Environment Variable Descriptions

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth application client ID | `abc123def456` |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth application client secret | `secret_abc123def456ghi789` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `super-secure-random-string-min-32-chars` |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | Access token expiration time | `1h` (1 hour) |
| `JWT_REFRESH_TOKEN_EXPIRES_IN` | Refresh token expiration time | `30d` (30 days) |
| `PUBLIC_SERVER_URL` | Backend API base URL | `http://localhost:3000` |
| `PUBLIC_APP_URL` | Frontend application URL | `http://localhost:5173` |
| `COOKIE_SECRET` | Secret for signing cookies | `another-secure-random-string` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `E2E_TEST_MODE` | Enable development auth bypass | `true` (development only) |

### Security Notes

- **Never commit** `.env` files to version control
- Use different GitHub OAuth applications for different environments
- Generate strong, random secrets for JWT and cookie signing
- In production, use secure HTTPS URLs only

## 3. Application Setup

### Install Dependencies

```bash
# Install all dependencies
pnpm install

# Build the project
pnpm build
```

### Start Development Servers

```bash
# Terminal 1: Start backend server
cd packages/server
pnpm dev

# Terminal 2: Start frontend development server
cd packages/frontend
pnpm dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## 4. Testing Authentication

### Development Mode Testing

When `E2E_TEST_MODE=true` is set, you'll see development authentication buttons in the bottom-left corner of the application:

1. **Login as Dev User** - Creates a test user with ID 1
2. **Login as Admin** - Creates a test user with ID 2

### Production Authentication Flow

1. Visit the application at http://localhost:5173
2. Click "Sign in with GitHub"
3. You'll be redirected to GitHub for authorization
4. Grant permissions to the application
5. You'll be redirected back to the application, now authenticated

### Authentication Endpoints

The following API endpoints handle authentication:

- `GET /auth/login` - Initiates GitHub OAuth flow
- `GET /auth/callback` - Handles GitHub OAuth callback
- `POST /auth/refresh` - Refreshes access tokens
- `POST /auth/logout` - Logs out user and clears tokens
- `GET /auth/me` - Returns current user information

## 5. Troubleshooting

### Common Issues

#### 1. "OAuth Application Not Found" Error

**Cause**: Incorrect client ID or the OAuth application doesn't exist.

**Solution**:
- Verify `GITHUB_OAUTH_CLIENT_ID` in `.env` matches the GitHub application
- Check that the OAuth application exists in your GitHub developer settings

#### 2. "Invalid Client Secret" Error

**Cause**: Incorrect or expired client secret.

**Solution**:
- Generate a new client secret in GitHub OAuth application settings
- Update `GITHUB_OAUTH_CLIENT_SECRET` in `.env`

#### 3. "Redirect URI Mismatch" Error

**Cause**: Callback URL doesn't match the registered OAuth application callback URL.

**Solution**:
- Ensure the GitHub OAuth application callback URL matches: `http://localhost:3000/auth/callback`
- Check `PUBLIC_SERVER_URL` in `.env` is correct

#### 4. "JWT Token Invalid" Error

**Cause**: JWT secret changed or tokens expired.

**Solution**:
- Clear browser cookies and localStorage
- Restart the application
- Ensure `JWT_SECRET` is consistent

#### 5. Development Auth Buttons Not Appearing

**Cause**: Development mode not enabled.

**Solution**:
- Set `NODE_ENV=development` in `.env`
- Set `E2E_TEST_MODE=true` in `.env`
- Add `?dev-auth` to the URL query string

### Debug Mode

Enable debug logging by setting:

```env
DEBUG="auth:*"
```

This will show detailed authentication flow logs in the server console.

### Network Issues

If experiencing CORS errors:

1. Verify `PUBLIC_APP_URL` matches your frontend URL
2. Check that the server is running on the expected port
3. Ensure the frontend is making requests to the correct backend URL

## 6. Production Deployment

### Environment Setup

1. Create a new GitHub OAuth application for production
2. Use HTTPS URLs for all endpoints
3. Set strong, unique secrets for production
4. Disable development mode:
   ```env
   NODE_ENV="production"
   E2E_TEST_MODE="false"
   ```

### Security Considerations

- Use environment variable management (AWS Secrets Manager, Heroku Config Vars, etc.)
- Enable HTTPS enforcement
- Set secure cookie flags in production
- Implement rate limiting on authentication endpoints
- Monitor authentication logs for suspicious activity

### Production URLs

Update the GitHub OAuth application with production URLs:
- **Homepage URL**: `https://your-domain.com`
- **Authorization callback URL**: `https://your-api-domain.com/auth/callback`

Update environment variables:
```env
PUBLIC_SERVER_URL="https://your-api-domain.com"
PUBLIC_APP_URL="https://your-domain.com"
```

## 7. Beta Tester Instructions

### For Beta Testers

1. **Get Repository Access**: Request access to the GitHub repository from the project maintainer
2. **Clone the Project**:
   ```bash
   git clone https://github.com/your-org/ai-agent-village-monitor.git
   cd ai-agent-village-monitor
   ```
3. **Install Dependencies**:
   ```bash
   pnpm install
   ```
4. **Environment Setup**: Request the `.env` file from the project maintainer or create one using the template above
5. **Start the Application**:
   ```bash
   # Terminal 1
   cd packages/server && pnpm dev

   # Terminal 2
   cd packages/frontend && pnpm dev
   ```
6. **Access the Application**: Open http://localhost:5173 in your browser
7. **Authenticate**: Click "Sign in with GitHub" and grant permissions

### Beta Testing Checklist

- [ ] Can access login page
- [ ] GitHub OAuth login works
- [ ] User menu displays correctly
- [ ] Can navigate protected routes
- [ ] Logout functionality works
- [ ] Development auth bypass works (if enabled)
- [ ] Token refresh works automatically
- [ ] No console errors during authentication

## 8. API Reference

### Authentication State Management

The frontend uses React Context for authentication state:

```typescript
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
  const { user, loading, error, login, logout } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <button onClick={login}>Login</button>;

  return (
    <div>
      Welcome, {user.username}!
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Protected Routes

Wrap components requiring authentication:

```typescript
import { ProtectedRoute } from '../contexts/AuthProvider';

function App() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
```

### Making Authenticated API Requests

```typescript
// Authentication tokens are automatically included via cookies
const response = await fetch('/api/protected-endpoint', {
  credentials: 'include'
});
```

## Support

For issues with GitHub OAuth setup:

1. Check this documentation first
2. Review the troubleshooting section
3. Check GitHub OAuth application settings
4. Verify environment variables
5. Contact the development team with specific error messages

---

**Last Updated**: January 2025
**Author**: AI Agent Village Monitor Team