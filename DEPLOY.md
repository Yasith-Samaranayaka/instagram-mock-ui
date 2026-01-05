# Deployment Guide

This guide explains how to deploy your Instagram Mock UI application to **Vercel** (Frontend) and **Render** (Backend).

## Part 1: GitHub Setup (Required First Step)

Types of hosting like Vercel and Render require your code to be on GitHub. I have already initialized a local Git repository for you.

1.  **Create a New Repository on GitHub:**
    *   Go to [github.com/new](https://github.com/new).
    *   **Repository name:** `instagram-mock-ui` (or any name you prefer).
    *   **Visibility:** Public or Private (your choice).
    *   **Initialize with README:** **UNCHECK** this (Keep it empty).
    *   Click **Create repository**.

2.  **Push Your Code:**
    *   Copy the URL of your new repository (e.g., `https://github.com/username/instagram-mock-ui.git`).
    *   Run the following commands in your terminal (replace `YOUR_REPO_URL` with the one you copied):

    ```bash
    git remote add origin YOUR_REPO_URL
    git branch -M main
    git push -u origin main
    ```

## Part 2: Backend Deployment (Render)

1.  Log in to [Render](https://render.com/).
2.  Click "New +" and select "Web Service".
3.  Connect your GitHub repository (the one you just created).
4.  Configure the service:
    *   **Name:** `instagram-mock-backend` (or similar).
    *   **Root Directory:** `.` (Leave empty).
    *   **Build Command:** `cd server && npm install`
    *   **Start Command:** `cd server && node index.js`
    *   **Environment Variables:**
        *   `NODE_VERSION`: `18`
        *   `CLIENT_URL`: `https://<YOUR_VERCEL_APP_URL>` (Put `*` for now, update later).
        *   `SESSION_SECRET`: (Enter a random string).
5.  Click "Create Web Service".
6.  **Copy the Service URL** (e.g., `https://instagram-mock-backend.onrender.com`).

## Part 3: Frontend Deployment (Vercel)

1.  Log in to [Vercel](https://vercel.com/).
2.  Click "Add New..." -> "Project".
3.  Import your GitHub repository.
4.  Configure the project:
    *   **Root Directory:** `client` (Click "Edit" and select `client`).
    *   **Framework Preset:** `Other`.
5.  **Before clicking Deploy**:
    *   Locally, go to `client/vercel.json`.
    *   Replace `REPLACE_WITH_YOUR_RENDER_URL` with your actual Render URL from Part 2.
    *   Commit and push the change:
        ```bash
        git add client/vercel.json
        git commit -m "Update Render URL"
        git push origin main
        ```
6.  Click "Deploy" (or Vercel will auto-deploy the new commit).
7.  **Copy your Vercel App URL**.

## Part 4: Final Connection

1.  Go back to **Render Dashboard** -> Environment.
2.  Update `CLIENT_URL` to your actual Vercel URL.
3.  Go to **Google Cloud Console** (if using Drive login) and add your Vercel URL to "Authorized JavaScript origins".
