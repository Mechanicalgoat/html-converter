function handleFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        fileContent = e.target.result;
        fileType = file.name.split('.').pop().toLowerCase();

        // アニメーションを完全に停止し、静止画に変換するスクリプト
        const animationStopperScript = `
            <script>
                // CSSアニメーションを停止する関数
                function freezeAnimations() {
                    document.querySelectorAll('*').forEach(el => {
                        const computedStyle = window.getComputedStyle(el);
                        
                        // CSSアニメーションを停止
                        el.style.animationPlayState = 'paused';
                        el.style.animation = 'none';

                        // GIFや動画を最初のフレームで停止
                        if (el.tagName === 'IMG' && el.complete) {
                            const canvas = document.createElement('canvas');
                            canvas.width = el.width;
                            canvas.height = el.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(el, 0, 0, el.width, el.height);
                            el.src = canvas.toDataURL();
                        }

                        // 動画を最初のフレームで停止
                        if (el.tagName === 'VIDEO') {
                            el.pause();
                            el.currentTime = 0;
                        }

                        // SVGアニメーションを停止
                        if (el.tagName === 'svg') {
                            const animateElements = el.querySelectorAll('animate, animateTransform');
                            animateElements.forEach(anim => {
                                anim.setAttribute('dur', '0s');
                            });
                        }
                    });

                    // Canvas要素のアニメーションを停止
                    const canvases = document.querySelectorAll('canvas');
                    canvases.forEach(canvas => {
                        const ctx = canvas.getContext('2d');
                        ctx.save();
                        ctx.globalCompositeOperation = 'copy';
                        ctx.drawImage(canvas, 0, 0);
                        ctx.restore();
                    });
                }

                // ページ読み込み後にアニメーションを停止
                window.addEventListener('load', () => {
                    // 少し遅延を入れて、すべてのリソースが読み込まれるのを待つ
                    setTimeout(freezeAnimations, 500);
                    
                    // 親ウィンドウに準備完了を通知
                    window.parent.postMessage('animationStopped', '*');
                });
            <\/script>
        `;

        // プレビュー表示
        const previewContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body { 
                            margin: 0; 
                            padding: 0;
                            width: 100%;
                            height: 100%;
                            background-color: #2C2C2C; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center;
                            overflow: hidden;
                        }
                        body > * {
                            max-width: 100%;
                            max-height: 100%;
                        }
                    </style>
                    ${animationStopperScript}
                </head>
                <body>${fileContent}</body>
            </html>
        `;

        preview.srcdoc = previewContent;

        // メッセージ受信ハンドラ
        const messageHandler = (event) => {
            if (event.data === 'animationStopped') {
                // アニメーション停止を検出
                saveBtn.disabled = false;
                showStatus('スクリーンショット準備完了', 'success');
                window.removeEventListener('message', messageHandler);
            }
        };

        window.addEventListener('message', messageHandler);

        // サイズ更新
        updatePreviewSize();
    };

    reader.onerror = function() {
        showStatus('ファイルの読み込みに失敗しました', 'error');
    };

    reader.readAsText(file);
}

function saveScreenshot() {
    // ローディング表示
    loading.style.display = 'flex';
    status.textContent = '';

    // 選択されたサイズを取得
    const [width, height] = sizeSelect.value.split('x').map(Number);

    // プレビューのコンテンツ内の最初の子要素（メインコンテンツ）を取得
    const targetElement = preview.contentDocument.body.children[0] || preview.contentDocument.body;

    // html2canvasで変換
    html2canvas(targetElement, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: width,
        height: height,
        windowWidth: width,
        windowHeight: height
    }).then(canvas => {
        // ローディング非表示
        loading.style.display = 'none';

        // 画像として保存
        const link = document.createElement('a');
        link.download = `screenshot_${new Date().toISOString().replace(/[:.]/g, '')}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.click();

        // ステータス表示
        showStatus('スクリーンショットを保存しました', 'success');
    }).catch(error => {
        // ローディング非表示
        loading.style.display = 'none';

        console.error('スクリーンショット保存エラー:', error);
        showStatus('スクリーンショット保存中にエラーが発生しました', 'error');
    });
}
