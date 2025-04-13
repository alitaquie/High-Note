# CruzHacks2025 Deployment

This document provides quick steps to deploy your CruzHacks2025 project using Netlify for the frontend and Heroku for the backend.

## Quick Deployment Steps

### 1. Deploy Backend to Heroku

```bash
# Install Heroku CLI if not already installed
npm install -g heroku

# Login to Heroku
heroku login

# Create a new Heroku app
heroku create cruzhacks2025-backend

# Set environment variables
heroku config:set MONGODB_URL="your_mongodb_atlas_connection_string"
heroku config:set JWT_SECRET="generate_a_secure_random_string"
heroku config:set GEMINI_API_KEY="AIzaSyATW4-HShWRk5eMdpj7F_mTJxP1Ho_fIQw"
heroku config:set FRONTEND_URL="https://your-app-name.netlify.app"

# Deploy to Heroku
git push heroku main
```

### 2. Deploy Frontend to Netlify

#### Using Netlify CLI:

```bash
# Install Netlify CLI if not already installed
npm install -g netlify-cli

# Login to Netlify
netlify login

# Navigate to frontend directory
cd frontend

# Initialize Netlify site
netlify init

# Deploy to production
netlify deploy --prod
```

#### Using Netlify Dashboard:

1. Go to [Netlify](https://app.netlify.com/)
2. Click "New site from Git"
3. Connect to your GitHub repository
4. Set build command: `npm run build`
5. Set publish directory: `frontend/build`
6. Add environment variable:
   - Key: `REACT_APP_API_BASE_URL`
   - Value: `https://your-heroku-app-name.herokuapp.com`
7. Click "Deploy site"

## Testing Your Deployment

1. Open your Netlify URL
2. Register/login with two different accounts
3. Create a lobby with one account
4. Join the same lobby with the other account
5. Verify that real-time collaboration works

## For Detailed Instructions

See the complete [Deployment Guide](./NETLIFY_HEROKU_DEPLOYMENT.md) for detailed step-by-step instructions. 