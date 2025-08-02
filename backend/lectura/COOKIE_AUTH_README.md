# Cookie-Based Authentication Implementation

## Overview
This implementation provides secure cookie-based authentication with CSRF protection as an alternative to JWT bearer tokens.

## New Endpoints

### Authentication Endpoints (v2)

#### 1. Login with Google
```
POST /auth/v2/google
Content-Type: application/json

{
  "idToken": "google-id-token"
}

Response:
{
  "csrfToken": "generated-csrf-token",
  "user": {
    "email": "user@example.com",
    "picture": "https://..."
  }
}

Sets cookies:
- lectura_access_token (15 minutes, httpOnly)
- lectura_refresh_token (30 days, httpOnly)
```

#### 2. Refresh Token
```
POST /auth/v2/refresh
(No body required - uses refresh token from cookie)

Response:
{
  "csrfToken": "new-csrf-token",
  "user": {
    "email": "user@example.com",
    "picture": "https://..."
  }
}

Updates both access and refresh token cookies
```

#### 3. Get Current User
```
GET /auth/v2/me
(No headers required - uses access token from cookie)

Response:
{
  "email": "user@example.com",
  "picture": "https://..."
}
```

#### 4. Logout
```
POST /auth/v2/logout
(No body required - uses tokens from cookies)

Clears all authentication cookies and CSRF token
```

## CSRF Protection

All state-changing requests (POST, PUT, DELETE, PATCH) require the CSRF token in the header:

```
X-CSRF-Token: <csrf-token-from-login-response>
```

## Frontend Integration

### Required Changes:

1. **Enable credentials in all requests:**
```javascript
// Axios
axios.defaults.withCredentials = true;

// Fetch
fetch(url, { credentials: 'include' })
```

2. **Include CSRF token in headers:**
```javascript
headers: {
  'X-CSRF-Token': csrfToken
}
```

3. **Remove Authorization header** - authentication is now via cookies

## Development Setup

For local development, use the `dev` profile to disable secure cookies:

```bash
SPRING_PROFILE=dev ./gradlew bootRun
```

Or set in application.properties:
```
spring.profiles.active=dev
```

## Environment Variables

### Production
```
COOKIE_SECURE=true
COOKIE_SAME_SITE=Strict
COOKIE_DOMAIN=yourdomain.com
```

### Development
```
COOKIE_SECURE=false
COOKIE_SAME_SITE=Lax
COOKIE_DOMAIN=localhost
```

## Security Features

1. **HTTP-Only Cookies**: Prevents XSS attacks by making cookies inaccessible to JavaScript
2. **Secure Flag**: Ensures cookies are only sent over HTTPS (in production)
3. **SameSite=Strict**: Prevents CSRF attacks by restricting cross-site cookie sending
4. **CSRF Tokens**: Additional protection against CSRF attacks
5. **Short-lived Access Tokens**: 15-minute expiration reduces attack window
6. **Automatic Token Refresh**: Seamless user experience with secure token rotation

## Migration Notes

- The v1 endpoints (`/auth/google`, `/auth/refresh`, etc.) remain available for backward compatibility
- Both authentication methods can coexist during the migration period
- Consider deprecating v1 endpoints after all clients have migrated