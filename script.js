// グローバル変数の初期化
window.selectedSize = 'a4'; // デフォルトサイズ
let selectedFormat = 'pdf'; // デフォルト出力形式
let outputQuality = 0.8; // デフォルト品質
let htmlContent = ''; // HTML内容の保存用
window.isSlideFormat = false; // スライド形式フラグ
window.freezeAnimations = false; // アニメーション停止フラグ

// 出力サイズの定義
const outputSizes = {
    'a4': { width: 595, height: 842 },
    'letter': { width: 612, height: 792 },
    'custom': { width: 800, height: 600 }
    // 他のサイズも必要に応じて追加
};

// 画像キャッシュの初期化
const imageCache = new Map();

// サイズ選択関数
function selectSize(size) {
    window.selectedSize = size;
    document.querySelectorAll('.size-button').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById(`size-${size}`).classList.add('selected');
}

// 形式選択関数
function selectFormat(format) {
    selectedFormat = format;
    document.querySelectorAll('.format-button').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById(`format-${format}`).classList.add('selected');
    
    // 品質スライダーの表示切り替え
    document.getElementById('quality-options').style.display = 
        format === 'jpg' ? 'block' : 'none';
}

// Enhanced status notification system
function updateStatus(message, type = 'info', showSpinner = false) {
    const statusMessage = document.getElementById('status-message');
    statusMessage.innerHTML = '';
    
    if (showSpinner) {
        const spinner = document.createElement('span');
        spinner.className = 'loading-spinner';
        statusMessage.appendChild(spinner);
        statusMessage.appendChild(document.createTextNode(' ' + message));
    } else {
        statusMessage.textContent = message;
    }
    
    statusMessage.className = type;
    statusMessage.classList.remove('hidden');
}

// Progress indicator for multi-page conversions
function createProgressBar() {
    const progressContainer = document.createElement('div');
    progressContainer.id = 'progress-container';
    progressContainer.style.width = '100%';
    progressContainer.style.height = '8px';
    progressContainer.style.backgroundColor = 'var(--gray-light)';
    progressContainer.style.borderRadius = '4px';
    progressContainer.style.marginTop = '10px';
    progressContainer.style.overflow = 'hidden';
    
    const progressBar = document.createElement('div');
    progressBar.id = 'progress-bar';
    progressBar.style.width = '0%';
    progressBar.style.height = '100%';
    progressBar.style.backgroundColor = 'var(--primary)';
    progressBar.style.transition = 'width 0.3s ease';
    
    progressContainer.appendChild(progressBar);
    return progressContainer;
}

// Update progress bar
function updateProgress(current, total) {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        const percentage = Math.round((current / total) * 100);
        progressBar.style.width = `${percentage}%`;
    }
}

// Faster image processing function
async function processImage(img, originalSrc) {
    // Check cache first
    if (imageCache.has(originalSrc)) {
        return imageCache.get(originalSrc);
    }
    
    // Try to use uploaded images
    const imageName = originalSrc.split('/').pop();
    if (window.uploadedImages && window.uploadedImages[imageName]) {
        imageCache.set(originalSrc, window.uploadedImages[imageName]);
        return window.uploadedImages[imageName];
    }
    
    // Otherwise load and convert to data URL
    return new Promise((resolve, reject) => {
        const imgElement = new Image();
        imgElement.crossOrigin = 'anonymous';
        
        imgElement.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = imgElement.width;
                canvas.height = imgElement.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgElement, 0, 0);
                const dataURL = canvas.toDataURL('image/png');
                imageCache.set(originalSrc, dataURL);
                resolve(dataURL);
            } catch (error) {
                console.error('Image conversion error:', error);
                reject(error);
            }
        };
        
        imgElement.onerror = () => reject(new Error(`Failed to load image: ${originalSrc}`));
        
        // Convert relative paths if needed
        let imgSrc = originalSrc;
        if (imgSrc.startsWith('./')) {
            imgSrc = imgSrc.substring(2);
        }
        
        imgElement.src = imgSrc;
        
        // Set timeout for loading
        setTimeout(() => {
            if (!imgElement.complete) {
                imgElement.src = '';
                reject(new Error(`Image loading timed out: ${imgSrc}`));
            }
        }, 3000);
    });
}

// Optimized preloading for images
async function preloadImages(htmlContent) {
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = htmlContent;
    
    // Get all image elements
    const images = tempContainer.querySelectorAll('img');
    const totalImages = images.length;
    
    if (totalImages === 0) {
        return htmlContent;
    }
    
    updateStatus(`Loading images... (0/${totalImages})`, 'info', true);
    
    // Add progress bar
    const statusMessage = document.getElementById('status-message');
    const progressContainer = createProgressBar();
    statusMessage.appendChild(progressContainer);
    
    // Process images in parallel with limit
    const concurrentLimit = navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 2;
    let processedCount = 0;
    let failedCount = 0;
    const imageMap = new Map();
    
    // Process in batches
    for (let i = 0; i < totalImages; i += concurrentLimit) {
        const batch = Array.from(images).slice(i, i + concurrentLimit);
        const promises = batch.map(async (img) => {
            const originalSrc = img.getAttribute('src');
            if (!originalSrc || originalSrc.startsWith('data:') || originalSrc.startsWith('blob:')) {
                return;
            }
            
            try {
                const dataURL = await processImage(img, originalSrc);
                imageMap.set(originalSrc, dataURL);
                processedCount++;
            } catch (error) {
                console.warn('Image processing error:', error);
                failedCount++;
            } finally {
                // Update progress
                updateStatus(`Loading images... (${processedCount}/${totalImages})`, 'info', true);
                updateProgress(processedCount + failedCount, totalImages);
            }
        });
        
        await Promise.all(promises);
    }
    
    // Replace image paths with data URLs
    let processedHTML = htmlContent;
    imageMap.forEach((dataURL, originalSrc) => {
        const escapedSrc = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`src=["']${escapedSrc}["']`, 'g');
        processedHTML = processedHTML.replace(regex, `src="${dataURL}"`);
    });
    
    if (failedCount > 0) {
        updateStatus(`Image processing complete. (${processedCount} loaded, ${failedCount} failed)`, 'warning');
    } else {
        updateStatus(`Image processing complete. All ${processedCount} images loaded.`, 'success');
    }
    
    return processedHTML;
}

// Enhanced file upload handling with clear feedback
async function handleFileUpload() {
    const fileInput = document.getElementById('html-file');
    const fileNameDisplay = document.getElementById('file-name');
    const previewBtn = document.getElementById('preview-btn');
    
    // Clear size info
    document.getElementById('size-info').textContent = '';
    window.originalWidth = null;
    window.originalHeight = null;
    
    if (fileInput.files.length === 0) {
        fileNameDisplay.textContent = '';
        previewBtn.disabled = true;
        return;
    }
    
    const file = fileInput.files[0];
    fileNameDisplay.textContent = file.name;
    updateStatus('Reading file...', 'info', true);
    
    // Get file extension
    const fileExt = file.name.split('.').pop().toLowerCase();
    
    try {
        if (fileExt === 'svg') {
            // Handle SVG files
            const content = await readFileAsText(file);
            htmlContent = content;
            
            // Extract SVG dimensions
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            const svgElement = tempDiv.querySelector('svg');
            
            if (svgElement) {
                extractSvgDimensions(svgElement);
            }
            
            previewBtn.disabled = false;
            selectFormat('svg');
            updateStatus('SVG file loaded successfully.', 'success');
            
        } else if (fileExt === 'html' || fileExt === 'htm') {
            // Handle HTML files
            const content = await readFileAsText(file);
            
            // Process uploaded images
            const processedContent = replaceUploadedImageReferences(content);
            
            // Preload images with better progress indication
            htmlContent = await preloadImages(processedContent);
            previewBtn.disabled = false;
            
            // Check for multiple pages
            checkMultiplePages(htmlContent);
            
        } else {
            // Unsupported file type
            fileNameDisplay.textContent = 'Unsupported file format';
            previewBtn.disabled = true;
            updateStatus('Error: Unsupported file format. Please select an HTML or SVG file.', 'error');
        }
    } catch (error) {
        console.error('File processing error:', error);
        updateStatus(`Error processing file: ${error.message}`, 'error');
        previewBtn.disabled = true;
    }
}

// Promise-based file reading
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(new Error('File reading failed'));
        reader.readAsText(file);
    });
}

// Extract SVG dimensions
function extractSvgDimensions(svgElement) {
    // Get width and height
    let width = svgElement.getAttribute('width');
    let height = svgElement.getAttribute('height');
    let viewBox = svgElement.getAttribute('viewBox');
    
    // Convert to numbers
    if (width) {
        width = parseFloat(width.replace('px', ''));
        window.originalWidth = width || 800;
    }
    
    if (height) {
        height = parseFloat(height.replace('px', ''));
        window.originalHeight = height || 600;
    }
    
    // Get dimensions from viewBox if needed
    if (viewBox && (!width || !height)) {
        const viewBoxValues = viewBox.split(/[\s,]+/);
        if (viewBoxValues.length >= 4) {
            if (!window.originalWidth) {
                window.originalWidth = parseFloat(viewBoxValues[2]);
            }
            if (!window.originalHeight) {
                window.originalHeight = parseFloat(viewBoxValues[3]);
            }
        }
    }
}

// Enhanced rendering preview with clear status indication
async function renderPreview() {
    const htmlPreview = document.getElementById('html-preview');
    const convertBtn = document.getElementById('convert-btn');
    const fileInput = document.getElementById('html-file');
    const sizeInfo = document.getElementById('size-info');
    
    updateStatus('Generating preview...', 'info', true);
    
    let fileExt = '';
    if (fileInput.files.length > 0) {
        fileExt = fileInput.files[0].name.split('.').pop().toLowerCase();
    }
    
    // Clear preview
    htmlPreview.innerHTML = '';
    
    // Set output size
    const outputSize = outputSizes[window.selectedSize];
    
    try {
        if (fileExt === 'svg') {
            // Handle SVG files
            htmlPreview.innerHTML = htmlContent;
            const svgElement = htmlPreview.querySelector('svg');
            
            if (svgElement) {
                // Apply selected size
                window.originalWidth = outputSize.width;
                window.originalHeight = outputSize.height;
                
                // Display size info
                sizeInfo.textContent = `Output size: ${outputSize.width} × ${outputSize.height} px`;
                
                // Set size on preview element
                htmlPreview.style.width = `${outputSize.width}px`;
                htmlPreview.style.height = `${outputSize.height}px`;
                
                // Apply styles to SVG
                svgElement.setAttribute('width', outputSize.width);
                svgElement.setAttribute('height', outputSize.height);
                svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svgElement.style.width = '100%';
                svgElement.style.height = '100%';
                svgElement.style.display = 'block';
            }
            
            updateStatus('Preview generated successfully.', 'success');
            convertBtn.disabled = false;
            
        } else {
            // Handle HTML files
            await renderHtmlPreview(htmlPreview, htmlContent, outputSize);
            sizeInfo.textContent = `Output size: ${outputSize.width} × ${outputSize.height} px`;
            
            // Adjust preview container
            const previewWrapper = document.querySelector('.preview-wrapper');
            const displayWidth = parseInt(htmlPreview.style.width);
            previewWrapper.style.maxWidth = `${displayWidth + 40}px`;
            previewWrapper.style.margin = '20px auto';
            
            updateStatus('Preview generated successfully.', 'success');
            convertBtn.disabled = false;
        }
    } catch (error) {
        console.error('Preview generation error:', error);
        updateStatus(`Error generating preview: ${error.message}`, 'error');
    }
}

// Render HTML preview with iframe
async function renderHtmlPreview(htmlPreview, content, outputSize) {
    return new Promise((resolve, reject) => {
        try {
            // Create iframe
            const contentFrame = document.createElement('iframe');
            contentFrame.style.width = '100%';
            contentFrame.style.height = '100%';
            contentFrame.style.border = 'none';
            contentFrame.style.overflow = 'hidden';
            contentFrame.id = 'content-frame';
            htmlPreview.appendChild(contentFrame);
            
            // Load content into iframe
            const frameDoc = contentFrame.contentDocument || contentFrame.contentWindow.document;
            frameDoc.open();
            frameDoc.write(content);
            frameDoc.close();
            
            // Handle animations if needed
            if (window.freezeAnimations) {
                applyFreezeAnimations(frameDoc);
            }
            
            // Wait for content to load
            setTimeout(() => {
                try {
                    // Handle slide format if detected
                    if (window.isSlideFormat) {
                        handleSlideFormatPreview(frameDoc);
                    } else {
                        // Apply scaling styles for normal HTML
                        applyScalingStyles(frameDoc);
                    }
                    
                    // Set dimensions
                    window.originalWidth = outputSize.width;
                    window.originalHeight = outputSize.height;
                    
                    // Calculate display size (scaled for browser view)
                    const { displayWidth, displayHeight } = calculateDisplaySize(
                        outputSize.width,
                        outputSize.height
                    );
                    
                    htmlPreview.style.width = `${displayWidth}px`;
                    htmlPreview.style.height = `${displayHeight}px`;
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }, 300);
            
        } catch (error) {
            reject(error);
        }
    });
}

// Apply freeze animations CSS and JS
function applyFreezeAnimations(frameDoc) {
    // Add style to freeze animations
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        * {
            animation-play-state: paused !important;
            animation-delay: -999s !important;
            transition: none !important;
        }
    `;
    frameDoc.head.appendChild(styleElement);
    
    // Add script to stop animations
    const scriptElement = document.createElement('script');
    scriptElement.textContent = `
        // Cancel timers and animations
        (function() {
            // Clear all timers
            const highestId = setTimeout(() => {}, 0);
            for (let i = 0; i < highestId; i++) {
                clearTimeout(i);
                clearInterval(i);
            }
            
            // Block requestAnimationFrame
            window.requestAnimationFrame = function() { return 0; };
            
            // Set all CSS animations to 100% state
            document.querySelectorAll('*').forEach(el => {
                const computedStyle = getComputedStyle(el);
                if (computedStyle.animationName !== 'none') {
                    el.style.animationPlayState = 'paused';
                    el.style.animationDelay = '-999s';
                }
            });
        })();
    `;
    frameDoc.body.appendChild(scriptElement);
}

// Handle slide format preview
function handleSlideFormatPreview(frameDoc) {
    const slides = getPages(frameDoc);
    if (slides.length > 0) {
        // Show only first slide
        slides.forEach((slide, index) => {
            if (index === 0) {
                slide.style.display = 'block';
                slide.style.opacity = '1';
                slide.style.position = 'relative';
                slide.style.zIndex = '2';
            } else {
                slide.style.display = 'none';
                slide.style.opacity = '0';
                slide.style.position = 'absolute';
                slide.style.zIndex = '1';
            }
        });
        
        // Add base styles for slides
        const rootStyle = document.createElement('style');
        rootStyle.textContent = `
            html, body {
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: 100% !important;
            }
        `;
        frameDoc.head.appendChild(rootStyle);
    }
}

// Apply scaling styles for normal HTML
function applyScalingStyles(frameDoc) {
    const scaleStyle = document.createElement('style');
    scaleStyle.textContent = `
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        
        body {
            font-size: 16px;
            line-height: 1.6;
        }
        
        * {
            box-sizing: border-box;
            max-width: 100%;
            word-wrap: break-word;
        }
        
        img, video, canvas, svg {
            max-width: 100%;
            height: auto;
        }
        
        table {
            table-layout: fixed;
            width: 100%;
        }
    `;
    frameDoc.head.appendChild(scaleStyle);
}

// Calculate display size based on browser constraints
function calculateDisplaySize(width, height) {
    let displayWidth = width;
    let displayHeight = height;
    
    // Consider browser viewport
    const maxWidth = window.innerWidth * 0.8;
    const maxHeight = window.innerHeight * 0.6;
    
    if (displayWidth > maxWidth) {
        const ratio = displayHeight / displayWidth;
        displayWidth = maxWidth;
        displayHeight = displayWidth * ratio;
    }
    
    if (displayHeight > maxHeight) {
        const ratio = displayWidth / displayHeight;
        displayHeight = maxHeight;
        displayWidth = displayHeight * ratio;
    }
    
    return { displayWidth, displayHeight };
}

// Enhanced conversion with clear status tracking and parallel processing
async function convertAndDownload() {
    const htmlPreview = document.getElementById('html-preview');
    const iframe = htmlPreview.querySelector('iframe');
    const fileInput = document.getElementById('html-file');
    const isSvgFile = fileInput.files.length > 0 && 
                      fileInput.files[0].name.toLowerCase().endsWith('.svg');
    
    // Get output size
    const outputSize = outputSizes[window.selectedSize];
    
    // Check if preview is empty
    if (htmlPreview.innerHTML.trim() === '') {
        updateStatus('Error: No preview loaded.', 'error');
        return;
    }
    
    // Add progress container
    const statusMessage = document.getElementById('status-message');
    const progressContainer = createProgressBar();
    
    // SVG file handling
    if (isSvgFile) {
        const svgElement = htmlPreview.querySelector('svg');
        if (svgElement) {
            updateStatus('Converting SVG...', 'info', true);
            statusMessage.appendChild(progressContainer);
            updateProgress(0, 100);
            
            try {
                await handleSvgConversion(svgElement);
                updateProgress(100, 100);
                updateStatus(`SVG successfully converted to ${selectedFormat.toUpperCase()}!`, 'success');
            } catch (error) {
                console.error('SVG conversion error:', error);
                updateStatus(`Error converting SVG: ${error.message}`, 'error');
            }
            return;
        }
    }
    
    // HTML file handling
    updateStatus('Beginning conversion...', 'info', true);
    statusMessage.appendChild(progressContainer);
    updateProgress(10, 100);
    
    try {
        if (!iframe && !isSvgFile) {
            throw new Error('Preview frame not found');
        }
        
        // Process pages or slides
        const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
        const pageSelection = document.querySelector('input[name="page-selection"]:checked').value;
        const selectedPageNumber = parseInt(document.getElementById('page-number').value) || 1;
        const pages = getPages(frameDoc);
        
        // Single page case
        if (pages.length === 0) {
            updateStatus('Converting single page...', 'info', true);
            updateProgress(20, 100);
            await convertSinglePage(iframe);
            updateProgress(100, 100);
            return;
        }
        
        // Multiple pages case
        if (pageSelection === 'all') {
            // Convert all pages
            updateStatus(`Converting all ${pages.length} pages...`, 'info', true);
            updateProgress(20, 100);
            
            if (selectedFormat === 'pdf') {
                await createMultiPagePdf(iframe, pages);
            } else {
                await createMultipleFiles(iframe, pages);
            }
        } else {
            // Convert selected page only
            if (selectedPageNumber <= pages.length) {
                // Hide other pages
                pages.forEach((page, index) => {
                    if (index + 1 === selectedPageNumber) {
                        page.style.display = 'block';
                        page.style.opacity = '1';
                        page.style.position = 'relative';
                        page.style.zIndex = '2';
                    } else {
                        page.style.display = 'none';
                        page.style.opacity = '0';
                        page.style.position = 'absolute';
                        page.style.zIndex = '1';
                    }
                });
                
                updateStatus(`Converting page ${selectedPageNumber}...`, 'info', true);
                updateProgress(20, 100);
                await convertSinglePage(iframe);
                updateProgress(100, 100);
            } else {
                updateStatus(`Error: Page number ${selectedPageNumber} is out of range.`, 'error');
            }
        }
    } catch (error) {
        console.error('Conversion error:', error);
        updateStatus(`Conversion error: ${error.message}`, 'error');
    }
}

// Convert single page with improved progress tracking and optimization
async function convertSinglePage(iframe) {
    const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
    const frameBody = frameDoc.body;
    const outputSize = outputSizes[window.selectedSize];
    
    // Slide format special handling
    if (window.isSlideFormat) {
        const slides = getPages(frameDoc);
        let visibleSlide = null;
        
        for (const slide of slides) {
            if (window.getComputedStyle(slide).display !== 'none' && 
                parseFloat(window.getComputedStyle(slide).opacity) > 0) {
                visibleSlide = slide;
                break;
            }
        }
        
        if (visibleSlide) {
            if (selectedFormat === 'svg') {
                updateStatus('Converting slide to SVG...', 'info', true);
                updateProgress(30, 100);
                await convertToSVG(visibleSlide);
                updateProgress(100, 100);
            } else {
                updateStatus('Rendering slide...', 'info', true);
                updateProgress(30, 100);
                
                const canvasOptions = {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: window.getComputedStyle(frameBody).backgroundColor || '#FFFFFF',
                    logging: false,
                    width: outputSize.width,
                    height: outputSize.height
                };
                
                updateProgress(50, 100);
                
                try {
                    const canvas = await html2canvas(visibleSlide, canvasOptions);
                    updateProgress(80, 100);
                    
                    if (selectedFormat === 'jpg') {
                        // Download as JPG
                        const link = document.createElement('a');
                        link.download = getFileName('jpg');
                        link.href = canvas.toDataURL('image/jpeg', outputQuality);
                        link.click();
                        
                        updateStatus('JPG file downloaded successfully!', 'success');
                    } else {
                        // Download as PDF
                        updateProgress(90, 100);
                        const pdf = new jsPDF({
                            orientation: outputSize.height > outputSize.width ? 'portrait' : 'landscape',
                            unit: 'px',
                            format: [outputSize.width, outputSize.height],
                            compress: true,
                            hotfixes: ['px_scaling']
                        });
                        
                        pdf.addImage(
                            canvas.toDataURL('image/jpeg', 1.0),
                            'JPEG',
                            0,
                            0,
                            outputSize.width,
                            outputSize.height,
                            undefined,
                            'FAST'
                        );
                        
                        pdf.save(getFileName('pdf'));
                        
                        updateStatus('PDF file downloaded successfully!', 'success');
                    }
                    
                    updateProgress(100, 100);
                } catch (error) {
                    console.error('HTML2Canvas error:', error);
                    updateStatus('Error during conversion. Please check the slide content.', 'error');
                    throw error;
                }
            }
            return;
        }
    }
    
    // Regular HTML processing
    if (selectedFormat === 'svg') {
        updateStatus('Converting to SVG...', 'info', true);
        updateProgress(30, 100);
        await convertToSVG(frameDoc.documentElement);
        updateProgress(100, 100);
    } else {
        updateStatus('Rendering content...', 'info', true);
        updateProgress(30, 100);
        
        const canvasOptions = {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: window.getComputedStyle(frameBody).backgroundColor || '#FFFFFF',
            logging: false,
            width: outputSize.width,
            height: outputSize.height,
            windowWidth: outputSize.width,
            windowHeight: outputSize.height,
            foreignObjectRendering: true,
            scrollX: 0,
            scrollY: 0
        };
        
        try {
            updateProgress(50, 100);
            const canvas = await html2canvas(frameDoc.documentElement, canvasOptions);
            updateProgress(80, 100);
            
            if (selectedFormat === 'jpg') {
                // Download as JPG
                const link = document.createElement('a');
                link.download = getFileName('jpg');
                link.href = canvas.toDataURL('image/jpeg', outputQuality);
                link.click();
                
                updateStatus('JPG file downloaded successfully!', 'success');
            } else {
                // Download as PDF
                updateProgress(90, 100);
                const pdf = new jsPDF({
                    orientation: outputSize.height > outputSize.width ? 'portrait' : 'landscape',
                    unit: 'px',
                    format: [outputSize.width, outputSize.height],
                    compress: true,
                    hotfixes: ['px_scaling']
                });
                
                pdf.addImage(
                    canvas.toDataURL('image/jpeg', 1.0),
                    'JPEG',
                    0,
                    0,
                    outputSize.width,
                    outputSize.height,
                    undefined,
                    'FAST'
                );
                
                pdf.save(getFileName('pdf'));
                
                updateStatus('PDF file downloaded successfully!', 'success');
            }
            
            updateProgress(100, 100);
        } catch (error) {
            console.error('Rendering error:', error);
            updateStatus('Error during conversion. Please check the content.', 'error');
            throw error;
        }
    }
}

// SVG to various formats with enhanced progress tracking
async function handleSvgConversion(svgElement) {
    return new Promise(async (resolve, reject) => {
        try {
            updateProgress(20, 100);
            
            // Get SVG content
            const serializer = new XMLSerializer();
            let svgContent = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n';
            
            // Clone and resize SVG
            const outputSize = outputSizes[window.selectedSize];
            const svgClone = svgElement.cloneNode(true);
            svgClone.setAttribute('width', outputSize.width);
            svgClone.setAttribute('height', outputSize.height);
            svgClone.setAttribute('viewBox', `0 0 ${outputSize.width} ${outputSize.height}`);
            
            svgContent += serializer.serializeToString(svgClone);
            
            updateProgress(40, 100);
            
            if (selectedFormat === 'svg') {
                // Save as SVG
                const blob = new Blob([svgContent], {type: 'image/svg+xml;charset=utf-8'});
                saveAs(blob, getFileName('svg'));
                
                updateStatus('SVG file downloaded successfully!', 'success');
                updateProgress(100, 100);
                resolve();
            } else {
                // Convert to other formats
                updateProgress(50, 100);
                const img = new Image();
                
                img.onload = function() {
                    try {
                        updateProgress(70, 100);
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = outputSize.width;
                        canvas.height = outputSize.height;
                        
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        
                        updateProgress(80, 100);
                        
                        if (selectedFormat === 'jpg') {
                            // Save as JPG
                            const link = document.createElement('a');
                            link.download = getFileName('jpg');
                            link.href = canvas.toDataURL('image/jpeg', outputQuality);
                            link.click();
                            
                            updateStatus('JPG file downloaded successfully!', 'success');
                        } else {
                            // Save as PDF
                            updateProgress(90, 100);
                            const pdf = new jsPDF({
                                orientation: outputSize.height > outputSize.width ? 'portrait' : 'landscape',
                                unit: 'px',
                                format: [outputSize.width, outputSize.height],
                                compress: true
                            });
                            
                            pdf.addImage(
                                canvas.toDataURL('image/jpeg', 1.0),
                                'JPEG',
                                0,
                                0,
                                outputSize.width,
                                outputSize.height
                            );
                            
                            pdf.save(getFileName('pdf'));
                            
                            updateStatus('PDF file downloaded successfully!', 'success');
                        }
                        
                        updateProgress(100, 100);
                        resolve();
                        
                        // Clean up
                        URL.revokeObjectURL(img.src);
                    } catch (error) {
                        console.error('SVG conversion error:', error);
                        updateStatus('SVG conversion failed.', 'error');
                        reject(error);
                    }
                };
                
                img.onerror = function(error) {
                    console.error('Image loading error:', error);
                    updateStatus('Failed to process SVG.', 'error');
                    URL.revokeObjectURL(img.src);
                    reject(new Error('Image loading failed'));
                };
                
                // Use object URL for better performance
                const svgBlob = new Blob([svgContent], {type: 'image/svg+xml;charset=utf-8'});
                const url = URL.createObjectURL(svgBlob);
                img.src = url;
            }
        } catch (error) {
            console.error('SVG conversion error:', error);
            updateStatus('SVG conversion failed.', 'error');
            reject(error);
        }
    });
}

// Convert to SVG format with optimizations
async function convertToSVG(element) {
    updateStatus('Converting to SVG format...', 'info', true);
    updateProgress(20, 100);
    
    try {
        // Use DOM to Image with better options
        const svgDataUrl = await domtoimage.toSvg(element, {
            width: outputSizes[window.selectedSize].width,
            height: outputSizes[window.selectedSize].height,
            style: {
                'transform': 'scale(1)',
                'transform-origin': 'top left'
            },
            quality: 1,
            cacheBust: true
        });
        
        updateProgress(80, 100);
        
        // Decode SVG content
        const svgContent = atob(svgDataUrl.split(',')[1]);
        
        // Save as SVG file
        const blob = new Blob([svgContent], {type: 'image/svg+xml;charset=utf-8'});
        saveAs(blob, getFileName('svg'));
        
        updateStatus('SVG file downloaded successfully!', 'success');
        updateProgress(100, 100);
    } catch (error) {
        console.error('SVG conversion error:', error);
        
        // Fallback to simpler method if the main one fails
        try {
            updateStatus('Using alternative SVG conversion method...', 'warning', true);
            updateProgress(30, 100);
            
            // Create SVG directly
            const serializer = new XMLSerializer();
            let svgContent = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n';
            
            // Create SVG element
            const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            svgElement.setAttribute("viewBox", `0 0 ${outputSizes[window.selectedSize].width} ${outputSizes[window.selectedSize].height}`);
            svgElement.setAttribute("width", outputSizes[window.selectedSize].width);
            svgElement.setAttribute("height", outputSizes[window.selectedSize].height);
            
            // Create foreign object for HTML content
            const foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
            foreignObject.setAttribute("width", "100%");
            foreignObject.setAttribute("height", "100%");
            
            // Clone element
            const clonedElement = element.cloneNode(true);
            foreignObject.appendChild(clonedElement);
            svgElement.appendChild(foreignObject);
            
            updateProgress(70, 100);
            
            // Serialize to SVG string
            svgContent += serializer.serializeToString(svgElement);
            
            // Save file
            const blob = new Blob([svgContent], {type: 'image/svg+xml;charset=utf-8'});
            saveAs(blob, getFileName('svg'));
            
            updateStatus('SVG file downloaded using fallback method!', 'success');
            updateProgress(100, 100);
        } catch (backupError) {
            console.error('SVG fallback conversion error:', backupError);
            updateStatus('SVG conversion failed. Please try another format.', 'error');
            throw error;
        }
    }
}

// Create multi-page PDF with optimized rendering
async function createMultiPagePdf(iframe, pages) {
    const outputSize = outputSizes[window.selectedSize];
    
    updateStatus(`Creating PDF with ${pages.length} pages...`, 'info', true);
    
    try {
        // Create PDF instance
        const pdf = new jsPDF({
            orientation: outputSize.height > outputSize.width ? 'portrait' : 'landscape',
            unit: 'px',
            format: [outputSize.width, outputSize.height],
            compress: true,
            hotfixes: ['px_scaling']
        });
        
        // HTML2Canvas options
        const canvasOptions = {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#FFFFFF',
            logging: false,
            width: outputSize.width,
            height: outputSize.height
        };
        
        // Process pages in batches for better memory management
        const batchSize = 3;
        let currentPage = 0;
        
        for (let i = 0; i < pages.length; i += batchSize) {
            const batch = pages.slice(i, i + batchSize);
            
            // Process each page in the batch
            for (const [index, page] of batch.entries()) {
                // Show current page, hide others
                pages.forEach(p => p.style.display = 'none');
                page.style.display = 'block';
                
                // Update status
                updateStatus(`Creating PDF - Page ${i + index + 1} of ${pages.length}...`, 'info', true);
                updateProgress((i + index) / pages.length * 100, 100);
                
                // Allow DOM to update
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Render page
                const canvas = await html2canvas(page, canvasOptions);
                
                // Add page to PDF
                if (i + index > 0) {
                    pdf.addPage();
                }
                
                pdf.addImage(
                    canvas.toDataURL('image/jpeg', 1.0),
                    'JPEG',
                    0,
                    0,
                    outputSize.width,
                    outputSize.height,
                    undefined,
                    'FAST'
                );
                
                // Free memory
                canvas.width = 0;
                canvas.height = 0;
            }
            
            // Allow GC to run
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Save the PDF
        pdf.save(getFileName('pdf'));
        
        updateStatus(`PDF with ${pages.length} pages downloaded successfully!`, 'success');
        updateProgress(100, 100);
    } catch (error) {
        console.error('PDF creation error:', error);
        updateStatus('Error creating PDF. Try with fewer pages or use JPG format.', 'error');
        throw error;
    }
}

// Create multiple files (for JPG format)
async function createMultipleFiles(iframe, pages) {
    const outputSize = outputSizes[window.selectedSize];
    const totalPages = pages.length;
    
    updateStatus(`Creating ${totalPages} ${selectedFormat} files...`, 'info', true);
    
    try {
        // HTML2Canvas options
        const canvasOptions = {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#FFFFFF',
            logging: false,
            width: outputSize.width,
            height: outputSize.height
        };
        
        // Process in batches
        const batchSize = 3;
        const zip = new JSZip();
        
        for (let i = 0; i < totalPages; i += batchSize) {
            const batch = pages.slice(i, i + batchSize);
            
            // Process each page in batch
            for (const [index, page] of batch.entries()) {
                // Show current page, hide others
                pages.forEach(p => p.style.display = 'none');
                page.style.display = 'block';
                
                // Update status
                updateStatus(`Processing image ${i + index + 1} of ${totalPages}...`, 'info', true);
                updateProgress((i + index) / totalPages * 100, 100);
                
                // Allow DOM to update
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Render page
                const canvas = await html2canvas(page, canvasOptions);
                
                // Add to zip file
                const dataUrl = canvas.toDataURL('image/jpeg', outputQuality);
                const base64Data = dataUrl.split(',')[1];
                zip.file(`page_${(i + index + 1).toString().padStart(3, '0')}.jpg`, base64Data, {base64: true});
                
                // Free memory
                canvas.width = 0;
                canvas.height = 0;
            }
            
            // Allow GC to run
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Generate zip file
        updateStatus('Creating ZIP archive...', 'info', true);
        const content = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 6
            }
        }, (metadata) => {
            updateProgress(90 + metadata.percent / 10, 100);
        });
        
        // Save zip file
        saveAs(content, getFileName('zip'));
        
        updateStatus(`ZIP file with ${totalPages} images downloaded successfully!`, 'success');
        updateProgress(100, 100);
    } catch (error) {
        console.error('Multiple files creation error:', error);
        updateStatus('Error creating files. Try with fewer pages or another format.', 'error');
        throw error;
    }
}

// Get file name based on format
function getFileName(format) {
    const fileInput = document.getElementById('html-file');
    let baseName = 'converted';
    
    if (fileInput.files.length > 0) {
        // Get original file name without extension
        baseName = fileInput.files[0].name.split('.').slice(0, -1).join('.');
    }
    
    // Add timestamp for uniqueness
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14);
    
    return `${baseName}_${timestamp}.${format}`;
}

// Check for multiple pages with improved performance
function checkMultiplePages(content) {
    // Page separators regex patterns
    const pageSeparators = [
        /<div[^>]*class="?page"?[^>]*>/i,
        /<div[^>]*id="?page[0-9]+"?[^>]*>/i,
        /<section[^>]*class="?page"?[^>]*>/i,
        /<article[^>]*class="?page"?[^>]*>/i,
        /<hr[^>]*class="?page-break"?[^>]*>/i,
        /<!-- *page-break *-->/i,
        /<div[^>]*style="[^"]*page-break-before: always[^"]*"[^>]*>/i,
        /<div[^>]*style="[^"]*page-break-after: always[^"]*"[^>]*>/i
    ];
    
    // Slide format patterns
    const slideSeparators = [
        /<div[^>]*class="?slide"?[^>]*>/i,
        /<div[^>]*id="?slide[0-9]+"?[^>]*>/i,
        /<section[^>]*class="?slide"?[^>]*>/i,
    ];
    
    // Check for slide format
    let isSlideFormat = false;
    
    // Check for slide-related JavaScript
    if (content.includes('changeSlide') || 
        content.includes('nextSlide') || 
        content.includes('prevSlide') ||
        content.includes('class="slides-container"')) {
        isSlideFormat = true;
    }
    
    // Efficient pattern matching
    function countMatches(patterns, text) {
        for (const pattern of patterns) {
            if (pattern.test(text)) {
                const matches = text.match(new RegExp(pattern.source, 'gi'));
                if (matches && matches.length > 0) {
                    return matches.length;
                }
            }
        }
        return 0;
    }
    
    // Check for pages and slides
    let hasMultiplePages = false;
    let pageCount = 1;
    let slidesCount = 0;
    
    // Check standard page separators
    const pageMatches = countMatches(pageSeparators, content);
    if (pageMatches > 0) {
        hasMultiplePages = true;
        pageCount += pageMatches;
    }
    
    // Check slide separators
    const slideMatches = countMatches(slideSeparators, content);
    if (slideMatches > 0) {
        hasMultiplePages = true;
        isSlideFormat = true;
        slidesCount = slideMatches;
        
        // Use slide count if higher
        if (slidesCount > pageCount - 1) {
            pageCount = slidesCount;
        }
    }
    
    // Update page info
    const pageInfo = document.getElementById('page-info');
    if (isSlideFormat) {
        pageInfo.textContent = `(Slide format: ${pageCount} pages detected)`;
        window.isSlideFormat = true;
    } else {
        pageInfo.textContent = hasMultiplePages ? `(${pageCount} pages detected)` : '';
        window.isSlideFormat = false;
    }
    
    // Show/hide page options
    document.getElementById('page-options').style.display = 
        hasMultiplePages ? 'block' : 'none';
}

// Get page elements from document
function getPages(doc) {
    let pages = [];
    
    // For slide format
    if (window.isSlideFormat) {
        // Try various slide selectors
        pages = Array.from(doc.querySelectorAll('div.slide'));
        if (pages.length > 0) return pages;
        
        pages = Array.from(doc.querySelectorAll('div[id^="slide"]'));
        if (pages.length > 0) return pages;
        
        pages = Array.from(doc.querySelectorAll('section.slide'));
        if (pages.length > 0) return pages;
    }
    
    // For standard page format
    pages = Array.from(doc.querySelectorAll('div.page'));
    if (pages.length > 0) return pages;
    
    pages = Array.from(doc.querySelectorAll('div[id^="page"]'));
    if (pages.length > 0) return pages;
    
    pages = Array.from(doc.querySelectorAll('section.page'));
    if (pages.length > 0) return pages;
    
    pages = Array.from(doc.querySelectorAll('article.page'));
    if (pages.length > 0) return pages;
    
    return [];
}

// Replace references to uploaded images in HTML content
function replaceUploadedImageReferences(content) {
    if (!window.uploadedImages || Object.keys(window.uploadedImages).length === 0) {
        return content;
    }
    
    let modifiedContent = content;
    
    Object.keys(window.uploadedImages).forEach(filename => {
        const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns = [
            new RegExp(`src=["'][^"']*/${escapedFilename}["']`, 'gi'),
            new RegExp(`src=["']${escapedFilename}["']`, 'gi')
        ];
        
        patterns.forEach(regex => {
            modifiedContent = modifiedContent.replace(regex, `src="${window.uploadedImages[filename]}"`);
        });
    });
    
    return modifiedContent;
}

// Update quality value display
function updateQualityValue() {
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    
    if (qualitySlider && qualityValue) {
        const value = qualitySlider.value;
        qualityValue.textContent = `${value}%`;
        outputQuality = value / 100;
    }
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', function() {
    // ファイルアップロードハンドラーの設定
    const fileInput = document.getElementById('html-file');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }
    
    // プレビューボタン
    const previewBtn = document.getElementById('preview-btn');
    if (previewBtn) {
        previewBtn.addEventListener('click', renderPreview);
    }
    
    // 変換ボタン
    const convertBtn = document.getElementById('convert-btn');
    if (convertBtn) {
        convertBtn.addEventListener('click', convertAndDownload);
    }
    
    // 品質スライダー
    const qualitySlider = document.getElementById('quality-slider');
    if (qualitySlider) {
        qualitySlider.addEventListener('input', updateQualityValue);
    }
    
    // サイズ選択ボタンの設定
    document.querySelectorAll('.size-button').forEach(btn => {
        btn.addEventListener('click', function() {
            selectSize(this.getAttribute('data-size'));
        });
    });
    
    // 形式選択ボタンの設定
    document.querySelectorAll('.format-button').forEach(btn => {
        btn.addEventListener('click', function() {
            selectFormat(this.getAttribute('data-format'));
        });
    });
    
    // 初期状態を設定
    selectSize('a4');
    selectFormat('pdf');
    updateQualityValue();
});
