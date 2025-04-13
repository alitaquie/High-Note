# Cloudflare Deployment Quick Start

This guide provides the essential steps to deploy your CruzHacks2025 project using Cloudflare.

## 1. Deploy Backend to Cloudflare Workers

```bash
# Login to Cloudflare
wrangler login

# Verify login was successful
wrangler whoami

# Deploy the Worker
wrangler publish
```

After deployment, note the URL of your worker (e.g., `https://cruzhacks2025-api.username.workers.dev`).

## 2. Set Up Cloudflare KV (Optional)

If you need persistent storage for authentication:

```bash
# Create a KV namespace
wrangler kv:namespace create AUTH_STORE
```

Update your `wrangler.toml` with the generated ID.

## 3. Set Up Cloudflare D1 Database (Optional)

For storing notes and lobbies:

```bash
# Create a D1 database
wrangler d1 create cruzhacks2025
```

Update your `wrangler.toml` with the generated ID.

## 4. Update Frontend Configuration

Edit `frontend/.env.production` to point to your Worker URL:

```
REACT_APP_API_BASE_URL=https://your-worker-url.workers.dev
```

## 5. Deploy Frontend to Cloudflare Pages

### Option 1: Using Cloudflare Dashboard

1. Go to [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages)
2. Click "Create a project"
3. Connect to your GitHub repository
4. Configure build settings:
   - Framework preset: Create React App
   - Build command: `cd frontend && npm install && npm run build`
   - Build output directory: `frontend/build`
5. Add environment variable:
   - `REACT_APP_API_BASE_URL`: Your Worker URL
6. Deploy

### Option 2: Using Wrangler CLI

```bash
# Navigate to frontend directory
cd frontend

# Build the project
npm run build

# Deploy to Cloudflare Pages
wrangler pages publish build
```

## 6. Test Your Deployment

1. Open your Cloudflare Pages URL (e.g., `https://cruzhacks2025.pages.dev`)
2. Verify that you can connect to the backend API

## 7. Implement Full WebSocket Support (Advanced)

To enable real-time collaboration, you'll need to set up Durable Objects:

```bash
# Create a Durable Object namespace
wrangler durable-object namespace create CONNECTION_MANAGER
```

Uncomment the Durable Objects section in `wrangler.toml` and complete the WebSocket implementation in `worker.js`.

## Need More Details?

See the complete [Cloudflare Deployment Guide](./CLOUDFLARE_DEPLOYMENT.md) for in-depth instructions. 