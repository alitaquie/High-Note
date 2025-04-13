# Deployment Guide for CruzHacks2025 Project

This guide provides step-by-step instructions to deploy your application, allowing users to join the same kibby (lobby) from different devices.

## Prerequisites

- MongoDB Atlas account (for database)
- Vercel account (for frontend)
- Railway account (for backend)
- Git

## Database Setup (MongoDB Atlas)

1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas/register
2. Create a new project
3. Build a database (choose the free tier)
4. Create a database user with password authentication
5. Configure network access to allow connections from anywhere (IP: 0.0.0.0/0)
6. Get your connection string from Connect > Connect your application
7. Replace `<username>`, `<password>`, and `<dbname>` in the connection string

## Backend Deployment (Railway)

1. Create a Railway account at https://railway.app/
2. Create a new project
3. Choose "Deploy from GitHub repo"
4. Connect your GitHub repository
5. Configure environment variables:
   - `MONGODB_URL`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: A secure random string for JWT token signing
   - `GEMINI_API_KEY`: Your Gemini API key
   - `FRONTEND_URL`: Your Vercel frontend URL (once deployed)
6. Deploy the application
7. Note the URL of your deployed backend (e.g., https://your-app-name.railway.app)

## Frontend Deployment (Vercel)

1. Create a Vercel account at https://vercel.com/signup
2. Create a new project
3. Import your GitHub repository
4. Configure environment variables:
   - `REACT_APP_API_BASE_URL`: Your Railway backend URL
5. Deploy the application
6. Note the URL of your deployed frontend

## Update CORS and WebSocket Configuration

1. Update the `.env.production` file in your backend with the correct `FRONTEND_URL`
2. Update the `main.py` file to include your frontend domain in the CORS allowed origins
3. Update the `frontend/.env.production` file with your backend URL

## Final Steps

1. Test the application by accessing your Vercel frontend URL
2. Verify that users can join the same lobby from different devices
3. Check that real-time collaboration works correctly

## Troubleshooting

- **WebSocket connection issues**: Make sure your frontend is using the correct WebSocket URL
- **CORS errors**: Verify that your backend CORS configuration includes your frontend domain
- **Database connection issues**: Check your MongoDB Atlas connection string and network settings

## Maintenance

- Monitor your Railway and Vercel dashboards for errors or performance issues
- Set up alerts for application failures
- Consider adding monitoring tools like Sentry for error tracking

## Security Considerations

- Keep your JWT_SECRET secure and unique for each environment
- Never commit `.env` files to your repository
- Regularly update dependencies to patch security vulnerabilities
- Consider enabling JWT token expiration for better security 