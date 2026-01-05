// Single Post Client View Script
const API_URL = '';

let state = {
    accountInfo: {
        name: '',
        pfp: ''
    },
    post: null
};

// Client Approval Workflow State
let clientIdentity = {
    email: '',
    feedId: ''
};

let feedbackDraft = {
    gridComment: '',
    posts: []
};

// Initialize single client view
async function initSingleClient() {
    // Get feed ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    clientIdentity.feedId = urlParams.get('id');

    if (!clientIdentity.feedId) {
        console.error('No post ID provided');
        return;
    }

    // Check for stored email
    const storedEmail = sessionStorage.getItem(`clientEmail_${clientIdentity.feedId}`);
    if (storedEmail) {
        clientIdentity.email = storedEmail;
        await loadSingleState();
        await loadFeedbackDraft();
        renderSinglePost();
        document.getElementById('sendFeedbackBtn').style.display = 'flex';
    } else {
        // Show email modal
        await loadSingleState();
        renderSinglePost();
        showEmailModal();
    }
}

// Load state from API
async function loadSingleState() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');

    console.log('📥 Loading single post with ID:', postId);

    if (!postId) {
        console.error('No post ID provided');
        return;
    }

    try {
        // Use public endpoint so unauthenticated users can view shared posts
        const response = await fetch(`${API_URL}/api/public/feeds/${postId}`);
        const feed = await response.json();

        console.log('📦 Feed data received:', feed);

        if (feed.state) {
            state.accountInfo = feed.state.accountInfo || {};
            state.post = feed.state.posts && feed.state.posts[0] ? feed.state.posts[0] : null;
            console.log('✅ State loaded:', state);
        } else {
            console.warn('⚠️ No state in feed response');
        }
    } catch (error) {
        console.error('❌ Error loading post:', error);
        state = {
            accountInfo: {
                name: 'Error',
                pfp: ''
            },
            post: null
        };
    }
}

// Render single post
function renderSinglePost() {
    const container = document.getElementById('singlePostView');

    console.log('🎨 Rendering single post, state:', state);

    if (!state.post) {
        console.warn('⚠️ No post found in state');
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Post Not Found</h3>
                <p>The post you're looking for doesn't exist or has been removed.</p>
            </div>
        `;
        return;
    }

    const post = state.post;
    let mediaHtml = '';

    if (post.type === 'post') {
        // Use cached path if available
        const imageUrl = post.cachedPath || convertGoogleDriveUrl(post.url, false);
        mediaHtml = `<img id="singlePostImg" src="${imageUrl}" style="width: 100%; display: block;" alt="Post">`;
    } else if (post.type === 'reel') {
        const videoUrl = post.cachedVideoPath || convertGoogleDriveUrl(post.videoUrl, true);

        mediaHtml = `
            <video src="${videoUrl}" controls style="width: 100%; display: block;" onclick="togglePlayPause(this)" ${post.cachedThumbnail ? `poster="${post.cachedThumbnail}"` : ''}>
                Your browser does not support video.
            </video>
        `;
    } else if (post.type === 'carousel') {
        // Use cached carousel images if available
        const carouselSlides = post.images.map((img, idx) => {
            const imageUrl = (post.cachedImages && post.cachedImages[idx]) || convertGoogleDriveUrl(img, false);
            return `
                <div class="swiper-slide">
                    <img src="${imageUrl}" alt="Carousel image" class="carousel-single-img" style="width: 100%; display: block;">
                </div>
            `;
        }).join('');

        mediaHtml = `
            <div class="swiper carousel-swiper-single" style="width: 100%;">
                <div class="swiper-wrapper">
                    ${carouselSlides}
                </div>
                <div class="swiper-pagination"></div>
                <div class="swiper-button-prev"></div>
                <div class="swiper-button-next"></div>
            </div>
        `;
    }

    // Use cached pfp if available
    const pfpUrl = state.accountInfo.cachedPfp || (state.accountInfo.pfp ? convertGoogleDriveUrl(state.accountInfo.pfp, false) : 'https://via.placeholder.com/36');

    // Get feedback for this post
    const postFeedback = feedbackDraft.posts.find(p => p.postId === post.id) || { liked: false, comments: [] };
    const likedClass = postFeedback.liked ? 'liked' : '';
    const heartIcon = postFeedback.liked ? 'fas' : 'far';
    const commentCount = postFeedback.comments.length;

    container.innerHTML = `
        <div class="wall-post" style="border-bottom: none; padding-bottom: 0;" data-post-id="${post.id}">
            <div class="wall-post-header">
                <img src="${pfpUrl}" class="wall-post-pfp" alt="Profile">
                <div class="wall-post-username">${state.accountInfo.name || 'username'}</div>
            </div>
            <div class="wall-post-image" id="singlePostContainer">
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

    // Apply aspect ratio to single post image
    if (post.type === 'post') {
        setTimeout(() => {
            const img = document.getElementById('singlePostImg');
            const container = document.getElementById('singlePostContainer');
            if (img && container) {
                applyAspectRatio(img, container);
            }
        }, 0);
    }

    // Apply aspect ratios to carousel images
    if (post.type === 'carousel') {
        setTimeout(() => {
            const images = document.querySelectorAll('.carousel-single-img');
            images.forEach((img) => {
                const parent = img.parentElement;
                applyAspectRatio(img, parent);
            });
        }, 0);
    }

    // Initialize Swiper for carousel
    if (post.type === 'carousel') {
        setTimeout(() => {
            // Destroy previous carousel swiper if it exists
            if (window.carouselSwiperSingle && window.carouselSwiperSingle.destroy) {
                window.carouselSwiperSingle.destroy();
            }

            window.carouselSwiperSingle = new Swiper('.carousel-swiper-single', {
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

// Toggle video play/pause
function togglePlayPause(video) {
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
}

// Google Drive URL conversion
function convertGoogleDriveUrl(url, isVideo) {
    if (!url) return url;

    // Extract file ID from Google Drive URL
    let fileId = null;
    const match = url.match(/[?&/]id=([a-zA-Z0-9_-]+)/);
    if (match) {
        fileId = match[1];
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        errorEl.textContent = 'Please enter a valid email address';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/client-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedId: clientIdentity.feedId, email: email })
        });

        if (!response.ok) throw new Error('Failed to log email');

        clientIdentity.email = email;
        sessionStorage.setItem(`clientEmail_${clientIdentity.feedId}`, email);
        await loadFeedbackDraft();
        closeEmailModal();
        document.getElementById('sendFeedbackBtn').style.display = 'flex';
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
        const response = await fetch(`${API_URL}/api/feedback/${clientIdentity.feedId}?email=${encodeURIComponent(clientIdentity.email)}`);
        if (response.ok) feedbackDraft = await response.json();
    } catch (error) {
        console.error('Error loading feedback draft:', error);
    }
}

// Like/Unlike Functions
function getPostFeedback(postId) {
    let postFeedback = feedbackDraft.posts.find(p => p.postId === postId);
    if (!postFeedback) {
        postFeedback = { postId: postId, liked: false, comments: [] };
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
        updateLikeButton(postId, postFeedback.liked);
    } catch (error) {
        console.error('Error toggling like:', error);
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
    document.getElementById('commentInput').value = '';
    renderExistingComments(postId);
    document.getElementById('commentModal').style.display = 'flex';
    window.currentCommentPostId = postId;
}

function closeCommentModal() {
    document.getElementById('commentModal').style.display = 'none';
    window.currentCommentPostId = null;
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
                postId: window.currentCommentPostId,
                text: text
            })
        });

        if (response.ok) {
            const data = await response.json();
            const postFeedback = getPostFeedback(window.currentCommentPostId);
            postFeedback.comments.push(data.comment);
            document.getElementById('commentInput').value = '';
            renderExistingComments(window.currentCommentPostId);
            updateCommentBadge(window.currentCommentPostId, postFeedback.comments.length);
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
    const post = state.post;

    let html = '<div style="color: var(--text-secondary); margin-bottom: 20px;">';
    html += `<p><strong>Your email:</strong> ${clientIdentity.email}</p>`;
    html += '</div>';

    const postFeedback = feedbackDraft.posts.find(p => p.postId === post.id);

    if (postFeedback && (postFeedback.liked || postFeedback.comments.length > 0)) {
        html += '<div class="review-section">';
        html += '<h4><i class="fas fa-image"></i> Post Feedback</h4>';

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

        html += '</div></div></div>';
    } else {
        html += '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No feedback to review yet. Like the post or add comments to provide feedback.</p>';
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

        if (!response.ok) throw new Error('Failed to submit approval');

        closeReviewPanel();
        showSuccessModal();
        feedbackDraft = { gridComment: '', posts: [] };
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
initSingleClient();
