# GitHub App Setup Guide

This guide walks you through creating and configuring a GitHub App for the AI Agent Village Monitor.

## Step 1: Create GitHub App

1. **Navigate to GitHub Settings**:
   - Go to [GitHub.com](https://github.com)
   - Click your profile picture → Settings
   - In the left sidebar, click "Developer settings"
   - Click "GitHub Apps"

2. **Create New GitHub App**:
   - Click "New GitHub App"
   - Fill in the required information:

### Basic Information

| Field                               | Value                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| **GitHub App name**                 | `AI Agent Village Monitor` (or any clear name)                                            |
| **Description**                     | Short sentence about monitoring/automation                                                |
| **Homepage URL**                    | Your marketing or repo URL (e.g. `https://github.com/CryptoJym/ai-agent-village-monitor`) |
| **User authorization callback URL** | `https://<your-host>/auth/github/callback` (update after Railway assigns a domain)        |

### Webhook Configuration

| Field              | Value                                          |
| ------------------ | ---------------------------------------------- |
| **Webhook URL**    | `https://<your-host>/api/webhooks/github`      |
| **Webhook secret** | Generate a random string and store it securely |

```bash
openssl rand -base64 32
```

### Permissions

Keep permissions minimal—only grant what the backend calls today.

| Repository permission | Access level | Reason                                                         |
| --------------------- | ------------ | -------------------------------------------------------------- |
| **Metadata**          | Read         | Required by GitHub for every App                               |
| **Contents**          | Read         | Needed to trigger `repository_dispatch` and read repo metadata |
| **Actions**           | Read         | Lists workflows for `/api/github/workflows`                    |
| **Workflows**         | Write        | Triggers workflow_dispatch jobs                                |
| **Issues**            | Read         | Lists issues for reconciliation endpoints                      |
| **Pull requests**     | Read         | Reads PR metadata (future use)                                 |
| **Checks**            | Read         | Receives check_run webhooks for CI smoke                       |

> If you plan to let the App open pull requests programmatically, elevate **Pull requests** to “Read & write”. Otherwise “Read” is sufficient today.

You do **not** need any organisation-level permissions for the current features. Keep the scope limited to the repositories you intend to monitor.

### Events Subscription

Subscribe to these webhook events:

- `issues`
- `pull_request`
- `push`
- `check_run`

You can add others later if new features require them.

### Installation Options

- ✅ **Any account** - Allow installation on any account
- Or select **Only on this account** if you want to restrict it

## Step 2: Save App Credentials

After creating the app, save these values:

1. **App ID**: Found at the top of your app's settings page
2. **Client ID**: Found in the "OAuth credentials" section
3. **Client Secret**: Click "Generate a new client secret" and save it
4. **Private Key**: Click "Generate a private key" and download the `.pem` file
5. **Webhook Secret**: The secret you generated earlier

## Step 3: Install the App

1. **Install on Organization/Repository**:
   - Go to your GitHub App settings
   - Click "Install App" in the left sidebar
   - Choose the account/organization to install on
   - Select repositories (All repositories or specific ones)
   - Click "Install"

## Step 4: Configure Railway Environment Variables

Use the credentials from Step 2 to set these Railway environment variables:

```bash
# Set these in Railway dashboard or via CLI
railway variables set GITHUB_OAUTH_CLIENT_ID="your_client_id"
railway variables set GITHUB_OAUTH_CLIENT_SECRET="your_client_secret"
railway variables set GITHUB_APP_ID="your_app_id"
railway variables set WEBHOOK_SECRET="your_webhook_secret"
railway variables set GITHUB_PRIVATE_KEY="$(cat path/to/private-key.pem)"
```

## Step 5: Update URLs After Deployment

After your Railway deployment is complete:

1. **Get your Railway service URL** from the Railway dashboard
2. **Update GitHub App settings**:
   - Go back to your GitHub App settings
   - Update the **Webhook URL** to: `https://your-actual-railway-url.up.railway.app/api/webhooks/github`
   - Update the **User authorization callback URL** to: `https://your-actual-railway-url.up.railway.app/auth/github/callback`

3. **Update Railway environment variables**:
   ```bash
   railway variables set PUBLIC_SERVER_URL="https://your-actual-railway-url.up.railway.app"
   railway variables set OAUTH_REDIRECT_URI="https://your-actual-railway-url.up.railway.app/auth/github/callback"
   ```

## Step 6: Test the Integration

1. **Test Webhook Delivery**:
   - Go to your GitHub App settings
   - Click "Advanced" tab
   - Look for recent webhook deliveries
   - Check for successful responses (200 status)

2. **Test OAuth Flow**:
   - Visit your application
   - Try to log in with GitHub
   - Verify the OAuth flow completes successfully

3. **Test API Access**:
   ```bash
   # Test the GitHub workflow listing endpoint
   curl "https://your-railway-url.up.railway.app/api/github/workflows?owner=your-org&repo=your-repo"
   ```

## Troubleshooting

### Common Issues

1. **Webhook Delivery Failures**:
   - Check that your Railway service is running
   - Verify the webhook URL is correct
   - Check Railway logs for errors

2. **OAuth Failures**:
   - Verify callback URL matches exactly
   - Check client ID and secret are correct
   - Ensure app is installed on the account

3. **Permission Errors**:
   - Verify app has required permissions
   - Check that app is installed on target repositories
   - Ensure user has access to the repositories

### Debug Commands

```bash
# Check webhook deliveries
curl -X GET "https://api.github.com/app/hook/deliveries" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test app installation
curl -X GET "https://api.github.com/app/installations" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Security Best Practices

1. **Private Key Security**:
   - Never commit private keys to version control
   - Store securely in Railway environment variables
   - Rotate keys periodically

2. **Webhook Secret**:
   - Use a strong, randomly generated secret
   - Verify webhook signatures in your application
   - Keep secret secure and don't share

3. **Permissions**:
   - Grant minimum required permissions
   - Review permissions regularly
   - Remove unused permissions

4. **Installation Scope**:
   - Install only on required repositories
   - Review installations periodically
   - Remove unused installations

## Next Steps

After completing the GitHub App setup:

1. ✅ Continue with Railway deployment
2. ✅ Run database migrations
3. ✅ Test the complete integration
4. ✅ Monitor webhook deliveries and logs
