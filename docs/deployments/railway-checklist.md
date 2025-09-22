# Railway Deployment Checklist

Use this checklist to ensure all steps are completed for a successful deployment.

## Pre-Deployment Setup

### GitHub App Configuration

- [ ] Create GitHub App at [GitHub Developer Settings](https://github.com/settings/apps)
- [ ] Set webhook URL (temporary): `https://placeholder.railway.app/api/webhooks/github`
- [ ] Set callback URL (temporary): `https://placeholder.railway.app/auth/github/callback`
- [ ] Generate and save webhook secret
- [ ] Configure required permissions (Metadata, Contents read, Actions read, Checks read, Issues read, Pull requests read, Workflows write)
- [ ] Subscribe to webhook events (issues, pull_request, push, check_run)
- [ ] Generate and download private key (.pem file)
- [ ] Install app on target organization/repositories
- [ ] Save App ID, Client ID, and Client Secret

### Local Environment

- [ ] Railway CLI installed (`npm install -g @railway/cli`)
- [ ] Logged into Railway (`railway login`)
- [ ] Repository cloned locally
- [ ] All setup scripts are executable

## Deployment Process

### 1. Initial Deployment

- [ ] Run `scripts/railway/deploy.sh`
- [ ] Verify PostgreSQL plugin added
- [ ] Verify Redis plugin added
- [ ] Check deployment status in Railway dashboard
- [ ] Note the Railway service URL

### 2. Environment Configuration

- [ ] Run `scripts/railway/setup-env-vars.sh`
- [ ] Enter GitHub OAuth Client ID
- [ ] Enter GitHub OAuth Client Secret
- [ ] Enter GitHub App ID
- [ ] Enter GitHub Private Key (PEM content)
- [ ] Enter Webhook Secret
- [ ] Enter Frontend URL
- [ ] Verify all variables set in Railway dashboard

### 3. URL Updates

- [ ] Update `PUBLIC_SERVER_URL` with actual Railway URL
- [ ] Update `OAUTH_REDIRECT_URI` with actual Railway URL
- [ ] Update GitHub App webhook URL with actual Railway URL
- [ ] Update GitHub App callback URL with actual Railway URL

### 4. Database Setup

- [ ] Run `scripts/railway/post-deploy.sh`
- [ ] Verify Prisma client generation
- [ ] Verify database migrations completed
- [ ] Optionally seed database
- [ ] Test database connectivity

## Post-Deployment Verification

### Application Health

- [ ] Check deployment logs in Railway dashboard
- [ ] Test health endpoint: `curl https://your-service.up.railway.app/health`
- [ ] Verify application starts without errors
- [ ] Check all environment variables are loaded

### GitHub Integration

- [ ] Test webhook delivery in GitHub App settings
- [ ] Verify webhook responses (200 status codes)
- [ ] Test OAuth login flow
- [ ] Test GitHub API endpoints
- [ ] Verify app installation on repositories

### Database & Redis

- [ ] Test database connection
- [ ] Verify Redis connection
- [ ] Check Prisma Studio access
- [ ] Verify data persistence

## Environment Variables Checklist

### Required Variables (Must be set)

- [ ] `NODE_ENV=production`
- [ ] `PORT=3000`
- [ ] `JWT_SECRET` (generated)
- [ ] `GITHUB_OAUTH_CLIENT_ID`
- [ ] `GITHUB_OAUTH_CLIENT_SECRET`
- [ ] `GITHUB_APP_ID`
- [ ] `GITHUB_PRIVATE_KEY`
- [ ] `WEBHOOK_SECRET`
- [ ] `PUBLIC_SERVER_URL`
- [ ] `PUBLIC_APP_URL`
- [ ] `OAUTH_REDIRECT_URI`

### Auto-Injected Variables (Railway plugins)

- [ ] `DATABASE_URL` (from PostgreSQL plugin)
- [ ] `REDIS_URL` (from Redis plugin)

### Optional Variables

- [ ] `GITHUB_TOKENS` (fallback PATs)
- [ ] `MCP_HTTP_ENDPOINT`
- [ ] `MCP_HTTP_API_KEY`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `OPENAI_API_KEY`

## Testing Checklist

### Basic Functionality

- [ ] Application starts and responds to requests
- [ ] Health check endpoint returns 200
- [ ] Database queries execute successfully
- [ ] Redis operations work correctly

### GitHub Integration

- [ ] Webhook events are received and processed
- [ ] OAuth authentication flow works
- [ ] GitHub API calls succeed
- [ ] Repository data is accessible

### Security

- [ ] HTTPS is enforced
- [ ] JWT tokens are properly signed
- [ ] Webhook signatures are verified
- [ ] Environment variables are secure

## Troubleshooting Quick Reference

### Common Issues

- [ ] **Build fails**: Check `pnpm-lock.yaml` and Node.js version
- [ ] **App won't start**: Check environment variables and logs
- [ ] **Database errors**: Verify migrations and connection string
- [ ] **GitHub webhook fails**: Check URL and webhook secret
- [ ] **OAuth fails**: Verify callback URL and client credentials

### Debug Commands

```bash
# Check deployment status
railway status

# View logs
railway logs --follow

# Check environment variables
railway variables

# Test database connection
railway run node -e "console.log(process.env.DATABASE_URL)"

# Run locally with Railway env
railway dev
```

## Final Steps

### Documentation

- [ ] Update README with deployment information
- [ ] Document any custom configuration
- [ ] Create monitoring/alerting setup
- [ ] Set up backup procedures

### Monitoring

- [ ] Set up Railway monitoring alerts
- [ ] Configure log aggregation
- [ ] Set up uptime monitoring
- [ ] Create performance dashboards

### Security Review

- [ ] Review all environment variables
- [ ] Audit GitHub App permissions
- [ ] Verify HTTPS configuration
- [ ] Check for exposed secrets

---

## Quick Commands Reference

```bash
# Deploy
./deploy-railway.sh

# Configure environment
./setup-env-vars.sh

# Post-deployment setup
./post-deploy.sh

# View logs
railway logs

# Update environment variable
railway variables set KEY="value"

# Connect to database
railway connect postgres

# Run command in Railway environment
railway run <command>
```

**✅ Deployment Complete!**

Your AI Agent Village Monitor should now be running on Railway with full GitHub integration.
