# Fix Database Error P2022

## The Issue
The OAuth is working (cookies are fine in incognito), but the database is throwing a Prisma P2022 error when trying to create/update a user. This typically means:
- Database schema is out of sync
- Required columns are missing
- Database wasn't migrated

## Solution Steps

### Option 1: Run Migrations on Railway (Recommended)

Add this environment variable to Railway:
```
DATABASE_URL=postgresql://[your-database-url]
```

Then run migrations via Railway CLI:
```bash
railway run npm run db:migrate
```

Or if that doesn't work:
```bash
railway run npx prisma migrate deploy
```

### Option 2: Add Migration Command to Railway

In Railway dashboard, add a build command:
```
npx prisma generate && npx prisma migrate deploy
```

### Option 3: Manual Database Reset (Last Resort)

If migrations fail, you might need to reset:
```bash
# Connect to Railway project
railway link

# Reset database (WARNING: This deletes all data!)
railway run npx prisma migrate reset --force

# Run migrations
railway run npx prisma migrate deploy
```

## Check Database Connection

First, verify the database is connected:
```bash
railway run npx prisma db pull
```

This will show if Prisma can connect to the database.

## The Root Cause

The error happens in the OAuth callback when trying to upsert a user:
```typescript
const dbUser = await prisma.user.upsert({
  where: { githubId: ghId },
  update: { username, avatarUrl: avatar ?? undefined, accessTokenHash: tokenHash },
  create: { githubId: ghId, username, avatarUrl: avatar, accessTokenHash: tokenHash },
});
```

The database likely doesn't have:
- The `githubId` column as BigInt
- The `accessTokenHash` column
- Or the User table at all

## Quick Test After Fix

Once the database is migrated, test again in incognito:
```
https://backend-production-6a6e4.up.railway.app/auth/login
```

You should be redirected to the frontend logged in!