// Global state
let currentPath = '';
let selectedFiles = new Set();
let currentView = 'grid';
let contextMenuItem = null;

// File type icons mapping
const fileIcons = {
    'folder': 'fa-folder',
    '.pdf': 'fa-file-pdf',
    '.doc': 'fa-file-word',
    '.docx': 'fa-file-word',
    '.xls': 'fa-file-excel',
    '.xlsx': 'fa-file-excel',
    '.ppt': 'fa-file-powerpoint',
    '.pptx': 'fa-file-powerpoint',
    '.zip': 'fa-file-archive',
    '.rar': 'fa-file-archive',
    '.7z': 'fa-file-archive',
    '.tar': 'fa-file-archive',
    '.gz': 'fa-file-archive',
    '.jpg': 'fa-file-image',
    '.jpeg': 'fa-file-image',
    '.png': 'fa-file-image',
    '.gif': 'fa-file-image',
    '.svg': 'fa-file-image',
    '.mp4': 'fa-file-video',
    '.avi': 'fa-file-video',
    '.mkv': 'fa-file-video',
    '.mp3': 'fa-file-audio',
    '.wav': 'fa-file-audio',
    '.txt': 'fa-file-alt',
    '.js': 'fa-file-code',
    '.py': 'fa-file-code',
    '.html': 'fa-file-code',
    '.css': 'fa-file-code',
    '.json': 'fa-file-code',
    '.xml': 'fa-file-code',
    '.yaml': 'fa-file-code',
    '.yml': 'fa-file-code',
    '.sh': 'fa-file-code',
    'default': 'fa-file'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadFiles(currentPath);
});

function initializeEventListeners() {
    // File upload
    const uploadBtn = document.getElementById('upload-btn');
    const fileUpload = document.getElementById('file-upload');
    
    uploadBtn.addEventListener('click', () => fileUpload.click());
    fileUpload.addEventListener('change', handleFileUpload);
    
    // Folder creation
    document.getElementById('create-folder-btn').addEventListener('click', createFolder);
    
    // Delete selected
    document.getElementById('delete-selected-btn').addEventListener('click', deleteSelected);
    
    // Search
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => handleSearch(e.target.value), 300);
    });
    
    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleView(btn.dataset.view));
    });
    
    // Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Context menu
    document.addEventListener('click', () => hideContextMenu());
    document.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.file-item')) {
            hideContextMenu();
        }
    });
    
    // Context menu items
    document.getElementById('ctx-open').addEventListener('click', () => {
        if (contextMenuItem) openItem(contextMenuItem);
    });
    
    document.getElementById('ctx-download').addEventListener('click', () => {
        if (contextMenuItem) downloadItem(contextMenuItem);
    });
    
    document.getElementById('ctx-get-url').addEventListener('click', () => {
        if (contextMenuItem) copyFileUrl(contextMenuItem);
    });
    
    document.getElementById('ctx-rename').addEventListener('click', () => {
        if (contextMenuItem) showRenameModal(contextMenuItem);
    });
    
    document.getElementById('ctx-delete').addEventListener('click', () => {
        if (contextMenuItem) deleteItems([contextMenuItem.dataset.path]);
    });
    
    // Rename modal
    document.getElementById('rename-cancel').addEventListener('click', hideRenameModal);
    document.getElementById('rename-confirm').addEventListener('click', confirmRename);
    
    // URL copy button
    document.getElementById('copy-url-btn').addEventListener('click', copyCurrentUrl);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
}

async function loadFiles(path) {
    showLoading(true);
    selectedFiles.clear();
    updateDeleteButton();
    
    // Clear URL display
    document.getElementById('url-input').value = '';
    document.getElementById('url-input').placeholder = 'Select a file to see its URL';
    
    try {
        const response = await fetch(`/list?path=${encodeURIComponent(path)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load files');
        }
        
        // Ensure currentPath is preserved and used throughout the UI
        currentPath = data.path || '';
        updateBreadcrumb(currentPath); // always pass the full path
        renderFiles(data.entries);
        
    } catch (error) {
        showError('Failed to load files: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function renderFiles(files) {
    const container = document.getElementById('file-grid');
    container.innerHTML = '';
    container.className = currentView === 'grid' ? 'file-grid' : 'file-list';
    
    // Add parent directory item if not in root
    if (currentPath) {
        const parentItem = createFileItem({
            name: '..',
            type: 'folder',
            isParent: true
        });
        container.appendChild(parentItem);
    }
    
    // Sort files (folders first, then by name)
    files.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
    
    // Render files
    files.forEach(file => {
        const item = createFileItem(file);
        container.appendChild(item);
    });
}

function createFileItem(file) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.dataset.path = file.isParent ? currentPath.split('/').slice(0, -1).join('/') : file.path;
    div.dataset.type = file.type;
    div.dataset.name = file.name;

    const icon = file.isParent ? 'fa-arrow-circle-up' : getFileIcon(file);
    const displayName = file.isParent ? 'Parent Directory' : file.name;
    const checkboxHtml = '<input type="checkbox" class="file-select-checkbox" />';

    if (currentView === 'grid') {
        div.innerHTML = `
            ${checkboxHtml}
            <div class="file-icon"><i class="fas ${icon}"></i></div>
            <div class="file-name" title="${displayName}">${displayName}</div>
            ${file.type === 'file' ? `<div class="file-size">${file.sizeFormatted}</div>` : ''}
        `;
    } else {
        const modified = file.modified ? new Date(file.modified).toLocaleString() : '-';
        div.innerHTML = `
            ${checkboxHtml}
            <div class="file-icon"><i class="fas ${icon}"></i></div>
            <div class="file-name">${displayName}</div>
            <div class="file-size">${file.sizeFormatted || '-'}</div>
            <div class="file-modified">${modified}</div>
        `;
    }

    // Checkbox event listener for multi-select
    const checkbox = div.querySelector('.file-select-checkbox');
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
            div.classList.add('selected');
            selectedFiles.add(file.path);
        } else {
            div.classList.remove('selected');
            selectedFiles.delete(file.path);
        }
        updateDeleteButton();
    });

    // Event listeners
    div.addEventListener('click', (e) => handleFileClick(e, file));
    div.addEventListener('dblclick', () => openItem(file));
    div.addEventListener('contextmenu', (e) => showContextMenu(e, file));

    return div;
}

function getFileIcon(file) {
    if (file.type === 'folder') return fileIcons.folder;
    
    const ext = file.extension || '';
    return fileIcons[ext] || fileIcons.default;
}

function handleFileClick(e, file) {
    if (e.target.classList.contains('file-select-checkbox')) {
        return; // Ignore clicks directly on the checkbox
    }

    const item = e.currentTarget;
    const checkbox = item.querySelector('.file-select-checkbox');

    if (e.ctrlKey || e.metaKey) {
        item.classList.toggle('selected');
        checkbox.checked = item.classList.contains('selected');

        if (item.classList.contains('selected')) {
            selectedFiles.add(file.path);
        } else {
            selectedFiles.delete(file.path);
        }
    } else {
        document.querySelectorAll('.file-item').forEach(other => {
            other.classList.remove('selected');
            const cb = other.querySelector('.file-select-checkbox');
            if (cb) cb.checked = false;
        });

        selectedFiles.clear();
        item.classList.add('selected');
        checkbox.checked = true;
        selectedFiles.add(file.path);
    }

    updateDeleteButton();
    updateUrlDisplay(file);
}

function openItem(file) {
    if (file.type === 'folder' || file.isParent) {
        const newPath = file.isParent 
            ? currentPath.split('/').slice(0, -1).join('/')
            : file.path;
        loadFiles(newPath);
    } else {
        window.open(`/files/${file.path}`, '_blank');
    }
}

function downloadItem(file) {
    window.location.href = `/download?path=${encodeURIComponent(file.dataset.path)}`;
}

async function handleFileUpload(e) {
    const files = e.target.files;
    if (!files.length) return;
    
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }
    formData.append('path', currentPath);
    
    showLoading(true);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.errors && result.errors.length) {
            showError('Some files failed to upload:\n' + 
                result.errors.map(e => `${e.file}: ${e.error}`).join('\n'));
        }
        
        loadFiles(currentPath);
    } catch (error) {
        showError('Upload failed: ' + error.message);
    } finally {
        showLoading(false);
        e.target.value = '';
    }
}

async function createFolder() {
    const name = prompt('Enter folder name:');
    if (!name) return;
    
    try {
        const response = await fetch('/create-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, path: currentPath })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to create folder');
        }
        
        loadFiles(currentPath);
    } catch (error) {
        showError('Failed to create folder: ' + error.message);
    }
}

async function deleteSelected() {
    const paths = Array.from(selectedFiles);
    if (!paths.length) return;
    
    const confirmMsg = paths.length === 1 
        ? 'Delete this item?' 
        : `Delete ${paths.length} items?`;
        
    if (!confirm(confirmMsg)) return;
    
    await deleteItems(paths);
}

async function deleteItems(paths) {
    try {
        const response = await fetch('/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths })
        });
        const result = await response.json();
        // Show toast notification instead of alert
        showToast(result.errors && result.errors.length
            ? 'Some items failed to delete.'
            : 'Items deleted successfully.');
        loadFiles(currentPath);
    } catch (error) {
        // Show toast notification on error
        showToast('Delete failed: ' + error.message);
    }
}

function showRenameModal(file) {
    const modal = document.getElementById('rename-modal');
    const input = document.getElementById('rename-input');
    
    input.value = file.dataset.name;
    modal.style.display = 'flex';
    input.focus();
    input.select();
    
    modal.dataset.oldPath = file.dataset.path;
}

function hideRenameModal() {
    const modal = document.getElementById('rename-modal');
    modal.style.display = 'none';
    delete modal.dataset.oldPath;
}

async function confirmRename() {
    const modal = document.getElementById('rename-modal');
    const oldPath = modal.dataset.oldPath;
    const newName = document.getElementById('rename-input').value.trim();
    
    if (!newName || !oldPath) return;
    
    try {
        const response = await fetch('/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPath, newName })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Failed to rename');
        }
        
        hideRenameModal();
        loadFiles(currentPath);
    } catch (error) {
        showError('Rename failed: ' + error.message);
    }
}

async function handleSearch(query) {
    if (!query) {
        loadFiles(currentPath);
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`/search?q=${encodeURIComponent(query)}&path=${encodeURIComponent(currentPath)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Search failed');
        }
        
        renderFiles(data.results);
    } catch (error) {
        showError('Search failed: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            // For basic auth, we need to send invalid credentials to force re-authentication
            const response = await fetch('/logout', { 
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + btoa('logout:logout')
                }
            });
            
            // Force browser to forget credentials
            if (response.status === 401) {
                // Clear any stored data
                selectedFiles.clear();
                currentPath = '';
                
                // Redirect to force re-authentication
                window.location.href = '/';
            }
        } catch (error) {
            // Force reload on error too
            window.location.reload();
        }
    }
}

// Drag and drop handlers
function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (!files.length) return;
    
    const fileInput = document.getElementById('file-upload');
    fileInput.files = files;
    handleFileUpload({ target: fileInput });
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

// Context menu
function showContextMenu(e, file) {
    e.preventDefault();
    
    const menu = document.getElementById('context-menu');
    contextMenuItem = e.currentTarget;
    
    // Show/hide Get URL option based on file type
    const getUrlOption = document.getElementById('ctx-get-url');
    if (file.type === 'file' && !file.isParent) {
        getUrlOption.style.display = '';
    } else {
        getUrlOption.style.display = 'none';
    }
    
    // Position menu
    const x = e.pageX;
    const y = e.pageY;
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';
    
    // Adjust if menu goes off-screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (y - rect.height) + 'px';
    }
}

function hideContextMenu() {
    document.getElementById('context-menu').style.display = 'none';
    contextMenuItem = null;
}

// Keyboard shortcuts
function handleKeyboard(e) {
    // Ctrl+A - Select all
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.add('selected');
            selectedFiles.add(item.dataset.path);
        });
        updateDeleteButton();
    }
    
    // Delete key
    if (e.key === 'Delete' && selectedFiles.size > 0) {
        deleteSelected();
    }
    
    // F2 - Rename
    if (e.key === 'F2' && selectedFiles.size === 1) {
        const path = Array.from(selectedFiles)[0];
        const item = document.querySelector(`[data-path="${path}"]`);
        if (item) showRenameModal(item);
    }
    
    // Escape - Clear selection
    if (e.key === 'Escape') {
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('selected');
            const cb = item.querySelector('.file-select-checkbox');
            if (cb) cb.checked = false;
        });
        selectedFiles.clear();
        updateDeleteButton();
        // Clear URL display
        document.getElementById('url-input').value = '';
        document.getElementById('url-input').placeholder = 'Select a file to see its URL';
    }
}

// UI helpers
function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    const parts = path ? path.split('/').filter(p => p) : [];
    
    let html = '<a href="#" data-path=""><i class="fas fa-home"></i></a>';
    let currentPathStr = '';
    
    parts.forEach((part, index) => {
        currentPathStr += (currentPathStr ? '/' : '') + part;
        html += ` <span>/</span> <a href="#" data-path="${currentPathStr}">${part}</a>`;
    });
    
    breadcrumb.innerHTML = html;
    // Show the full path in #current-full-path (add this element to HTML as needed)
    const fullPathDisplay = document.getElementById('current-full-path');
    if (fullPathDisplay) {
        fullPathDisplay.textContent = '/' + path;
    }
    // Add click handlers
    breadcrumb.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            loadFiles(link.dataset.path);
        });
    });
}

function updateDeleteButton() {
    const btn = document.getElementById('delete-selected-btn');
    btn.disabled = selectedFiles.size === 0;
    
    if (selectedFiles.size > 0) {
        btn.innerHTML = `<i class="fas fa-trash"></i> Delete (${selectedFiles.size})`;
    } else {
        btn.innerHTML = '<i class="fas fa-trash"></i> Delete Selected';
    }
}

function toggleView(view) {
    currentView = view;
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    loadFiles(currentPath);
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
    document.getElementById('file-grid').style.display = show ? 'none' : '';
}

function showError(message) {
    showToast(message);
}

// Toast notification helper
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('visible');
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }, 10);
}

// URL Display functions
function updateUrlDisplay(file) {
    const urlInput = document.getElementById('url-input');
    if (file.type === 'file' && !file.isParent) {
        const url = `${window.location.origin}/files/${file.path}`;
        urlInput.value = url;
    } else {
        urlInput.value = '';
        urlInput.placeholder = 'Select a file to see its URL';
    }
}

function copyCurrentUrl() {
    const urlInput = document.getElementById('url-input');
    const copyBtn = document.getElementById('copy-url-btn');
    
    if (urlInput.value) {
        copyToClipboard(urlInput.value, 'URL copied to clipboard!');
        
        // Visual feedback
        copyBtn.classList.add('copied');
        setTimeout(() => {
            copyBtn.classList.remove('copied');
        }, 2000);
    }
}

function copyFileUrl(fileElement) {
    const path = fileElement.dataset.path;
    const type = fileElement.dataset.type;
    
    if (type === 'file') {
        const url = `${window.location.origin}/files/${path}`;
        copyToClipboard(url, 'File URL copied to clipboard!');
    } else {
        showToast('Cannot get URL for folders');
    }
}

function copyToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMessage || 'Copied to clipboard!');
        }).catch(() => {
            fallbackCopyToClipboard(text, successMessage);
        });
    } else {
        fallbackCopyToClipboard(text, successMessage);
    }
}

function fallbackCopyToClipboard(text, successMessage) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        showToast(successMessage || 'Copied to clipboard!');
    } catch (err) {
        showToast('Failed to copy to clipboard');
    }
    
    document.body.removeChild(textarea);
}