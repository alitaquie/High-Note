/**
 * CruzHacks2025 API Worker
 * This is a Cloudflare Worker that handles API requests for the CruzHacks2025 project.
 */

// Environment variables from wrangler.toml
const GEMINI_API_KEY = GEMINI_API_KEY || "YOUR_API_KEY_HERE";
const FRONTEND_URL = FRONTEND_URL || "https://cruzhacks2025.pages.dev";

// Main event listener for HTTP requests
addEventListener('fetch', event => {
  // Handle OPTIONS requests for CORS
  if (event.request.method === 'OPTIONS') {
    event.respondWith(handleOptions(event.request));
    return;
  }

  // Handle WebSocket upgrade requests
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/ws/')) {
    const lobbyId = url.pathname.split('/')[2];
    
    // You would need to have Durable Objects set up for this to work
    // This is a placeholder for the WebSocket handling
    // event.respondWith(handleWebSocket(event, lobbyId));
    // return;
    
    // For now, return an informational response
    event.respondWith(new Response(
      JSON.stringify({ error: "WebSocket support requires Durable Objects. Please set them up first." }),
      { 
        status: 501,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    ));
    return;
  }

  // Handle regular HTTP requests
  event.respondWith(handleRequest(event.request));
});

// CORS headers for all responses - Allow all origins during development
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // Allow all origins for now
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Handle CORS preflight requests
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

// Main request handler
async function handleRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Route requests to appropriate handlers
    if (url.pathname.startsWith('/auth/')) {
      return await handleAuth(request);
    } else if (url.pathname.startsWith('/notes/')) {
      return await handleNotes(request);
    } else if (url.pathname.startsWith('/lobby/')) {
      return await handleLobby(request);
    } else if (url.pathname === '/env-check') {
      return await handleEnvCheck(request);
    } else if (url.pathname === '/') {
      // Root endpoint
      return new Response(
        JSON.stringify({
          message: 'Welcome to CruzHacks2025 API',
          status: 'online',
          version: '1.0.0'
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
    
    // Not found
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    // Handle errors
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
}

// Environment check endpoint
async function handleEnvCheck(request) {
  return new Response(
    JSON.stringify({
      gemini_api_key_exists: Boolean(GEMINI_API_KEY),
      frontend_url: FRONTEND_URL
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
}

// Auth endpoints handler (placeholder)
async function handleAuth(request) {
  const url = new URL(request.url);
  
  // Example implementation for login endpoint
  if (url.pathname === '/auth/login' && request.method === 'POST') {
    try {
      const data = await request.json();
      
      // This is a placeholder. In a real implementation, you would:
      // 1. Validate the user credentials against your KV store or D1 database
      // 2. Generate a JWT token if valid
      // 3. Return the token
      
      return new Response(
        JSON.stringify({
          access_token: "example_token",
          token_type: "bearer"
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  }
  
  // Not implemented auth endpoint
  return new Response(
    JSON.stringify({ error: 'Auth endpoint not implemented' }),
    {
      status: 501,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
}

// Notes endpoints handler (placeholder)
async function handleNotes(request) {
  return new Response(
    JSON.stringify({ error: 'Notes endpoints not implemented' }),
    {
      status: 501,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
}

// Lobby endpoints handler (placeholder)
async function handleLobby(request) {
  return new Response(
    JSON.stringify({ error: 'Lobby endpoints not implemented' }),
    {
      status: 501,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
}

// The Durable Object class for handling WebSocket connections
// This is a placeholder and would need to be implemented properly
export class ConnectionManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = {};
  }
  
  async fetch(request) {
    // WebSocket handling would go here
    // This is just a placeholder
    return new Response("WebSocket connections not yet implemented", { status: 501 });
  }
} 