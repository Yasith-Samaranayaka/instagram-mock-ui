// Lightweight Google Drive upload helpers for browser-side uploads.

function validateFile(file) {
    if (!file) {
        throw new Error('No file provided');
    }

    if (CONFIG && CONFIG.UPLOAD_SETTINGS) {
        if (CONFIG.UPLOAD_SETTINGS.allowedTypes && !CONFIG.UPLOAD_SETTINGS.allowedTypes.includes(file.type)) {
            throw new Error('Invalid file type');
        }
        if (CONFIG.UPLOAD_SETTINGS.maxFileSize && file.size > CONFIG.UPLOAD_SETTINGS.maxFileSize) {
            throw new Error('File too large');
        }
    }
}

function getViewUrl(fileId) {
    // Use thumbnail endpoint for better rate limit handling
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
}

function getThumbnailUrl(fileId) {
    // Use thumbnail endpoint with appropriate size
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}

async function uploadToGoogleDrive(file, folderType = 'posts') {
    if (!accessToken) {
        throw new Error('Not authenticated. Please connect Google Drive.');
    }

    validateFile(file);

    if (!CONFIG || !CONFIG.DRIVE_FOLDERS || !CONFIG.DRIVE_FOLDERS[folderType]) {
        throw new Error(`Drive folder ID missing for ${folderType}`);
    }

    const metadata = {
        name: `${Date.now()}_${file.name}`,
        parents: [CONFIG.DRIVE_FOLDERS[folderType]]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,thumbnailLink',
        {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: form
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    // Make the file publicly accessible
    try {
        await fetch(
            `https://www.googleapis.com/drive/v3/files/${result.id}/permissions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role: 'reader',
                    type: 'anyone'
                })
            }
        );
    } catch (permError) {
        console.warn('Failed to set public permissions:', permError);
    }

    return {
        fileId: result.id,
        fileName: result.name,
        url: getViewUrl(result.id),
        thumbnailUrl: result.thumbnailLink || getThumbnailUrl(result.id)
    };
}

async function uploadMultipleFiles(files, folderType = 'carousels') {
    const uploads = Array.from(files).map(file => uploadToGoogleDrive(file, folderType));
    return Promise.all(uploads);
}
