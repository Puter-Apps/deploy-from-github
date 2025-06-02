const repoUrlInput = document.getElementById('repoUrl');
const deployBtn = document.getElementById('deployBtn');
const historyBtn = document.getElementById('historyBtn');
const historyCountBadge = document.getElementById('historyCount');
const statusDiv = document.getElementById('status');
const modalOverlay = document.getElementById('modalOverlay');
const modalSubtitle = document.getElementById('modalSubtitle');
const historyModalOverlay = document.getElementById('historyModalOverlay');
const historyList = document.getElementById('historyList');
const siteUrlElement = document.getElementById('siteUrl');
const visitSiteBtn = document.getElementById('visitSiteBtn');

let deploymentHistory = [];

async function loadDeploymentHistory() {
    try {
        await ensureAuthenticated();
        const historyData = await puter.kv.get('deployment_history_v2');
        if (historyData) {
            deploymentHistory = JSON.parse(historyData);
        }
        updateHistoryButton();
    } catch (error) {
        console.error('Error loading deployment history:', error);
        deploymentHistory = [];
    }
}

async function saveDeploymentHistory() {
    try {
        await puter.kv.set('deployment_history_v2', JSON.stringify(deploymentHistory));
    } catch (error) {
        console.error('Error saving deployment history:', error);
    }
}

function addToHistory(siteUrl, filesCount, originalRepoUrl, repoDetails) {
    const deployment = {
        id: Date.now(),
        siteUrl: siteUrl,
        filesCount: filesCount,
        repoUrl: originalRepoUrl,
        repoOwner: repoDetails.owner,
        repoName: repoDetails.repo,
        deployedAt: new Date().toISOString(),
        timestamp: Date.now()
    };
    
    deploymentHistory.unshift(deployment);
    if (deploymentHistory.length > 50) {
        deploymentHistory = deploymentHistory.slice(0, 50);
    }
    
    saveDeploymentHistory();
    updateHistoryButton();
}

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

function showHistoryModal() {
    renderHistoryList();
    historyModalOverlay.classList.add('show');
}

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

function closeHistoryModal() {
    historyModalOverlay.classList.remove('show');
}

async function clearHistory() {
    if (confirm('Are you sure you want to clear your deployment history? This cannot be undone.')) {
        deploymentHistory = [];
        await puter.kv.del('deployment_history_v2');
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

async function ensureAuthenticated() {
    try {
        if (!puter.auth.isSignedIn()) {
            showStatus('Please sign in to Puter...', 'info');
            await puter.auth.signIn();
            showStatus('Successfully signed in!', 'success');
            setTimeout(hideStatus, 2000);
        }
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

async function getRepositoryFiles(repoUrlString) {
    try {
        console.log(`Attempting to fetch files from: ${repoUrlString}`);
        
        const urlParts = new URL(repoUrlString);
        const pathParts = urlParts.pathname.split('/').filter(part => part);
        if (pathParts.length < 2) {
            throw new Error('Invalid GitHub URL format. Please provide a valid repository URL.');
        }
        
        const owner = pathParts[0];
        const repo = pathParts[1].replace(/\.git$/, '');
        console.log(`Extracted - Owner: "${owner}", Repo: "${repo}"`);
        
        const branchesToTry = ['main', 'master', 'dev', 'develop'];
        let workingBranch = null;
        let filesList = [];
        
        for (const branch of branchesToTry) {
            try {
                console.log(`Testing branch: ${branch}`);
                const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
                console.log(`API URL: ${apiUrl}`);
                
                const treeResponse = await fetch(apiUrl);
                
                if (treeResponse.ok) {
                    const treeData = await treeResponse.json();
                    if (treeData.tree && treeData.tree.length > 0) {
                        workingBranch = branch;
                        filesList = treeData.tree.filter(item => item.type === 'blob').map(item => item.path);
                        console.log(`✅ Found branch: ${branch} with ${filesList.length} files`);
                        const exampleFiles = filesList.slice(0, 5);
                        console.log(`Example files: ${exampleFiles.join(', ')}`);
                        break;
                    }
                } else {
                    console.log(`❌ Branch ${branch} returned: ${treeResponse.status} ${treeResponse.statusText}`);
                }
            } catch (branchError) {
                console.log(`❌ Error testing branch ${branch}:`, branchError.message);
                continue;
            }
        }
        
        if (!workingBranch) {
            throw new Error(`Could not access repository "${owner}/${repo}". Please verify:\n• The repository exists and is public\n• The URL is correct: ${repoUrlString}\n• The repository has a main, master, dev, or develop branch`);
        }
        
        if (filesList.length === 0) {
            throw new Error(`Repository "${owner}/${repo}" (branch: ${workingBranch}) appears to be empty.`);
        }
        
        console.log(`🎉 Successfully accessed repository with ${filesList.length} files on branch: ${workingBranch}`);
        
        return {
            files: filesList,
            owner: owner,
            repo: repo,
            branch: workingBranch,
            originalUrl: repoUrlString
        };
        
    } catch (error) {
        console.error('❌ Error in getRepositoryFiles:', error);
        throw error;
    }
}

function analyzeWebFiles(filePathsArray) {
    console.log('Analyzing web files, received:', filePathsArray);
    
    if (!Array.isArray(filePathsArray)) {
        console.error('filePathsArray is not an array:', filePathsArray);
        return {
            hasRootWebFiles: false,
            bestFolder: null,
            analysis: 'Error: Invalid file list provided for analysis'
        };
    }
    
    const webExtensions = ['.html', '.css', '.js', '.htm'];
    const commonWebFolders = ['src', 'public', 'dist', 'build', 'www', 'web', 'app', 'client', 'frontend', 'site', 'docs'];
    
    const rootWebFiles = filePathsArray.filter(file => {
        const fileName = file.toLowerCase();
        return webExtensions.some(ext => fileName.endsWith(ext)) && !file.includes('/');
    });
    
    const hasIndexInRoot = rootWebFiles.some(file => 
        file.toLowerCase() === 'index.html' || file.toLowerCase() === 'index.htm'
    );
    
    if (hasIndexInRoot && rootWebFiles.length >= 1) {
        return {
            hasRootWebFiles: true,
            bestFolder: null,
            analysis: 'Root directory contains index.html (and possibly other web files)'
        };
    }
    
    const folderScores = {};
    
    for (const folder of commonWebFolders) {
        const folderFiles = filePathsArray.filter(file => file.startsWith(folder + '/'));
        const folderWebFiles = folderFiles.filter(file => {
            const fileName = file.toLowerCase();
            return webExtensions.some(ext => fileName.endsWith(ext));
        });
        
        if (folderWebFiles.length > 0) {
            let score = folderWebFiles.length;
            const hasIndex = folderWebFiles.some(file => {
                const fileName = file.toLowerCase().split('/').pop();
                return fileName === 'index.html' || fileName === 'index.htm';
            });
            if (hasIndex) score += 10;
            if (folderWebFiles.some(file => file.toLowerCase().endsWith('.css'))) score += 3;
            if (folderWebFiles.some(file => file.toLowerCase().endsWith('.js'))) score += 3;
            const maxDepth = Math.max(0, ...folderFiles.map(file => file.split('/').length - (folder.split('/').length)));
            if (maxDepth > 2) score -= (maxDepth - 2); // Penalty for nesting beyond 2 levels inside the chosen folder

            folderScores[folder] = {
                score: score,
                webFileCount: folderWebFiles.length,
                hasIndex: hasIndex,
                files: folderWebFiles
            };
        }
    }
    
    const bestFolder = Object.keys(folderScores).reduce((best, current) => {
        if (!best) return current;
        return folderScores[current].score > folderScores[best].score ? current : best;
    }, null);
    
    if (!bestFolder && rootWebFiles.length > 0) {
        return {
            hasRootWebFiles: true,
            bestFolder: null,
            analysis: 'Using root directory with available web files (no specific index.html found in root, but other web files exist)'
        };
    }
    
    return {
        hasRootWebFiles: false,
        bestFolder: bestFolder,
        analysis: bestFolder ? 
            `Best folder: ${bestFolder} (${folderScores[bestFolder].webFileCount} web files, index: ${folderScores[bestFolder].hasIndex})` :
            'No suitable web folder found'
    };
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function deployRepository(repoUrlString) {
    const originalBtnHTML = deployBtn.innerHTML;
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1500;
    
    try {
        deployBtn.disabled = true;
        repoUrlInput.disabled = true;

        deployBtn.innerHTML = '<span class="loading-spinner"></span>Authenticating...';
        await ensureAuthenticated();
        
        deployBtn.innerHTML = '<span class="loading-spinner"></span>Fetching repository data...';
        showStatus('Fetching repository data...', 'info');
        const repoData = await getRepositoryFiles(repoUrlString);
        
        if (!repoData || !repoData.files || repoData.files.length === 0) {
            throw new Error('Could not access repository, repository is empty, or a common branch (main/master/dev/develop) does not exist.');
        }

        deployBtn.innerHTML = '<span class="loading-spinner"></span>Analyzing repository...';
        showStatus('Analyzing repository structure...', 'info');
        const webAnalysis = analyzeWebFiles(repoData.files); 
        console.log('Web Analysis Result:', webAnalysis);

        let filesToDeployPaths;
        let sourceFolder = '';
        
        if (webAnalysis.hasRootWebFiles) {
            filesToDeployPaths = repoData.files;
            sourceFolder = '';
            showStatus('✅ Web files found in repository root. Deploying root.', 'success');
        } else if (webAnalysis.bestFolder) {
            sourceFolder = webAnalysis.bestFolder;
            filesToDeployPaths = repoData.files.filter(file => file.startsWith(sourceFolder + '/'));
            showStatus(`✅ Web files found in /${sourceFolder}/ folder. Deploying this folder.`, 'success');
        } else {
            throw new Error('No web files (HTML, CSS, JS) found in this repository. This doesn\'t appear to be a web project.');
        }

        if (!filesToDeployPaths || filesToDeployPaths.length === 0) {
            throw new Error(`No files found in the selected deployment source: ${sourceFolder || 'root'}`);
        }

        const randomSubdomain = puter.randName();
        showStatus(`Preparing deployment to ${randomSubdomain}.puter.site...`, 'info');

        const puterDirName = `gh-deploy-${repoData.owner}-${repoData.repo}-${Date.now()}`;
        const createdDir = await puter.fs.mkdir(puterDirName);
        const targetPuterPathBase = createdDir.path;
        
        let downloadedFilesCount = 0;
        let failedFileDownloads = [];
        
        for (let i = 0; i < filesToDeployPaths.length; i++) {
            const filePathInRepo = filesToDeployPaths[i];
            deployBtn.innerHTML = `<span class="loading-spinner"></span>Downloading ${i + 1}/${filesToDeployPaths.length}...`;
            showStatus(`Downloading ${filePathInRepo}... (${i + 1}/${filesToDeployPaths.length})`, 'info');
            
            let success = false;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const rawUrl = `https://raw.githubusercontent.com/${repoData.owner}/${repoData.repo}/${repoData.branch}/${filePathInRepo}`;
                    console.log(`Downloading: ${rawUrl} (Attempt ${attempt})`);
                    
                    const response = await puter.net.fetch(rawUrl);
                    if (response.ok) {
                        const content = await response.blob();
                        const relativePathForPuter = sourceFolder ? filePathInRepo.substring(sourceFolder.length + 1) : filePathInRepo;
                        const finalPuterPath = `${targetPuterPathBase}/${relativePathForPuter}`;
                        
                        await puter.fs.write(finalPuterPath, content, { 
                            overwrite: true, 
                            createMissingParents: true 
                        });
                        downloadedFilesCount++;
                        success = true;
                        console.log(`Successfully downloaded ${filePathInRepo}`);
                        break; 
                    } else {
                        console.warn(`Could not download ${filePathInRepo} (Attempt ${attempt}): HTTP ${response.status} ${response.statusText || ''}`);
                        if (attempt < MAX_RETRIES) {
                            showStatus(`Download failed for ${filePathInRepo} (HTTP ${response.status}). Retrying (${attempt}/${MAX_RETRIES})...`, 'info');
                            await delay(RETRY_DELAY_MS * attempt); 
                        }
                    }
                } catch (error) {
                    let errorMessage = "Unknown fetch error";
                    if (error && typeof error === 'object' && error.statusText) {
                        errorMessage = `Fetch error ${error.status || ''}: ${error.statusText}`;
                    } else if (error && error.message) {
                        errorMessage = error.message;
                    } else if (typeof error === 'string') {
                        errorMessage = error;
                    } else {
                        errorMessage = JSON.stringify(error); // Fallback for unusual error types
                    }
                    console.warn(`Error downloading ${filePathInRepo} (Attempt ${attempt}):`, errorMessage, error);
                    if (attempt < MAX_RETRIES) {
                        showStatus(`Download error for ${filePathInRepo}. Retrying (${attempt}/${MAX_RETRIES})...`, 'info');
                        await delay(RETRY_DELAY_MS * attempt);
                    }
                }
            } 

            if (!success) {
                console.error(`Failed to download ${filePathInRepo} after ${MAX_RETRIES} attempts.`);
                failedFileDownloads.push(filePathInRepo);
            }
        } 
        
        if (downloadedFilesCount === 0 && filesToDeployPaths.length > 0) {
            throw new Error('No files could be downloaded from the repository after multiple retries.');
        }

        let deploymentMessage = `Creating hosted site with ${downloadedFilesCount} files...`;
        if (failedFileDownloads.length > 0) {
            deploymentMessage = `Downloaded ${downloadedFilesCount} files. ${failedFileDownloads.length} files failed. Proceeding...`;
            showStatus(deploymentMessage, 'info');
            await delay(2000); 
        }
        
        deployBtn.innerHTML = '<span class="loading-spinner"></span>Creating hosted site...';
        showStatus(deploymentMessage, 'info');
        
        await puter.hosting.create(randomSubdomain, puterDirName);
        
        const siteUrl = `https://${randomSubdomain}.puter.site`;
        
        addToHistory(siteUrl, downloadedFilesCount, repoData.originalUrl, { owner: repoData.owner, repo: repoData.repo });
        
        showSuccessModal(siteUrl, failedFileDownloads); // Pass failed files to modal
        
    } catch (error) {
        showStatus(`Deployment failed: ${error.message}`, 'error');
        console.error('Deployment error:', error);
    } finally {
        deployBtn.innerHTML = originalBtnHTML;
        deployBtn.disabled = false;
        repoUrlInput.disabled = false;
    }
}

function showSuccessModal(siteUrl, failedDownloads = []) {
    siteUrlElement.href = siteUrl;
    siteUrlElement.textContent = siteUrl;
    visitSiteBtn.onclick = () => window.open(siteUrl, '_blank');
    
    let subtitleText = "Your repository is now live on the web";
    if (failedDownloads.length > 0) {
        subtitleText += `<br><small style='color: #f97316; display: block; margin-top: 0.5rem;'>Warning: ${failedDownloads.length} file(s) could not be downloaded and might be missing from your site.</small>`;
    }
    modalSubtitle.innerHTML = subtitleText;

    modalOverlay.classList.add('show');
    hideStatus();
}

function closeModal() {
    modalOverlay.classList.remove('show');
     // Reset subtitle for next time
    modalSubtitle.innerHTML = "Your repository is now live on the web";
}

historyBtn.addEventListener('click', showHistoryModal);

document.getElementById('deployForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    hideStatus(); 
    
    const repoUrl = repoUrlInput.value.trim();
    if (!repoUrl) {
        showStatus('Please enter a GitHub repository URL.', 'error');
        return;
    }

    if (!repoUrl.includes('github.com')) {
        showStatus('Please enter a valid GitHub repository URL (must be from github.com).', 'error');
        return;
    }

    await deployRepository(repoUrl);
});

modalOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

historyModalOverlay.addEventListener('click', function(e) {
    if (e.target === this) closeHistoryModal();
});

document.addEventListener('DOMContentLoaded', async function() {
    await loadDeploymentHistory();
    try {
        if (puter.auth.isSignedIn()) {
            const user = await puter.auth.getUser();
            // Don't show status on load to avoid interfering with potential deployment messages
            // showStatus(`👋 Welcome, ${user.username}! Ready to deploy.`, 'info');
            // setTimeout(hideStatus, 3000);
            console.log(`User ${user.username} is signed in.`);
        } else {
            // showStatus('Ready to deploy! You\'ll be prompted to sign in when needed.', 'info');
            // setTimeout(hideStatus, 4000);
            console.log('User not signed in. Will prompt if needed.');
        }
    } catch (error) {
        console.error('Initial auth check error:', error);
    }
});