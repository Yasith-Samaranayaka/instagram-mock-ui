// Client View Script
const API_URL = '';

let state = {
    accountInfo: {},
    posts: []
};

let clientActiveTab = 'grid';

// Client Approval Workflow State
let clientIdentity = {
    email: '',
    feedId: ''
};

let feedbackDraft = {
    gridComment: '',
    posts: []
};

let currentCommentPostId = null;

// Initialize client view
async function initClient() {
    // Get feed ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    clientIdentity.feedId = urlParams.get('id');

    if (!clientIdentity.feedId) {
        console.error('No feed ID provided');
        return;
    }

    // Check for stored email
    const storedEmail = sessionStorage.getItem(`clientEmail_${clientIdentity.feedId}`);
    if (storedEmail) {
        clientIdentity.email = storedEmail;
        await loadState();
        await loadFeedbackDraft();
        renderProfile();
        renderGrid();
        setupClientTabs();
        document.getElementById('sendFeedbackBtn').style.display = 'flex';
    } else {
        // Show email modal
        await loadState(); // Load state first to show content
        renderProfile();
        renderGrid();
        setupClientTabs();
        showEmailModal();
    }
}

// Load state from API
async function loadState() {
    const urlParams = new URLSearchParams(window.location.search);
    const feedId = urlParams.get('id');

    if (!feedId) {
        console.error('No feed ID provided');
        return;
    }

    try {
        // Use public endpoint so unauthenticated users can view shared feeds
        const response = await fetch(`${API_URL}/api/public/feeds/${feedId}`);
        const feed = await response.json();

        if (feed.state) {
            state.accountInfo = feed.state.accountInfo || {};
            state.posts = feed.state.posts || [];
            clientActiveTab = feed.state.activeTab || 'grid';
        }
    } catch (error) {
        console.error('Error loading feed:', error);
        state = {
            accountInfo: {
                name: 'Error',
                bio: 'Failed to load feed'
            },
            posts: []
        };
    }
}

// Render profile
function renderProfile() {
    document.getElementById('clientUsername').textContent = state.accountInfo.name || 'username';
    document.getElementById('clientPosts').textContent = state.posts.length;
    document.getElementById('clientFollowers').textContent = state.accountInfo.followers || '0';
    document.getElementById('clientFollowing').textContent = state.accountInfo.following || '0';
    document.getElementById('clientBio').textContent = state.accountInfo.bio || '';

    // Use cached PFP if available, otherwise use direct PFP URL
    const pfpUrl = state.accountInfo.cachedPfp
        ? state.accountInfo.cachedPfp
        : (state.accountInfo.pfp ? convertGoogleDriveUrl(state.accountInfo.pfp, false) : 'https://via.placeholder.com/80');
    document.getElementById('clientPfp').src = pfpUrl;
}

// Render grid
function renderGrid() {
    const grid = document.getElementById('clientGrid');
    if (!grid) return;

    grid.innerHTML = '';

    const filteredPosts = clientActiveTab === 'grid'
        ? state.posts
        : state.posts.filter(p => p.type === 'reel');

    if (filteredPosts.length === 0) {
        return;
    }

    filteredPosts.forEach((post, index) => {
        const item = document.createElement('div');
        item.className = 'grid-item';

        let mediaUrl = '';
        if (post.type === 'post') {
            // Use cached path if available, otherwise convert Google Drive URL
            mediaUrl = post.cachedPath || convertGoogleDriveUrl(post.url, false);
        } else if (post.type === 'reel') {
            // For reels, use cached thumbnail if available
            mediaUrl = post.cachedThumbnail || convertGoogleDriveUrl(post.thumbnail, false);
        } else if (post.type === 'carousel') {
            // For carousel, use cached first image if available
            mediaUrl = (post.cachedImages && post.cachedImages[0]) || convertGoogleDriveUrl(post.images[0], false);
        }

        item.innerHTML = `
            <img src="${mediaUrl}" alt="${post.type}">
            ${post.type === 'reel' ? '<i class="fas fa-video grid-item-icon"></i>' : ''}
            ${post.type === 'carousel' ? '<i class="fas fa-clone grid-item-icon"></i>' : ''}
        `;

        if (post.type === 'reel') {
            item.onclick = () => openReelWall(index);
        } else {
            item.onclick = () => openPostWall(index);
        }

        grid.appendChild(item);
    });
}

// Setup tabs
function setupClientTabs() {
    const tabs = document.querySelectorAll('.mock-tab:not(.disabled)');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            clientActiveTab = tab.dataset.tab;
            renderGrid();
        });
    });
}

// Open post wall
function openPostWall(startIndex) {
    const wall = document.getElementById('postWall');
    const feed = document.getElementById('wallFeed');

    const posts = state.posts.filter(p => p.type !== 'reel');

    feed.innerHTML = posts.map((post, index) => {
        let mediaHtml = '';
        if (post.type === 'post') {
            // Use cached path if available
            const imageUrl = post.cachedPath || convertGoogleDriveUrl(post.url, false);
            mediaHtml = `<img src="${imageUrl}" alt="Post">`;
        } else if (post.type === 'carousel') {
            // Use cached first image if available
            const imageUrl = (post.cachedImages && post.cachedImages[0]) || convertGoogleDriveUrl(post.images[0], false);
            mediaHtml = `<img src="${imageUrl}" alt="Carousel">`;
        }

        const pfpUrl = state.accountInfo.cachedPfp || (state.accountInfo.pfp ? convertGoogleDriveUrl(state.accountInfo.pfp, false) : 'https://via.placeholder.com/36');

        // Get feedback for this post
        const postFeedback = feedbackDraft.posts.find(p => p.postId === post.id) || { liked: false, comments: [] };
        const likedClass = postFeedback.liked ? 'liked' : '';
        const heartIcon = postFeedback.liked ? 'fas' : 'far';
        const commentCount = postFeedback.comments.length;

        return `
            <div class="wall-post" id="wallPost${index}" data-post-id="${post.id}">
                <div class="wall-post-header">
                    <img src="${pfpUrl}" 
                        class="wall-post-pfp" alt="Profile">
                    <div class="wall-post-username">${state.accountInfo.name || 'username'}</div>
                </div>
                <div class="wall-post-image">
                    ${mediaHtml}
                </div>
                <div class="wall-post-actions">
                    <div class="wall-post-action-icons">
                        <button class="post-like-btn ${likedClass}" onclick="toggleLike('${post.id}')">
                            <i class="${heartIcon} fa-heart"></i>
                        </button>
                        <button class="post-comment-btn" onclick="openCommentModal('${post.id}')">
                            <i class="far fa-comment"></i>
                            ${commentCount > 0 ? `<span class="comment-badge">${commentCount}</span>` : ''}
                        </button>
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
    }).join('');

    wall.style.display = 'block';

    // Scroll to clicked post
    setTimeout(() => {
        const postElement = document.getElementById(`wallPost${startIndex}`);
        if (postElement) {
            postElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
}

// Close post wall
function closeWall() {
    document.getElementById('postWall').style.display = 'none';
}

// Open reel wall
function openReelWall(startIndex) {
    const wall = document.getElementById('reelWall');
    const feed = document.getElementById('reelFeed');

    const reels = state.posts.filter(p => p.type === 'reel');

    feed.innerHTML = reels.map((post, index) => {
        const videoUrl = post.cachedVideoPath || convertGoogleDriveUrl(post.videoUrl, true);
        const pfpUrl = state.accountInfo.cachedPfp || (state.accountInfo.pfp ? convertGoogleDriveUrl(state.accountInfo.pfp, false) : 'https://via.placeholder.com/40');

        return `
            <div class="reel-item" id="reel${index}">
                <video class="reel-video" src="${videoUrl}" loop onclick="togglePlayPause(this)" ${post.cachedThumbnail ? `poster="${post.cachedThumbnail}"` : ''}></video>
                <div class="reel-play-icon">
                    <i class="fas fa-play-circle"></i>
                </div>
                <div class="reel-overlay">
                    <div class="reel-user-info">
                        <img src="${pfpUrl}" 
                            class="reel-pfp" alt="Profile">
                        <div class="reel-username">${state.accountInfo.name || 'username'}</div>
                    </div>
                    <div class="reel-caption">${post.caption || ''}</div>
                </div>
                <div class="reel-side-actions">
                    <button class="reel-action-btn">
                        <i class="far fa-heart"></i>
                        <span class="reel-action-count">125K</span>
                    </button>
                    <button class="reel-action-btn">
                        <i class="far fa-comment"></i>
                        <span class="reel-action-count">1,234</span>
                    </button>
                    <button class="reel-action-btn">
                        <i class="far fa-paper-plane"></i>
                    </button>
                    <button class="reel-action-btn">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    wall.style.display = 'block';

    // Scroll to clicked reel and auto-play
    setTimeout(() => {
        const reelElement = document.getElementById(`reel${startIndex}`);
        if (reelElement) {
            reelElement.scrollIntoView({ behavior: 'auto', block: 'start' });
            const video = reelElement.querySelector('video');
            if (video) {
                video.play().catch(e => console.log('Auto-play failed:', e));
            }
        }
    }, 100);
}

// Toggle video play/pause
function togglePlayPause(video) {
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
}

// Close reel wall
function closeReelWall() {
    const wall = document.getElementById('reelWall');
    wall.style.display = 'none';

    // Stop all videos
    const videos = wall.querySelectorAll('video');
    videos.forEach(video => {
        video.pause();
        video.currentTime = 0;
    });
}

// Open post modal (for grid item clicks)
function openPostModal(post) {
    const modal = document.getElementById('postModal');
    const content = document.getElementById('postModalContent');

    let modalHtml = '';

    if (post.type === 'post' || post.type === 'Post' || post.type === 'Single') {
        // Use cached path if available, otherwise convert Google Drive URL
        const imageUrl = post.cachedPath || convertGoogleDriveUrl(post.url, false);
        const pfpUrl = state.accountInfo.cachedPfp || convertGoogleDriveUrl(state.accountInfo.pfp, false) || 'https://via.placeholder.com/40';

        modalHtml = `
            <div class="post-modal-image" id="postImageContainer">
                <img id="postImage" src="${imageUrl}" alt="Post">
            </div>
            <div class="post-modal-sidebar">
                <div class="post-modal-header">
                    <img src="${pfpUrl}" class="post-modal-pfp" alt="Profile">
                    <div class="post-modal-username">${state.accountInfo.name || 'username'}</div>
                </div>
                <div class="post-modal-caption">
                    <strong>${state.accountInfo.name || 'username'}</strong> ${post.caption || ''}
                </div>
                <div class="post-modal-actions">
                    <div class="post-modal-action-icons">
                        <i class="far fa-heart"></i>
                        <i class="far fa-comment"></i>
                        <i class="far fa-paper-plane"></i>
                    </div>
                    <div class="post-modal-date">${formatDate(post.date, post.time)}</div>
                </div>
                <button class="btn-primary" onclick="editPost('${post.id}')" style="width: 100%; margin-top: 12px;">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>
        `;
    } else if (post.type === 'carousel') {
        // Use cached paths for carousel images
        const carouselSlides = post.images.map((img, idx) => {
            const imageUrl = (post.cachedImages && post.cachedImages[idx]) || convertGoogleDriveUrl(img, false);
            return `
                <div class="swiper-slide">
                    <img src="${imageUrl}" alt="Carousel image" class="carousel-modal-img" data-index="${idx}">
                </div>
            `;
        }).join('');

        const pfpUrl = state.accountInfo.cachedPfp || convertGoogleDriveUrl(state.accountInfo.pfp, false) || 'https://via.placeholder.com/40';

        modalHtml = `
            <div class="post-modal-image" id="carouselContainer">
                <div class="swiper carousel-swiper-modal" style="width: 100%; height: 90vh;">
                    <div class="swiper-wrapper">
                        ${carouselSlides}
                    </div>
                    <div class="swiper-pagination"></div>
                    <div class="swiper-button-prev"></div>
                    <div class="swiper-button-next"></div>
                </div>
            </div>
            <div class="post-modal-sidebar">
                <div class="post-modal-header">
                    <img src="${pfpUrl}" class="post-modal-pfp" alt="Profile">
                    <div class="post-modal-username">${state.accountInfo.name || 'username'}</div>
                </div>
                <div class="post-modal-caption">
                    <strong>${state.accountInfo.name || 'username'}</strong> ${post.caption || ''}
                </div>
                <div class="post-modal-actions">
                    <div class="post-modal-action-icons">
                        <i class="far fa-heart"></i>
                        <i class="far fa-comment"></i>
                        <i class="far fa-paper-plane"></i>
                    </div>
                    <div class="post-modal-date">${formatDate(post.date, post.time)}</div>
                </div>
            </div>
        `;
    }

    content.innerHTML = modalHtml;
    modal.style.display = 'flex';

    // Apply aspect ratio to post image
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
            const carouselContainer = document.getElementById('carouselContainer');
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
        // sz=w1600 provides high quality while avoiding rate limit issues
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
    }

    return url;
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

// Edit post in single editor
function editPost(postId) {
    window.location.href = `single.html?load=${postId}`;
}

// ==================== CLIENT APPROVAL WORKFLOW FUNCTIONS ====================

// Email Modal Functions
function showEmailModal() {
    document.getElementById('emailModal').style.display = 'flex';
}

function closeEmailModal() {
    document.getElementById('emailModal').style.display = 'none';
}

async function submitEmail() {
    const emailInput = document.getElementById('clientEmailInput');
    const email = emailInput.value.trim();
    const errorEl = document.getElementById('emailError');

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        errorEl.textContent = 'Please enter a valid email address';
        errorEl.style.display = 'block';
        return;
    }

    try {
        // Log email to backend
        const response = await fetch(`${API_URL}/api/client-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feedId: clientIdentity.feedId,
                email: email
            })
        });

        if (!response.ok) {
            throw new Error('Failed to log email');
        }

        // Store email
        clientIdentity.email = email;
        sessionStorage.setItem(`clientEmail_${clientIdentity.feedId}`, email);

        // Load feedback draft
        await loadFeedbackDraft();

        // Close modal and show feedback button
        closeEmailModal();
        document.getElementById('sendFeedbackBtn').style.display = 'flex';

        console.log('Email logged successfully');
    } catch (error) {
        console.error('Error logging email:', error);
        errorEl.textContent = 'Failed to save email. Please try again.';
        errorEl.style.display = 'block';
    }
}

// Feedback Draft Management
async function loadFeedbackDraft() {
    if (!clientIdentity.email || !clientIdentity.feedId) return;

    try {
        const response = await fetch(
            `${API_URL}/api/feedback/${clientIdentity.feedId}?email=${encodeURIComponent(clientIdentity.email)}`
        );

        if (response.ok) {
            const data = await response.json();
            feedbackDraft = data;
            console.log('Feedback draft loaded:', feedbackDraft);
        }
    } catch (error) {
        console.error('Error loading feedback draft:', error);
    }
}

async function saveFeedbackDraft() {
    if (!clientIdentity.email || !clientIdentity.feedId) return;

    try {
        await fetch(`${API_URL}/api/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feedId: clientIdentity.feedId,
                clientEmail: clientIdentity.email,
                gridComment: feedbackDraft.gridComment,
                posts: feedbackDraft.posts
            })
        });
        console.log('Feedback draft saved');
    } catch (error) {
        console.error('Error saving feedback draft:', error);
    }
}

// Like/Unlike Functions
function getPostFeedback(postId) {
    let postFeedback = feedbackDraft.posts.find(p => p.postId === postId);
    if (!postFeedback) {
        postFeedback = {
            postId: postId,
            liked: false,
            comments: []
        };
        feedbackDraft.posts.push(postFeedback);
    }
    return postFeedback;
}

async function toggleLike(postId) {
    if (!clientIdentity.email) {
        showEmailModal();
        return;
    }

    const postFeedback = getPostFeedback(postId);
    postFeedback.liked = !postFeedback.liked;

    try {
        await fetch(`${API_URL}/api/feedback/like`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feedId: clientIdentity.feedId,
                clientEmail: clientIdentity.email,
                postId: postId,
                liked: postFeedback.liked
            })
        });

        console.log(`Like ${postFeedback.liked ? 'added' : 'removed'} for post ${postId}`);
        updateLikeButton(postId, postFeedback.liked);
    } catch (error) {
        console.error('Error toggling like:', error);
        // Revert on error
        postFeedback.liked = !postFeedback.liked;
    }
}

function updateLikeButton(postId, liked) {
    const likeBtn = document.querySelector(`[data-post-id="${postId}"] .post-like-btn`);
    if (likeBtn) {
        if (liked) {
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '<i class="fas fa-heart"></i>';
        } else {
            likeBtn.classList.remove('liked');
            likeBtn.innerHTML = '<i class="far fa-heart"></i>';
        }
    }
}

// Comment Functions
function openCommentModal(postId) {
    if (!clientIdentity.email) {
        showEmailModal();
        return;
    }

    currentCommentPostId = postId;
    document.getElementById('commentInput').value = '';
    renderExistingComments(postId);
    document.getElementById('commentModal').style.display = 'flex';
}

function closeCommentModal() {
    document.getElementById('commentModal').style.display = 'none';
    currentCommentPostId = null;
}

function renderExistingComments(postId) {
    const container = document.getElementById('existingComments');
    const postFeedback = feedbackDraft.posts.find(p => p.postId === postId);

    if (!postFeedback || !postFeedback.comments || postFeedback.comments.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No comments yet</p>';
        return;
    }

    container.innerHTML = postFeedback.comments.map(comment => `
        <div class="comment-item">
            <div class="comment-text">${comment.text}</div>
            <button class="comment-delete-btn" onclick="deleteComment('${postId}', '${comment.id}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

async function addComment() {
    const text = document.getElementById('commentInput').value.trim();

    if (!text) return;

    try {
        const response = await fetch(`${API_URL}/api/feedback/comment`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feedId: clientIdentity.feedId,
                clientEmail: clientIdentity.email,
                postId: currentCommentPostId,
                text: text
            })
        });

        if (response.ok) {
            const data = await response.json();
            const postFeedback = getPostFeedback(currentCommentPostId);
            postFeedback.comments.push(data.comment);

            document.getElementById('commentInput').value = '';
            renderExistingComments(currentCommentPostId);
            updateCommentBadge(currentCommentPostId, postFeedback.comments.length);

            console.log('Comment added');
        }
    } catch (error) {
        console.error('Error adding comment:', error);
    }
}

async function deleteComment(postId, commentId) {
    try {
        const response = await fetch(`${API_URL}/api/feedback/comment`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feedId: clientIdentity.feedId,
                clientEmail: clientIdentity.email,
                postId: postId,
                commentId: commentId
            })
        });

        if (response.ok) {
            const postFeedback = getPostFeedback(postId);
            postFeedback.comments = postFeedback.comments.filter(c => c.id !== commentId);

            renderExistingComments(postId);
            updateCommentBadge(postId, postFeedback.comments.length);

            console.log('Comment deleted');
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
    }
}

function updateCommentBadge(postId, count) {
    const commentBtn = document.querySelector(`[data-post-id="${postId}"] .post-comment-btn`);
    if (commentBtn) {
        let badge = commentBtn.querySelector('.comment-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'comment-badge';
                commentBtn.appendChild(badge);
            }
            badge.textContent = count;
        } else if (badge) {
            badge.remove();
        }
    }
}

// Grid Comment Functions
function openGridCommentModal() {
    if (!clientIdentity.email) {
        showEmailModal();
        return;
    }

    document.getElementById('gridCommentInput').value = feedbackDraft.gridComment || '';
    document.getElementById('gridCommentModal').style.display = 'flex';
}

function closeGridCommentModal() {
    document.getElementById('gridCommentModal').style.display = 'none';
}

async function saveGridComment() {
    const text = document.getElementById('gridCommentInput').value.trim();
    feedbackDraft.gridComment = text;

    await saveFeedbackDraft();
    closeGridCommentModal();

    console.log('Grid comment saved');
}

// Review Panel Functions
function openReviewPanel() {
    if (!clientIdentity.email) {
        showEmailModal();
        return;
    }

    renderReviewPanel();
    document.getElementById('reviewPanel').style.display = 'flex';
}

function closeReviewPanel() {
    document.getElementById('reviewPanel').style.display = 'none';
}

function renderReviewPanel() {
    const container = document.getElementById('reviewPanelContent');

    let html = '<div style="color: var(--text-secondary); margin-bottom: 20px;">';
    html += `<p><strong>Your email:</strong> ${clientIdentity.email}</p>`;
    html += '</div>';

    // Grid Comment
    if (feedbackDraft.gridComment) {
        html += '<div class="review-section">';
        html += '<h4><i class="fas fa-comment-alt"></i> Overall Feedback</h4>';
        html += `<p style="color: var(--text-secondary);">${feedbackDraft.gridComment}</p>`;
        html += '</div>';
    }

    // Posts with feedback
    const postsWithFeedback = feedbackDraft.posts.filter(p => p.liked || p.comments.length > 0);

    if (postsWithFeedback.length > 0) {
        html += '<div class="review-section">';
        html += '<h4><i class="fas fa-images"></i> Post Feedback</h4>';

        postsWithFeedback.forEach(postFeedback => {
            const post = state.posts.find(p => p.id === postFeedback.postId);
            if (!post) return;

            let mediaUrl = '';
            if (post.type === 'post') {
                mediaUrl = post.cachedPath || convertGoogleDriveUrl(post.url, false);
            } else if (post.type === 'reel') {
                mediaUrl = post.cachedThumbnail || convertGoogleDriveUrl(post.thumbnail, false);
            } else if (post.type === 'carousel') {
                mediaUrl = (post.cachedImages && post.cachedImages[0]) || convertGoogleDriveUrl(post.images[0], false);
            }

            html += '<div class="review-post-item">';
            html += `<img src="${mediaUrl}" alt="Post">`;
            html += '<div class="review-post-info">';
            html += `<div class="post-title">${post.type.toUpperCase()}</div>`;
            html += '<div class="post-status">';
            if (postFeedback.liked) {
                html += '<span class="liked"><i class="fas fa-heart"></i> Liked</span>';
            }
            if (postFeedback.comments.length > 0) {
                html += `<span class="has-comments"><i class="fas fa-comment"></i> ${postFeedback.comments.length} comment(s)</span>`;
            }
            html += '</div>';

            if (postFeedback.comments.length > 0) {
                html += '<div class="post-comments">';
                postFeedback.comments.forEach(comment => {
                    html += `<div class="review-comment">${comment.text}</div>`;
                });
                html += '</div>';
            }

            html += '</div></div>';
        });

        html += '</div>';
    }

    if (!feedbackDraft.gridComment && postsWithFeedback.length === 0) {
        html += '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No feedback to review yet. Like posts or add comments to provide feedback.</p>';
    }

    container.innerHTML = html;
}

// Approval Submission
async function submitApproval() {
    try {
        const response = await fetch(`${API_URL}/api/approvals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                feedId: clientIdentity.feedId,
                clientEmail: clientIdentity.email
            })
        });

        if (!response.ok) {
            throw new Error('Failed to submit approval');
        }

        const data = await response.json();
        console.log('Approval submitted:', data);

        closeReviewPanel();
        showSuccessModal();

        // Clear feedback draft
        feedbackDraft = {
            gridComment: '',
            posts: []
        };

        // Hide send button
        document.getElementById('sendFeedbackBtn').style.display = 'none';

    } catch (error) {
        console.error('Error submitting approval:', error);
        alert('Failed to submit feedback. Please try again.');
    }
}

function showSuccessModal() {
    document.getElementById('successModal').style.display = 'flex';
}

function closeSuccessModal() {
    document.getElementById('successModal').style.display = 'none';
}

// Initialize on page load
initClient();
