# Cloudflare Deployment Guide for CruzHacks2025

This guide provides step-by-step instructions to deploy your application using Cloudflare Pages for the frontend and Cloudflare Workers for the backend.

## Prerequisites

- GitHub repository with your code
- Cloudflare account (free tier available)
- MongoDB Atlas account (for database)

## Step 1: Set Up MongoDB Atlas

1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas/register
2. Create a new project
3. Build a database (choose the free tier)
4. Create a database user with password authentication
5. Configure network access to allow connections from anywhere (IP: 0.0.0.0/0)
6. Get your connection string from Connect > Connect your application

## Step 2: Deploy Frontend to Cloudflare Pages

### Option 1: Deploy via Cloudflare Dashboard

1. Log in to your Cloudflare account
2. Go to the "Pages" section
3. Click "Create a project"
4. Connect your GitHub repository
5. Configure your build settings:
   - Framework preset: Create React App
   - Build command: `cd frontend && npm install && npm run build`
   - Build output directory: `frontend/build`
   - Root directory: `/` (or wherever your frontend code is located)
6. Set environment variables:
   - `REACT_APP_API_BASE_URL`: Your Cloudflare Worker URL (e.g., `https://cruzhacks2025-api.your-username.workers.dev`)
7. Click "Save and Deploy"

### Option 2: Deploy via Wrangler CLI

1. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```
2. Log in to Cloudflare:
   ```bash
   wrangler login
   ```
3. Create a `wrangler.toml` file in your frontend directory:
   ```toml
   name = "cruzhacks2025-frontend"
   type = "webpack"
   account_id = "your-account-id"
   workers_dev = true
   route = ""
   zone_id = ""
   usage_model = ""
   compatibility_date = "2023-11-16"

   [site]
   bucket = "./build"
   entry-point = "."

   [build]
   command = "npm run build"
   ```
4. Deploy to Cloudflare:
   ```bash
   cd frontend
   wrangler pages publish build
   ```

## Step 3: Deploy Backend to Cloudflare Workers

### Configure Backend for Workers

1. Create a `wrangler.toml` file in the root directory:
   ```toml
   name = "cruzhacks2025-api"
   main = "worker.js"
   compatibility_date = "2023-11-16"
   usage_model = "bundled"
   
   [vars]
   GEMINI_API_KEY = "AIzaSyATW4-HShWRk5eMdpj7F_mTJxP1Ho_fIQw"
   FRONTEND_URL = "https://cruzhacks2025.pages.dev"
   
   [durable_objects]
   bindings = [
     { name = "CONNECTION_MANAGER", class_name = "ConnectionManager" }
   ]
   
   [[kv_namespaces]]
   binding = "AUTH_STORE"
   id = "your-kv-namespace-id"
   
   [[d1_databases]]
   binding = "DB"
   database_name = "cruzhacks2025"
   database_id = "your-d1-database-id"
   ```

2. Create a `worker.js` file (adapting your FastAPI code to Cloudflare Workers):
   ```javascript
   // This is a simplified example. You'll need to convert your FastAPI routes to Workers

   addEventListener('fetch', event => {
     event.respondWith(handleRequest(event.request))
   })
   
   // Handle HTTP requests
   async function handleRequest(request) {
     const url = new URL(request.url)
     
     // Add CORS headers
     const corsHeaders = {
       'Access-Control-Allow-Origin': FRONTEND_URL,
       'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
       'Access-Control-Allow-Headers': 'Content-Type, Authorization',
       'Access-Control-Max-Age': '86400',
     }
     
     // Handle CORS preflight requests
     if (request.method === 'OPTIONS') {
       return new Response(null, {
         status: 204,
         headers: corsHeaders
       })
     }
     
     // Route requests to appropriate handlers
     if (url.pathname.startsWith('/auth/')) {
       return handleAuth(request, corsHeaders)
     } else if (url.pathname.startsWith('/notes/')) {
       return handleNotes(request, corsHeaders)
     } else if (url.pathname.startsWith('/lobby/')) {
       return handleLobby(request, corsHeaders)
     } else if (url.pathname === '/env-check') {
       return handleEnvCheck(request, corsHeaders)
     }
     
     // Default response
     return new Response(JSON.stringify({
       message: 'Welcome to CruzHacks2025 API',
       status: 'online'
     }), {
       status: 200,
       headers: {
         'Content-Type': 'application/json',
         ...corsHeaders
       }
     })
   }
   
   // Implement your API handler functions here...
   ```

3. For WebSockets, use Durable Objects:
   ```javascript
   // Durable Object for WebSocket connections
   export class ConnectionManager {
     constructor(state, env) {
       this.state = state
       this.env = env
       this.sessions = {}
     }
     
     async fetch(request) {
       // WebSocket connection handling
       // ...
     }
   }
   ```

### Deploy using Wrangler

1. Deploy to Cloudflare Workers:
   ```bash
   wrangler publish
   ```

## Step 4: Set Up Cloudflare KV and D1 for Data Storage

Since Workers doesn't natively connect to MongoDB, we'll use Cloudflare's KV and D1 services:

1. Create a KV namespace for authentication:
   ```bash
   wrangler kv:namespace create AUTH_STORE
   ```

2. Create a D1 database for notes and lobbies:
   ```bash
   wrangler d1 create cruzhacks2025
   ```

3. Update your `wrangler.toml` with the IDs from these commands

## Step 5: Configure WebSocket Support with Durable Objects

1. Create a Durable Object namespace:
   ```bash
   wrangler durable-object namespace create CONNECTION_MANAGER
   ```

2. Add the binding to your `wrangler.toml`

## Step 6: Connect Your Frontend to the Cloudflare Worker Backend

Update your frontend code to connect to the Cloudflare Worker:

1. Update the API URL in your frontend:
   ```javascript
   const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
   const WS_BASE_URL = API_BASE_URL.replace('https:', 'wss:').replace('http:', 'ws:');
   ```

2. For WebSockets in Cloudflare, you might need to adjust to use:
   ```javascript
   const WS_URL = `${WS_BASE_URL}/ws/${lobbyId}`;
   ```

## Testing Your Deployment

1. Open your Cloudflare Pages URL
2. Test user registration and login
3. Create a new lobby
4. Open the site in a different browser or private browsing window
5. Log in with a different account
6. Join the same lobby
7. Verify that real-time collaboration works

## Troubleshooting

### WebSocket Connection Issues

For WebSockets in Cloudflare:
1. Make sure you've set up Durable Objects correctly
2. Verify your WebSocket URL is correct
3. Check Cloudflare logs for any connection errors

### CORS Issues

1. Verify your CORS configuration in the Worker script
2. Make sure `FRONTEND_URL` environment variable is set correctly

### Database Connection Issues

1. Check your KV and D1 bindings in `wrangler.toml`
2. Verify that your Worker has the correct permissions

## Production Considerations

1. **Security**: 
   - Store sensitive data in Cloudflare Workers Secrets
   - Consider using Cloudflare Access for additional authentication

2. **Performance**:
   - Optimize your Worker code for faster execution
   - Use Cloudflare Caching where applicable

3. **Scaling**:
   - Monitor your usage limits on the free tier
   - Consider upgrading to paid plans for higher limits 