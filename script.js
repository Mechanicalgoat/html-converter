// ページオプションの表示
if (hasMultiplePages) {
    pageOptions.style.display = 'block';
} else {
    pageOptions.style.display = 'none';
}

// 変換時間の推定
function estimateConversionTime(totalPages, format) {
    // ページ数と形式に基づいて変換時間を推定
    const baseTime = 1; // 初期処理の基本時間
    let timePerPage = 0;

    switch(format) {
        case 'pdf':
            timePerPage = 0.5; // PDFは比較的軽い
            break;
        case 'jpg':
            timePerPage = 1; // JPGは少し重い
            break;
        case 'svg':
            timePerPage = 0.3; // SVGは最も軽い
            break;
        default:
            timePerPage = 0.5;
    }

    // 処理時間を計算
    const totalTime = baseTime + (totalPages * timePerPage);
    
    // 時間を整形
    if (totalTime < 1) {
        return '1秒未満';
    } else if (totalTime < 60) {
        return `約${Math.round(totalTime)}秒`;
    } else {
        const minutes = Math.floor(totalTime / 60);
        const seconds = Math.round(totalTime % 60);
        return `約${minutes}分${seconds}秒`;
    }
}

// プレビュー生成
async function renderPreview() {
    const htmlPreview = document.getElementById('html-preview');
    const convertBtn = document.getElementById('convert-btn');
    const fileInput = document.getElementById('html-file');
    const sizeInfo = document.getElementById('size-info');
    
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
            const iframeContainer = document.createElement('div');
            iframeContainer.style.width = '100%';
            iframeContainer.style.height = '100%';
            
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            
            htmlPreview.appendChild(iframe);
            
            // iframeにコンテンツを書き込む
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(htmlContent);
            iframeDoc.close();
            
            // サイズ情報を表示
            sizeInfo.textContent = `出力サイズ: ${outputSize.width} × ${outputSize.height} px`;
            
            updateStatus('プレビューが正常に生成されました', 'success');
            convertBtn.disabled = false;
        }
        
        // 推定変換時間を表示
        const estimatedTimeEl = document.getElementById('estimated-time');
        const format = selectedFormat || 'pdf';
        const pageCount = document.getElementById('page-info').textContent.match(/\d+/)?.[0] || 1;
        const estimatedTime = estimateConversionTime(parseInt(pageCount), format);
        
        estimatedTimeEl.textContent = `推定変換時間: ${estimatedTime}`;
    } catch (error) {
        console.error('プレビュー生成エラー:', error);
        updateStatus(`プレビュー生成エラー: ${error.message}`, 'error');
        convertBtn.disabled = true;
    }
}

// 変換処理
async function convertAndDownload() {
    const fileInput = document.getElementById('html-file');
    const fileExt = fileInput.files[0]?.name.split('.').pop().toLowerCase();
    const outputSize = outputSizes[window.selectedSize];
    
    updateStatus('変換処理を開始します...', 'info', true);
    
    try {
        if (fileExt === 'svg') {
            // SVGファイルの変換
            await convertSvgFile(htmlContent, outputSize);
        } else {
            // HTMLファイルの変換
            await convertHtmlFile(htmlContent, outputSize);
        }
    } catch (error) {
        console.error('変換エラー:', error);
        updateStatus(`変換中にエラーが発生しました: ${error.message}`, 'error');
    }
}

// SVGファイルの変換
async function convertSvgFile(svgContent, outputSize) {
    try {
        // SVGをCanvasに変換
        const img = new Image();
        img.src = `data:image/svg+xml;base64,${btoa(svgContent)}`;
        
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        
        const canvas = document.createElement('canvas');
        canvas.width = outputSize.width;
        canvas.height = outputSize.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, outputSize.width, outputSize.height);
        
        // 選択した形式で保存
        switch(selectedFormat) {
            case 'svg':
                // そのままSVGとして保存
                const blob = new Blob([svgContent], {type: 'image/svg+xml'});
                saveAs(blob, `converted_${new Date().toISOString().replace(/[:.]/g, '')}.svg`);
                break;
            case 'jpg':
                // JPGとして保存
                const jpgDataUrl = canvas.toDataURL('image/jpeg', outputQuality);
                const jpgLink = document.createElement('a');
                jpgLink.href = jpgDataUrl;
                jpgLink.download = `converted_${new Date().toISOString().replace(/[:.]/g, '')}.jpg`;
                jpgLink.click();
                break;
            case 'pdf':
                // PDFとして保存
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    orientation: outputSize.height > outputSize.width ? 'portrait' : 'landscape',
                    unit: 'px',
                    format: [outputSize.width, outputSize.height]
                });
                
                pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, outputSize.width, outputSize.height);
                pdf.save(`converted_${new Date().toISOString().replace(/[:.]/g, '')}.pdf`);
                break;
        }
        
        updateStatus('変換が正常に完了しました', 'success');
    } catch (error) {
        console.error('SVG変換エラー:', error);
        updateStatus(`SVG変換エラー: ${error.message}`, 'error');
    }
}

// HTMLファイルの変換
async function convertHtmlFile(htmlContent, outputSize) {
    // 一時的なiframeを作成して変換
    const tempFrame = document.createElement('iframe');
    tempFrame.style.position = 'absolute';
    tempFrame.style.left = '-9999px';
    document.body.appendChild(tempFrame);
    
    const frameDoc = tempFrame.contentDocument || tempFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(htmlContent);
    frameDoc.close();
    
    try {
        // ページ選択オプションを取得
        const pageSelection = document.querySelector('input[name="page-selection"]:checked').value;
        const selectedPageNumber = parseInt(document.getElementById('page-number').value) || 1;
        
        // ページの検出
        const pages = getPages(frameDoc);
        
        if (pageSelection === 'single' && selectedPageNumber > pages.length) {
            throw new Error(`選択したページ番号 (${selectedPageNumber}) が無効です`);
        }
        
        // 変換処理
        switch(selectedFormat) {
            case 'pdf':
                await convertToPdf(pages, outputSize, pageSelection, selectedPageNumber);
                break;
            case 'jpg':
                await convertToJpg(pages, outputSize, pageSelection, selectedPageNumber);
                break;
            case 'svg':
                await convertToSvg(pages, outputSize, pageSelection, selectedPageNumber);
                break;
        }
        
        updateStatus('変換が正常に完了しました', 'success');
    } catch (error) {
        console.error('HTML変換エラー:', error);
        updateStatus(`変換エラー: ${error.message}`, 'error');
    } finally {
        // 一時フレームを削除
        document.body.removeChild(tempFrame);
    }
}

// ページ要素の取得
function getPages(doc) {
    // スライドまたはページのセレクター
    const selectors = [
        'div.slide', 'div[id^="slide"]', 'section.slide',
        'div.page', 'div[id^="page"]', 'section.page', 'article.page'
    ];
    
    for (const selector of selectors) {
        const pages = Array.from(doc.querySelectorAll(selector));
        if (pages.length > 0) return pages;
    }
    
    // ページが見つからない場合はbodyを返す
    return [doc.body];
}

// PDFへの変換
async function convertToPdf(pages, outputSize, pageSelection, selectedPageNumber) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: outputSize.height > outputSize.width ? 'portrait' : 'landscape',
        unit: 'px',
        format: [outputSize.width, outputSize.height]
    });
    
    const pagesToConvert = pageSelection === 'all' 
        ? pages 
        : [pages[selectedPageNumber - 1]];
    
    for (const page of pagesToConvert) {
        const canvas = await html2canvas(page, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            width: outputSize.width,
            height: outputSize.height
        });
        
        // 最初のページでない場合は新しいページを追加
        if (pagesToConvert.indexOf(page) > 0) {
            pdf.addPage();
        }
        
        pdf.addImage(
            canvas.toDataURL('image/jpeg', 1.0), 
            'JPEG', 
            0, 
            0, 
            outputSize.width, 
            outputSize.height
        );
    }
    
    pdf.save(`converted_${new Date().toISOString().replace(/[:.]/g, '')}.pdf`);
}

// JPGへの変換
async function convertToJpg(pages, outputSize, pageSelection, selectedPageNumber) {
    const pagesToConvert = pageSelection === 'all' 
        ? pages 
        : [pages[selectedPageNumber - 1]];
    
    // 複数ページの場合はZIPで保存
    if (pagesToConvert.length > 1) {
        const zip = new JSZip();
        
        for (let i = 0; i < pagesToConvert.length; i++) {
            const page = pagesToConvert[i];
            const canvas = await html2canvas(page, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                width: outputSize.width,
                height: outputSize.height
            });
            
            // JPGデータをZIPに追加
            const dataUrl = canvas.toDataURL('image/jpeg', outputQuality);
            const base64Data = dataUrl.split(',')[1];
            zip.file(`page_${(i + 1).toString().padStart(3, '0')}.jpg`, base64Data, {base64: true});
        }
        
        // ZIPファイルを生成してダウンロード
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `converted_${new Date().toISOString().replace(/[:.]/g, '')}.zip`);
    } else {
        // 単一ページの場合は直接ダウンロード
        const page = pagesToConvert[0];
        const canvas = await html2canvas(page, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            width: outputSize.width,
            height: outputSize.height
        });
        
        const dataUrl = canvas.toDataURL('image/jpeg', outputQuality);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `converted_${new Date().toISOString().replace(/[:.]/g, '')}.jpg`;
        link.click();
    }
}

// SVGへの変換
async function convertToSvg(pages, outputSize, pageSelection, selectedPageNumber) {
    const pagesToConvert = pageSelection === 'all' 
        ? pages 
        : [pages[selectedPageNumber - 1]];
    
    // 複数ページの場合はZIPで保存
    if (pagesToConvert.length > 1) {
        const zip = new JSZip();
        
        for (let i = 0; i < pagesToConvert.length; i++) {
            const page = pagesToConvert[i];
            const svgDataUrl = await domtoimage.toSvg(page, {
                width: outputSize.width,
                height: outputSize.height
            });
            
            // SVGデータをZIP
        const estimatedTime = estimateConversionTime(pageCount, format);
    
    if (hasMultiplePages) {
        estimatedTimeEl.textContent = `推定変換時間: ${estimatedTime}`;
    } else {
        estimatedTimeEl.textContent = '';
    }
}

// 変換時間の推定
function estimateConversionTime(totalPages, format) {
    // ページ数と形式に基づいて変換時間を推定
    const baseTime = 1; // 初期処理の基本時間
    let timePerPage = 0;

    switch(format) {
        case 'pdf':
            timePerPage = 0.5; // PDFは比較的軽い
            break;
        case 'jpg':
            timePerPage = 1; // JPGは少し重い
            break;
        case 'svg':
            timePerPage = 0.3; // SVGは最も軽い
            break;
        default:
            timePerPage = 0.5;
    }

    // 処理時間を計算
    const totalTime = baseTime + (totalPages * timePerPage);
    
    // 時間を整形
    if (totalTime < 1) {
        return '1秒未満';
    } else if (totalTime < 60) {
        return `約${Math.round(totalTime)}秒`;
    } else {
        const minutes = Math.floor(totalTime / 60);
        const seconds = Math.round(totalTime % 60);
        return `約${minutes}分${seconds}秒`;
    }
}

// プレビュー生成
async function renderPreview() {
    const htmlPreview = document.getElementById('html-preview');
    const convertBtn = document.getElementById('convert-btn');
    const fileInput = document.getElementById('html-file');
    const sizeInfo = document.getElementById('size-info');
    
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
            const iframeContainer = document.createElement('div');
            iframeContainer.style.width = '100%';
            iframeContainer.style.height = '100%';
            
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            
            htmlPreview.appendChild(iframe);
            
            // iframeにコンテンツを書き込む
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(htmlContent);
            iframeDoc.close();
            
            // サイズ情報を表示
            sizeInfo.textContent = `出力サイズ: ${outputSize.width} × ${outputSize.height} px`;
            
            updateStatus('プレビューが正常に生成されました', 'success');
            convertBtn.disabled = false;
        }
        
        // 推定変換時間を表示
        const estimatedTimeEl = document.getElementById('estimated-time');
        const format = selectedFormat || 'pdf';
        const pageCount = document.getElementById('page-info').textContent.match(/\d+/)?.[0] || 1;
        const estimatedTime = estimateConversionTime(parseInt(pageCount), format);
        
        estimatedTimeEl.textContent = `推定変換時間: ${estimatedTime}`;
    } catch (error) {
        console.error('プレビュー生成エラー:', error);
        updateStatus(`プレビュー生成エラー: ${error.message}`, 'error');
        convertBtn.disabled = true;
    }
}

// 変換処理
async function convertAndDownload() {
    const fileInput = document.getElementById('html-file');
    const fileExt = fileInput.files[0]?.name.split('.').pop().toLowerCase();
    const outputSize = outputSizes[window.selectedSize];
    
    updateStatus('変換処理を開始します...', 'info', true);
    
    try {
        if (fileExt === 'svg') {
            // SVGファイルの変換
            await convertSvgFile(htmlContent, outputSize);
        } else {
            // HTMLファイルの変換
            await convertHtmlFile(htmlContent, outputSize);
        }
    } catch (error) {
        console.error('変換エラー:', error);
        updateStatus(`変換中にエラーが発生しました: ${error.message}`, 'error');
    }
}

// SVGファイルの変換
async function convertSvgFile(svgContent, outputSize) {
    try {
        // SVGをCanvasに変換
        const img = new Image();
        img.src = `data:image/svg+xml;base64,${btoa(svgContent)}`;
        
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        
        const canvas = document.createElement('canvas');
        canvas.width = outputSize.width;
        canvas.height = outputSize.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, outputSize.width, outputSize.height);
        
        // 選択した形式で保存
        switch(selectedFormat) {
            case 'svg':
                // そのままSVGとして保存
                const blob = new Blob([svgContent], {type: 'image/svg+xml'});
                saveAs(blob, `converted_${new Date().toISOString().replace(/[:.]/g, '')}.svg`);
                break;
            case 'jpg':
                // JPGとして保存
                const jpgDataUrl = canvas.toDataURL('image/jpeg', outputQuality);
                const jpgLink = document.createElement('a');
                jpgLink.href = jpgDataUrl;
                jpgLink.download = `converted_${new Date().toISOString().replace(/[:.]/g, '')}.jpg`;
                jpgLink.click();
                break;
            case 'pdf':
                // PDFとして保存
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    orientation: outputSize.height > outputSize.width ? 'portrait' : 'landscape',
                    unit: 'px',
                    format: [outputSize.width, outputSize.height]
                });
                
                pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, outputSize.width, outputSize.height);
                pdf.save(`converted_${new Date().toISOString().replace(/[:.]/g, '')}.pdf`);
                break;
        }
        
        updateStatus('変換が正常に完了しました', 'success');
    } catch (error) {
        console.error('SVG変換エラー:', error);
        updateStatus(`SVG変換エラー: ${error.message}`, 'error');
    }
}

// ページ要素の取得
function getPages(doc) {
    // スライドまたはページのセレクター
    const selectors = [
        'div.slide', 'div[id^="slide"]', 'section.slide',
        'div.page', 'div[id^="page"]', 'section.page', 'article.page'
    ];
    
    for (const selector of selectors) {
        const pages = Array.from(doc.querySelectorAll(selector));
        if (pages.length > 0) return pages;
    }
    
    // ページが見つからない場合はbodyを返す
    return [doc.body];
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', function() {
    // ファイル入力
    const fileInput = document.getElementById('html-file');
    fileInput.addEventListener('change', handleFileUpload);
    
    // ドラッグ&ドロップのサポート
    const dropZone = fileInput.closest('.border-2');
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500', 'bg-blue-50/10');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-blue-500', 'bg-blue-50/10');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50/10');
        
        // ファイルを設定
        fileInput.files = e.dataTransfer.files;
        
        // changeイベントを発火
        const event = new Event('change');
        fileInput.dispatchEvent(event);
    });
    
    // プレビューボタン
    const previewBtn = document.getElementById('preview-btn');
    previewBtn.addEventListener('click', renderPreview);
    
    // 変換ボタン
    const convertBtn = document.getElementById('convert-btn');
    convertBtn.addEventListener('click', convertAndDownload);
    
    // サイズ選択ボタン
    document.querySelectorAll('.size-button').forEach(btn => {
        btn.addEventListener('click', function() {
            const size = this.getAttribute('data-size');
            selectSize(size);
        });
    });
    
    // 形式選択ボタン
    document.querySelectorAll('.format-button').forEach(btn => {
        btn.addEventListener('click', function() {
            const format = this.getAttribute('data-format');
            selectFormat(format);
        });
    });
    
    // 品質スライダー
    const qualitySlider = document.getElementById('quality-slider');
    qualitySlider.addEventListener('input', function() {
        const qualityValue = document.getElementById('quality-value');
        qualityValue.textContent = `${this.value}%`;
        outputQuality = this.value / 100;
    });
    
    // 初期状態の設定
    selectSize('a4');
    selectFormat('pdf');
});

// デバッグ用のグローバル関数
window.debugConverter = {
    getHtmlContent: () => htmlContent,
    getSelectedFormat: () => selectedFormat,
    getOutputQuality: () => outputQuality
};
