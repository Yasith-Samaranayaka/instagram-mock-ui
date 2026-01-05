# Google Drive API Implementation Plan

## Overview
This document outlines the plan to integrate Google Drive API into the application, allowing users to upload content directly to a designated Google Drive location without routing through our server.

## Architecture Change

**Current Flow:**
```
User → Browser → Your Server → CachedImages folder → Serve to clients
```

**New Flow:**
```
User → Browser → Google Drive API → Your Drive folder → Serve to clients
```

## Key Benefits

1. **No Server Storage**: Eliminate `CachedImages` and `CacheContent` directories entirely
2. **Faster Uploads**: Direct upload from browser to Google Drive
3. **Better Performance**: No server bottleneck for file transfers
4. **Cost Reduction**: No storage costs on your server
5. **Scalability**: Google Drive handles the heavy lifting
6. **Resumable Uploads**: Built-in support for large files

---

## Phase 1: Quick Wins

### 1.1 Set Up Google Cloud Project

**Steps:**
1. Create Google Cloud project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable Google Drive API
3. Create OAuth 2.0 credentials (Web application)
   - Add authorized JavaScript origins: `http://localhost:3000` (and production domain)
   - Add authorized redirect URIs if needed
4. Get the Client ID (no client secret needed for browser-only auth)

**Security Note:** Client ID is safe to expose in browser. Never use service account keys in client-side code.

### 1.2 Create Designated Upload Folder Structure

**In Your Google Drive:**
```
InstagramMock/
├── posts/
├── profiles/
├── reels/
├── carousels/
└── stories/
```

**Steps:**
1. Create folder hierarchy in your Google Drive
2. Set permissions: "Anyone with the link can view"
3. Note down each folder ID from URL
4. Store folder IDs in your application config

### 1.3 Add Google Identity Services

**Add to HTML files:**
```html
<!-- In head section of instamock.html, index.html, etc. -->
<script src="https://accounts.google.com/gsi/client" async defer></script>
<script src="https://apis.google.com/js/api.js"></script>
```

**Create new file: `auth.js`**
```javascript
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let accessToken = null;
let tokenClient;

// Initialize Google Auth
function initGoogleAuth() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
            if (response.access_token) {
                accessToken = response.access_token;
                onAuthSuccess();
            } else {
                console.error('Auth failed:', response);
                onAuthFailure();
            }
        }
    });
}

// Request access token
function requestAuth() {
    if (!tokenClient) {
        initGoogleAuth();
    }
    tokenClient.requestAccessToken();
}

// Check if authenticated
function isAuthenticated() {
    return accessToken !== null;
}

// Sign out
function signOut() {
    accessToken = null;
    google.accounts.oauth2.revoke(accessToken, () => {
        console.log('Access token revoked');
    });
}

// Callbacks
function onAuthSuccess() {
    console.log('Authentication successful');
    document.getElementById('uploadBtn').disabled = false;
    // Update UI to show authenticated state
}

function onAuthFailure() {
    console.error('Authentication failed');
    // Show error message to user
}

// Initialize on page load
window.addEventListener('load', initGoogleAuth);
```

### 1.4 Implement Direct Upload Function

**Create new file: `drive-upload.js`**
```javascript
// Folder IDs for your Google Drive structure
const DRIVE_FOLDERS = {
    posts: 'YOUR_POSTS_FOLDER_ID',
    profiles: 'YOUR_PROFILES_FOLDER_ID',
    reels: 'YOUR_REELS_FOLDER_ID',
    carousels: 'YOUR_CAROUSELS_FOLDER_ID',
    stories: 'YOUR_STORIES_FOLDER_ID'
};

/**
 * Upload file directly to Google Drive
 * @param {File} file - The file object from input
 * @param {string} folderType - Type of content (posts, profiles, etc.)
 * @returns {Promise<object>} Drive file metadata
 */
async function uploadToGoogleDrive(file, folderType = 'posts') {
    if (!accessToken) {
        throw new Error('Not authenticated. Please sign in first.');
    }

    const folderId = DRIVE_FOLDERS[folderType];
    if (!folderId) {
        throw new Error(`Invalid folder type: ${folderType}`);
    }

    // Prepare metadata
    const metadata = {
        name: `${Date.now()}_${file.name}`,
        parents: [folderId]
    };

    // Create multipart form data
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], 
        { type: 'application/json' }));
    form.append('file', file);

    try {
        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                body: form
            }
        );

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        
        // Return direct view URL
        return {
            fileId: result.id,
            fileName: result.name,
            url: `https://drive.google.com/uc?id=${result.id}&export=view`,
            thumbnailUrl: result.thumbnailLink || `https://drive.google.com/thumbnail?id=${result.id}&sz=w400`
        };
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
}

/**
 * Upload large file with resumable upload (for files > 5MB)
 * @param {File} file - The file object
 * @param {string} folderType - Type of content
 * @param {Function} onProgress - Progress callback (percent)
 * @returns {Promise<object>} Drive file metadata
 */
async function uploadLargeFile(file, folderType = 'posts', onProgress = null) {
    if (!accessToken) {
        throw new Error('Not authenticated');
    }

    const folderId = DRIVE_FOLDERS[folderType];
    const metadata = {
        name: `${Date.now()}_${file.name}`,
        parents: [folderId]
    };

    // Step 1: Initiate resumable upload
    const initResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        }
    );

    const uploadUrl = initResponse.headers.get('Location');

    // Step 2: Upload file content
    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': file.type
        },
        body: file
    });

    const result = await uploadResponse.json();
    
    return {
        fileId: result.id,
        fileName: result.name,
        url: `https://drive.google.com/uc?id=${result.id}&export=view`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${result.id}&sz=w400`
    };
}

/**
 * Upload multiple files (for carousels)
 * @param {FileList} files - Array of files
 * @param {string} folderType - Type of content
 * @returns {Promise<Array>} Array of uploaded file metadata
 */
async function uploadMultipleFiles(files, folderType = 'carousels') {
    const uploads = Array.from(files).map(file => 
        uploadToGoogleDrive(file, folderType)
    );
    
    return await Promise.all(uploads);
}

/**
 * Get direct download URL from file ID
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<string>} Direct URL
 */
async function getDirectUrl(fileId) {
    const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webContentLink,thumbnailLink`,
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );
    
    const data = await response.json();
    return data.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=view`;
}
```

### 1.5 Update UI for File Upload

**Add to instamock.html:**
```html
<!-- Auth button -->
<button id="authBtn" onclick="requestAuth()">Connect to Google Drive</button>

<!-- Upload section (disabled until authenticated) -->
<div id="uploadSection" style="display: none;">
    <input type="file" id="fileInput" accept="image/*,video/*" multiple>
    <select id="contentType">
        <option value="posts">Post</option>
        <option value="profiles">Profile</option>
        <option value="reels">Reel</option>
        <option value="carousels">Carousel</option>
    </select>
    <button id="uploadBtn" onclick="handleUpload()">Upload</button>
    <div id="uploadProgress"></div>
</div>
```

**Add to script.js:**
```javascript
async function handleUpload() {
    const fileInput = document.getElementById('fileInput');
    const contentType = document.getElementById('contentType').value;
    const files = fileInput.files;

    if (files.length === 0) {
        alert('Please select files to upload');
        return;
    }

    try {
        document.getElementById('uploadProgress').textContent = 'Uploading...';
        
        let results;
        if (files.length === 1) {
            results = [await uploadToGoogleDrive(files[0], contentType)];
        } else {
            results = await uploadMultipleFiles(files, contentType);
        }

        // Store file IDs in feed_data.json
        results.forEach(result => {
            addPostToFeed(result);
        });

        document.getElementById('uploadProgress').textContent = 'Upload complete!';
        fileInput.value = ''; // Clear input
        
    } catch (error) {
        console.error('Upload failed:', error);
        document.getElementById('uploadProgress').textContent = 'Upload failed: ' + error.message;
    }
}

function addPostToFeed(uploadResult) {
    // Add to your feed data structure
    const newPost = {
        id: uploadResult.fileId,
        imageUrl: uploadResult.url,
        thumbnailUrl: uploadResult.thumbnailUrl,
        timestamp: Date.now(),
        // ... other metadata
    };
    
    // Update feed_data.json via your backend
    saveToFeedData(newPost);
}
```

---

## Phase 2: Better UX & Cleanup

### 2.1 Remove Caching System

**Files/Folders to DELETE:**
- ❌ `CachedImages/` folder entirely
- ❌ `CacheContent/` folder entirely

**server/index.js changes:**
- ❌ Remove lines ~180-350 (caching endpoints)
- ❌ Remove `/api/cache/download` endpoint
- ❌ Remove `/api/cache/cleanup` endpoint
- ❌ Remove metadata.json management

**script.js changes:**
- ❌ Remove `downloadAndCacheThumbnail()` function
- ❌ Simplify `convertGoogleDriveUrl()` function

### 2.2 Update Data Structure

**Modify feed_data.json structure:**
```json
{
  "posts": [
    {
      "id": "drive_file_id_here",
      "driveFileId": "1234567890abcdef",
      "imageUrl": "https://drive.google.com/uc?id=1234567890abcdef&export=view",
      "thumbnailUrl": "https://drive.google.com/thumbnail?id=1234567890abcdef&sz=w400",
      "username": "user123",
      "timestamp": 1703000000000,
      "type": "post"
    }
  ]
}
```

### 2.3 Implement Folder Organization

**Create folders per feed:**
```javascript
async function createFeedFolder(feedName) {
    const response = await fetch(
        'https://www.googleapis.com/drive/v3/files',
        {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: feedName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [DRIVE_FOLDERS.posts] // Parent folder
            })
        }
    );
    
    const result = await response.json();
    return result.id;
}
```

### 2.4 Add Google Picker (Optional Enhancement)

**Allows users to pick existing Drive files:**
```javascript
function showFilePicker() {
    gapi.load('picker', () => {
        const picker = new google.picker.PickerBuilder()
            .addView(google.picker.ViewId.DOCS_IMAGES)
            .setOAuthToken(accessToken)
            .setDeveloperKey('YOUR_API_KEY') // Optional
            .setCallback((data) => {
                if (data.action === google.picker.Action.PICKED) {
                    const file = data.docs[0];
                    addPostFromExistingDriveFile(file.id, file.name);
                }
            })
            .build();
        
        picker.setVisible(true);
    });
}
```

---

## Phase 3: Advanced Features

### 3.1 Progress Tracking for Large Files

```javascript
async function uploadWithProgress(file, folderType, onProgress) {
    const chunkSize = 256 * 1024; // 256 KB chunks
    let uploadedBytes = 0;

    // Implementation using XMLHttpRequest for progress events
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                onProgress(percentComplete);
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
        });
        
        xhr.addEventListener('error', () => reject(new Error('Upload error')));
        
        // Configure and send request
        // ... implementation details
    });
}
```

### 3.2 Thumbnail Generation

**Use Drive's built-in thumbnails:**
```javascript
function getThumbnailUrl(fileId, size = 400) {
    // Available sizes: w200, w400, w800, w1600
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

// Or get multiple sizes
function getThumbnailSizes(fileId) {
    return {
        small: getThumbnailUrl(fileId, 200),
        medium: getThumbnailUrl(fileId, 400),
        large: getThumbnailUrl(fileId, 800)
    };
}
```

### 3.3 Batch Operations

**Upload entire carousel at once:**
```javascript
async function uploadCarousel(files, carouselMetadata) {
    const uploadPromises = Array.from(files).map((file, index) => 
        uploadToGoogleDrive(file, 'carousels').then(result => ({
            ...result,
            order: index,
            carouselId: carouselMetadata.id
        }))
    );
    
    const results = await Promise.all(uploadPromises);
    
    // Save carousel data
    const carouselData = {
        id: carouselMetadata.id,
        images: results,
        timestamp: Date.now(),
        username: carouselMetadata.username
    };
    
    await saveCarouselToFeed(carouselData);
    return carouselData;
}
```

### 3.4 File Management

**Delete file from Drive:**
```javascript
async function deleteFromDrive(fileId) {
    const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );
    
    return response.ok;
}
```

**List files in folder:**
```javascript
async function listFolderContents(folderId) {
    const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,thumbnailLink,createdTime)`,
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );
    
    const data = await response.json();
    return data.files;
}
```

---

## Implementation Priority

### Priority 1 (Week 1): Core Upload
- [ ] Set up Google Cloud project
- [ ] Create Drive folder structure
- [ ] Implement basic authentication (auth.js)
- [ ] Implement direct upload (drive-upload.js)
- [ ] Update UI for file selection
- [ ] Test upload flow

### Priority 2 (Week 2): Integration
- [ ] Update feed_data.json structure
- [ ] Modify script.js to use Drive URLs
- [ ] Remove URL conversion logic
- [ ] Test existing features with new URLs

### Priority 3 (Week 3): Cleanup
- [ ] Remove caching endpoints from server
- [ ] Delete CachedImages directory
- [ ] Delete CacheContent directory
- [ ] Remove metadata.json logic
- [ ] Test all features after cleanup

### Priority 4 (Week 4): Enhancements
- [ ] Add progress indicators
- [ ] Implement resumable uploads
- [ ] Add Google Picker (optional)
- [ ] Implement batch operations
- [ ] Add folder organization

---

## Configuration File

**Create: `config.js`**
```javascript
const CONFIG = {
    GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',
    
    DRIVE_FOLDERS: {
        posts: 'FOLDER_ID_FOR_POSTS',
        profiles: 'FOLDER_ID_FOR_PROFILES',
        reels: 'FOLDER_ID_FOR_REELS',
        carousels: 'FOLDER_ID_FOR_CAROUSELS',
        stories: 'FOLDER_ID_FOR_STORIES'
    },
    
    UPLOAD_SETTINGS: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
        useResumableUpload: true, // For files > 5MB
        chunkSize: 256 * 1024 // 256KB chunks
    },
    
    OAUTH_SCOPES: 'https://www.googleapis.com/auth/drive.file'
};
```

---

## Security Considerations

### 1. OAuth Token Management
- ✅ Store access token in memory only (not localStorage)
- ✅ Implement token refresh logic
- ✅ Sign out on tab close
- ✅ Never log tokens to console in production

### 2. Folder Permissions
- ✅ Set folders to "Anyone with link can view"
- ✅ Only the app owner can edit/delete
- ✅ Users upload with OAuth (not service account)

### 3. File Validation
```javascript
function validateFile(file) {
    // Check file type
    if (!CONFIG.UPLOAD_SETTINGS.allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type');
    }
    
    // Check file size
    if (file.size > CONFIG.UPLOAD_SETTINGS.maxFileSize) {
        throw new Error('File too large');
    }
    
    // Sanitize filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    return true;
}
```

### 4. Rate Limiting
```javascript
const uploadQueue = [];
const MAX_CONCURRENT_UPLOADS = 3;

async function queueUpload(file, folderType) {
    if (uploadQueue.length >= MAX_CONCURRENT_UPLOADS) {
        await Promise.race(uploadQueue);
    }
    
    const uploadPromise = uploadToGoogleDrive(file, folderType);
    uploadQueue.push(uploadPromise);
    
    uploadPromise.finally(() => {
        const index = uploadQueue.indexOf(uploadPromise);
        if (index > -1) uploadQueue.splice(index, 1);
    });
    
    return uploadPromise;
}
```

---

## Testing Checklist

### Basic Upload
- [ ] Single image upload
- [ ] Multiple image upload
- [ ] Video upload
- [ ] Large file upload (>5MB)

### Integration
- [ ] Upload shows in feed immediately
- [ ] Thumbnails display correctly
- [ ] URLs work across all pages
- [ ] No broken images

### Edge Cases
- [ ] Upload without authentication (should prompt)
- [ ] Upload with expired token (should refresh)
- [ ] Network interruption (should retry)
- [ ] Invalid file type (should reject)
- [ ] File too large (should reject)

### Performance
- [ ] Multiple simultaneous uploads
- [ ] Upload progress display
- [ ] Cancel upload functionality
- [ ] Memory cleanup after upload

---

## Estimated Code Removal

With full implementation, you can remove:
- **~300 lines** from server/index.js (caching logic)
- **~100 lines** from script.js (URL conversion, caching)
- **~50 lines** from various files (metadata management)
- **~2 GB** potential storage (CachedImages folder)

**Total: ~450 lines of code removed, significantly reduced complexity**

---

## Rollout Strategy

### Stage 1: Parallel Implementation
- Keep existing caching system running
- Add Google Drive upload as alternative
- Test thoroughly with both systems

### Stage 2: Migration
- Upload all existing cached images to Drive
- Update feed_data.json with Drive URLs
- Verify all images accessible

### Stage 3: Deprecation
- Disable caching endpoints
- Remove caching code
- Delete cache directories
- Monitor for issues

### Stage 4: Optimization
- Add advanced features
- Improve UI/UX
- Add analytics

---

## Resources

- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/about-sdk)
- [Google Identity Services](https://developers.google.com/identity/gsi/web/guides/overview)
- [Upload Files Guide](https://developers.google.com/drive/api/v3/manage-uploads)
- [File Picker API](https://developers.google.com/drive/picker/guides/overview)

---

## Support & Troubleshooting

### Common Issues

**"Upload failed: 401 Unauthorized"**
- Token expired, refresh authentication

**"Upload failed: 403 Forbidden"**
- Check folder permissions
- Verify OAuth scopes

**"Thumbnail not loading"**
- Drive thumbnail generation can take 30-60 seconds
- Fallback to regular URL if thumbnail fails

**"Upload stuck at 100%"**
- File processing on Drive side
- Wait for API response, don't retry immediately

---

## Next Steps

1. Review this plan
2. Set up Google Cloud project
3. Create test folder structure in Drive
4. Implement Phase 1
5. Test upload functionality
6. Proceed with Phase 2 and 3

**Estimated Total Implementation Time: 3-4 weeks**
