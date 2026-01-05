# Instagram Mock UI - Complete Developer Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Authentication System](#authentication-system)
3. [Architecture](#architecture)
4. [Directory Structure](#directory-structure)
5. [Frontend Setup](#frontend-setup)
6. [Backend Setup](#backend-setup)
7. [Data Flow & States](#data-flow--states)
8. [UI Components & Pages](#ui-components--pages)
9. [Styling System](#styling-system)
10. [JavaScript Logic](#javascript-logic)
11. [API Endpoints](#api-endpoints)
12. [Caching System](#caching-system)
13. [Features Deep Dive](#features-deep-dive)
14. [Data Schema](#data-schema)
15. [Step-by-Step Recreation Guide](#step-by-step-recreation-guide)

---

## Project Overview

**Instagram Mock UI** is a web application that allows users to create realistic Instagram feed mockups. It enables:
- **User Authentication** via Google Sign-In (each user has isolated data)
- Creating full Instagram profiles with multiple posts/reels/carousels
- Creating single standalone posts
- Real-time preview of how the feed will look
- Publishing feeds and sharing them via URL
- Client approval workflow for feedback and approvals
- Caching media from Google Drive to avoid re-downloading
- Saving presets for quick reuse

The application has a **frontend** (HTML/CSS/JavaScript) and a **Node.js/Express backend** that handles authentication, data persistence, and media caching.

---

## Authentication System

### Overview
The application uses **Google Sign-In (OAuth 2.0)** for user authentication. Each user has their own isolated data - feeds, posts, and presets are tied to their Google account.

### Key Features
- ✅ **Secure Authentication**: Industry-standard OAuth 2.0
- ✅ **User Isolation**: Each user can only see/edit their own content
- ✅ **Session Management**: 30-day persistent sessions
- ✅ **No Password Storage**: Google handles all authentication

### Authentication Flow

```
1. User visits any page (index.html, grid.html, etc.)
   ↓
2. Page calls requireAuth() from auth-client.js
   ↓
3. requireAuth() checks /auth/status endpoint
   ↓
4. If not authenticated → Redirect to /login.html
   If authenticated → Continue and show user info
   ↓
5. On login page, user clicks "Sign in with Google"
   ↓
6. Redirects to /auth/google
   ↓
7. Google OAuth flow (user signs in)
   ↓
8. Callback to /auth/google/callback
   ↓
9. Server creates/updates user in Data/users.json
   ↓
10. Session created, redirect to /index.html
```

### Files Involved

**Backend:**
- `server/auth.js` - Passport.js configuration for Google OAuth
- `server/.env` - OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET)
- `server/index.js` - Authentication routes and middleware
- `Data/users.json` - User database

**Frontend:**
- `login.html` - Login page with Google Sign-In button
- `login.css` - Login page styling
- `login.js` - Login page logic
- `auth-client.js` - Shared authentication utilities (checkAuth, requireAuth, logout, renderUserInfo)

### Setup Instructions

1. **Create OAuth Credentials** (if not already done):
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Select your project (or create new)
   - Navigate to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Select "Web application"
   - Add authorized redirect URI: `http://localhost:3001/auth/google/callback`
   - Copy Client ID and Client Secret

2. **Configure Environment Variables**:
   - Open `server/.env`
   - Set `GOOGLE_CLIENT_ID` to your OAuth Client ID
   - Set `GOOGLE_CLIENT_SECRET` to your OAuth Client Secret
   - Set `SESSION_SECRET` to a random string (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

3. **Restart Server**:
   ```bash
   cd server
   node index.js
   ```

4. **Test Login**:
   - Visit `http://localhost:3001/login.html`
   - Click "Sign in with Google"
   - Sign in with your Google account
   - You'll be redirected to the dashboard

### User Data Structure

**Data/users.json:**
```json
{
  "users": [
    {
      "id": "google_106018206788081594275",
      "googleId": "106018206788081594275",
      "email": "user@example.com",
      "name": "John Doe",
      "picture": "https://lh3.googleusercontent.com/...",
      "createdAt": "2026-01-01T15:42:56.231Z",
      "lastLogin": "2026-01-01T16:06:07.854Z"
    }
  ]
}
```

### Data Isolation

All feeds are now tied to users via `userId` field:

**Data/feed_data.json:**
```json
[
  {
    "id": 1735747200000,
    "type": "Grid",
    "name": "My Feed",
    "state": { ... },
    "userId": "google_106018206788081594275",
    "createdAt": "2026-01-01T20:00:00Z"
  }
]
```

### API Endpoints

**Authentication Routes:**
- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/google/callback` - OAuth callback handler
- `GET /auth/status` - Check if user is authenticated
- `POST /auth/logout` - Logout user

**Protected Routes** (require authentication):
- `GET /api/feeds` - Returns only current user's feeds
- `GET /api/feeds/:id` - Verifies user owns the feed
- `POST /api/feeds` - Adds userId to new feeds
- `DELETE /api/feeds/:id` - Verifies ownership before deletion

### Security Features

1. **Session-Based Authentication**
   - HTTP-only cookies (not accessible via JavaScript)
   - 30-day session duration
   - Secure flag for HTTPS in production

2. **Data Isolation**
   - All feeds filtered by userId
   - Ownership verification on all operations
   - 403 Forbidden for unauthorized access

3. **OAuth 2.0**
   - No password storage
   - Google handles security
   - Industry-standard protocol

---

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Browser)                │
│  ┌──────────────────────────────────────────────┐  │
│  │  Dashboard (index.html)                      │  │
│  │  ├─ Display saved feeds                      │  │
│  │  ├─ Display saved accounts                   │  │
│  │  └─ Navigation buttons                       │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Grid Editor (grid.html)                     │  │
│  │  ├─ Account info form                        │  │
│  │  ├─ Instagram preview (middle)               │  │
│  │  └─ Content management (right)               │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Single Post Editor (single.html)            │  │
│  │  └─ Similar layout for single posts          │  │
│  └──────────────────────────────────────────────┘  │
│                      │                             │
│            HTTP Requests (JSON)                    │
└────────────────────────┼──────────────────────────┘
                         │
                 (http://localhost:3001)
                         │
┌────────────────────────┼──────────────────────────┐
│          Backend (Node.js/Express)                │
│                      │                             │
│  ┌────────────────────┴──────────────┐            │
│  │     API Endpoints                 │            │
│  ├─ GET/POST/DELETE /api/feeds      │            │
│  ├─ GET /api/presets                │            │
│  ├─ POST /api/cache/download        │            │
│  └─ POST /api/cache/delete          │            │
│                      │                │            │
│  ┌────────────────────┴──────────────┐            │
│  │  File System                      │            │
│  ├─ Data/feed_data.json             │            │
│  ├─ Data/client_info.json           │            │
│  ├─ CachedImages/                   │            │
│  │  ├─ posts/                       │            │
│  │  ├─ reels/                       │            │
│  │  ├─ carousels/                   │            │
│  │  ├─ profiles/                    │            │
│  │  └─ metadata.json                │            │
│  └─ CacheContent/                  │            │
│     (Older cache structure)         │            │
└─────────────────────────────────────┘            │
└──────────────────────────────────────────────────┘
```

---

## Directory Structure

```
workspace-root/
├── index.html                           # Dashboard page (homepage)
├── grid.html                            # Grid feed editor
├── single.html                          # Single post editor
├── scheduler.html                       # Scheduler page
├── client.html                          # Client approval page
├── client.js                            # Client page logic
├── single-client.html                   # Single post client page
├── single-client.js                     # Single post client logic
│
├── login.html                           # Login page (NEW)
├── login.css                            # Login page styles (NEW)
├── login.js                             # Login page logic (NEW)
│
├── styles.css                           # Main stylesheet
├── script.js                            # Main editor logic
├── ui.js                                # Modal/dialog utilities
├── auth.js                              # Google Drive authentication
├── auth-client.js                       # User authentication utilities (NEW)
├── config.js                            # Configuration (Drive API keys)
├── drive-upload.js                      # Google Drive upload utilities
│
├── wiki.md                              # Complete developer guide
├── GoogleAPI_Implementation.md          # Google Drive API reference
├── admin-approval-guide.md              # Admin approval workflow guide
├── approval-workflow-implementation.md  # Approval workflow technical docs
├── newfeatures.md                       # Feature documentation
├── run server(delete this before rollout).ps1  # Server start script
│
├── Data/                                # Data storage
│   ├── feed_data.json                   # Saved feeds (with userId)
│   ├── users.json                       # User accounts (NEW)
│   ├── client_info.json                 # Client information
│   ├── client_emails.json               # Client email addresses
│   ├── client_feedback.json             # Client feedback/approvals
│   ├── approvals.json                   # Approval data
│   └── scheduler.json                   # Scheduled posts
│
├── CachedImages/                        # Downloaded & cached images
│   ├── posts/                           # Cached post images
│   ├── reels/                           # Cached reel thumbnails
│   ├── carousels/                       # Cached carousel images
│   ├── profiles/                        # Cached profile pictures
│   └── metadata.json                    # Cache metadata tracking
│
├── CacheContent/                        # (Legacy cache structure - can be removed)
│
├── server/                              # Backend
│   ├── index.js                         # Express server with authentication
│   ├── auth.js                          # Passport.js OAuth configuration (NEW)
│   ├── .env                             # Environment variables (OAuth credentials) (NEW)
│   ├── package.json                     # Dependencies
│   └── package-lock.json
│
└── UI Ref/                              # Reference materials
```

---

## Frontend Setup

### Technologies Used
- **HTML5** - Semantic markup
- **CSS3** - Grid layouts, CSS variables, flexbox
- **Vanilla JavaScript** - No frameworks (pure DOM manipulation)
- **Font Awesome 6.4.0** - Icon library (via CDN)
- **Swiper 11** - Carousel component (via CDN)

### Key Files

#### **styles.css** (1248 lines)
Complete stylesheet organized into sections:

```css
/* Color Scheme - Dark Instagram Theme */
:root {
    --bg-primary: #000000;              /* Main background */
    --bg-secondary: #121212;            /* Secondary background */
    --bg-tertiary: #262626;             /* Tertiary background */
    --text-primary: #ffffff;            /* Main text */
    --text-secondary: #a8a8a8;          /* Secondary text */
    --text-muted: #737373;              /* Muted text */
    --border-color: #262626;            /* Border color */
    --blue-primary: #0095f6;            /* Instagram blue */
    --blue-hover: #1877f2;              /* Hover blue */
    --red-primary: #ed4956;             /* Instagram red (likes) */
    --green-primary: #00ba7c;           /* Green accent */
}
```

**CSS Sections:**
- **Reset & Variables** - CSS custom properties and element resets
- **Typography** - Font sizes, weights, headings
- **Buttons** - Primary, secondary, danger button styles
- **Forms** - Input, textarea, select styling
- **Layout** - Header, containers, panels, grid systems
- **Instagram Mock Components** - Profile header, grid, modal, stats
- **Responsive Design** - Media queries for mobile

---

## Backend Setup

### Technologies Used
- **Node.js** - Runtime
- **Express** - Web framework
- **CORS** - Cross-origin requests
- **fs (File System)** - File operations
- **https/http** - Download media from URLs
- **path** - File path utilities

### Setup Instructions

1. **Install Dependencies**
   ```bash
   cd server
   npm install
   ```

2. **Start Server**
   ```bash
   npm start
   # or
   node index.js
   ```

3. **Server will run on**
   ```
   http://localhost:3001
   ```

### Core Server Features

**Port:** 3001 (configurable via `PORT` env var)

**Static File Serving:**
- Serves all frontend files from the parent directory
- Makes `/CachedImages/`, `/Data/`, etc. accessible via HTTP

**Middleware:**
- CORS enabled for cross-origin requests
- JSON body parser with 2MB size limit

---

## Data Flow & States

### State Management (Frontend)

Each editor page maintains a `state` object:

```javascript
const state = {
    accountInfo: {
        name: '',           // Username
        pfp: '',            // Profile picture URL
        followers: '',      // Follower count (string, e.g., "10k")
        following: '',      // Following count
        bio: '',            // Bio text
        cachedPfp: ''       // Cached profile picture path
    },
    posts: [],              // Array of post objects
    presets: [],            // Available presets
    activeTab: 'grid'       // Current tab ('grid' or 'reels')
};
```

### Post Object Schema

```javascript
// Regular Post
{
    id: "timestamp",
    type: "post",
    caption: "Post caption",
    date: "2025-12-17",
    time: "19:00",
    url: "https://...",                    // Direct image URL
    cachedPath: "/CachedImages/posts/..."  // Cached version
}

// Reel (Video)
{
    id: "timestamp",
    type: "reel",
    caption: "",
    date: "2025-12-17",
    time: "19:00",
    videoUrl: "https://...",                           // Video URL
    thumbnail: "https://...",                          // Thumbnail URL
    cachedThumbnail: "/CachedImages/reels/..."        // Cached thumbnail
}

// Carousel
{
    id: "timestamp",
    type: "carousel",
    caption: "",
    date: "2025-12-17",
    time: "19:00",
    images: ["url1", "url2", ...],                    // Array of image URLs
    cachedImages: ["/CachedImages/carousel/...", ...] // Cached versions
}
```

### State Persistence Flow

```
User Input (Form)
    ↓
updateAccountInfo() / updatePost()
    ↓
Update state object
    ↓
Render UI (renderAccountInfo() / renderGrid())
    ↓
saveState() - saves to backend
    ↓
Backend: POST /api/feeds
    ↓
Saves to Data/feed_data.json
```

---

## UI Components & Pages

### Page 1: Dashboard (index.html)

**Purpose:** Landing page, view all saved feeds and accounts

**Key Sections:**

1. **Header**
   - Title: "Instagram Mock UI"
   - "New File" button → Opens file type modal

2. **Published Feeds Section**
   - Displays all saved grid feeds
   - Shows feed name and timestamp
   - Click to load feed
   - Delete button for each feed

3. **Saved Account Information Section**
   - Displays extracted account info from all feeds
   - Profile picture, name, followers
   - Fixed at bottom with scroll

4. **File Type Modal**
   - Opens when "New File" clicked
   - Options:
     - **Grid (Full Profile)** → Opens grid.html
     - **Single Post** → Opens single.html

**UI Layout:**
```
┌─────────────────────────────────────────────┐
│  Instagram Mock UI         [+ New File]     │
├─────────────────────────────────────────────┤
│                                             │
│  Published Feeds (0 feeds)                  │
│  ┌─────────────────────────────────────┐    │
│  │ Feed Name                      [×]  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  (Empty State if no feeds)                  │
│                                             │
├─────────────────────────────────────────────┤
│  Saved Account Information (Bottom Fixed)   │
│  ┌──────┬──────┬──────┐                     │
│  │ PFP  │ Name │ Info │                     │
│  └──────┴──────┴──────┘                     │
└─────────────────────────────────────────────┘
```

---

### Page 2: Grid Editor (grid.html)

**Purpose:** Create and edit full Instagram profile feeds

**Key Sections:**

1. **Header & Controls**
   - Preset selector dropdown
   - Load previous feed dropdown
   - Publish button

2. **Three-Panel Layout**

   **LEFT PANEL:**
   - Account Information section
     - Account name input
     - Profile picture URL input
     - Followers/Following inputs
     - Bio textarea
   - Presets section
     - Update selected preset button
     - Save as new preset button
   - Add Content section
     - Content type dropdown (post/reel/carousel)
     - Add to feed button

   **MIDDLE PANEL (Instagram Preview):**
   - Profile header
     - Profile picture
     - Username
     - Post count / Followers / Following stats
   - Bio display
   - Action buttons (Following, Message, Contact)
   - Tabs (Grid, Reels, Tagged)
   - Instagram-style grid display
     - 3 columns on desktop
     - Draggable items (reorder posts)
     - Click to open modal
   - Post modal (overlay)
     - Shows full post/reel/carousel
     - Carousel has swiper navigation

   **RIGHT PANEL:**
   - Content List
     - Editable fields for each post
     - Type badge
     - Delete button
     - Caption textarea
     - Date/time pickers
     - Update preview button

**Data Flow:**
```
User changes account info
    ↓
updateAccountInfo() called
    ↓
state.accountInfo updated
    ↓
renderAccountInfo() - updates mock profile header
    ↓
saveState() - persists to backend
```

**UI Wireframe:**
```
┌──────────────────────────────────────────────────────────┐
│ Grid Editor        [Presets v] [Load Feed v] [Publish]   │
├────────────────────┬──────────────────┬──────────────────┤
│   LEFT PANEL       │ MIDDLE PANEL     │    RIGHT PANEL   │
│                    │                  │                  │
│  Account Info      │   @username      │  Content List    │
│  ┌──────────────┐  │   ┌────────────┐ │  ┌─────────────┐ │
│  │ Name         │  │   │ PFP stats  │ │  │ Post 1 [×]  │ │
│  │ PFP URL      │  │   ├────────────┤ │  │ Photo URL   │ │
│  │ Followers    │  │   │ Bio area   │ │  │ Caption     │ │
│  │ Following    │  │   ├────────────┤ │  │ Date/Time   │ │
│  │ Bio          │  │   │ 3 Buttons  │ │  └─────────────┘ │
│  └──────────────┘  │   ├────────────┤ │                  │
│                    │   │ Tabs       │ │  ┌─────────────┐ │
│  Presets           │   ├────────────┤ │  │ Reel 2 [×]  │ │
│  [Update][SaveNew] │   │ Grid:      │ │  │ Video URL   │ │
│                    │   │ [img][img] │ │  │ Thumbnail   │ │
│  Add Content       │   │ [img][img] │ │  │ Caption     │ │
│  Type: Post v      │   └────────────┘ │  │ Date/Time   │ │
│  [Add to Feed]     │                  │  └─────────────┘ │
│                    │                  │                  │
└────────────────────┴──────────────────┴──────────────────┘
```

---

### Page 3: Single Post Editor (single.html)

**Purpose:** Create standalone single posts

**Similar to Grid Editor but:**
- No account profile display
- Only manages one post at a time
- Post type selector (post/reel/carousel)
- Conditional fields based on post type

**UI Layout:**
```
┌────────────────────────────────────────┐
│ Single Post Editor  [Presets] [Publish]│
├────────────────────┬───────────────────┤
│   LEFT PANEL       │   PREVIEW PANEL   │
│                    │                   │
│  Account Info      │   Single Post     │
│  ┌──────────────┐  │   ┌─────────────┐ │
│  │ Name         │  │   │ @username   │ │
│  │ PFP URL      │  │   │ ┌─────────┐ │ │
│  │              │  │   │ │ image   │ │ │
│  └──────────────┘  │   │ ├─────────┤ │ │
│                    │   │ │ caption │ │ │
│  Post Type: Post v │   │ │ date    │ │ │
│  Photo URL [____]  │   │ └─────────┘ │ │
│  Caption [____]    │   └─────────────┘ │
│  Date [__]         │                   │
│  Time [__]         │                   │
│  [Update Preview]  │                   │
│  [Publish]         │                   │
│                    │                   │
└────────────────────┴───────────────────┘
```

---

## Styling System

### CSS Architecture

**Variables (Custom Properties):**
```css
:root {
    /* Color palette (Instagram dark theme) */
    --bg-primary: #000000;
    --bg-secondary: #121212;
    --bg-tertiary: #262626;
    --text-primary: #ffffff;
    --text-secondary: #a8a8a8;
    --text-muted: #737373;
    --border-color: #262626;
    --blue-primary: #0095f6;    /* Like button, links */
    --blue-hover: #1877f2;
    --red-primary: #ed4956;     /* Danger buttons */
    --green-primary: #00ba7c;
    
    /* Spacing Scale */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;
    
    /* Border Radius */
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-full: 50%;    /* For circles */
    
    /* Typography */
    --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...;
}
```

**Key Component Classes:**

1. **Buttons**
   - `.btn-primary` - Blue, for primary actions (Publish, Save)
   - `.btn-secondary` - Grey, for secondary actions
   - `.btn-danger` - Red, for destructive actions (Delete)
   - `.btn-small` - Small button variant

2. **Forms**
   - `.form-group` - Container for label + input
   - `.form-row` - Side-by-side form groups
   - `.form-column` - Vertical form groups

3. **Layout**
   - `.main-header` - Top header bar
   - `.editor-container` - 3-panel layout
   - `.editor-panel` - Individual panels (left-panel, middle-panel, right-panel)
   - `.panel-section` - Sections within panels

4. **Instagram Mock**
   - `.instagram-mock` - Container for Instagram preview
   - `.mock-header` - Profile header
   - `.mock-grid` - 3-column grid display
   - `.mock-tab` - Tab navigation
   - `.post-modal` - Full-screen post display

5. **Modals**
   - `.modal` - Modal overlay
   - `.modal-content` - Modal window
   - `.modal-header`, `.modal-body`, `.modal-footer`

### Responsive Design

**Breakpoints:**
```css
/* Desktop: 1200px+ (3-panel layout) */
@media (max-width: 1024px) {
    /* Tablet: 768px - 1023px (2 panels or stacked) */
}

@media (max-width: 768px) {
    /* Mobile: 320px - 767px (1 panel, stacked layout) */
}
```

### Instagram Grid Display

**CSS Grid:**
```css
.mock-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);  /* 3 columns */
    gap: 8px;
    aspect-ratio: 1;  /* Square items */
}

.mock-grid-item {
    position: relative;
    cursor: pointer;
    overflow: hidden;
    border-radius: 0;  /* Instagram style - no border radius */
}

.mock-grid-item:hover {
    opacity: 0.8;
}
```

---

## JavaScript Logic

### Main Script (script.js) - 1111 lines

#### Initialization
```javascript
async function init() {
    await loadPresets();           // Load saved presets from API
    await loadSavedFeeds();        // Load previous feeds
    setupGoogleDriveConversion();  // Enable URL conversion listeners
    setupTabs();                   // Setup tab navigation
    setupDragAndDrop();            // Enable drag-to-reorder
    
    // Check if loading existing feed from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const loadId = urlParams.get('load');
    if (loadId) {
        await loadFeedById(loadId);
    }
    
    renderAccountInfo();           // Render profile preview
    renderGrid();                  // Render grid preview
    renderContentList();           // Render content management list
}
```

#### State Management Functions

**updateAccountInfo()**
```javascript
function updateAccountInfo() {
    state.accountInfo = {
        name: document.getElementById('accountName').value,
        pfp: document.getElementById('accountPfp').value,
        followers: document.getElementById('accountFollowers').value,
        following: document.getElementById('accountFollowing').value,
        bio: document.getElementById('accountBio').value
    };
    
    // If Google Drive URL, cache it
    if (state.accountInfo.pfp.includes('drive.google.com')) {
        const convertedUrl = convertGoogleDriveUrl(state.accountInfo.pfp, false);
        downloadAndCacheThumbnail(convertedUrl, 'profile', 'pfp')
            .then(cachedPath => {
                if (cachedPath) {
                    state.accountInfo.cachedPfp = cachedPath;
                    saveState();
                }
            });
    }
    
    renderAccountInfo();  // Update mock preview
    saveState();          // Persist to backend
}
```

**updatePost(id, field, value)**
```javascript
function updatePost(id, field, value) {
    const post = state.posts.find(p => p.id === id);
    if (post) {
        // Auto-convert Google Drive URLs
        const convertedValue = convertGoogleDriveUrl(value, field === 'videoUrl');
        post[field] = convertedValue;
        
        // Cache if it was a Google Drive URL
        if (value.includes('drive.google.com')) {
            downloadAndCacheThumbnail(convertedValue, post.type, id)
                .then(cachedPath => {
                    if (cachedPath) {
                        if (field === 'url') post.cachedPath = cachedPath;
                        if (field === 'thumbnail') post.cachedThumbnail = cachedPath;
                        renderGrid();
                        saveState();
                    }
                });
        }
        
        renderGrid();
        saveState();
    }
}
```

#### Rendering Functions

**renderAccountInfo()**
- Updates mock profile section
- Displays name, followers, following, bio, profile picture
- One-way binding: state → UI

**renderGrid()**
- Renders 3-column Instagram grid
- Creates draggable grid items
- Shows post thumbnails
- Attaches click handlers to open modals

**renderContentList()**
- Displays all posts in right panel
- Editable fields for each post
- Delete buttons
- Different fields based on post type

#### Important Utilities

**convertGoogleDriveUrl(url, isVideo)**
```javascript
function convertGoogleDriveUrl(url, isVideo) {
    if (!url.includes('drive.google.com')) return url;
    
    // Extract file ID from various Google Drive URL formats
    const fileIdMatch = url.match(/(?:\/d\/|id=)([a-zA-Z0-9-_]+)/);
    if (!fileIdMatch) return url;
    
    const fileId = fileIdMatch[1];
    
    // Return appropriate share URL
    if (isVideo) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
    } else {
        return `https://drive.google.com/uc?id=${fileId}&export=view`;
    }
}
```

**downloadAndCacheThumbnail(url, type, id, index)**
```javascript
async function downloadAndCacheThumbnail(url, type, id, index) {
    try {
        const response = await fetch(`${API_URL}/api/cache/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ googleDriveUrl: url, type, id, index })
        });
        
        const data = await response.json();
        return data.localPath;  // Returns cached path like /CachedImages/posts/...
    } catch (error) {
        console.error('Cache error:', error);
        return null;
    }
}
```

**saveState()**
```javascript
async function saveState() {
    try {
        const response = await fetch(`${API_URL}/api/feeds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'Grid',
                name: `${state.accountInfo.name} - ${new Date().toLocaleString()}`,
                state: state
            })
        });
        
        if (!response.ok) throw new Error('Failed to save');
        
        const newFeed = await response.json();
        console.log('Feed saved:', newFeed.id);
    } catch (error) {
        console.error('Save error:', error);
    }
}
```

**publishFeed()**
```javascript
async function publishFeed() {
    if (!state.accountInfo.name) {
        await showAlert('Missing Info', 'Please enter account name');
        return;
    }
    
    if (state.posts.length === 0) {
        await showAlert('No Content', 'Please add at least one post');
        return;
    }
    
    // Save to backend
    const response = await fetch(`${API_URL}/api/feeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'Grid',
            name: state.accountInfo.name,
            state: state
        })
    });
    
    const feed = await response.json();
    const shareLink = `${window.location.origin}/client.html?load=${feed.id}`;
    
    // Show share modal
    document.getElementById('shareLink').value = shareLink;
    document.getElementById('shareModal').style.display = 'flex';
}
```

#### Drag & Drop

**setupDragAndDrop()**
```javascript
function setupDragAndDrop() {
    // Implement HTML5 drag and drop
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    draggedElement = e.target;
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    // Swap positions in state.posts array
    const draggedIndex = state.posts.indexOf(draggedElement.post);
    const targetIndex = state.posts.indexOf(e.target.post);
    
    [state.posts[draggedIndex], state.posts[targetIndex]] = 
    [state.posts[targetIndex], state.posts[draggedIndex]];
    
    renderGrid();
    saveState();
}
```

#### Tab Navigation

**setupTabs()**
```javascript
function setupTabs() {
    document.querySelectorAll('.mock-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            state.activeTab = tabName;
            
            // Update UI based on active tab
            if (tabName === 'grid') {
                renderGrid();
            } else if (tabName === 'reels') {
                renderReels();
            }
            
            saveState();
        });
    });
}
```

#### Modal Handling

**openPostModal(postId)**
```javascript
function openPostModal(postId) {
    const post = state.posts.find(p => p.id === postId);
    if (!post) return;
    
    const modal = document.getElementById('postModal');
    const content = document.getElementById('postModalContent');
    
    // Render appropriate content based on post type
    if (post.type === 'post') {
        content.innerHTML = `
            <img src="${post.url}" alt="post" style="width: 100%; height: auto;">
            <div class="post-caption">${post.caption}</div>
            <div class="post-date">${post.date} at ${post.time}</div>
        `;
    } else if (post.type === 'reel') {
        content.innerHTML = `
            <video src="${post.videoUrl}" controls style="width: 100%;"></video>
            <div class="post-caption">${post.caption}</div>
        `;
    } else if (post.type === 'carousel') {
        content.innerHTML = `
            <div class="swiper">
                <div class="swiper-wrapper">
                    ${post.images.map(img => `
                        <div class="swiper-slide">
                            <img src="${img}" alt="carousel item" style="width: 100%;">
                        </div>
                    `).join('')}
                </div>
                <div class="swiper-pagination"></div>
            </div>
        `;
        new Swiper('.swiper', { pagination: { el: '.swiper-pagination' } });
    }
    
    modal.style.display = 'flex';
}

function closePostModal() {
    document.getElementById('postModal').style.display = 'none';
}
```

---

## API Endpoints

### Base URL
```
http://localhost:3001
```

### Feed Management

**GET /api/feeds**
- Retrieve all saved feeds
- Response: Array of feed objects

**GET /api/feeds/:id**
- Retrieve single feed by ID
- Parameters:
  - `id` - Feed ID (timestamp)
- Response: Feed object

**POST /api/feeds**
- Create new feed
- Request body:
  ```json
  {
      "type": "Grid",
      "name": "Feed Name",
      "state": { /* state object */ }
  }
  ```
- Response: Created feed with ID

**DELETE /api/feeds/:id**
- Delete feed by ID
- Response: Success message

### Preset Management

**GET /api/presets**
- Retrieve all available presets
- Response: Array of preset objects

**POST /api/presets**
- Save new preset
- Request body:
  ```json
  {
      "name": "Preset Name",
      "data": { /* account info */ }
  }
  ```

### Caching Management

**POST /api/cache/download**
- Download and cache image from Google Drive
- Request body:
  ```json
  {
      "googleDriveUrl": "https://drive.google.com/...",
      "type": "post",
      "id": "timestamp",
      "index": null
  }
  ```
- Response:
  ```json
  {
      "localPath": "/CachedImages/posts/post_123_456.jpg",
      "message": "Image cached successfully"
  }
  ```

**POST /api/cache/delete**
- Delete cached files
- Request body:
  ```json
  {
      "type": "post",
      "id": "timestamp",
      "paths": ["/CachedImages/posts/..."]
  }
  ```

---

## Caching System

### Why Caching?

Google Drive URLs can be slow or fail after some time. The caching system:
1. Downloads images locally to `CachedImages/`
2. Stores metadata in `CachedImages/metadata.json`
3. Reuses cached files for same Google Drive ID
4. Cleans up old cache (>2 months)

### Cache Structure

```
CachedImages/
├── posts/
│   ├── post_1765977730212_1765977743174.jpg
│   ├── post_1765978205638_1765978217546.jpg
│   └── ...
├── reels/
│   ├── reel_1765978205638_1765978217546.jpg
│   └── ...
├── carousels/
│   ├── carousel_1765978205638_0_1765978217546.jpg
│   ├── carousel_1765978205638_1_1765978217546.jpg
│   └── ...
├── profiles/
│   ├── profile_pfp_1765772638497.jpg
│   └── ...
└── metadata.json
```

### Metadata File (metadata.json)

Tracks all cached files:

```json
{
    "post_1765977730212_1765977743174.jpg": {
        "type": "post",
        "id": "1765977730212",
        "index": null,
        "originalUrl": "https://drive.google.com/uc?id=abc123&export=view",
        "cachedAt": "2025-12-17T19:00:00.000Z",
        "cachedAtMs": 1765977743174
    },
    "carousel_1765978205638_0_1765978217546.jpg": {
        "type": "carousel",
        "id": "1765978205638",
        "index": 0,
        "originalUrl": "https://drive.google.com/uc?id=xyz789&export=view",
        "cachedAt": "2025-12-17T19:00:17.546Z",
        "cachedAtMs": 1765978217546
    }
}
```

### Caching Flow

```
User enters Google Drive URL (e.g., post image)
    ↓
URL is converted via convertGoogleDriveUrl()
    ↓
updatePost() is called
    ↓
downloadAndCacheThumbnail() called
    ↓
POST /api/cache/download
    ↓
Backend checks metadata.json for existing cache
    ↓
If exists: return cached path
If not: download from Google Drive
    ↓
Save to CachedImages/[type]/[filename].jpg
    ↓
Add entry to metadata.json
    ↓
Return local path (/CachedImages/posts/...)
    ↓
Frontend stores in state.cachedPath
    ↓
Uses cached path in future renders
```

### Cache Cleanup

**Automatic Cleanup:**
- Runs on server startup
- Deletes files older than 2 months (60 days)
- Removes metadata entries for missing files

```javascript
const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;

async function cleanupOldCache() {
    const now = Date.now();
    const types = ['posts', 'reels', 'carousels', 'profiles'];
    
    for (const type of types) {
        const typeDir = path.join(CACHE_DIR, type);
        const files = fs.readdirSync(typeDir);
        
        for (const file of files) {
            const filePath = path.join(typeDir, file);
            const stats = fs.statSync(filePath);
            const fileAgeMs = now - stats.mtimeMs;
            
            if (fileAgeMs > TWO_MONTHS_MS) {
                fs.unlinkSync(filePath);
                removeCacheMetadata(file);
            }
        }
    }
}
```

---

## Features Deep Dive

### Feature 1: Google Drive URL Conversion

**Problem:** Different Google Drive URL formats all point to same file

**Solution:** Standardize all Google Drive URLs

```javascript
function convertGoogleDriveUrl(url, isVideo) {
    // Match: /d/FILE_ID or id=FILE_ID
    const fileIdMatch = url.match(/(?:\/d\/|id=)([a-zA-Z0-9-_]+)/);
    if (!fileIdMatch) return url;
    
    const fileId = fileIdMatch[1];
    
    if (isVideo) {
        // Videos: use /preview endpoint
        return `https://drive.google.com/file/d/${fileId}/preview`;
    } else {
        // Images: use /uc endpoint for direct access
        return `https://drive.google.com/uc?id=${fileId}&export=view`;
    }
}
```

**Supported URL Formats:**
- `https://drive.google.com/file/d/FILE_ID/view`
- `https://drive.google.com/uc?id=FILE_ID&export=view`
- `https://drive.google.com/file/d/FILE_ID/preview`
- Any variant with `/d/FILE_ID` or `id=FILE_ID`

### Feature 2: Presets System

**Purpose:** Save and reuse account configurations

**Preset Object:**
```json
{
    "name": "EM",
    "data": {
        "name": "Eleventh Mission",
        "pfp": "https://drive.google.com/...",
        "followers": "10k",
        "following": "5",
        "bio": "Janith Made This",
        "cachedPfp": "/CachedImages/profiles/profile_pfp_1765772638497.jpg"
    }
}
```

**Functions:**

**updatePreset()**
```javascript
function updatePreset() {
    const select = document.getElementById('presetSelect');
    const index = select.value;
    
    if (index === '') return;
    
    const preset = state.presets[index];
    if (preset) {
        preset.data = state.accountInfo;
        // Save to backend
    }
}
```

**saveAsNewPreset()**
```javascript
function saveAsNewPreset() {
    const name = prompt('Preset name:');
    if (!name) return;
    
    state.presets.push({
        name: name,
        data: { ...state.accountInfo }
    });
    
    // Save to backend
}
```

**loadPreset()**
```javascript
function loadPreset() {
    const select = document.getElementById('presetSelect');
    const index = select.value;
    
    if (index === '') return;
    
    const preset = state.presets[index];
    state.accountInfo = { ...preset.data };
    
    renderAccountInfo();
}
```

### Feature 3: Post Modal/Lightbox

**Purpose:** Show full-size post when grid item clicked

**Features:**
- Full-screen overlay
- Close button (X)
- Different views for post/reel/carousel
- Carousel uses Swiper.js for navigation
- Auto-focus when opened

**Carousel Example:**
```javascript
// Inside openPostModal() for carousel type
content.innerHTML = `
    <div class="swiper">
        <div class="swiper-wrapper">
            ${post.images.map(img => `
                <div class="swiper-slide">
                    <img src="${img}" alt="carousel">
                </div>
            `).join('')}
        </div>
        <div class="swiper-pagination"></div>
        <div class="swiper-button-prev"></div>
        <div class="swiper-button-next"></div>
    </div>
`;

// Initialize Swiper
new Swiper('.swiper', {
    pagination: { el: '.swiper-pagination', clickable: true },
    navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev'
    }
});
```

### Feature 4: Publishing & Sharing

**Flow:**
1. User clicks "Publish" button
2. Feed is saved to backend with unique ID (timestamp)
3. Share link generated: `client.html?load={feedId}`
4. Modal shows share options:
   - Copy link to clipboard
   - Share via WhatsApp
   - Share via Email
   - Open in current/new tab

```javascript
async function publishFeed() {
    // Save feed
    const response = await fetch(`${API_URL}/api/feeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'Grid',
            name: state.accountInfo.name,
            state: state
        })
    });
    
    const feed = await response.json();
    const shareLink = `${window.location.origin}/client.html?load=${feed.id}`;
    
    // Show modal with share link
    document.getElementById('shareLink').value = shareLink;
    document.getElementById('shareModal').style.display = 'flex';
}

function shareWhatsApp() {
    const text = `Check out my Instagram profile mock: ${document.getElementById('shareLink').value}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
}

function shareEmail() {
    const shareLink = document.getElementById('shareLink').value;
    window.location.href = `mailto:?subject=Check out my Instagram profile&body=${encodeURIComponent(shareLink)}`;
}

function copyLink() {
    const link = document.getElementById('shareLink').value;
    navigator.clipboard.writeText(link);
    alert('Link copied to clipboard!');
}
```

### Feature 5: Drag & Drop Reordering

**Purpose:** Allow users to reorder posts in grid

**Implementation:**
```javascript
function handleDragStart(e) {
    draggedElement = this;
    e.dataTransfer.effectAllowed = 'move';
    this.style.opacity = '0.5';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (this !== draggedElement) {
        this.style.borderRight = '2px solid blue';
    }
}

function handleDrop(e) {
    e.preventDefault();
    
    if (this !== draggedElement) {
        // Find posts by element
        const draggedPost = draggedElement.post;
        const targetPost = this.post;
        
        // Swap in array
        const draggedIdx = state.posts.indexOf(draggedPost);
        const targetIdx = state.posts.indexOf(targetPost);
        
        [state.posts[draggedIdx], state.posts[targetIdx]] = 
        [state.posts[targetIdx], state.posts[draggedIdx]];
        
        renderGrid();
        saveState();
    }
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    this.style.borderRight = '';
}
```

**To enable drag & drop:**
1. Add `draggable="true"` attribute to grid items
2. Attach `dragstart`, `dragover`, `drop`, `dragend` listeners
3. Store reference to currently dragged element in `draggedElement` variable
4. On drop: swap positions in `state.posts` array

---

## Data Schema

### Feed Object

```json
{
    "id": 1765978222104,
    "type": "Grid",
    "name": "Eleventh Mission - 12/17/2025, 7:00:22 PM",
    "state": {
        "accountInfo": {
            "name": "Eleventh Mission",
            "pfp": "/CachedImages/profiles/profile_pfp_1765772638497.jpg",
            "followers": "10k",
            "following": "5",
            "bio": "Janith Made This",
            "cachedPfp": "/CachedImages/profiles/profile_pfp_1765772638497.jpg"
        },
        "posts": [
            {
                "id": "1765978205638",
                "type": "reel",
                "caption": "Video caption",
                "date": "2025-12-17",
                "time": "19:00",
                "videoUrl": "https://drive.google.com/...",
                "thumbnail": "https://drive.google.com/...",
                "cachedThumbnail": "/CachedImages/reels/reel_1765978205638_1765978217546.jpg"
            },
            {
                "id": "1765977730212",
                "type": "post",
                "caption": "Post caption",
                "date": "2025-12-17",
                "time": "18:52",
                "url": "/CachedImages/posts/post_1765977730212_1765977743174.jpg",
                "cachedPath": "/CachedImages/posts/post_1765977730212_1765977743174.jpg"
            }
        ],
        "presets": [
            {
                "name": "EM",
                "data": { /* account info */ }
            }
        ],
        "activeTab": "grid"
    }
}
```

### Client Info Object (legacy)

```json
{
    "name": "Username",
    "pfp": "image_url",
    "followers": "10k",
    "following": "500",
    "bio": "Bio text"
}
```

---

## Step-by-Step Recreation Guide

### Prerequisites
- Node.js (v14+)
- npm
- Text editor (VS Code recommended)
- Web browser (Chrome/Firefox)

### Step 1: Project Setup

```bash
# Create project directory
mkdir instagram-mock-ui
cd instagram-mock-ui

# Create subdirectories
mkdir server
mkdir Data
mkdir CachedImages
mkdir CachedImages/posts
mkdir CachedImages/reels
mkdir CachedImages/carousels
mkdir CachedImages/profiles
mkdir CacheContent
mkdir "UI Ref"
```

### Step 2: Backend Setup

**Create `server/package.json`:**
```json
{
  "name": "instagram-mock-ui-server",
  "version": "1.0.0",
  "description": "Backend for Instagram Mock UI",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
```

**Install dependencies:**
```bash
cd server
npm install
cd ..
```

**Create `server/index.js`:** (445 lines - see Backend Setup section above)

### Step 3: Frontend - Create HTML Files

**Create `index.html`:** (Dashboard page - 451 lines)
**Create `grid.html`:** (Grid editor - main editor)
**Create `single.html`:** (Single post editor)

**Key structure for grid.html:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grid Editor - Instagram Mock UI</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
</head>
<body>
    <!-- Header -->
    <header class="main-header">
        <div class="header-left">
            <h1>Grid Editor</h1>
        </div>
        <div class="header-right">
            <select id="presetSelect"></select>
            <button class="btn-secondary" onclick="loadPreset()">Load</button>
            <select id="loadFeedSelect"></select>
            <button class="btn-secondary" onclick="loadSavedFeed()">Load</button>
            <button class="btn-primary" onclick="publishFeed()">
                <i class="fas fa-upload"></i> Publish
            </button>
        </div>
    </header>

    <!-- Three Panel Layout -->
    <div class="editor-container">
        <!-- Left Panel -->
        <div class="editor-panel left-panel">
            <!-- Account info form -->
        </div>

        <!-- Middle Panel (Instagram Preview) -->
        <div class="middle-panel">
            <div class="instagram-mock">
                <!-- Profile header, grid, modal -->
            </div>
        </div>

        <!-- Right Panel (Content Management) -->
        <div class="editor-panel right-panel">
            <!-- Content list -->
        </div>
    </div>

    <script src="ui.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
    <script src="script.js"></script>
</body>
</html>
```

### Step 4: Create Stylesheet

**Create `styles.css`:** (1248 lines)

Key sections:
- CSS variables for colors and spacing
- Button styles (primary, secondary, danger)
- Form styles
- Header and layout
- Instagram mock components
- Modal styles
- Responsive design

### Step 5: Create JavaScript Files

**Create `ui.js`:** (Modal/dialog utilities)
```javascript
// Modal dialog system for alerts, confirmations, prompts
function showAlert(title, message) { /* ... */ }
function showConfirm(title, message) { /* ... */ }
function showPrompt(title, message, defaultValue) { /* ... */ }
function closeModal(result) { /* ... */ }
function initializeModalListeners() { /* ... */ }
```

**Create `script.js`:** (1111 lines - main editor logic)

### Step 6: Create Data Files

**Create `Data/feed_data.json`:**
```json
[]
```

**Create `Data/client_info.json`:**
```json
[]
```

**Create `CachedImages/metadata.json`:**
```json
{}
```

### Step 7: Start Server

```bash
# From project root
cd server
npm start

# Server runs on http://localhost:3001
```

### Step 8: Test

1. Open browser to `http://localhost:3001`
2. Click "New File" → Select "Grid (Full Profile)"
3. Enter account information
4. Add posts
5. Click "Publish"
6. Share the generated link

---

## Troubleshooting

### Server Won't Start

**Problem:** Port 3001 already in use
```bash
# Kill process using port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Images Won't Cache

**Problem:** Google Drive URL not recognized
```
Check if URL contains:
- /d/FILE_ID (for view URLs)
- id=FILE_ID (for uc URLs)

Must be converted by convertGoogleDriveUrl()
```

### Posts Not Showing in Grid

**Problem:** State not being rendered
```javascript
// Always call renderGrid() after updating state
renderGrid();
```

### Modal Not Closing

**Problem:** Event listener not attached
```javascript
// Ensure initializeModalListeners() is called
// Usually happens in init() on page load
```

---

## Performance Tips

1. **Cache Large Images**
   - Google Drive URLs can be slow
   - Always use cached versions when available

2. **Lazy Load Grid Items**
   - For feeds with 100+ posts, consider lazy loading
   - Load thumbnails on viewport entry

3. **Optimize Image Sizes**
   - Instagram thumbnails: ~400x400px
   - Use appropriate image formats (JPEG for photos, PNG for graphics)

4. **Clean Cache Regularly**
   - Set up cron job to run cleanup weekly
   - Automatic cleanup runs on server startup (2 months)

---

## Security Considerations

1. **File Upload Validation**
   - Currently using Google Drive URLs only
   - If adding direct upload, validate file types and sizes

2. **CORS Configuration**
   - Currently allows all origins
   - In production: specify allowed origins only

3. **Input Validation**
   - Sanitize user input (names, bios, captions)
   - Use DOMPurify or similar for user-generated content

4. **Data Persistence**
   - Feed data stored in JSON files (no database)
   - No authentication system currently
   - In production: add user authentication and database

---

## Deployment Checklist

- [ ] Remove `run server(delete this before rollout).ps1`
- [ ] Set environment variable `PORT` for production port
- [ ] Enable HTTPS in production
- [ ] Set up CORS for specific domain
- [ ] Implement authentication if sharing publicly
- [ ] Set up database instead of JSON files
- [ ] Configure automatic backup of feed data
- [ ] Test all Google Drive URL formats
- [ ] Test cache cleanup on old files
- [ ] Monitor server logs for errors
- [ ] Set up error tracking (Sentry, etc.)

---

## Future Enhancement Ideas

1. **User Accounts**
   - Account creation/login
   - Save feeds to user profile
   - Private/public feeds

2. **Database Integration**
   - Replace JSON files with MongoDB/PostgreSQL
   - Better query capabilities
   - Automatic backups

3. **Direct Image Upload**
   - Allow users to upload images directly
   - No need for Google Drive links

4. **Advanced Editing**
   - Filters and effects
   - Watermarks
   - Text overlays

5. **Analytics**
   - Track how many times feed was viewed
   - Track shares and clicks

6. **Mobile App**
   - React Native or Flutter
   - Native iOS/Android experience

7. **Collaboration**
   - Multiple users editing same feed
   - Real-time collaboration (WebSocket)

8. **Template Library**
   - Pre-made layouts
   - Default color schemes
   - Quick-start templates

---

## Conclusion

This Instagram Mock UI application demonstrates a complete web app with:
- ✅ Frontend with real-time preview
- ✅ Backend API for data persistence
- ✅ Image caching system
- ✅ Drag-and-drop UI
- ✅ Sharing functionality
- ✅ Modular, maintainable code

All code is vanilla JavaScript with no heavy frameworks, making it lightweight and easy to modify. The modular structure allows easy addition of new features.
