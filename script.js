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
};

// 画像キャッシュの初期化
const imageCache = new Map();

// UI要素のスタイル更新関数
function updateButtonStyles(selector, activeButton) {
    document.querySelectorAll(selector).forEach(btn => {
        btn.classList.remove('bg-blue-500', 'text-white');
        btn.classList.add('bg-white', 'text-gray-700', 'border', 'border-gray-300');
    });
    
    activeButton.classList.remove('bg-white', 'text-gray-700', 'border', 'border-gray-300');
    activeButton.classList.add('bg-blue-500', 'text-white');
}

// サイズ選択関数
function selectSize(size) {
    window.selectedSize = size;
    const button = document.getElementById(`size-${size}`);
    updateButtonStyles('.size-button', button);
}

// 形式選択関数
function selectFormat(format) {
    selectedFormat = format;
    const button = document.getElementById(`format-${format}`);
    updateButtonStyles('.format-button', button);
    
    // 品質スライダーの表示切り替え
    const qualityOptions = document.getElementById('quality-options');
    qualityOptions.style.display = format === 'jpg' ? 'block' : 'none';
}

// ステータスメッセージの更新
function updateStatus(message, type = 'info', showSpinner = false) {
    const statusMessage = document.getElementById('status-message');
    statusMessage.innerHTML = '';
    
    // クラスをリセット
    statusMessage.className = 'mt-4 p-3 rounded-lg text-center';
    
    // タイプに応じたスタイル
    const typeStyles = {
        'info': 'bg-blue-50 text-blue-700',
        'success': 'bg-green-50 text-green-700',
        'warning': 'bg-yellow-50 text-yellow-700',
        'error': 'bg-red-50 text-red-700'
    };
    
    statusMessage.classList.add(typeStyles[type] || typeStyles['info']);
    
    if (showSpinner) {
        const spinner = document.createElement('div');
        spinner.className = 'animate-spin inline-block w-5 h-5 border-4 border-blue-500 border-t-transparent rounded-full mr-2';
        statusMessage.appendChild(spinner);
    }
    
    // メッセージテキスト
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    statusMessage.appendChild(messageSpan);
}

// プログレスバーの作成
function createProgressBar() {
    const progressContainer = document.createElement('div');
    progressContainer.className = 'w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-2';
    
    const progressBar = document.createElement('div');
    progressBar.id = 'progress-bar';
    progressBar.className = 'h-full bg-blue-500 transition-all duration-300 ease-in-out';
    progressBar.style.width = '0%';
    
    progressContainer.appendChild(progressBar);
    return progressContainer;
}

// プログレスバーの更新
function updateProgress(current, total) {
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        const percentage = Math.round((current / total) * 100);
        progressBar.style.width = `${percentage}%`;
    }
}

// 画像処理関数（以前のコードと同様）
async function processImage(img, originalSrc) {
    // 前のコードと同じ実装
    // ...
}

// ファイルアップロード処理
async function handleFileUpload() {
    const fileInput = document.getElementById('html-file');
    const fileNameDisplay = document.getElementById('file-name');
    const previewBtn = document.getElementById('preview-btn');
    const sizeInfo = document.getElementById('size-info');
    
    // サイズ情報のクリア
    sizeInfo.textContent = '';
    window.originalWidth = null;
    window.originalHeight = null;
    
    if (fileInput.files.length === 0) {
        fileNameDisplay.textContent = '';
        previewBtn.disabled = true;
        return;
    }
    
    const file = fileInput.files[0];
    fileNameDisplay.textContent = file.name;
    updateStatus('ファイルを読み込んでいます...', 'info', true);
    
    // ファイル拡張子の取得
    const fileExt = file.name.split('.').pop().toLowerCase();
    
    try {
        if (fileExt === 'svg') {
            // SVGファイルの処理
            const content = await readFileAsText(file);
            htmlContent = content;
            
            // SVGの寸法を抽出
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            const svgElement = tempDiv.querySelector('svg');
            
            if (svgElement) {
                extractSvgDimensions(svgElement);
            }
            
            previewBtn.disabled = false;
            selectFormat('svg');
            updateStatus('SVGファイルが正常に読み込まれました', 'success');
            
        } else if (fileExt === 'html' || fileExt === 'htm') {
            // HTMLファイルの処理
            const content = await readFileAsText(file);
            
            // アップロードされた画像の参照を置き換え
            const processedContent = replaceUploadedImageReferences(content);
            
            // 画像をプリロード
            htmlContent = await
                // 続きの関数群

// ファイルをテキストとして読み込む
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(new Error('ファイル読み込みに失敗しました'));
        reader.readAsText(file);
    });
}

// SVGの寸法を抽出
function extractSvgDimensions(svgElement) {
    let width = svgElement.getAttribute('width');
    let height = svgElement.getAttribute('height');
    let viewBox = svgElement.getAttribute('viewBox');
    
    // 幅と高さを数値に変換
    if (width) {
        width = parseFloat(width.replace('px', ''));
        window.originalWidth = width || 800;
    }
    
    if (height) {
        height = parseFloat(height.replace('px', ''));
        window.originalHeight = height || 600;
    }
    
    // viewBoxから寸法を取得
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

// アップロードされた画像の参照を置き換え
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

// 画像のプリロード
async function preloadImages(htmlContent) {
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = htmlContent;
    
    // 画像要素を取得
    const images = tempContainer.querySelectorAll('img');
    const totalImages = images.length;
    
    if (totalImages === 0) {
        return htmlContent;
    }
    
    updateStatus(`画像を読み込んでいます... (0/${totalImages})`, 'info', true);
    
    // プログレスバーを追加
    const statusMessage = document.getElementById('status-message');
    const progressContainer = createProgressBar();
    statusMessage.appendChild(progressContainer);
    
    // 画像を並列処理
    const concurrentLimit = navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 2;
    let processedCount = 0;
    let failedCount = 0;
    const imageMap = new Map();
    
    // バッチ処理
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
                console.warn('画像処理エラー:', error);
                failedCount++;
            } finally {
                // プログレスを更新
                updateStatus(`画像を読み込んでいます... (${processedCount}/${totalImages})`, 'info', true);
                updateProgress(processedCount + failedCount, totalImages);
            }
        });
        
        await Promise.all(promises);
    }
    
    // 画像パスをデータURLに置き換え
    let processedHTML = htmlContent;
    imageMap.forEach((dataURL, originalSrc) => {
        const escapedSrc = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`src=["']${escapedSrc}["']`, 'g');
        processedHTML = processedHTML.replace(regex, `src="${dataURL}"`);
    });
    
    if (failedCount > 0) {
        updateStatus(`画像処理完了。(${processedCount}枚読み込み、${failedCount}枚失敗)`, 'warning');
    } else {
        updateStatus(`画像処理完了。全${processedCount}枚の画像を読み込みました。`, 'success');
    }
    
    return processedHTML;
}

// 複数ページの確認
function checkMultiplePages(content) {
    // ページセパレーターの正規表現パターン
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
    
    // スライド形式のパターン
    const slideSeparators = [
        /<div[^>]*class="?slide"?[^>]*>/i,
        /<div[^>]*id="?slide[0-9]+"?[^>]*>/i,
        /<section[^>]*class="?slide"?[^>]*>/i,
    ];
    
    // スライド形式の確認
    let isSlideFormat = false;
    
    // スライド関連のJavaScriptをチェック
    if (content.includes('changeSlide') || 
        content.includes('nextSlide') || 
        content.includes('prevSlide') ||
        content.includes('class="slides-container"')) {
        isSlideFormat = true;
    }
    
    // パターンマッチング関数
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
    
    // ページとスライドのチェック
    let hasMultiplePages = false;
    let pageCount = 1;
    let slidesCount = 0;
    
    // 標準のページセパレーターをチェック
    const pageMatches = countMatches(pageSeparators, content);
    if (pageMatches > 0) {
        hasMultiplePages = true;
        pageCount += pageMatches;
    }
    
    // スライドセパレーターをチェック
    const slideMatches = countMatches(slideSeparators, content);
    if (slideMatches > 0) {
        hasMultiplePages = true;
        isSlideFormat = true;
        slidesCount = slideMatches;
        
        // スライド数が多い場合はそちらを使用
        if (slidesCount > pageCount - 1) {
            pageCount = slidesCount;
        }
    }
    
    // ページ情報を更新
    const pageInfo = document.getElementById('page-info');
    if (isSlideFormat) {
        pageInfo.textContent = `(スライド形式: ${pageCount}ページ検出)`;
        window.isSlideFormat = true;
    } else {
        pageInfo.textContent = hasMultiplePages ? `(${pageCount}ページ検出)` : '';
        window.isSlideFormat = false;
    }
    
    // ページオプションの表示/非表示
    document.getElementById('page-options').style.display = 
        hasMultiplePages ? 'block' : 'none';
}

// プレビュー生成
async function renderPreview() {
    const htmlPreview = document.getElementById('html-preview');
    const convertBtn = document.getElementById('convert-btn');
    const fileInput = document.getElementById('html-file');
    const sizeInfo = document.getElementById('size-info');
    
    updateStatus('プレビューを生成しています...', 'info', true);
    
    // プレビューをクリア
    htmlPreview.innerHTML = '';
    
    // 出力サイズを設定
    const outputSize = outputSizes[window.selectedSize];
    
    try {
        const fileExt = fileInput.files[0]?.name.split('.').pop().toLowerCase();
        
        if (fileExt === 'svg') {
            // SVGファイルの処理
            htmlPreview.innerHTML = htmlContent;
            const svgElement = htmlPreview.querySelector('svg');
            
            if (svgElement) {
                // 選択されたサイズを適用
                window.originalWidth = outputSize.width;
                window.originalHeight = outputSize.height;
                
                // サイズ情報を表示
                sizeInfo.textContent = `出力サイズ: ${outputSize.width} × ${outputSize.height} px`;
                
                // プレビュー要素にサイズを設定
                htmlPreview.style.width = `${outputSize.width}px`;
                htmlPreview.style.height = `${outputSize.height}px`;
                
                // SVGにスタイルを適用
                svgElement.setAttribute('width', outputSize.width);
                svgElement.setAttribute('height', outputSize.height);
                svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svgElement.style.width = '100%';
                svgElement.style.height = '100%';
                svgElement.style.display = 'block';
            }
            
            updateStatus('プレビューが正常に生成されました', 'success');
            convertBtn.disabled = false;
            
        } else {
            // HTMLファイルの処理
            await renderHtmlPreview(htmlPreview, htmlContent, outputSize);
            sizeInfo.textContent = `出力サイズ: ${outputSize.width} × ${outputSize.height} px`;
            
            updateStatus('プレビューが正常に生成されました', 'success');
            convertBtn.disabled = false;
        }
    } catch (error) {
        console.error('プレビュー生成エラー:', error);
        updateStatus(`プレビュー生成エラー: ${error.message}`, 'error');
    }
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', function() {
    // ファイルアップロードハンドラー
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
    
    // サイズ選択ボタン
    document.querySelectorAll('.size-button').forEach(btn => {
        btn.addEventListener('click', function() {
            selectSize(this.getAttribute('data-size'));
        });
    });
    
    // 形式選択ボタン
    document.querySelectorAll('.format-button').forEach(btn => {
        btn.addEventListener('click', function() {
            selectFormat(this.getAttribute('data-format'));
        });
    });
    
    // 品質スライダー
    const qualitySlider = document.getElementById('quality-slider');
    if (qualitySlider) {
        qualitySlider.addEventListener('input', function() {
            const qualityValue = document.getElementById('quality-value');
            qualityValue.textContent = `${this.value}%`;
            outputQuality = this.value / 100;
        });
    }
    
    // 初期状態を設定
    selectSize('a4');
    selectFormat('pdf');
});

// 以降の関数（convertAndDownload、getPages、その他の変換関連の関数）は次のセクションで続けます
