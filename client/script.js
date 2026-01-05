// Grid Editor - Main Script
const API_URL = '';
// Inline placeholders to avoid external placeholder domains failing to resolve
const PFP_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2280%22%20height%3D%2280%22%3E%3Crect%20fill%3D%22%23e5e5e5%22%20width%3D%2280%22%20height%3D%2280%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2255%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20fill%3D%22%23999%22%20font-family%3D%22sans-serif%22%20font-size%3D%2211%22%3EProfile%3C%2Ftext%3E%3C%2Fsvg%3E';
const MEDIA_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22400%22%3E%3Crect%20fill%3D%22%23f0f0f0%22%20width%3D%22400%22%20height%3D%22400%22%2F%3E%3Ctext%20fill%3D%22%23999%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%20font-family%3D%22sans-serif%22%20font-size%3D%2218%22%3ENo%20Media%3C%2Ftext%3E%3C%2Fsvg%3E';

// State management
const state = {
    accountInfo: {
        name: '',
        pfp: '',
        followers: '',
        following: '',
        bio: ''
    },
    posts: [],
    presets: [],
    activeTab: 'grid',
    approvals: [],
    currentFeedId: null,
    schedulerStatus: []
};

let draggedElement = null;

function getNowDateTime() {
    const now = new Date();
    return {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].substring(0, 5)
    };
}

function handleDriveAuthClick() {
    console.log('🔵 Drive Auth button clicked');
    console.log('requestAuth function exists:', typeof requestAuth === 'function');
    console.log('tokenClient:', typeof tokenClient !== 'undefined' ? 'defined' : 'undefined');
    console.log('Google API loaded:', typeof window.google !== 'undefined');

    if (typeof requestAuth === 'function') {
        requestAuth();
    } else {
        console.error('❌ requestAuth function not found');
    }
}

function updateDriveUiState() {
    const uploadSection = document.getElementById('driveUploadSection');
    const uploadBtn = document.getElementById('driveUploadBtn');
    const authBtn = document.getElementById('driveAuthBtn');
    const statusEl = document.getElementById('driveUploadStatus');

    const authed = typeof isAuthenticated === 'function' && isAuthenticated();

    if (uploadSection) {
        uploadSection.style.display = authed ? 'block' : 'none';
    }

    if (uploadBtn) {
        uploadBtn.disabled = !authed;
    }

    if (authBtn) {
        authBtn.disabled = authed;
        authBtn.textContent = authed ? 'Drive Connected' : 'Connect to Google Drive';
    }

    if (statusEl) {
        statusEl.textContent = authed ? 'Select files to upload.' : 'Connect to start uploading.';
    }
}

function setupDriveUi() {
    const authBtn = document.getElementById('driveAuthBtn');
    const uploadBtn = document.getElementById('driveUploadBtn');
    const uploadSection = document.getElementById('driveUploadSection');
    const statusEl = document.getElementById('driveUploadStatus');

    if (!authBtn || !uploadBtn || !uploadSection || !statusEl) {
        return;
    }

    updateDriveUiState();
    window.addEventListener('gdrive-auth-success', updateDriveUiState);
    window.addEventListener('gdrive-auth-failure', updateDriveUiState);
    window.addEventListener('gdrive-auth-logout', updateDriveUiState);
}

function onAuthSuccess() {
    updateDriveUiState();
}

function onAuthFailure() {
    updateDriveUiState();
}

function addDriveUploadToState(uploadResults, folderType) {
    if (!uploadResults || uploadResults.length === 0) return;

    const now = getNowDateTime();

    if (folderType === 'profiles') {
        state.accountInfo.pfp = uploadResults[0].url;
        renderAccountInfo();
        saveState();
        return;
    }

    if (folderType === 'reels') {
        const reel = uploadResults[0];
        state.posts.unshift({
            id: Date.now().toString(),
            type: 'reel',
            caption: '',
            date: now.date,
            time: now.time,
            videoUrl: reel.url,
            thumbnail: reel.thumbnailUrl || reel.url
        });
    } else if (folderType === 'carousels') {
        state.posts.unshift({
            id: Date.now().toString(),
            type: 'carousel',
            caption: '',
            date: now.date,
            time: now.time,
            images: uploadResults.map(r => r.url)
        });
    } else {
        const post = uploadResults[0];
        state.posts.unshift({
            id: Date.now().toString(),
            type: 'post',
            caption: '',
            date: now.date,
            time: now.time,
            url: post.url,
            thumbnail: post.thumbnailUrl
        });
    }

    updatePostCount();
    renderGrid();
    renderContentList();
    saveState();
}

async function handleDriveUpload() {
    const fileInput = document.getElementById('driveFileInput');
    const folderTypeSelect = document.getElementById('driveFolderType');
    const statusEl = document.getElementById('driveUploadStatus');
    const uploadBtn = document.getElementById('driveUploadBtn');

    if (!fileInput || !folderTypeSelect) return;

    const files = fileInput.files;
    if (!files || files.length === 0) {
        await showAlert('No Files', 'Select at least one file to upload.');
        return;
    }

    const folderType = folderTypeSelect.value || 'posts';

    if (statusEl) statusEl.textContent = 'Uploading to Google Drive...';
    if (uploadBtn) uploadBtn.disabled = true;

    try {
        let uploads;
        if (files.length === 1) {
            uploads = [await uploadToGoogleDrive(files[0], folderType)];
        } else {
            uploads = await uploadMultipleFiles(files, folderType);
        }

        addDriveUploadToState(uploads, folderType);

        if (statusEl) statusEl.textContent = 'Upload complete.';
        fileInput.value = '';
    } catch (error) {
        console.error('Drive upload failed:', error);
        if (statusEl) statusEl.textContent = `Upload failed: ${error.message || error}`;
        await showAlert('Upload Failed', error.message || 'Unable to upload to Google Drive.');
    } finally {
        if (uploadBtn) uploadBtn.disabled = !(typeof isAuthenticated === 'function' && isAuthenticated());
    }
}

// Prefer cached media paths when available so we do not re-download
function applyCachedMediaToState() {
    if (state.accountInfo && state.accountInfo.cachedPfp) {
        state.accountInfo.pfp = state.accountInfo.cachedPfp;
    }

    state.posts = (state.posts || []).map(post => {
        const updated = { ...post };

        if (updated.cachedPath) {
            updated.url = updated.cachedPath;
        }

        if (updated.cachedThumbnail) {
            updated.thumbnail = updated.cachedThumbnail;
        }

        if (updated.cachedImages && Array.isArray(updated.images)) {
            updated.images = updated.images.map((img, idx) => updated.cachedImages[idx] || img);
        }

        return updated;
    });
}

// Initialize app
async function init() {
    await loadPresets();
    await loadSavedFeeds();
    setupDriveUi();
    setupGoogleDriveConversion();
    setupTabs();
    setupDragAndDrop();

    // Check if loading existing feed
    const urlParams = new URLSearchParams(window.location.search);
    const loadId = urlParams.get('load');
    if (loadId) {
        await loadFeedById(loadId);
    }

    renderAccountInfo();
    renderGrid();
    renderContentList();
}

// Load presets from API
async function loadPresets() {
    try {
        const response = await fetch(`${API_URL}/api/presets`);
        if (!response.ok) {
            console.error('Failed to load presets:', response.status);
            state.presets = [];
            return;
        }
        state.presets = await response.json();

        const select = document.getElementById('presetSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Load Preset...</option>';
        state.presets.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = preset.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading presets:', error);
        state.presets = [];
    }
}

// Load saved feeds for dropdown
async function loadSavedFeeds() {
    try {
        const response = await fetch(`${API_URL}/api/feeds`);
        if (!response.ok) {
            console.error('Failed to load feeds:', response.status);
            return;
        }
        const feeds = await response.json();

        const select = document.getElementById('loadFeedSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Load Previous Feed...</option>';
        feeds.filter(f => f.type === 'Grid').forEach(feed => {
            const option = document.createElement('option');
            option.value = feed.id;
            option.textContent = `${feed.name} (${new Date(feed.id).toLocaleString()})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading feeds:', error);
    }
}

// Load feed by ID
async function loadFeedById(id) {
    try {
        const response = await fetch(`${API_URL}/api/feeds/${id}`);

        if (!response.ok) {
            throw new Error(`Feed not found (${response.status})`);
        }

        const feed = await response.json();

        if (!feed || !feed.state) {
            throw new Error('Invalid feed data');
        }

        state.accountInfo = feed.state.accountInfo || state.accountInfo;
        state.posts = feed.state.posts || [];
        state.activeTab = feed.state.activeTab || 'grid';
        state.currentFeedId = id;

        // Load approvals for this feed
        await loadApprovals(id);

        // Load scheduler status
        await loadSchedulerStatus();

        // Always prefer cached media paths when available
        applyCachedMediaToState();

        renderAccountInfo();
        renderGrid();
        renderContentList();
        updatePostCount();

        return true;
    } catch (error) {
        console.error('Error loading feed:', error);
        await showAlert('Error', `Failed to load feed: ${error.message}`);
        return false;
    }
}

// Load saved feed from dropdown
async function loadSavedFeed() {
    const select = document.getElementById('loadFeedSelect');
    const feedId = select.value;

    if (!feedId) {
        await showAlert('No Selection', 'Please select a feed to load');
        return;
    }

    await loadFeedById(feedId);
    await showAlert('Success', 'Feed loaded successfully');
}

// Update account info
function updateAccountInfo() {
    const pfpInput = document.getElementById('accountPfp');
    const pfpUrl = pfpInput ? pfpInput.value : state.accountInfo.pfp;
    state.accountInfo = {
        name: document.getElementById('accountName').value,
        pfp: pfpUrl,
        followers: document.getElementById('accountFollowers').value,
        following: document.getElementById('accountFollowing').value,
        bio: document.getElementById('accountBio').value
    };

    // Cache profile picture if it's a Google Drive URL
    if (pfpUrl && pfpUrl.includes('drive.google.com')) {
        const convertedUrl = convertGoogleDriveUrl(pfpUrl, false);
        downloadAndCacheThumbnail(convertedUrl, 'profile', 'pfp').then(cachedPath => {
            if (cachedPath && cachedPath !== convertedUrl) {
                state.accountInfo.cachedPfp = cachedPath;
                saveState();
            }
        });
    }

    updatePostCount();
    renderAccountInfo();
    saveState();
}

// Render account info to preview
function renderAccountInfo() {
    const mockUsername = document.getElementById('mockUsername');
    const mockPfp = document.getElementById('mockPfp');
    const mockFollowers = document.getElementById('mockFollowers');
    const mockFollowing = document.getElementById('mockFollowing');
    const mockBio = document.getElementById('mockBio');

    // Update form fields if not focused
    if (document.activeElement.id !== 'accountName') {
        document.getElementById('accountName').value = state.accountInfo.name || '';
    }
    const pfpInput = document.getElementById('accountPfp');
    if (pfpInput && document.activeElement.id !== 'accountPfp') {
        pfpInput.value = state.accountInfo.pfp || '';
    }
    if (document.activeElement.id !== 'accountFollowers') {
        document.getElementById('accountFollowers').value = state.accountInfo.followers || '';
    }
    if (document.activeElement.id !== 'accountFollowing') {
        document.getElementById('accountFollowing').value = state.accountInfo.following || '';
    }
    if (document.activeElement.id !== 'accountBio') {
        document.getElementById('accountBio').value = state.accountInfo.bio || '';
    }

    // Update mock preview directly
    if (mockUsername) mockUsername.textContent = state.accountInfo.name || 'username';
    if (mockFollowers) mockFollowers.textContent = state.accountInfo.followers || '0';
    if (mockFollowing) mockFollowing.textContent = state.accountInfo.following || '0';
    if (mockBio) mockBio.textContent = state.accountInfo.bio || 'Your bio will appear here...';

    // Update profile picture with cached path if available
    if (mockPfp) {
        const pfpUrl = state.accountInfo.cachedPfp
            || (state.accountInfo.pfp ? convertGoogleDriveUrl(state.accountInfo.pfp, false) : PFP_PLACEHOLDER);
        mockPfp.src = pfpUrl;
    }

    // Update preview using InstaMock component (if available)
    if (window.instaMock) {
        const pfpUrl = state.accountInfo.cachedPfp
            || (state.accountInfo.pfp ? convertGoogleDriveUrl(state.accountInfo.pfp, false) : PFP_PLACEHOLDER);
        window.instaMock.updateAccount({
            username: state.accountInfo.name || 'username',
            pfp: pfpUrl,
            followers: state.accountInfo.followers || '0',
            following: state.accountInfo.following || '0',
            bio: state.accountInfo.bio || 'Your bio will appear here...',
            posts: state.posts.length
        });
    }
}

// Update post count
function updatePostCount() {
    const mockPosts = document.getElementById('mockPosts');
    if (mockPosts) {
        mockPosts.textContent = state.posts.length;
    }
}

// Add content to feed
function addContent() {
    const contentType = document.getElementById('contentType').value;
    const now = new Date();

    if (window.instaMock) {
        window.instaMock.updateAccount({ posts: state.posts.length + 1 });
    }

    const newPost = {
        id: Date.now().toString(),
        type: contentType,
        caption: '',
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].substring(0, 5)
    };

    // Add type-specific fields
    if (contentType === 'post') {
        newPost.url = '';
        newPost.cachedPath = '';
    } else if (contentType === 'reel') {
        newPost.videoUrl = '';
        newPost.thumbnail = '';
        newPost.cachedThumbnail = '';
    } else if (contentType === 'carousel') {
        newPost.images = [MEDIA_PLACEHOLDER, MEDIA_PLACEHOLDER];
        newPost.cachedImages = [];
    }

    state.posts.unshift(newPost);
    updatePostCount();
    renderGrid();
    renderContentList();
    saveState();
}

// Render grid
function renderGrid() {
    const grid = document.getElementById('mockGrid');
    if (!grid) {
        console.warn('⚠️ renderGrid: mockGrid element not found');
        return;
    }

    grid.innerHTML = '';

    const filteredPosts = state.activeTab === 'grid'
        ? state.posts
        : state.posts.filter(p => p.type === 'reel');

    if (filteredPosts.length === 0) {
        return;
    }

    filteredPosts.forEach((post, index) => {
        const item = document.createElement('div');
        item.className = 'grid-item';
        item.draggable = state.activeTab === 'grid';
        item.dataset.postId = post.id;

        let mediaUrl = '';
        if (post.type === 'post') {
            // Use cached path if available, otherwise convert Google Drive URL
            if (post.cachedPath) {
                mediaUrl = post.cachedPath;
            } else if (post.url) {
                mediaUrl = convertGoogleDriveUrl(post.url, false);
            }
        } else if (post.type === 'reel') {
            if (post.cachedThumbnail) {
                mediaUrl = post.cachedThumbnail;
            } else if (post.thumbnail) {
                mediaUrl = convertGoogleDriveUrl(post.thumbnail, false);
            }
        } else if (post.type === 'carousel') {
            if (post.cachedImages && post.cachedImages[0]) {
                mediaUrl = post.cachedImages[0];
            } else if (post.images && post.images[0]) {
                mediaUrl = convertGoogleDriveUrl(post.images[0], false);
            }
        }

        // Get approval stats for this post
        const approvalStats = getPostApprovalStats(post.id);
        const scheduled = isPostScheduled(post.id);

        item.innerHTML = `
            <img src="${mediaUrl || MEDIA_PLACEHOLDER}" alt="${post.type}" onerror="this.src='${MEDIA_PLACEHOLDER}'">
            ${post.type === 'reel' ? '<i class="fas fa-video grid-item-icon"></i>' : ''}
            ${post.type === 'carousel' ? '<i class="fas fa-clone grid-item-icon"></i>' : ''}
            ${approvalStats.liked ? '<div class="grid-item-indicator liked"><i class="fas fa-check"></i></div>' : ''}
            ${approvalStats.commentCount > 0 ? `<div class="grid-item-indicator comments">${approvalStats.commentCount}</div>` : ''}
            ${scheduled ? '<div class="grid-item-indicator scheduled"><i class="fas fa-calendar-check"></i></div>' : ''}
        `;

        item.onclick = () => openPostModal(post);

        if (state.activeTab === 'grid') {
            item.ondragstart = handleDragStart;
            item.ondragover = handleDragOver;
            item.ondrop = handleDrop;
            item.ondragend = handleDragEnd;
        }

        grid.appendChild(item);
    });

    // Update approvals count badge after rendering
    updateApprovalsCount();
}

// Render content list
function renderContentList() {
    const list = document.getElementById('contentList');

    if (state.posts.length === 0) {
        list.innerHTML = '<p class="text-muted">No content added yet. Add content from the left panel.</p>';
        return;
    }

    list.innerHTML = state.posts.map(post => {
        let contentHtml = '';

        if (post.type === 'post') {
            const isPlaceholder = !post.url || post.url.includes('placeholder');
            const uploaded = !isPlaceholder && (post.cachedPath || post.url);
            contentHtml = `
                <div class="form-group">
                    <label>Photo</label>
                    <div class="upload-row" style="justify-content: space-between; gap: 12px;">
                        <button class="btn-secondary btn-small" onclick="uploadPostImage('${post.id}')">
                            <i class="fas fa-upload"></i> Upload Photo
                        </button>
                        <span class="upload-status-tag ${uploaded ? 'success' : 'pending'}">
                            ${uploaded ? 'Uploaded' : 'Awaiting upload'}
                        </span>
                    </div>
                </div>
            `;
        } else if (post.type === 'reel') {
            const videoUploaded = !!post.videoUrl && !post.videoUrl.includes('placeholder');
            const isThumbPlaceholder = !post.thumbnail || post.thumbnail.includes('placeholder');
            const thumbUploaded = !isThumbPlaceholder && !!(post.cachedThumbnail || post.thumbnail);
            contentHtml = `
                <div class="form-group">
                    <label>Video</label>
                    <div class="upload-row" style="justify-content: space-between; gap: 12px;">
                        <button class="btn-secondary btn-small" onclick="uploadReelVideo('${post.id}')">
                            <i class="fas fa-upload"></i> Upload Video
                        </button>
                        <span class="upload-status-tag ${videoUploaded ? 'success' : 'pending'}">
                            ${videoUploaded ? 'Uploaded' : 'Awaiting upload'}
                        </span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Thumbnail</label>
                    <div class="upload-row" style="justify-content: space-between; gap: 12px;">
                        <button class="btn-secondary btn-small" onclick="uploadReelThumbnail('${post.id}')">
                            <i class="fas fa-upload"></i> Upload Thumbnail
                        </button>
                        <span class="upload-status-tag ${thumbUploaded ? 'success' : 'pending'}">
                            ${thumbUploaded ? 'Uploaded' : 'Awaiting upload'}
                        </span>
                    </div>
                </div>
            `;
        } else if (post.type === 'carousel') {
            contentHtml = `
                <div class="form-group">
                    <label>Carousel Images</label>
                    <div class="carousel-images">
                        ${post.images.map((img, idx) => `
                            <div class="carousel-image-chip">
                                <span>Image ${idx + 1}</span>
                                <div class="carousel-chip-actions">
                                    <button class="btn-secondary btn-small" onclick="replaceCarouselImage('${post.id}', ${idx})">
                                        <i class="fas fa-sync"></i>
                                    </button>
                                    ${post.images.length > 1 ? `
                                        <button class="btn-danger btn-small" onclick="removeCarouselImage('${post.id}', ${idx})">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                        <button class="btn-secondary btn-small" onclick="uploadCarouselImages('${post.id}')">
                            <i class="fas fa-upload"></i> Upload Images
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="content-item">
                <div class="content-item-header">
                    <span class="content-type-badge ${post.type}">${post.type.toUpperCase()}</span>
                    <button class="btn-danger btn-small" onclick="deletePost('${post.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                ${contentHtml}
                <div class="form-group">
                    <label>Caption</label>
                    <textarea onchange="updatePost('${post.id}', 'caption', this.value)">${post.caption || ''}</textarea>
                </div>
                <div class="form-column">
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" value="${post.date}" 
                            onchange="updatePost('${post.id}', 'date', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Time</label>
                        <input type="time" value="${post.time}" 
                            onchange="updatePost('${post.id}', 'time', this.value)">
                    </div>
                </div>
                <button class="btn-secondary btn-small" onclick="forceUpdate()" style="width: 100%; margin-top: 8px;">
                    <i class="fas fa-sync"></i> Update Preview
                </button>
            </div>
        `;
    }).join('');

    // Re-attach Google Drive conversion to new inputs
    setupGoogleDriveConversion();
}

// Update post field
function updatePost(id, field, value) {
    const post = state.posts.find(p => p.id === id);
    if (post) {
        // Check if it's a Google Drive URL BEFORE converting
        const isGoogleDriveUrl = (field === 'url' || field === 'thumbnail') && value && value.includes('drive.google.com');

        // Auto-convert Google Drive URLs
        if ((field === 'url' || field === 'thumbnail') && value) {
            value = convertGoogleDriveUrl(value, false);
        } else if (field === 'videoUrl' && value) {
            value = convertGoogleDriveUrl(value, true);
        }

        post[field] = value;

        // Cache image if it's a URL field and it was a valid Google Drive URL
        if (isGoogleDriveUrl) {
            console.log(`📤 Frontend: Triggering cache for ${field} = ${value.substring(0, 60)}...`);
            // Trigger caching in background with the converted URL
            downloadAndCacheThumbnail(value, post.type, id).then(cachedPath => {
                console.log(`📤 Frontend: Cache returned: ${cachedPath}`);
                if (cachedPath && cachedPath !== value) {
                    if (field === 'url') {
                        post.cachedPath = cachedPath;
                    } else if (field === 'thumbnail') {
                        post.cachedThumbnail = cachedPath;
                    }
                    console.log(`📤 Frontend: Stored cached path in post`);
                    renderGrid();
                    saveState();
                }
            });
        }

        // Update grid immediately for critical fields
        if (field === 'url' || field === 'thumbnail' || field === 'videoUrl') {
            renderGrid();
        }

        saveState();
    }
}

// Update carousel image
function updateCarouselImage(id, index, value) {
    const post = state.posts.find(p => p.id === id);
    if (post && post.images) {
        const isGoogleDriveUrl = value && value.includes('drive.google.com');
        const convertedUrl = convertGoogleDriveUrl(value, false);
        post.images[index] = convertedUrl;

        // Cache carousel image if it's a Google Drive URL
        if (isGoogleDriveUrl) {
            downloadAndCacheThumbnail(convertedUrl, 'carousel', id, index).then(cachedPath => {
                if (cachedPath && cachedPath !== convertedUrl) {
                    if (!post.cachedImages) {
                        post.cachedImages = [];
                    }
                    post.cachedImages[index] = cachedPath;
                    renderGrid();
                    saveState();
                }
            });
        }

        renderGrid();
        saveState();
    }
}

// Add carousel image
function addCarouselImage(id) {
    const post = state.posts.find(p => p.id === id);
    if (post && post.images && post.images.length < 20) {
        post.images.push('https://via.placeholder.com/400');
        if (post.imageNames) {
            post.imageNames.push(`Image ${post.images.length}`);
        }
        renderContentList();
        saveState();
    }
}

// Remove carousel image
function removeCarouselImage(id, index) {
    const post = state.posts.find(p => p.id === id);
    if (post && post.images && post.images.length > 1) {
        post.images.splice(index, 1);
        if (post.cachedImages) {
            post.cachedImages.splice(index, 1);
        }
        if (post.imageNames) {
            post.imageNames.splice(index, 1);
        }
        renderGrid();
        renderContentList();
        saveState();
    }
}

function replaceCarouselImage(postId, index) {
    if (!ensureDriveAuthOrAlert()) return;

    pickFiles('image/*', false, async (files) => {
        const file = files[0];
        if (!file) return;

        try {
            setPageLoading(true, 'Uploading image...');
            const result = await uploadToGoogleDrive(file, 'carousels');
            const post = getPostById(postId);
            if (!post || !post.images) return;

            post.images[index] = result.url;
            if (!post.cachedImages) post.cachedImages = [];
            post.cachedImages[index] = result.thumbnailUrl || result.url;

            markDirtyAndRender();
            setPageLoading(false);
        } catch (error) {
            console.error('Replace upload failed:', error);
            setPageLoading(false);
            await showAlert('Upload failed', error.message || 'Unable to replace image.');
        }
    });
}

// Drive upload helpers
function ensureDriveAuthOrAlert() {
    const authed = typeof isAuthenticated === 'function' && isAuthenticated();
    if (!authed) {
        showAlert('Connect to Drive', 'Please connect to Google Drive before uploading.');
    }
    return authed;
}

function pickFiles(accept, multiple, onPicked) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = !!multiple;
    input.onchange = () => {
        const files = Array.from(input.files || []);
        if (files.length && typeof onPicked === 'function') {
            onPicked(files);
        }
    };
    input.click();
}

function getPostById(id) {
    return state.posts.find(p => p.id === id);
}

function uploadAccountPfp() {
    if (!ensureDriveAuthOrAlert()) return;

    pickFiles('image/*', false, async (files) => {
        const file = files[0];
        try {
            setPageLoading(true, 'Uploading profile picture...');
            const result = await uploadToGoogleDrive(file, 'profiles');
            state.accountInfo.pfp = result.url;
            state.accountInfo.cachedPfp = result.thumbnailUrl || result.url;
            const statusEl = document.getElementById('accountPfpStatus');
            if (statusEl) {
                statusEl.textContent = 'Uploaded';
                statusEl.classList.add('success');
            }
            renderAccountInfo();
            saveState();
            setPageLoading(false);
            await showAlert('Upload complete', 'Profile picture uploaded.');
        } catch (error) {
            console.error('Upload failed:', error);
            setPageLoading(false);
            await showAlert('Upload failed', error.message || 'Unable to upload file.');
        }
    });
}

function markDirtyAndRender() {
    renderGrid();
    renderContentList();
    saveState();
}

function uploadPostImage(postId) {
    if (!ensureDriveAuthOrAlert()) return;

    pickFiles('image/*', false, async (files) => {
        const file = files[0];
        try {
            setPageLoading(true, 'Uploading photo...');
            const result = await uploadToGoogleDrive(file, 'posts');

            const post = getPostById(postId);
            if (!post) {
                console.error(`❌ uploadPostImage: Post ${postId} not found in state`);
                setPageLoading(false);
                return;
            }

            post.url = result.url;
            post.cachedPath = result.thumbnailUrl || result.url;
            post.fileName = result.fileName || file.name;

            markDirtyAndRender();
            setPageLoading(false);
            await showAlert('Upload complete', 'Photo uploaded to Google Drive.');
        } catch (error) {
            console.error('❌ uploadPostImage: Upload failed:', error);
            setPageLoading(false);
            await showAlert('Upload failed', error.message || 'Unable to upload file.');
        }
    });
}

function uploadReelVideo(postId) {
    if (!ensureDriveAuthOrAlert()) return;

    pickFiles('video/*', false, async (files) => {
        const file = files[0];
        try {
            setPageLoading(true, 'Uploading video...');
            const result = await uploadToGoogleDrive(file, 'reels');
            const post = getPostById(postId);
            if (!post) return;

            post.videoUrl = result.url;
            post.videoFileName = result.fileName || file.name;

            markDirtyAndRender();
            setPageLoading(false);
            await showAlert('Upload complete', 'Video uploaded to Google Drive.');
        } catch (error) {
            console.error('Upload failed:', error);
            setPageLoading(false);
            await showAlert('Upload failed', error.message || 'Unable to upload file.');
        }
    });
}

function uploadReelThumbnail(postId) {
    if (!ensureDriveAuthOrAlert()) return;

    pickFiles('image/*', false, async (files) => {
        const file = files[0];
        try {
            setPageLoading(true, 'Uploading thumbnail...');
            const result = await uploadToGoogleDrive(file, 'reels');
            const post = getPostById(postId);
            if (!post) return;

            post.thumbnail = result.url;
            post.cachedThumbnail = result.thumbnailUrl || result.url;
            post.thumbnailFileName = result.fileName || file.name;

            markDirtyAndRender();
            setPageLoading(false);
            await showAlert('Upload complete', 'Thumbnail uploaded to Google Drive.');
        } catch (error) {
            console.error('Upload failed:', error);
            setPageLoading(false);
            await showAlert('Upload failed', error.message || 'Unable to upload file.');
        }
    });
}

function uploadCarouselImages(postId) {
    if (!ensureDriveAuthOrAlert()) return;

    pickFiles('image/*', true, async (files) => {
        if (!files.length) return;
        try {
            setPageLoading(true, 'Uploading images...');
            const results = await uploadMultipleFiles(files, 'carousels');
            const post = getPostById(postId);
            if (!post) return;

            post.images = post.images || [];
            post.cachedImages = post.cachedImages || [];
            post.imageNames = post.imageNames || [];

            results.forEach((res, idx) => {
                post.images.push(res.url);
                post.cachedImages.push(res.thumbnailUrl || res.url);
                post.imageNames.push(res.fileName || files[idx].name);
            });

            markDirtyAndRender();
            setPageLoading(false);
            await showAlert('Upload complete', `${results.length} image(s) uploaded to Google Drive.`);
        } catch (error) {
            console.error('Upload failed:', error);
            setPageLoading(false);
            await showAlert('Upload failed', error.message || 'Unable to upload files.');
        }
    });
}

// Delete post
async function deletePost(id) {
    const confirmed = await showConfirm('Delete Post', 'Are you sure you want to delete this post?');
    if (!confirmed) return;

    const post = state.posts.find(p => p.id === id);

    if (post) {
        // Delete cached files before removing post
        await deleteCacheOnPostRemoval(post);
    }

    state.posts = state.posts.filter(p => p.id !== id);
    updatePostCount();
    renderGrid();
    renderContentList();
    saveState();
}

// Force update
function forceUpdate() {
    // Find the current post being edited in the right panel
    const contentItems = document.querySelectorAll('.content-item');

    contentItems.forEach(item => {
        const urlInput = item.querySelector('.drive-url-input');
        if (urlInput && urlInput.value) {
            // Get the post ID from the delete button
            const deleteBtn = item.querySelector('[onclick*="deletePost"]');
            if (deleteBtn) {
                const postIdMatch = deleteBtn.getAttribute('onclick').match(/'(\d+)'/);
                if (postIdMatch) {
                    const postId = postIdMatch[1];
                    const post = state.posts.find(p => p.id == postId);
                    if (post) {
                        // Update the cached path if available
                        if (post.cachedPath) {
                            post.url = post.cachedPath;
                        }
                    }
                }
            }
        }
    });

    renderGrid();
    renderContentList();
    showAlert('Updated', 'Preview updated successfully');
}

// Drag and drop handlers
function handleDragStart(e) {
    draggedElement = e.target.closest('.grid-item');
    draggedElement.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (state.activeTab !== 'grid') return;

    const target = e.target.closest('.grid-item');
    if (!target || target === draggedElement) return;

    const draggedId = draggedElement.dataset.postId;
    const targetId = target.dataset.postId;

    const draggedIndex = state.posts.findIndex(p => p.id === draggedId);
    const targetIndex = state.posts.findIndex(p => p.id === targetId);

    const [draggedPost] = state.posts.splice(draggedIndex, 1);
    state.posts.splice(targetIndex, 0, draggedPost);

    renderGrid();
    renderContentList();
    saveState();

    return false;
}

function handleDragEnd(e) {
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
    }
}

function setupDragAndDrop() {
    // Already set up in renderGrid
}

// Setup tabs
function setupTabs() {
    const tabs = document.querySelectorAll('.mock-tab:not(.disabled)');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.activeTab = tab.dataset.tab;
            renderGrid();
            saveState();
        });
    });
}

// Open post modal
function openPostModal(post) {
    const modal = document.getElementById('postModal');
    const content = document.getElementById('postModalContent');

    let mediaHtml = '';

    if (post.type === 'post' || post.type === 'Post' || post.type === 'Single') {
        const imageUrl = post.cachedPath || convertGoogleDriveUrl(post.url, false);
        mediaHtml = `<img id="postImage" src="${imageUrl}" style="width: 100%; display: block;" alt="Post">`;
    } else if (post.type === 'reel') {
        const videoUrl = post.cachedVideoPath || convertGoogleDriveUrl(post.videoUrl, true);
        const posterUrl = post.cachedThumbnail || (post.thumbnail ? convertGoogleDriveUrl(post.thumbnail, false) : '');

        mediaHtml = `
            <video src="${videoUrl}" controls style="width: 100%; display: block;" onclick="togglePlayPause(this)" ${posterUrl ? `poster="${posterUrl}"` : ''}>
                Your browser does not support video.
            </video>
        `;
    } else if (post.type === 'carousel') {
        const images = post.images && post.images.length ? post.images : [MEDIA_PLACEHOLDER];
        const carouselSlides = images.map((img, idx) => {
            const imageUrl = (post.cachedImages && post.cachedImages[idx]) || convertGoogleDriveUrl(img, false) || MEDIA_PLACEHOLDER;
            return `
                <div class="swiper-slide">
                    <img src="${imageUrl}" alt="Carousel image" class="carousel-modal-img" style="width: 100%; display: block;" onerror="this.src='${MEDIA_PLACEHOLDER}'">
                </div>
            `;
        }).join('');

        mediaHtml = `
            <div class="swiper carousel-swiper-modal" style="width: 100%;">
                <div class="swiper-wrapper">
                    ${carouselSlides}
                </div>
                <div class="swiper-pagination"></div>
                <div class="swiper-button-prev"></div>
                <div class="swiper-button-next"></div>
            </div>
        `;
    }

    const pfpUrl = state.accountInfo.cachedPfp || (state.accountInfo.pfp ? convertGoogleDriveUrl(state.accountInfo.pfp, false) : 'https://via.placeholder.com/36');

    const modalHtml = `
        <div class="wall-post" style="border-bottom: none; padding-bottom: 0;">
            <div class="wall-post-header">
                <img src="${pfpUrl}" class="wall-post-pfp" alt="Profile">
                <div class="wall-post-username">${state.accountInfo.name || 'username'}</div>
            </div>
            <div class="wall-post-image" id="postImageContainer">
                ${mediaHtml}
            </div>
            <div class="wall-post-actions">
                <div class="wall-post-action-icons">
                    <i class="far fa-heart"></i>
                    <i class="far fa-comment"></i>
                    <i class="far fa-paper-plane"></i>
                </div>
            </div>
            <div class="wall-post-caption">
                ${post.caption || ''}
            </div>
            <div class="wall-post-date">
                <div>${formatDate(post.date, post.time)}</div>
                <div class="wall-post-time">${formatTime(post.time)}</div>
            </div>
        </div>
    `;

    content.innerHTML = modalHtml;
    modal.style.display = 'flex';

    // Apply aspect ratio to single post image
    if (post.type === 'post' || post.type === 'Post' || post.type === 'Single') {
        setTimeout(() => {
            const img = document.getElementById('postImage');
            const container = document.getElementById('postImageContainer');
            if (img && container) {
                applyAspectRatio(img, container);
            }
        }, 0);
    }

    // Apply aspect ratios to carousel images
    if (post.type === 'carousel') {
        setTimeout(() => {
            const carouselContainer = document.getElementById('postImageContainer');
            const images = carouselContainer.querySelectorAll('.carousel-modal-img');
            images.forEach((img, idx) => {
                const parent = img.parentElement;
                applyAspectRatio(img, parent);
            });
        }, 0);
    }

    // Initialize Swiper for carousel
    if (post.type === 'carousel') {
        setTimeout(() => {
            // Destroy previous carousel swiper if it exists
            if (window.carouselSwiperModal && window.carouselSwiperModal.destroy) {
                window.carouselSwiperModal.destroy();
            }

            window.carouselSwiperModal = new Swiper('.carousel-swiper-modal', {
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev'
                },
                loop: true
            });
        }, 100);
    }
}

// Close post modal
function closePostModal() {
    const modal = document.getElementById('postModal');
    modal.style.display = 'none';

    // Stop any playing videos
    const videos = modal.querySelectorAll('video');
    videos.forEach(video => {
        video.pause();
        video.currentTime = 0;
    });
}

// Publish feed
async function publishFeed() {
    if (!state.accountInfo.name) {
        await showAlert('Validation Error', 'Please enter an account name');
        return;
    }

    if (state.posts.length === 0) {
        await showAlert('Validation Error', 'Please add at least one post');
        return;
    }

    const now = new Date();
    const feedName = `${state.accountInfo.name} - ${now.toLocaleString()}`;

    try {
        const response = await fetch(`${API_URL}/api/feeds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'Grid',
                name: feedName,
                state: state
            })
        });

        const feed = await response.json();

        // Store the feed ID in state
        state.currentFeedId = feed.id;

        // Show share modal
        const link = `${window.location.origin}/client.html?id=${feed.id}`;
        document.getElementById('shareLink').value = link;
        document.getElementById('shareModal').style.display = 'flex';

        // Reload feeds list
        await loadSavedFeeds();
    } catch (error) {
        console.error('Error publishing feed:', error);
        await showAlert('Error', 'Failed to publish feed. Make sure the server is running.');
    }
}

// Share functions
function copyLink() {
    const input = document.getElementById('shareLink');
    input.select();

    if (navigator.clipboard) {
        navigator.clipboard.writeText(input.value).then(() => {
            showAlert('Copied', 'Link copied to clipboard!');
        });
    } else {
        document.execCommand('copy');
        showAlert('Copied', 'Link copied to clipboard!');
    }
}

function shareWhatsApp() {
    const link = document.getElementById('shareLink').value;
    const message = `Check out my Instagram mockup: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

function shareEmail() {
    const link = document.getElementById('shareLink').value;
    const subject = 'Check out my Instagram mockup';
    const body = `I created an Instagram mockup. Check it out here: ${link}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function closeShareModal() {
    document.getElementById('shareModal').style.display = 'none';
}

function openShareLink(newTab) {
    const link = document.getElementById('shareLink').value;
    if (link) {
        if (newTab) {
            window.open(link, '_blank');
        } else {
            window.location.href = link;
        }
    }
}

// Preset management
async function loadPreset() {
    const select = document.getElementById('presetSelect');
    const index = select.value;

    if (index === '') {
        await showAlert('No Selection', 'Please select a preset to load');
        return;
    }

    const preset = state.presets[parseInt(index)];
    if (preset) {
        state.accountInfo = { ...preset.data };
        applyCachedMediaToState();
        renderAccountInfo();
        saveState();
        await showAlert('Success', `Preset "${preset.name}" loaded successfully`);
    }
}

async function updatePreset() {
    const select = document.getElementById('presetSelect');
    const index = select.value;

    if (index === '') {
        await showAlert('No Selection', 'Please select a preset to update');
        return;
    }

    const confirmed = await showConfirm('Update Preset', 'Are you sure you want to update this preset with current account info?');
    if (!confirmed) return;

    state.presets[parseInt(index)].data = { ...state.accountInfo };
    await savePresetsToFile(state.presets);
    await showAlert('Success', 'Preset updated successfully');
}

async function saveAsNewPreset() {
    const name = await showPrompt('New Preset', 'Enter preset name:', 'My Preset');
    if (!name) return;

    const newPreset = {
        name: name,
        data: { ...state.accountInfo }
    };

    state.presets.push(newPreset);
    await savePresetsToFile(state.presets);
    await loadPresets();
    await showAlert('Success', `Preset "${name}" saved successfully`);
}

async function savePresetsToFile(presets) {
    try {
        await fetch(`${API_URL}/api/presets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(presets)
        });

        // Also save to localStorage so dashboard can display them
        localStorage.setItem('savedAccounts', JSON.stringify(presets));
    } catch (error) {
        console.error('Error saving presets:', error);
    }
}

// Google Drive URL conversion
function convertGoogleDriveUrl(url, isVideo) {
    if (!url) return url;

    // Try to extract file ID from various Google Drive URL formats
    let fileId = null;

    // Format: https://drive.google.com/file/d/{id}/...
    let match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) fileId = match[1];

    // Format: https://drive.google.com/open?id={id}
    if (!fileId) {
        match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match) fileId = match[1];
    }

    // Format: https://drive.google.com/thumbnail?id={id} or uc?id={id}
    if (!fileId) {
        match = url.match(/(?:thumbnail|uc)\?id=([a-zA-Z0-9_-]+)/);
        if (match) fileId = match[1];
    }

    if (fileId) {
        if (isVideo) {
            // For videos, use download endpoint
            return `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
        // For images, use thumbnail endpoint to avoid rate limits
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
    }

    return url;
}

// Cache management functions
async function downloadAndCacheThumbnail(googleDriveUrl, type, id, index) {
    try {
        console.log(`🖼️ Frontend: Caching ${type} image for ID ${id}`);
        console.log(`🖼️ Frontend: URL = ${googleDriveUrl.substring(0, 60)}...`);

        const response = await fetch(`${API_URL}/api/cache/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                googleDriveUrl: googleDriveUrl,
                type: type,
                id: id,
                index: index
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error(`❌ Frontend: Cache failed (${response.status}):`, error);
            return googleDriveUrl; // Fallback to original
        }

        const data = await response.json();
        console.log(`✅ Frontend: Cache successful! Path = ${data.localPath}`);
        return data.localPath;
    } catch (error) {
        console.error('❌ Frontend: Cache download error:', error);
        return googleDriveUrl; // Fallback to original
    }
}

async function deleteCacheOnPostRemoval(post) {
    try {
        const response = await fetch(`${API_URL}/api/cache/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: post.type,
                id: post.id,
                paths: [
                    post.cachedPath,
                    post.cachedThumbnail,
                    post.cachedVideoPath,
                    ...(post.cachedImages || [])
                ].filter(p => p) // Remove null/undefined
            })
        });

        const data = await response.json();
        console.log(`Deleted ${data.deleted} cache file(s)`);
        return true;
    } catch (error) {
        console.error('Failed to delete cache files:', error);
        // Don't fail post deletion if cache deletion fails
        return true;
    }
}


function setupGoogleDriveConversion() {
    // Profile picture conversion
    const pfpInput = document.getElementById('accountPfp');
    if (pfpInput) {
        pfpInput.addEventListener('blur', () => {
            const value = pfpInput.value;
            if (value && value.includes('drive.google.com')) {
                pfpInput.value = convertGoogleDriveUrl(value, false);
                updateAccountInfo();
            }
        });
    }

    // Content URL conversion (delegated to document for dynamic inputs)
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('drive-url-input')) {
            const value = e.target.value;
            if (value && value.includes('drive.google.com')) {
                const isVideo = e.target.previousElementSibling?.textContent === 'Video URL';
                e.target.value = convertGoogleDriveUrl(value, isVideo);
            }
        }
    });
}

// Utility functions
function formatDate(date, time) {
    if (!date || !time) return 'Recently';
    try {
        const d = new Date(`${date}T${time}`);
        if (isNaN(d.getTime())) return 'Recently';
        return d.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    } catch (e) {
        return 'Recently';
    }
}

function formatTime(time) {
    if (!time) return '';
    try {
        const [hours, minutes] = time.split(':');
        const d = new Date(2024, 0, 1, parseInt(hours), parseInt(minutes));
        return d.toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (e) {
        return time;
    }
}

function saveState() {
    // Auto-save to localStorage for recovery
    localStorage.setItem('grid-editor-state', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('grid-editor-state');
    if (saved) {
        const parsedState = JSON.parse(saved);
        Object.assign(state, parsedState);
        applyCachedMediaToState();
    }
}

// Get nearest aspect ratio for image
function getNearestAspectRatio(width, height) {
    if (!width || !height) return 'vertical'; // Default to 4:5

    const aspectRatio = width / height;
    const ratios = {
        square: { ratio: 1, name: 'square' },
        vertical: { ratio: 0.8, name: 'vertical' },    // 4:5
        horizontal: { ratio: 1.25, name: 'horizontal' }, // 5:4
        landscape: { ratio: 1.91, name: 'landscape' }
    };

    let nearest = 'vertical';
    let minDiff = Math.abs(aspectRatio - ratios.vertical.ratio);

    for (const [key, value] of Object.entries(ratios)) {
        const diff = Math.abs(aspectRatio - value.ratio);
        if (diff < minDiff) {
            minDiff = diff;
            nearest = key;
        }
    }

    return nearest;
}

// Apply aspect ratio class to image container
function applyAspectRatio(img, container) {
    if (!img) return;

    const onLoad = () => {
        if (img.naturalWidth && img.naturalHeight) {
            const ratio = getNearestAspectRatio(img.naturalWidth, img.naturalHeight);
            container.className = `post-aspect-${ratio}`;
        }
    };

    if (img.complete) {
        onLoad();
    } else {
        img.addEventListener('load', onLoad);
    }
}

// ========== Client Approval Indicators ==========

// Load approvals for a specific feed
async function loadApprovals(feedId) {
    try {
        const response = await fetch(`${API_URL}/api/approvals/${feedId}`);
        if (response.ok) {
            state.approvals = await response.json();
            updateApprovalsCount();
        } else {
            state.approvals = [];
        }
    } catch (error) {
        console.error('Error loading approvals:', error);
        state.approvals = [];
    }
}

// Update approvals count badge
function updateApprovalsCount() {
    const badge = document.getElementById('approvalsCount');
    const btn = document.getElementById('viewApprovalsBtn');

    if (badge && btn) {
        const count = state.approvals.length;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
        btn.style.display = state.currentFeedId ? 'flex' : 'none';
    }
}

// Get approval statistics for a specific post
function getPostApprovalStats(postId) {
    const stats = {
        liked: false,
        commentCount: 0,
        comments: []
    };

    // Ensure approvals is an array
    const approvals = Array.isArray(state.approvals) ? state.approvals : [];

    approvals.forEach(approval => {
        // New format: payload.posts
        if (approval.payload && approval.payload.posts) {
            approval.payload.posts.forEach(post => {
                if (post.postId === postId) {
                    if (post.liked) {
                        stats.liked = true;
                    }
                    if (post.comments && post.comments.length > 0) {
                        stats.commentCount += post.comments.length;
                        post.comments.forEach(comment => {
                            stats.comments.push({
                                text: comment,
                                timestamp: approval.submittedAt,
                                clientEmail: approval.clientEmail
                            });
                        });
                    }
                }
            });
        }

        // Old format: feedback array
        if (approval.feedback) {
            approval.feedback.forEach(item => {
                if (item.postId === postId) {
                    if (item.type === 'like') {
                        stats.liked = true;
                    } else if (item.type === 'comment') {
                        stats.commentCount++;
                        stats.comments.push({
                            text: item.comment,
                            timestamp: item.timestamp,
                            clientEmail: approval.clientEmail
                        });
                    }
                }
            });
        }
    });

    return stats;
}

// Open approvals panel
function openApprovalsPanel() {
    const panel = document.getElementById('approvalsPanel');
    if (!panel) return;

    panel.classList.add('active');
    renderApprovalsPanel();
}

// Close approvals panel
function closeApprovalsPanel() {
    const panel = document.getElementById('approvalsPanel');
    if (panel) {
        panel.classList.remove('active');
    }
}

// Render approvals panel content
function renderApprovalsPanel() {
    const content = document.getElementById('approvalsPanelContent');
    if (!content) return;

    const approvals = Array.isArray(state.approvals) ? state.approvals : [];

    if (approvals.length === 0) {
        content.innerHTML = '<p class="text-muted">No client feedback yet.</p>';
        return;
    }

    let html = '';
    approvals.forEach(approval => {
        const submittedDate = new Date(approval.submittedAt).toLocaleString();
        let likeCount = 0;
        let allComments = [];

        // New format: payload
        if (approval.payload) {
            if (approval.payload.posts) {
                approval.payload.posts.forEach(post => {
                    if (post.liked) likeCount++;
                    if (post.comments && post.comments.length > 0) {
                        post.comments.forEach(comment => {
                            const postObj = state.posts.find(p => p.id === post.postId);
                            const postName = postObj ? `Post ${state.posts.indexOf(postObj) + 1}` : 'Unknown';
                            allComments.push({
                                text: comment,
                                postName: postName
                            });
                        });
                    }
                });
            }
        }

        // Old format: feedback array
        if (approval.feedback) {
            likeCount = approval.feedback.filter(f => f.type === 'like').length;
            approval.feedback.filter(f => f.type === 'comment').forEach(comment => {
                const post = state.posts.find(p => p.id === comment.postId);
                const postName = post ? `Post ${state.posts.indexOf(post) + 1}` : 'Unknown';
                allComments.push({
                    text: comment.comment,
                    postName: postName
                });
            });
        }

        const commentCount = allComments.length;

        html += `
            <div class="approval-item">
                <div class="approval-header">
                    <strong>${approval.clientEmail}</strong>
                    <span class="text-muted">${submittedDate}</span>
                </div>
                <div class="approval-stats">
                    <span><i class="fas fa-heart"></i> ${likeCount} likes</span>
                    <span><i class="fas fa-comment"></i> ${commentCount} comments</span>
                </div>
                ${allComments.length > 0 ? `
                    <div class="approval-comments">
                        ${allComments.map(comment => `
                            <div class="approval-comment">
                                <div class="approval-comment-post">${comment.postName}</div>
                                <div class="approval-comment-text">${comment.text}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    });

    content.innerHTML = html;
}

// Share with scheduler
async function shareWithScheduler() {
    if (!state.currentFeedId) {
        await showAlert('Error', 'No feed loaded');
        return;
    }

    try {
        setPageLoading(true, 'Creating scheduler link...');

        const response = await fetch(`${API_URL}/api/scheduler`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feedId: state.currentFeedId
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Server response:', response.status, errorData);
            throw new Error(errorData.error || `Server returned ${response.status}`);
        }

        const scheduler = await response.json();
        const schedulerLink = `${window.location.origin}/scheduler.html?id=${scheduler.schedulerId}`;

        setPageLoading(false);
        closeApprovalsPanel();

        // Show modal with link
        const modal = document.getElementById('shareModal');
        const linkInput = document.getElementById('shareLink');
        if (modal && linkInput) {
            linkInput.value = schedulerLink;
            modal.style.display = 'flex';
        }

    } catch (error) {
        console.error('Error sharing with scheduler:', error);
        setPageLoading(false);
        await showAlert('Error', `Failed to create scheduler link: ${error.message}`);
    }
}

// Load scheduler status for current feed
async function loadSchedulerStatus() {
    if (!state.currentFeedId) return;

    try {
        const response = await fetch(`${API_URL}/api/scheduler/feed/${state.currentFeedId}`);
        if (!response.ok) {
            state.schedulerStatus = [];
            return;
        }

        const schedulers = await response.json();

        // Merge all scheduled posts from all schedulers
        state.schedulerStatus = [];
        schedulers.forEach(scheduler => {
            scheduler.posts.forEach(post => {
                if (post.scheduled) {
                    state.schedulerStatus.push(post.postId);
                }
            });
        });

    } catch (error) {
        console.error('Error loading scheduler status:', error);
        state.schedulerStatus = [];
    }
}

// Check if post is scheduled
function isPostScheduled(postId) {
    return state.schedulerStatus && state.schedulerStatus.includes(postId);
}

// Initialize on page load
init();
