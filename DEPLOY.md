# Deploying to Render (Free Tier)

This app is configured as a "Monolith", meaning you can deploy it as a single Web Service.

## Steps to Deploy

1.  **Push your code to GitHub**
    - Ensure your repo is public or private (Render supports both).

2.  **Create account on [Render.com](https://render.com)**
    - It's free and requires no credit card for the free tier.

3.  **New Web Service**
    - Click **New +** -> **Web Service**.
    - Connect your GitHub repository.

4.  **Configure Service**
    - **Name**: `face-verify-app` (or any name)
    - **Region**: Closest to you (e.g., Singapore, Ohio, Frankfurt)
    - **Branch**: `main`
    - **Root Directory**: `.` (leave empty to use root)
    - **Runtime**: `Node`
    - **Build Command**: `npm run build`
    - **Start Command**: `npm start`
    - **Instance Type**: Free

5.  **Environment Variables**
    Add the following environment variable (Advanced -> Add Environment Variable):
    - Key: `NODE_ENV`
    - Value: `production`

6.  **Deploy**
    - Click **Create Web Service**.
    - Wait about 3-5 minutes for the build to complete.

## That's it!
Render will give you a URL like `https://face-verify-app.onrender.com`.
- **HTTPS is enabled automatically**, so the camera will work.
- Share this link with anyone!

## Note on Free Tier
The usage of the Free Tier on Render creates a "spin down" effect:
- If no one visits your site for 15 minutes, the server sleeps.
- The **first access** after sleeping will take ~30-50 seconds.
- **Session Data**: Since we store sessions in memory, **all sessions are wiped** when the server sleeps. This is actually good for privacy!
