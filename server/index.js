import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import passport from 'passport';
import session from 'express-session';
import { configurePassport } from './auth.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3001',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        process.env.CLIENT_URL
    ].filter(Boolean),
    credentials: true
}));
app.use(express.json({ limit: '2mb' }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true for https
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // required for cross-site cookies
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
configurePassport();

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// File paths
const DATA_DIR = path.join(__dirname, '..', 'Data');
const FEED_DATA_PATH = path.join(DATA_DIR, 'feed_data.json');
const CLIENT_INFO_PATH = path.join(DATA_DIR, 'client_info.json');
const CLIENT_EMAILS_PATH = path.join(DATA_DIR, 'client_emails.json');
const CLIENT_FEEDBACK_PATH = path.join(DATA_DIR, 'client_feedback.json');
const APPROVALS_PATH = path.join(DATA_DIR, 'approvals.json');
const SCHEDULER_PATH = path.join(DATA_DIR, 'scheduler.json');
const CACHE_DIR = path.join(__dirname, '..', 'CachedImages');
const CACHE_METADATA_FILE = path.join(CACHE_DIR, 'metadata.json');

// Cache cleanup interval (2 months in milliseconds)
const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;

// Helper functions
function readJson(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return [];
        }
        const data = fs.readFileSync(filePath, 'utf8');
        if (!data || data.trim() === '') {
            return [];
        }
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        return [];
    }
}

function writeJson(filePath, data) {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Successfully wrote to ${filePath}`);
    } catch (error) {
        console.error(`Error writing to ${filePath}:`, error.message);
        throw error;
    }
}

// Cache helper functions
function initializeCacheDirectory() {
    try {
        const types = ['posts', 'reels', 'carousels', 'profiles'];

        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }

        types.forEach(type => {
            const typeDir = path.join(CACHE_DIR, type);
            if (!fs.existsSync(typeDir)) {
                fs.mkdirSync(typeDir, { recursive: true });
            }
        });

        console.log('Cache directory initialized');
    } catch (error) {
        console.error('Error initializing cache directory:', error);
    }
}

async function cleanupOldCache() {
    try {
        const now = Date.now();
        const types = ['posts', 'reels', 'carousels', 'profiles'];

        for (const type of types) {
            const typeDir = path.join(CACHE_DIR, type);
            if (!fs.existsSync(typeDir)) continue;

            const files = fs.readdirSync(typeDir);

            for (const file of files) {
                const filePath = path.join(typeDir, file);
                const stats = fs.statSync(filePath);
                const fileAgeMs = now - stats.mtimeMs;

                if (fileAgeMs > TWO_MONTHS_MS) {
                    try {
                        fs.unlinkSync(filePath);
                        const ageInDays = Math.round(fileAgeMs / (24 * 60 * 60 * 1000));
                        console.log(`Cleanup: Deleted ${file} (age: ${ageInDays} days)`);
                    } catch (error) {
                        console.error(`Failed to delete old cache ${file}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Cache cleanup error:', error);
    }
}

function saveCacheMetadata(fileName, type, id, googleDriveUrl, index = null) {
    try {
        let metadata = {};

        if (fs.existsSync(CACHE_METADATA_FILE)) {
            const data = fs.readFileSync(CACHE_METADATA_FILE, 'utf8');
            metadata = JSON.parse(data);
        }

        metadata[fileName] = {
            type: type,
            id: id,
            index: index,
            originalUrl: googleDriveUrl,
            cachedAt: new Date().toISOString(),
            cachedAtMs: Date.now()
        };

        fs.writeFileSync(CACHE_METADATA_FILE, JSON.stringify(metadata, null, 2));
    } catch (error) {
        console.error('Failed to save cache metadata:', error);
    }
}

function getExistingCachePath(type, id, googleDriveUrl, index = null, typeFolder = '') {
    try {
        if (!fs.existsSync(CACHE_METADATA_FILE)) return null;

        const data = fs.readFileSync(CACHE_METADATA_FILE, 'utf8');
        const metadata = JSON.parse(data);
        let metadataChanged = false;

        for (const [fileName, info] of Object.entries(metadata)) {
            const filePath = path.join(CACHE_DIR, typeFolder || `${type}s`, fileName);
            const matches = info.type === type
                && info.id === id
                && (info.index ?? null) === (index ?? null)
                && info.originalUrl === googleDriveUrl;

            if (matches && fs.existsSync(filePath)) {
                return {
                    cachePath: `/CachedImages/${typeFolder || `${type}s`}/${fileName}`,
                    fileName
                };
            }

            if (!fs.existsSync(filePath)) {
                delete metadata[fileName];
                metadataChanged = true;
            }
        }

        if (metadataChanged) {
            fs.writeFileSync(CACHE_METADATA_FILE, JSON.stringify(metadata, null, 2));
        }
    } catch (error) {
        console.error('Failed to read existing cache metadata:', error);
    }

    return null;
}

function removeCacheMetadata(fileName) {
    try {
        if (!fs.existsSync(CACHE_METADATA_FILE)) return;

        const data = fs.readFileSync(CACHE_METADATA_FILE, 'utf8');
        let metadata = JSON.parse(data);

        delete metadata[fileName];

        fs.writeFileSync(CACHE_METADATA_FILE, JSON.stringify(metadata, null, 2));
    } catch (error) {
        console.error('Failed to remove cache metadata:', error);
    }
}

// ========== AUTHENTICATION MIDDLEWARE ==========

// Middleware to require authentication
function requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
}

// ========== AUTHENTICATION ROUTES ==========

// Google OAuth login
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login.html' }),
    (req, res) => {
        // Successful authentication, redirect to dashboard
        res.redirect('/index.html');
    }
);

// Check authentication status
app.get('/auth/status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name,
                picture: req.user.picture
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Logout
app.post('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// ========== FEED MANAGEMENT API ENDPOINTS ==========

// Get all feeds
app.get('/api/feeds', requireAuth, (req, res) => {
    try {
        const feeds = readJson(FEED_DATA_PATH);
        // Filter feeds by current user
        const userFeeds = feeds.filter(f => f.userId === req.user.id);
        res.json(userFeeds);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read feeds' });
    }
});

// Get single feed by ID (authenticated - for dashboard/editor use)
app.get('/api/feeds/:id', requireAuth, (req, res) => {
    try {
        const feeds = readJson(FEED_DATA_PATH);
        const feedId = req.params.id;
        const feed = feeds.find(f => f.id === parseInt(feedId) || f.id.toString() === feedId);

        if (!feed) {
            return res.status(404).json({ error: 'Feed not found' });
        }

        // Verify ownership
        if (feed.userId && feed.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(feed);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read feed' });
    }
});

// Get single feed by ID (public - for client viewing)
// This endpoint allows unauthenticated access so clients can view shared feeds
app.get('/api/public/feeds/:id', (req, res) => {
    try {
        const feeds = readJson(FEED_DATA_PATH);
        const feedId = req.params.id;
        const feed = feeds.find(f => f.id === parseInt(feedId) || f.id.toString() === feedId);

        if (!feed) {
            return res.status(404).json({ error: 'Feed not found' });
        }

        // Return the feed without authentication check
        // This is intentional - the feed is meant to be publicly shareable
        res.json(feed);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read feed' });
    }
});

// Create new feed
app.post('/api/feeds', requireAuth, (req, res) => {
    try {
        const feeds = readJson(FEED_DATA_PATH);
        const newFeed = {
            id: Date.now(),
            type: req.body.type || 'Grid',
            name: req.body.name,
            state: req.body.state,
            userId: req.user.id, // Add userId
            createdAt: new Date().toISOString()
        };
        feeds.push(newFeed);
        writeJson(FEED_DATA_PATH, feeds);
        res.status(201).json(newFeed);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create feed' });
    }
});

// Delete feed by ID
app.delete('/api/feeds/:id', requireAuth, (req, res) => {
    try {
        let feeds = readJson(FEED_DATA_PATH);
        const feedToDelete = feeds.find(f => f.id === parseInt(req.params.id));

        if (!feedToDelete) {
            return res.status(404).json({ error: 'Feed not found' });
        }

        // Verify ownership
        if (feedToDelete.userId && feedToDelete.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        feeds = feeds.filter(f => f.id !== parseInt(req.params.id));
        writeJson(FEED_DATA_PATH, feeds);
        res.json({ message: 'Feed deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete feed' });
    }
});

// Cache Management API Endpoints

// Download and cache image from Google Drive
app.post('/api/cache/download', async (req, res) => {
    try {
        const { googleDriveUrl, type, id, index } = req.body;

        if (!googleDriveUrl || !type || !id) {
            console.log('❌ Cache: Missing parameters', { googleDriveUrl, type, id });
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Normalize type to plural for consistency
        const typeFolder = type === 'post' ? 'posts' : (type === 'reel' ? 'reels' : (type === 'carousel' ? 'carousels' : (type === 'profile' ? 'profiles' : type + 's')));

        console.log(`📥 Cache: Starting download for ${type}_${id}`);
        console.log(`📥 Cache: URL = ${googleDriveUrl.substring(0, 80)}...`);

        // Reuse existing cache if available
        const existing = getExistingCachePath(type, id, googleDriveUrl, index, typeFolder);
        if (existing) {
            console.log(`✅ Cache: Reusing existing file ${existing.cachePath}`);
            return res.json({
                localPath: existing.cachePath,
                message: 'Image served from cache'
            });
        }

        // Generate filename
        const fileName = `${type}_${id}${index ? `_${index}` : ''}_${Date.now()}.jpg`;
        const fileDir = path.join(CACHE_DIR, typeFolder);
        const filePath = path.join(fileDir, fileName);

        console.log(`📁 Cache: Directory = ${fileDir}`);
        console.log(`📁 Cache: Full path = ${filePath}`);

        // Ensure directory exists
        try {
            if (!fs.existsSync(fileDir)) {
                fs.mkdirSync(fileDir, { recursive: true });
                console.log(`✅ Cache: Created directory ${fileDir}`);
            }
        } catch (error) {
            console.error(`❌ Cache: Failed to create directory: ${error.message}`);
            return res.status(500).json({ error: 'Failed to create cache directory', details: error.message });
        }

        // Download image
        const protocol = googleDriveUrl.startsWith('https') ? https : http;

        // Helper function to follow redirects
        const downloadWithRedirects = (url, maxRedirects = 5) => {
            return new Promise((resolve, reject) => {
                if (maxRedirects <= 0) {
                    reject(new Error('Too many redirects'));
                    return;
                }

                const proto = url.startsWith('https') ? https : http;

                proto.get(url, (response) => {
                    console.log(`📡 Cache: Response status = ${response.statusCode}`);

                    // Handle redirects
                    if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307 || response.statusCode === 308) {
                        console.log(`🔄 Cache: Following redirect to ${response.headers.location}`);
                        downloadWithRedirects(response.headers.location, maxRedirects - 1)
                            .then(resolve)
                            .catch(reject);
                    } else if (response.statusCode === 200) {
                        resolve(response);
                    } else {
                        reject(new Error(`HTTP ${response.statusCode}`));
                    }
                }).on('error', reject);
            });
        };

        // Download the image following redirects
        downloadWithRedirects(googleDriveUrl)
            .then((response) => {
                const fileStream = fs.createWriteStream(filePath);
                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    const fileSize = fs.statSync(filePath).size;
                    console.log(`✅ Cache: File saved successfully (${(fileSize / 1024).toFixed(2)} KB)`);
                    console.log(`✅ Cache: File path = ${filePath}`);
                    saveCacheMetadata(fileName, type, id, googleDriveUrl, index);
                    const cachePath = `/CachedImages/${typeFolder}/${fileName}`;
                    console.log(`✅ Cache: Returning path = ${cachePath}`);
                    res.json({
                        localPath: cachePath,
                        message: 'Image cached successfully'
                    });
                });

                fileStream.on('error', (error) => {
                    console.error(`❌ Cache: File write error: ${error.message}`);
                    try {
                        fs.unlinkSync(filePath);
                    } catch (e) { }
                    res.status(500).json({ error: 'Failed to write cache file', details: error.message });
                });
            })
            .catch((error) => {
                console.error(`❌ Cache: Download error: ${error.message}`);
                res.status(500).json({ error: 'Failed to download image', details: error.message });
            });
    } catch (error) {
        console.error(`❌ Cache: Unexpected error: ${error.message}`);
        res.status(500).json({ error: 'Cache download failed', details: error.message });
    }
});

// Delete cached files
app.post('/api/cache/delete', async (req, res) => {
    try {
        const { type, id, paths } = req.body;

        if (!paths || !Array.isArray(paths)) {
            return res.status(400).json({ error: 'Missing or invalid paths' });
        }

        let deleted = 0;

        for (const filePath of paths) {
            if (!filePath) continue;

            try {
                const fullPath = path.join(__dirname, '..', filePath.replace(/^\//, ''));

                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    const fileName = path.basename(fullPath);
                    removeCacheMetadata(fileName);
                    deleted++;
                    console.log(`Deleted cache: ${filePath}`);
                }
            } catch (error) {
                console.error(`Failed to delete ${filePath}:`, error);
            }
        }

        res.json({
            deleted: deleted,
            message: 'Cache files deleted'
        });
    } catch (error) {
        console.error('Cache deletion error:', error);
        res.status(500).json({ error: 'Cache deletion failed' });
    }
});

// Preset Management API Endpoints

// Get all presets
app.get('/api/presets', (req, res) => {
    try {
        const presets = readJson(CLIENT_INFO_PATH);
        res.json(presets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read presets' });
    }
});

// Save/update all presets
app.post('/api/presets', (req, res) => {
    try {
        writeJson(CLIENT_INFO_PATH, req.body);
        res.json({ message: 'Presets saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save presets' });
    }
});

// ============================================
// Client Approval Workflow API Endpoints
// ============================================

// Email Logging

// Log client email for a feed
app.post('/api/client-email', (req, res) => {
    try {
        const { feedId, email } = req.body;

        if (!feedId || !email) {
            return res.status(400).json({ error: 'Missing feedId or email' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const emails = readJson(CLIENT_EMAILS_PATH);

        // Check if this email is already logged for this feed
        const exists = emails.some(e => e.feedId === feedId && e.email === email);
        if (exists) {
            return res.json({ message: 'Email already logged', alreadyExists: true });
        }

        const entry = {
            feedId,
            email,
            timestamp: Date.now()
        };

        emails.push(entry);
        writeJson(CLIENT_EMAILS_PATH, emails);

        console.log(`Client email logged: ${email} for feed ${feedId}`);
        res.status(201).json({ message: 'Email logged successfully', entry });
    } catch (error) {
        console.error('Error logging client email:', error);
        res.status(500).json({ error: 'Failed to log email' });
    }
});

// Get emails for a specific feed
app.get('/api/client-email/:feedId', (req, res) => {
    try {
        const feedId = req.params.feedId;
        const emails = readJson(CLIENT_EMAILS_PATH);
        const feedEmails = emails.filter(e => e.feedId.toString() === feedId);
        res.json(feedEmails);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read emails' });
    }
});

// Feedback Management (Draft Likes/Comments)

// Get feedback draft for a client
app.get('/api/feedback/:feedId', (req, res) => {
    try {
        const feedId = req.params.feedId;
        const email = req.query.email;

        if (!email) {
            return res.status(400).json({ error: 'Email parameter required' });
        }

        const feedbacks = readJson(CLIENT_FEEDBACK_PATH);
        const feedback = feedbacks.find(f =>
            f.feedId.toString() === feedId && f.clientEmail === email
        );

        if (!feedback) {
            // Return empty feedback structure
            return res.json({
                feedId,
                clientEmail: email,
                gridComment: '',
                posts: [],
                lastUpdated: Date.now()
            });
        }

        res.json(feedback);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read feedback' });
    }
});

// Create or update feedback draft
app.post('/api/feedback', (req, res) => {
    try {
        const { feedId, clientEmail, gridComment, posts } = req.body;

        if (!feedId || !clientEmail) {
            return res.status(400).json({ error: 'Missing feedId or clientEmail' });
        }

        const feedbacks = readJson(CLIENT_FEEDBACK_PATH);
        const existingIndex = feedbacks.findIndex(f =>
            f.feedId.toString() === feedId.toString() && f.clientEmail === clientEmail
        );

        const updatedFeedback = {
            feedId,
            clientEmail,
            gridComment: gridComment || '',
            posts: posts || [],
            lastUpdated: Date.now()
        };

        if (existingIndex >= 0) {
            feedbacks[existingIndex] = updatedFeedback;
        } else {
            feedbacks.push(updatedFeedback);
        }

        writeJson(CLIENT_FEEDBACK_PATH, feedbacks);

        console.log(`Feedback updated for ${clientEmail} on feed ${feedId}`);
        res.json({ message: 'Feedback saved', feedback: updatedFeedback });
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

// Toggle like for a post
app.patch('/api/feedback/like', (req, res) => {
    try {
        const { feedId, clientEmail, postId, liked } = req.body;

        if (!feedId || !clientEmail || !postId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const feedbacks = readJson(CLIENT_FEEDBACK_PATH);
        let feedback = feedbacks.find(f =>
            f.feedId.toString() === feedId.toString() && f.clientEmail === clientEmail
        );

        if (!feedback) {
            feedback = {
                feedId,
                clientEmail,
                gridComment: '',
                posts: [],
                lastUpdated: Date.now()
            };
            feedbacks.push(feedback);
        }

        let postFeedback = feedback.posts.find(p => p.postId === postId);
        if (!postFeedback) {
            postFeedback = {
                postId,
                liked: false,
                comments: []
            };
            feedback.posts.push(postFeedback);
        }

        postFeedback.liked = liked;
        feedback.lastUpdated = Date.now();

        writeJson(CLIENT_FEEDBACK_PATH, feedbacks);

        console.log(`Like ${liked ? 'added' : 'removed'} for post ${postId} by ${clientEmail}`);
        res.json({ message: 'Like updated', feedback });
    } catch (error) {
        console.error('Error updating like:', error);
        res.status(500).json({ error: 'Failed to update like' });
    }
});

// Add comment to a post
app.patch('/api/feedback/comment', (req, res) => {
    try {
        const { feedId, clientEmail, postId, text } = req.body;

        if (!feedId || !clientEmail || !postId || !text) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const feedbacks = readJson(CLIENT_FEEDBACK_PATH);
        let feedback = feedbacks.find(f =>
            f.feedId.toString() === feedId.toString() && f.clientEmail === clientEmail
        );

        if (!feedback) {
            feedback = {
                feedId,
                clientEmail,
                gridComment: '',
                posts: [],
                lastUpdated: Date.now()
            };
            feedbacks.push(feedback);
        }

        let postFeedback = feedback.posts.find(p => p.postId === postId);
        if (!postFeedback) {
            postFeedback = {
                postId,
                liked: false,
                comments: []
            };
            feedback.posts.push(postFeedback);
        }

        const comment = {
            id: Date.now().toString(),
            text,
            timestamp: Date.now()
        };

        postFeedback.comments.push(comment);
        feedback.lastUpdated = Date.now();

        writeJson(CLIENT_FEEDBACK_PATH, feedbacks);

        console.log(`Comment added to post ${postId} by ${clientEmail}`);
        res.json({ message: 'Comment added', comment, feedback });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Delete comment from a post
app.delete('/api/feedback/comment', (req, res) => {
    try {
        const { feedId, clientEmail, postId, commentId } = req.body;

        if (!feedId || !clientEmail || !postId || !commentId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const feedbacks = readJson(CLIENT_FEEDBACK_PATH);
        const feedback = feedbacks.find(f =>
            f.feedId.toString() === feedId.toString() && f.clientEmail === clientEmail
        );

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        const postFeedback = feedback.posts.find(p => p.postId === postId);
        if (!postFeedback) {
            return res.status(404).json({ error: 'Post feedback not found' });
        }

        const initialLength = postFeedback.comments.length;
        postFeedback.comments = postFeedback.comments.filter(c => c.id !== commentId);

        if (postFeedback.comments.length === initialLength) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        feedback.lastUpdated = Date.now();
        writeJson(CLIENT_FEEDBACK_PATH, feedbacks);

        console.log(`Comment ${commentId} deleted from post ${postId} by ${clientEmail}`);
        res.json({ message: 'Comment deleted', feedback });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// Approval Submissions

// Submit approval (convert draft to immutable approval record)
app.post('/api/approvals', (req, res) => {
    try {
        const { feedId, clientEmail } = req.body;

        if (!feedId || !clientEmail) {
            return res.status(400).json({ error: 'Missing feedId or clientEmail' });
        }

        // Get the current feedback draft
        const feedbacks = readJson(CLIENT_FEEDBACK_PATH);
        const feedback = feedbacks.find(f =>
            f.feedId.toString() === feedId.toString() && f.clientEmail === clientEmail
        );

        if (!feedback) {
            return res.status(404).json({ error: 'No feedback found to submit' });
        }

        // Create approval record
        const approvals = readJson(APPROVALS_PATH);
        const approval = {
            approvalId: Date.now(),
            feedId,
            clientEmail,
            payload: {
                gridComment: feedback.gridComment || '',
                posts: feedback.posts.map(p => ({
                    postId: p.postId,
                    liked: p.liked,
                    comments: p.comments.map(c => c.text)
                }))
            },
            submittedAt: Date.now()
        };

        approvals.push(approval);
        writeJson(APPROVALS_PATH, approvals);

        console.log(`Approval submitted: ${approval.approvalId} by ${clientEmail} for feed ${feedId}`);
        res.status(201).json({
            message: 'Approval submitted successfully',
            approval
        });
    } catch (error) {
        console.error('Error submitting approval:', error);
        res.status(500).json({ error: 'Failed to submit approval' });
    }
});

// Get all approvals for a feed
app.get('/api/approvals/:feedId', (req, res) => {
    try {
        const feedId = req.params.feedId;
        const approvals = readJson(APPROVALS_PATH);
        const feedApprovals = approvals.filter(a =>
            a.feedId.toString() === feedId
        );
        res.json(feedApprovals);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read approvals' });
    }
});

// ========== Scheduler Endpoints ==========

// Create scheduler plan
app.post('/api/scheduler', (req, res) => {
    try {
        const { feedId, schedulerEmail } = req.body;

        if (!feedId) {
            return res.status(400).json({ error: 'feedId required' });
        }

        const schedulers = readJson(SCHEDULER_PATH);
        const schedulerId = Date.now();

        const newScheduler = {
            schedulerId,
            feedId,
            schedulerEmail: schedulerEmail || '',
            posts: [],
            createdAt: Date.now(),
            sharedAt: Date.now()
        };

        schedulers.push(newScheduler);
        writeJson(SCHEDULER_PATH, schedulers);

        res.json(newScheduler);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create scheduler' });
    }
});

// Get scheduler by ID
app.get('/api/scheduler/:schedulerId', (req, res) => {
    try {
        const schedulerId = req.params.schedulerId;
        const schedulers = readJson(SCHEDULER_PATH);
        const scheduler = schedulers.find(s => s.schedulerId.toString() === schedulerId);

        if (!scheduler) {
            return res.status(404).json({ error: 'Scheduler not found' });
        }

        res.json(scheduler);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read scheduler' });
    }
});

// Get schedulers by feed ID
app.get('/api/scheduler/feed/:feedId', (req, res) => {
    try {
        const feedId = req.params.feedId;
        const schedulers = readJson(SCHEDULER_PATH);
        const feedSchedulers = schedulers.filter(s => s.feedId.toString() === feedId);
        res.json(feedSchedulers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read schedulers' });
    }
});

// Update post schedule status
app.patch('/api/scheduler/:schedulerId/post/:postId', (req, res) => {
    try {
        const { schedulerId, postId } = req.params;
        const { scheduled, scheduledDate, scheduledTime, caption } = req.body;

        const schedulers = readJson(SCHEDULER_PATH);
        const scheduler = schedulers.find(s => s.schedulerId.toString() === schedulerId);

        if (!scheduler) {
            return res.status(404).json({ error: 'Scheduler not found' });
        }

        // Find or create post entry
        let postEntry = scheduler.posts.find(p => p.postId === postId);
        if (!postEntry) {
            postEntry = { postId, scheduled: false };
            scheduler.posts.push(postEntry);
        }

        // Update fields
        if (scheduled !== undefined) postEntry.scheduled = scheduled;
        if (scheduledDate) postEntry.scheduledDate = scheduledDate;
        if (scheduledTime) postEntry.scheduledTime = scheduledTime;
        if (caption !== undefined) postEntry.caption = caption;
        postEntry.updatedAt = Date.now();

        writeJson(SCHEDULER_PATH, schedulers);
        res.json(scheduler);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update post schedule' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);

    // Initialize cache directory
    initializeCacheDirectory();

    // Run cleanup on startup
    cleanupOldCache();

    // Run cleanup every 24 hours
    setInterval(cleanupOldCache, 24 * 60 * 60 * 1000);
});
