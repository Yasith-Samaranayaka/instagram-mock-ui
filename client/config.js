// Google Drive configuration placeholders. Replace with your project values before enabling uploads.
const CONFIG = {
    GOOGLE_CLIENT_ID: '989046162464-slq8ltvbp68tame7kil0uapia1nsf55h.apps.googleusercontent.com',
    DRIVE_FOLDERS: {
        posts: '169mKCYayLkqU7LODleJixx5cTcqrwzl3',
        profiles: '1VLlgR2PfUlHolzDr6avj_FvyB3L6sbn9',
        reels: '1K-76CkSeluW-xOVaqErEdI-3m7Jm23qI',
        carousels: '1t3UpV70lc6jicO6j50MxPIausM57MPeq',
        stories: '1chKZmK8RSICA7lrgPU7L_4x8Gm7PW-24'
    },
    UPLOAD_SETTINGS: {
        maxFileSize: 100 * 1024 * 1024, // 100MB cap for browser uploads
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
        useResumableUpload: true,
        chunkSize: 256 * 1024 // 256KB
    },
    OAUTH_SCOPES: 'https://www.googleapis.com/auth/drive.file'
};
