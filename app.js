/**
 * Enterprise Gender Sorting App
 * Handles model loading, image processing, and zip generation.
 */

// Configuration
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
const CONFIDENCE_THRESHOLD = 0.6; // Minimum confidence to classify gender

// Application State
const state = {
    isModelsLoaded: false,
    files: [],
    processedCount: 0,
    results: {
        male: [],
        female: [],
        unknown: [] // Includes no-face or low confidence
    },
    zipBlob: null
};

// UI Elements
const ui = {
    statusBanner: document.getElementById('system-status'),
    statusText: document.getElementById('status-text'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    dashboard: document.getElementById('dashboard'),
    progressBar: document.getElementById('progress-bar-fill'),
    progressText: document.getElementById('progress-percentage'),
    counts: {
        male: document.getElementById('count-male'),
        female: document.getElementById('count-female'),
        unknown: document.getElementById('count-unknown')
    },
    downloadBtn: document.getElementById('download-btn'),
    resetBtn: document.getElementById('reset-btn')
};

// --- Initialization ---

async function init() {
    try {
        // Load TinyFaceDetector (faster) and AgeGenderNet
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
        ]);
        
        state.isModelsLoaded = true;
        updateStatus('ready', 'AI Models Ready');
    } catch (error) {
        console.error("Model Load Error:", error);
        updateStatus('error', 'Failed to load AI models. Check connection.');
    }
}

// --- Event Listeners ---

ui.dropZone.addEventListener('click', () => ui.fileInput.click());

ui.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    ui.dropZone.classList.add('drag-over');
});

ui.dropZone.addEventListener('dragleave', () => {
    ui.dropZone.classList.remove('drag-over');
});

ui.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    ui.dropZone.classList.remove('drag-over');
    if (state.isModelsLoaded) handleFiles(e.dataTransfer.files);
});

ui.fileInput.addEventListener('change', (e) => {
    if (state.isModelsLoaded) handleFiles(e.target.files);
});

ui.downloadBtn.addEventListener('click', downloadZip);
ui.resetBtn.addEventListener('click', resetApp);

// --- Core Logic ---

function handleFiles(fileList) {
    const validFiles = Array.from(fileList).filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
        alert("Please upload valid image files (JPG, PNG).");
        return;
    }

    state.files = validFiles;
    
    // Switch UI to processing mode
    ui.dropZone.classList.add('hidden');
    ui.dashboard.classList.remove('hidden');
    ui.downloadBtn.disabled = true;
    ui.downloadBtn.innerText = "Processing...";

    processImages();
}

async function processImages() {
    // Create an invisible image element for processing
    const imgEl = document.createElement('img');
    
    for (const file of state.files) {
        try {
            const gender = await detectGender(file, imgEl);
            
            // Store file in appropriate category
            state.results[gender].push(file);
            
            // Update UI
            state.processedCount++;
            updateProgress();
            
        } catch (err) {
            console.warn(`Could not process ${file.name}`, err);
            state.results.unknown.push(file);
        }
    }

    // Finished
    await prepareDownload();
}

/**
 * Detects gender for a single file.
 * Returns: 'male', 'female', or 'unknown'
 */
async function detectGender(file, imgElement) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            imgElement.src = e.target.result;
            
            // Wait for image decode
            await imgElement.decode();
            
            // Run Detection
            // Using TinyFaceDetector options for speed
            const detection = await faceapi.detectSingleFace(
                imgElement, 
                new faceapi.TinyFaceDetectorOptions()
            ).withAgeAndGender();

            if (!detection) {
                resolve('unknown');
                return;
            }

            const { gender, genderProbability } = detection;

            // Strict threshold
            if (genderProbability < CONFIDENCE_THRESHOLD) {
                resolve('unknown');
            } else {
                resolve(gender);
            }
        };

        reader.onerror = () => resolve('unknown');
        reader.readAsDataURL(file);
    });
}

async function prepareDownload() {
    ui.downloadBtn.innerText = "Generating Zip...";
    
    const zip = new JSZip();
    
    // Add files to folders
    state.results.male.forEach(file => zip.folder("Boys").file(file.name, file));
    state.results.female.forEach(file => zip.folder("Girls").file(file.name, file));
    state.results.unknown.forEach(file => zip.folder("Unsorted").file(file.name, file));

    // Generate Zip Blob
    state.zipBlob = await zip.generateAsync({ type: "blob" });
    
    ui.downloadBtn.innerText = "Download Sorted Images";
    ui.downloadBtn.disabled = false;
}

function downloadZip() {
    if (!state.zipBlob) return;
    
    const url = URL.createObjectURL(state.zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "sorted_images.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- UI Helpers ---

function updateStatus(type, message) {
    ui.statusBanner.className = `status-banner ${type}`;
    ui.statusText.innerText = message;
    
    if (type === 'ready') {
        ui.statusBanner.querySelector('.spinner').style.display = 'none';
    }
}

function updateProgress() {
    const percent = Math.round((state.processedCount / state.files.length) * 100);
    ui.progressBar.style.width = `${percent}%`;
    ui.progressText.innerText = `${percent}%`;
    
    ui.counts.male.innerText = state.results.male.length;
    ui.counts.female.innerText = state.results.female.length;
    ui.counts.unknown.innerText = state.results.unknown.length;
}

function resetApp() {
    // Reset State
    state.files = [];
    state.processedCount = 0;
    state.results = { male: [], female: [], unknown: [] };
    state.zipBlob = null;
    
    // Reset UI
    ui.dropZone.classList.remove('hidden');
    ui.dashboard.classList.add('hidden');
    ui.fileInput.value = '';
    
    updateProgress(); // Reset counters visually
}

// Start app
init();
