# Deploy to Vercel

Vercel is the easiest way to deploy this API for free (hobby plan).

## Prerequisites
- GitHub Account
- Vercel Account (Login with GitHub)

## Configuration
The project includes a `vercel.json` file optimized for deployment:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/app.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/app.js"
    }
  ]
}
```

## Steps to Deploy

### Option 1: Vercel Dashboard (Recommended)
1. Push your code to a GitHub repository.
2. Go to [Vercel Dashboard](https://vercel.com/dashboard).
3. Click **"Add New..."** > **"Project"**.
4. Import your GitHub repository.
5. In **Framework Preset**, select **Other**.
6. **Environment Variables**:
   Add the following variables if you want to change defaults:
   - `DEFAULT_LANG`: `in` or `en`
   - `NODE_ENV`: `production`
7. Click **Deploy**.

### Option 2: Vercel CLI
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. Login:
   ```bash
   vercel login
   ```
3. Deploy:
   ```bash
   vercel --prod
   ```

## Verification
Once deployed, visit your Vercel URL (e.g., `https://your-project.vercel.app`).
- `/` should show the API Documentation.
- `/health` should return status healthy.
