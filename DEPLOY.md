# Deployment Guide

This guide explains how to deploy your Instagram Mock UI application to **Vercel** (Frontend) and **Render** (Backend).

## 1. Backend Deployment (Render)

1.  Push your code to a GitHub repository.
2.  Log in to [Render](https://render.com/).
3.  Click "New +" and select "Web Service".
4.  Connect your GitHub repository.
5.  Configure the service:
    *   **Name:** `instagram-mock-backend` (or similar)
    *   **Root Directory:** `.` (Leave empty or set to root)
    *   **Build Command:** `cd server && npm install`
    *   **Start Command:** `cd server && node index.js`
    *   **Environment Variables:**
        *   `NODE_VERSION`: `18` (or generic)
        *   `CLIENT_URL`: `https://<YOUR_VERCEL_APP_URL>` (You will update this *after* deploying Vercel, for now you can put `*` to allow all or wait).
        *   `SESSION_SECRET`: Generate a random string.
6.  Click "Create Web Service".
7.  **Copy the Service URL** (e.g., `https://instagram-mock-backend.onrender.com`). You will need this for Vercel.

## 2. Frontend Deployment (Vercel)

1.  Log in to [Vercel](https://vercel.com/).
2.  Click "Add New..." -> "Project".
3.  Import your GitHub repository.
4.  Configure the project:
    *   **Root Directory:** `client` (Click "Edit" next to Root Directory and select `client`).
    *   **Framework Preset:** `Other` (or just leave as is, since it's static).
5.  **Before clicking Deploy**:
    *   Go to your local project code `client/vercel.json`.
    *   Replace `REPLACE_WITH_YOUR_RENDER_URL` with the Render URL you copied in Step 1 (e.g., `https://instagram-mock-backend.onrender.com`).
    *   **Commit and push** this change to GitHub.
6.  Back in Vercel, if you haven't deployed yet, click "Deploy". If you already deployed with the wrong URL, Vercel will auto-deploy the new commit.
7.  **Copy the Vercel App URL** (e.g., `https://instagram-mock-ui.vercel.app`).

## 3. Final Configuration

1.  Go back to **Render** Dashboard -> Your Web Service -> **Environment**.
2.  Add/Update the `CLIENT_URL` variable to your **Vercel App URL** (no trailing slash).
3.  Web Service will restart automatically.

## Important Notes

*   **Data Persistence:** Files uploaded or created (feeds, images) are stored in the `Data/` and `CachedImages/` folders. On Render (Free Tier), these files **will be lost** every time the server restarts or deploys. For permanent storage, you would need to implement a database and cloud storage (e.g., AWS S3).
*   **Google Drive:** Ensure your `config.js` in `client/` has the correct Google Client ID and configured origins in Google Cloud Console. You need to add both `http://localhost:3001` and your Vercel URL to "Authorized JavaScript origins" in Google Cloud Console.
