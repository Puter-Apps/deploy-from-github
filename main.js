const repoUrlInput = document.getElementById('repoUrl');
const deployBtn = document.getElementById('deployBtn');
const historyBtn = document.getElementById('historyBtn');
const historyCountBadge = document.getElementById('historyCount');
const statusDiv = document.getElementById('status');
const modalOverlay = document.getElementById('modalOverlay');
const historyModalOverlay = document.getElementById('historyModalOverlay');
const historyList = document.getElementById('historyList');
const siteUrlElement = document.getElementById('siteUrl');
const visitSiteBtn = document.getElementById('visitSiteBtn');

// Deployment history storage
let deploymentHistory = [];

// Load deployment history from Puter key-value store
async function loadDeploymentHistory() {
    try {
        await ensureAuthenticated();
        
        /**
         * PUTER SDK: Key-Value Store
         * The puter.kv module provides a simple key-value storage system for your app.
         * Use puter.kv.get() to retrieve data stored under a specific key.
         * This is perfect for storing user preferences, app state, or other persistent data.
         */
        const historyData = await puter.kv.get('deployment_history');
        if (historyData) {
            deploymentHistory = JSON.parse(historyData);
        }
        updateHistoryButton();
    } catch (error) {
        console.error('Error loading deployment history:', error);
        deploymentHistory = [];
    }
}

// Save deployment history to Puter key-value store
async function saveDeploymentHistory() {
    try {
        /**
         * PUTER SDK: Key-Value Store - Setting Data
         * Use puter.kv.set() to store data under a specific key.
         * The first parameter is the key name, and the second is the value to store.
         * Values are automatically serialized, but complex objects should be JSON.stringify'd first.
         * Data persists across user sessions and device restarts.
         */
        await puter.kv.set('deployment_history', JSON.stringify(deploymentHistory));
    } catch (error) {
        console.error('Error saving deployment history:', error);
    }
}

// Add new deployment to history
function addToHistory(siteUrl, filesCount, repoUrl, repoInfo) {
    const deployment = {
        id: Date.now(),
        siteUrl: siteUrl,
        filesCount: filesCount,
        repoUrl: repoUrl,
        repoOwner: repoInfo.owner,
        repoName: repoInfo.repo,
        deployedAt: new Date().toISOString(),
        timestamp: Date.now()
    };
    
    deploymentHistory.unshift(deployment); // Add to beginning
    // Keep only last 50 deployments
    if (deploymentHistory.length > 50) {
        deploymentHistory = deploymentHistory.slice(0, 50);
    }
    
    saveDeploymentHistory();
    updateHistoryButton();
}

// Update history button text based on history count
function updateHistoryButton() {
    const count = deploymentHistory.length;
    if (count > 0) {
        historyBtn.classList.add('visible');
        historyCountBadge.textContent = count;
        historyCountBadge.style.display = 'flex';
    } else {
        historyBtn.classList.remove('visible');
        historyCountBadge.style.display = 'none';
    }
}

// Show deployment history modal
function showHistoryModal() {
    renderHistoryList();
    historyModalOverlay.classList.add('show');
}

// Render the history list in the modal
function renderHistoryList() {
    if (deploymentHistory.length === 0) {
        historyList.innerHTML = `
            <div class="empty-history">
                <div class="icon">🚀</div>
                <p>No deployments yet</p>
                <p style="font-size: 0.8rem; margin-top: 0.5rem;">Your deployment history will appear here</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = deploymentHistory.map(deployment => {
        const date = new Date(deployment.deployedAt);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        return `
            <div class="history-item">
                <div class="history-item-header">
                    <a href="${deployment.siteUrl}" target="_blank" class="history-item-url">
                        ${deployment.siteUrl}
                    </a>
                    <span class="history-item-date">${formattedDate}</span>
                </div>
                <div class="history-item-details">
                    <div class="history-detail">
                        <span class="icon">📁</span>
                        <span class="label">Files:</span>
                        <span class="value">${deployment.filesCount}</span>
                    </div>
                    <div class="history-detail">
                        <span class="icon">📂</span>
                        <span class="label">Repo:</span>
                        <span class="value">${deployment.repoOwner}/${deployment.repoName}</span>
                    </div>
                    <div class="history-repo-url">
                        <a href="${deployment.repoUrl}" target="_blank">
                            <span class="icon">🔗</span> ${deployment.repoUrl}
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Close history modal
function closeHistoryModal() {
    historyModalOverlay.classList.remove('show');
}

// Clear deployment history
async function clearHistory() {
    if (confirm('Are you sure you want to clear your deployment history? This cannot be undone.')) {
        deploymentHistory = [];
        
        /**
         * PUTER SDK: Key-Value Store - Deleting Data
         * Use puter.kv.del() to remove a key and its associated value from storage.
         * This is useful for cleaning up user data or resetting app state.
         * Once deleted, the data cannot be recovered unless you have a backup.
         */
        await puter.kv.del('deployment_history');
        updateHistoryButton();
        renderHistoryList();
    }
}

function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status-bar ${type}`;
    statusDiv.style.display = 'block';
}

function hideStatus() {
    statusDiv.style.display = 'none';
}

function parseGitHubUrl(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname !== 'github.com') return null;
        const pathParts = urlObj.pathname.split('/').filter(part => part);
        if (pathParts.length < 2) return null;
        return { owner: pathParts[0], repo: pathParts[1].replace('.git', '') };
    } catch { 
        return null; 
    }
}

async function ensureAuthenticated() {
    try {
        /**
         * PUTER SDK: Authentication - Checking Sign-in Status
         * puter.auth.isSignedIn() checks if the user is currently authenticated.
         * This is useful for conditionally showing UI elements or enabling features
         * that require authentication.
         */
        if (!puter.auth.isSignedIn()) {
            showStatus('Please sign in to Puter...', 'info');
            
            /**
             * PUTER SDK: Authentication - Sign-in Flow
             * puter.auth.signIn() launches the Puter authentication flow.
             * This presents a modal dialog for the user to sign in with their Puter account.
             * The function returns a Promise that resolves when authentication is complete.
             * If the user cancels, the Promise will reject with an error.
             */
            await puter.auth.signIn();
            showStatus('Successfully signed in!', 'success');
            setTimeout(hideStatus, 2000);
        }
        
        /**
         * PUTER SDK: Authentication - User Information
         * puter.auth.getUser() retrieves information about the currently signed-in user.
         * This includes properties like username, email, and user ID.
         * Useful for personalizing the UI or storing user-specific data.
         */
        const user = await puter.auth.getUser();
        console.log('User authenticated:', user.username);
    } catch (error) {
        const message = error.message && error.message.toLowerCase().includes('cancel') ? 
                        'Sign-in cancelled.' : 
                        `Authentication failed: ${error.message}`;
        showStatus(message, 'error');
        throw new Error(message);
    }
}

async function getRepositoryFiles(repoInfo) {
    try {
        /**
         * PUTER SDK: Networking - HTTP Requests
         * puter.net.fetch() works similarly to the browser's native fetch API but with
         * added benefits like automatic CORS handling and integration with Puter's auth system.
         * Use it to make HTTP requests to external APIs and services from your app.
         * The API follows the same pattern as the standard fetch() with similar response methods.
         */
        const treeResponse = await puter.net.fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/main?recursive=1`);
        if (!treeResponse.ok) {
            throw new Error(`Failed to fetch repository structure: ${treeResponse.statusText} (Status: ${treeResponse.status})`);
        }
        const treeData = await treeResponse.json();
        if (!treeData.tree) {
            throw new Error('Repository tree is empty or invalid. Ensure the `main` branch exists and is not empty.');
        }
        // Filter to only get blob files (not directories) and return their paths
        return treeData.tree.filter(item => item.type === 'blob').map(item => item.path);
    } catch (error) {
        console.error('Error fetching repository files:', error);
        throw error;
    }
}

async function deployRepository(repoInfo) {
    const originalBtnHTML = deployBtn.innerHTML;
    
    try {
        deployBtn.disabled = true;
        repoUrlInput.disabled = true;

        deployBtn.innerHTML = '<span class="loading-spinner"></span>Authenticating...';
        // Ensure user is signed in to Puter before proceeding
        await ensureAuthenticated();
        
        deployBtn.innerHTML = '<span class="loading-spinner"></span>Analyzing repository...';
        showStatus('Analyzing repository structure...', 'info');
        // Get list of all files in the repository
        const allFiles = await getRepositoryFiles(repoInfo);
        
        if (allFiles.length === 0) {
            throw new Error('Could not access repository, repository is empty, or `main` branch does not exist.');
        }

        /**
         * PUTER SDK: Utilities - Random Name Generator
         * puter.randName() generates a random, human-readable name that can be used
         * for subdomains, file names, or any other identifier.
         * The generated names are typically two words joined together (like 'happyelephant').
         * This is useful for creating unique identifiers that are still readable by humans.
         */
        const randomSubdomain = puter.randName();
        showStatus(`Preparing deployment to ${randomSubdomain}.puter.site...`, 'info');

        // Create a directory in user's Puter drive to store the repository files
        const dirName = `gh-deploy-${repoInfo.owner}-${repoInfo.repo}-${Date.now()}`;
        
        /**
         * PUTER SDK: File System - Creating Directories
         * puter.fs.mkdir() creates a new directory in the user's Puter drive.
         * It returns a Promise that resolves to an object containing information about the created directory.
         * This is part of Puter's virtual file system that gives your web app access to persistent storage.
         * The returned object includes properties like 'path', which gives the full path to the new directory.
         */
        const createdDir = await puter.fs.mkdir(dirName);
        const targetPath = createdDir.path;
        
        const baseUrl = `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/main`;
        let downloadedFilesCount = 0;
        
        // Download each file from the repository and save to Puter drive
        for (let i = 0; i < allFiles.length; i++) {
            const file = allFiles[i];
            deployBtn.innerHTML = `<span class="loading-spinner"></span>Downloading ${i + 1}/${allFiles.length}...`;
            showStatus(`Downloading ${file}... (${i + 1}/${allFiles.length})`, 'info');
            
            try {
                /**
                 * PUTER SDK: Networking - Fetching Binary Data
                 * Here we're using puter.net.fetch() again, but this time to download file content.
                 * The response.blob() method is used to handle binary data like images or other non-text files.
                 */
                const response = await puter.net.fetch(`${baseUrl}/${file}`);
                if (response.ok) {
                    const content = await response.blob();
                    const filePath = `${targetPath}/${file}`;
                    
                    /**
                     * PUTER SDK: File System - Writing Files
                     * puter.fs.write() saves content to a file in the user's Puter drive.
                     * Parameters:
                     * 1. Path: Where to save the file (can include directories)
                     * 2. Content: The data to write (can be string, Blob, ArrayBuffer, etc.)
                     * 3. Options: Additional settings like:
                     *    - overwrite: Whether to replace existing files
                     *    - createMissingParents: Automatically create parent directories if they don't exist
                     * 
                     * This powerful function handles both text and binary data and can create
                     * complex directory structures automatically.
                     */
                    await puter.fs.write(filePath, content, { 
                        overwrite: true, 
                        createMissingParents: true 
                    });
                    downloadedFilesCount++;
                } else {
                    console.warn(`Could not download ${file}: HTTP ${response.status}`);
                }
            } catch (error) {
                console.warn(`Error downloading ${file}:`, error.message);
            }
        }
        
        if (downloadedFilesCount === 0) {
            throw new Error('No files could be downloaded from the repository.');
        }
        
        deployBtn.innerHTML = '<span class="loading-spinner"></span>Creating hosted site...';
        showStatus(`Downloaded ${downloadedFilesCount} files. Creating hosted site...`, 'info');
        
        /**
         * PUTER SDK: Hosting - Creating a Hosted Site
         * puter.hosting.create() deploys a static website from files in the user's Puter drive.
         * Parameters:
         * 1. Subdomain: The subdomain for the site (will be available at subdomain.puter.site)
         * 2. Directory: The directory containing the website files to host
         * 
         * This powerful feature lets your app create hosted websites with just one line of code.
         * The hosted sites are served from Puter's CDN and can be accessed by anyone on the internet.
         * Perfect for deploying static sites, portfolios, documentation, or any web content.
         */
        await puter.hosting.create(randomSubdomain, dirName);
        
        const siteUrl = `https://${randomSubdomain}.puter.site`;
        
        // Add deployment to history
        addToHistory(siteUrl, downloadedFilesCount, `https://github.com/${repoInfo.owner}/${repoInfo.repo}`, repoInfo);
        
        showSuccessModal(siteUrl);
        
    } catch (error) {
        showStatus(`Deployment failed: ${error.message}`, 'error');
        console.error('Deployment error:', error);
    } finally {
        deployBtn.innerHTML = originalBtnHTML;
        deployBtn.disabled = false;
        repoUrlInput.disabled = false;
    }
}

function showSuccessModal(siteUrl) {
    siteUrlElement.href = siteUrl;
    siteUrlElement.textContent = siteUrl;
    visitSiteBtn.onclick = () => window.open(siteUrl, '_blank');
    modalOverlay.classList.add('show');
    hideStatus();
}

function closeModal() {
    modalOverlay.classList.remove('show');
}

// History button event listener
historyBtn.addEventListener('click', showHistoryModal);

document.getElementById('deployForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const repoUrl = repoUrlInput.value.trim();
    if (!repoUrl) {
        showStatus('Please enter a GitHub repository URL.', 'error');
        return;
    }

    const repoInfo = parseGitHubUrl(repoUrl);
    if (!repoInfo) {
        showStatus('Invalid GitHub URL format. Example: https://github.com/owner/repo', 'error');
        return;
    }

    await deployRepository(repoInfo);
});

// Close modal when clicking outside of it
modalOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

// Close history modal when clicking outside of it
historyModalOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeHistoryModal();
});

// Initial setup when page loads
document.addEventListener('DOMContentLoaded', async function() {
    // Load deployment history on page load
    await loadDeploymentHistory();
    
    try {
        /**
         * PUTER SDK: Authentication - Checking Initial State
         * On page load, we check if the user is already signed in from a previous session.
         * This is a common pattern in Puter apps - check auth state when the app starts
         * and provide a personalized experience for returning users.
         */
        if (puter.auth.isSignedIn()) {
            const user = await puter.auth.getUser();
            showStatus(`👋 Welcome, ${user.username}! Ready to deploy.`, 'success');
            setTimeout(hideStatus, 3000);
        } else {
            showStatus('Ready to deploy! You\'ll be prompted to sign in when needed.', 'info');
            setTimeout(hideStatus, 4000);
        }
    } catch (error) {
        console.error('Initial auth check error:', error);
    }
});