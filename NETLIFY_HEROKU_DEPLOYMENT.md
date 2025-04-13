# Deployment Guide: Netlify (Frontend) & Heroku (Backend)

This guide provides step-by-step instructions to deploy your CruzHacks2025 application using Netlify for the frontend and Heroku for the backend.

## Prerequisites

- GitHub repository with your code
- Netlify account (for frontend)
- Heroku account (for backend)
- MongoDB Atlas account (for database)

## Step 1: Set Up MongoDB Atlas

1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas/register
2. Create a new project
3. Build a database (choose the free tier)
4. Create a database user with password authentication
5. Configure network access to allow connections from anywhere (IP: 0.0.0.0/0)
6. Get your connection string from Connect > Connect your application

## Step 2: Deploy Backend to Heroku

### Option 1: Deploy via Heroku Dashboard

1. Create a new app in your Heroku Dashboard
2. Connect your GitHub repository
3. Configure environment variables in Settings > Config Vars:
   - `MONGODB_URL`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: A secure random string for JWT token signing
   - `GEMINI_API_KEY`: Your Gemini API key
   - `FRONTEND_URL`: `https://cruzhacks2025.netlify.app` (or your custom domain)
4. Deploy the application from the Deploy tab

### Option 2: Deploy via Heroku CLI

1. Install Heroku CLI: `npm install -g heroku`
2. Log in to Heroku: `heroku login`
3. Create a new Heroku app: `heroku create cruzhacks2025-backend`
4. Set environment variables:
   ```
   heroku config:set MONGODB_URL="your_mongodb_connection_string"
   heroku config:set JWT_SECRET="your_secure_jwt_secret"
   heroku config:set GEMINI_API_KEY="AIzaSyATW4-HShWRk5eMdpj7F_mTJxP1Ho_fIQw"
   heroku config:set FRONTEND_URL="https://cruzhacks2025.netlify.app"
   ```
5. Push to Heroku: `git push heroku main`

## Step 3: Deploy Frontend to Netlify

### Option 1: Deploy via Netlify Dashboard

1. Go to Netlify Dashboard and click "New site from Git"
2. Connect to your GitHub repository
3. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `frontend/build`
4. Configure environment variables:
   - `REACT_APP_API_BASE_URL`: Your Heroku backend URL (e.g., `https://cruzhacks2025-backend.herokuapp.com`)
5. Deploy the site

### Option 2: Deploy via Netlify CLI

1. Install Netlify CLI: `npm install -g netlify-cli`
2. Log in to Netlify: `netlify login`
3. Initialize a new Netlify site: `cd frontend && netlify init`
4. Deploy to Netlify: `netlify deploy --prod`

## Step 4: Test Your Deployment

1. Open your Netlify site URL
2. Test user registration and login
3. Create a new lobby
4. Open the site in a different browser or private browsing window
5. Log in with a different account
6. Join the same lobby
7. Verify that real-time collaboration works (WebSocket connection)

## Troubleshooting

### WebSocket Connection Issues

If you're experiencing WebSocket connection issues:

1. Check the browser console for errors
2. Verify that your backend CORS settings include your Netlify domain
3. Make sure the WebSocket URL is correct (wss:// for HTTPS, ws:// for HTTP)
4. Try using a connection testing tool like: https://www.piesocket.com/websocket-tester

### CORS Errors

If you're seeing CORS errors:

1. Verify your backend CORS configuration in `main.py`
2. Make sure the `FRONTEND_URL` environment variable is set correctly in Heroku
3. Check that you're using the correct backend URL in your frontend

### Database Connection Issues

If you're having MongoDB connection problems:

1. Check your MongoDB Atlas connection string
2. Verify that your IP whitelist includes `0.0.0.0/0` to allow connections from Heroku
3. Test your database connection using the `/env-check` endpoint

## Maintenance

- Monitor your Heroku and Netlify dashboards for errors or performance issues
- Set up alerts for application failures
- Regularly update dependencies to patch security vulnerabilities

## Security Considerations

- Keep your JWT_SECRET secure and unique for production
- Consider enabling JWT token expiration for better security
- Never commit `.env` files to your repository
- Use environment variables for all sensitive information 