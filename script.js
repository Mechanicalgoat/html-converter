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
