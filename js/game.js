class LemonFukuwarai {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isGameActive = false;
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.placedPositions = []; // 各パーツの配置位置を記憶
        this.revealedBoxIndex = 0; // 現在公開されているボックスのインデックス
        this.randomOrder = []; // ゲーム毎のランダム順序
        this.currentDragBox = null; // 現在ドラッグ中のボックス
        this.dragFollower = null; // ドラッグ追跡要素
        this.currentTitle = ''; // 作品の題名
        this.partsVisible = true; // パーツボックス表示状態
        
        // 元画像のサイズとスケール設定
        this.originalImageSize = { width: 608, height: 859 };
        this.canvasScale = this.calculateCanvasScale();
        
        // レモのパーツ定義
        this.parts = [
            { name: 'body', file: 'body.png', displayName: '体' },
            { name: 'head', file: 'head.png', displayName: '頭' },
            { name: 'l_leg', file: 'l_leg.png', displayName: '右足' },
            { name: 'r_leg', file: 'r_leg.png', displayName: '左足' },
            { name: 'l_hand', file: 'l_hand.png', displayName: '右手' },
            { name: 'r_hand', file: 'r_hand.png', displayName: '左手' },
            { name: 'head_top', file: 'head_top.png', displayName: '頭の上' },
            { name: 'antenna', file: 'antenna.png', displayName: 'アンテナ' },
            { name: 'antenna_ball', file: 'antenna_ball.png', displayName: 'アンテナボール' },
            { name: 'mouth_lower', file: 'mouth_lower.png', displayName: '下唇' },
            { name: 'mouth_upper', file: 'mouth_upper.png', displayName: '上唇' },
            { name: 'l_eye', file: 'l_eye.png', displayName: '右目' },
            { name: 'r_eye', file: 'r_eye.png', displayName: '左目' }
        ];
        
        // レイヤー順序（描画順序 - 下から上へ）
        this.layerOrder = [
            'body', 'head', 'l_leg', 'r_leg', 'l_hand', 'r_hand',
            'head_top', 'antenna', 'antenna_ball', 'mouth_lower',
            'mouth_upper', 'l_eye', 'r_eye'
        ];
        
        this.images = {};
        this.init();
    }

    calculateCanvasScale() {
        const scaleX = this.canvas.width / this.originalImageSize.width;
        const scaleY = this.canvas.height / this.originalImageSize.height;
        return Math.min(scaleX, scaleY);
    }

    drawScaledImage(img, x, y) {
        // スケールを適用して画像を描画
        const scaledWidth = img.width * this.canvasScale;
        const scaledHeight = img.height * this.canvasScale;
        
        this.ctx.drawImage(
            img,
            x - scaledWidth / 2,
            y - scaledHeight / 2,
            scaledWidth,
            scaledHeight
        );
    }

    async init() {
        this.dragFollower = document.getElementById('dragFollower');
        this.togglePartsBtn = document.getElementById('togglePartsBtn');
        this.setupTitleModal();
        
        // モーダルを確実に非表示にする
        const modal = document.getElementById('titleModal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
        }
        
        await this.loadImages();
        this.setupEventListeners();
        
        // 画像読み込み完了後にゲーム開始
        this.startGame();
    }

    async loadImages() {
        console.log('画像読み込み開始...');
        this.showStatus('画像を読み込んでいます...');
        
        const imagePromises = this.parts.map((part, index) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const imagePath = `./レモふくわらい/${part.file}`;
                
                img.onload = () => {
                    console.log(`✓ 読み込み成功: ${imagePath} (${img.width}x${img.height})`);
                    this.images[part.name] = img;
                    resolve();
                };
                
                img.onerror = (error) => {
                    console.error(`✗ 読み込み失敗: ${imagePath}`, error);
                    // フォールバック: スラッシュなしでも試行
                    const fallbackPath = `レモふくわらい/${part.file}`;
                    img.src = fallbackPath;
                    console.log(`フォールバック試行: ${fallbackPath}`);
                    
                    img.onerror = () => {
                        reject(error);
                    };
                };
                
                console.log(`読み込み試行 ${index + 1}/13: ${imagePath}`);
                img.src = imagePath;
            });
        });

        try {
            await Promise.all(imagePromises);
            console.log('✓ 全画像の読み込み完了!');
            console.log('読み込まれた画像:', Object.keys(this.images));
        } catch (error) {
            console.error('✗ 画像読み込みエラー:', error);
            this.showStatus('画像の読み込みに失敗しました');
        }
    }

    setupEventListeners() {
        const resetBtn = document.getElementById('resetBtn');
        resetBtn.addEventListener('click', () => this.resetGame());
        resetBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.resetGame();
        });
        
        // 目ボタンのイベントリスナー
        this.togglePartsBtn.addEventListener('click', () => this.togglePartsVisibility());
        this.togglePartsBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.togglePartsVisibility();
        });
        
        // キャンバスでのドラッグ継続・終了
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // 全体でのマウス離す処理とタッチムーブ処理
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    }

    startGame() {
        this.isGameActive = true;
        this.revealedBoxIndex = 0;
        this.placedPositions = [];
        this.currentDragBox = null;
        
        this.showStatus('ゲームを開始します...');
        
        // head、body、残りパーツの順序を生成
        this.generateRandomOrder();
        
        // パーツボックスを作成
        this.createPartsBoxes();
        
        this.clearCanvas();
        this.revealNextBox();
    }
    
    generateRandomOrder() {
        // 1番目：head、2番目：body、3番目以降：ランダム
        const headPart = this.parts.find(part => part.name === 'head');
        const bodyPart = this.parts.find(part => part.name === 'body');
        const otherParts = this.parts.filter(part => 
            part.name !== 'head' && part.name !== 'body'
        );
        
        // 残りのパーツをシャッフル
        for (let i = otherParts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [otherParts[i], otherParts[j]] = [otherParts[j], otherParts[i]];
        }
        
        // 順序を設定：head → body → ランダムな残りパーツ
        this.randomOrder = [headPart, bodyPart, ...otherParts];
    }
    
    createPartsBoxes() {
        const leftBoxesContainer = document.getElementById('leftPartsBoxes');
        const rightBoxesContainer = document.getElementById('rightPartsBoxes');
        leftBoxesContainer.innerHTML = '';
        rightBoxesContainer.innerHTML = '';
        
        this.randomOrder.forEach((part, index) => {
            const box = document.createElement('div');
            box.className = 'part-box';
            box.dataset.partIndex = index;
            box.dataset.partName = part.name;
            
            // 最初はクエスチョンマーク
            box.innerHTML = '<span class="question-mark">?</span>';
            
            // ドラッグイベントを設定（後でrevealedクラス時のみ有効）
            box.addEventListener('mousedown', (e) => this.handleBoxMouseDown(e, box, part));
            box.addEventListener('touchstart', (e) => this.handleBoxTouchStart(e, box, part));
            
            // 左側に6個、右側に7個配置
            if (index < 6) {
                leftBoxesContainer.appendChild(box);
            } else {
                rightBoxesContainer.appendChild(box);
            }
        });
        
    }
    
    revealNextBox() {
        if (this.revealedBoxIndex >= this.randomOrder.length) {
            return;
        }
        
        // 左右のボックスから該当するものを取得
        const allBoxes = [
            ...document.querySelectorAll('#leftPartsBoxes .part-box'),
            ...document.querySelectorAll('#rightPartsBoxes .part-box')
        ];
        const box = allBoxes[this.revealedBoxIndex];
        const part = this.randomOrder[this.revealedBoxIndex];
        
        if (box) {
            box.classList.add('revealed');
            box.innerHTML = `<img src="レモふくわらい/${part.file}" alt="${part.displayName}">`;
        }
        
        this.showStatus(`${part.displayName}をドラッグして配置してください`);
    }

    // ボックスからのドラッグ開始
    handleBoxMouseDown(e, box, part) {
        if (!this.isGameActive || !box.classList.contains('revealed') || box.classList.contains('used')) {
            return;
        }
        
        this.isDragging = true;
        this.currentDragBox = { box, part };
        this.dragStartPos = { x: e.clientX, y: e.clientY };
        document.body.style.cursor = 'grabbing';
        
        e.preventDefault();
    }

    handleBoxTouchStart(e, box, part) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.handleBoxMouseDown(mouseEvent, box, part);
        
        // タッチフィードバック
        box.style.transform = 'scale(0.95)';
        
        // ドラッグ追跡要素を表示
        this.showDragFollower(touch.clientX, touch.clientY);
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.currentDragBox) return;
        
        const rect = this.canvas.getBoundingClientRect();
        // キャンバスの実際のサイズとCSSサイズの違いを考慮
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        this.redrawWithDraggedPart(x, y);
    }

    handleMouseUp(e) {
        if (!this.isDragging || !this.currentDragBox) return;
        
        const rect = this.canvas.getBoundingClientRect();
        // キャンバスの実際のサイズとCSSサイズの違いを考慮
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        // キャンバス内でドロップされた場合のみ配置
        if (x >= 0 && x <= this.canvas.width && y >= 0 && y <= this.canvas.height) {
            this.placePart(x, y);
        } else {
            // キャンバス外にドロップした場合はキャンバスをクリア
            this.clearCanvas();
        }
        
        this.isDragging = false;
        this.currentDragBox = null;
        document.body.style.cursor = 'default';
    }

    // タッチイベントハンドラー（パーツボックス用は handleBoxTouchStart で処理済み）

    handleTouchMove(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!this.isDragging || !this.currentDragBox) return;
        
        const touch = e.touches[0];
        if (!touch) return;
        
        // ドラッグ追跡要素のみを更新（キャンバス描画は無効化）
        this.showDragFollower(touch.clientX, touch.clientY);
    }

    handleTouchEnd(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // ドラッグ追跡要素を隠す
        this.hideDragFollower();
        
        // 描画状態をクリア
        this.pendingDrawPos = null;
        this.drawPending = false;
        
        const touch = e.changedTouches[0];
        const mouseEvent = new MouseEvent('mouseup', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.handleMouseUp(mouseEvent);
        
        // タッチ特有のリセット
        if (this.currentDragBox && this.currentDragBox.box) {
            this.currentDragBox.box.style.transform = '';
        }
    }


    redrawWithDraggedPart(x, y) {
        if (!this.currentDragBox) return;
        
        const part = this.currentDragBox.part;
        const img = this.images[part.name];
        if (!img) return;
        
        // PC用のキャンバス描画
        this.clearCanvas();
        this.drawScaledImage(img, x, y);
    }
    
    showDragFollower(clientX, clientY) {
        if (!this.dragFollower || !this.currentDragBox) return;
        
        const part = this.currentDragBox.part;
        const img = this.images[part.name];
        if (!img) return;
        
        // ドラッグ時は操作しやすい小さめのサイズ（キャンバスサイズの60%）
        const baseScaledWidth = img.width * this.canvasScale;
        const baseScaledHeight = img.height * this.canvasScale;
        const scaledWidth = baseScaledWidth * 0.6;
        const scaledHeight = baseScaledHeight * 0.6;
        
        // 画像設定を一度だけ行う（ドラッグ開始時）
        if (!this.dragFollower.classList.contains('active')) {
            this.dragFollower.innerHTML = `
                <img src="./レモふくわらい/${part.file}" 
                     alt="${part.displayName}" 
                     style="width: ${scaledWidth}px; height: ${scaledHeight}px;">
            `;
            this.dragFollower.classList.add('active');
            this.dragFollower.style.left = '0px';
            this.dragFollower.style.top = '0px';
        }
        
        // 画像の中心を指の位置に合わせる
        const offsetX = scaledWidth / 2;
        const offsetY = scaledHeight / 2;
        this.dragFollower.style.transform = `translate(${clientX - offsetX}px, ${clientY - offsetY}px)`;
    }
    
    hideDragFollower() {
        if (!this.dragFollower) return;
        this.dragFollower.classList.remove('active');
        this.dragFollower.innerHTML = '';
        this.dragFollower.style.transform = '';
    }

    async placePart(x, y) {
        if (!this.currentDragBox) return;
        
        const { box, part } = this.currentDragBox;
        
        // 配置位置を記憶
        this.placedPositions.push({
            part: part,
            x: x,
            y: y
        });
        
        // ボックスを使用済みにする
        box.classList.add('used');
        
        // 配置アニメーション
        await this.showPlacementAnimation(x, y);
        
        // 次のボックスを公開
        this.revealedBoxIndex++;
        
        if (this.revealedBoxIndex < this.randomOrder.length) {
            // すぐに次のボックスを公開
            setTimeout(() => {
                this.revealNextBox();
            }, 100);
        } else {
            // 全パーツ完了
            this.showFinalResult();
        }
    }

    async showPlacementAnimation(x, y) {
        if (!this.currentDragBox) return;
        
        const part = this.currentDragBox.part;
        const img = this.images[part.name];
        if (!img) return;
        
        this.clearCanvas();
        
        const scaledHeight = img.height * this.canvasScale;
        
        // 高速化された「ここに配置！」アニメーション
        for (let i = 0; i < 2; i++) {
            // パーツを点滅させる
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            if (i % 2 === 0) {
                this.drawScaledImage(img, x, y);
                
                // 「配置！」テキスト表示
                this.ctx.fillStyle = '#ff6600';
                this.ctx.font = 'bold 20px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('配置！', x, y - scaledHeight / 2 - 15);
            }
            
            await this.sleep(100);
        }
        
        // 最後にパーツを消す
        this.clearCanvas();
        this.showStatus(`${part.displayName}を配置しました！`);
    }

    async showFinalResult() {
        this.isGameActive = false;
        this.clearCanvas();
        this.showStatus('すべてのパーツを配置中...');
        
        // レイヤー順序で描画
        for (const layerPartName of this.layerOrder) {
            const placement = this.placedPositions.find(p => p.part.name === layerPartName);
            if (placement) {
                const img = this.images[placement.part.name];
                if (img) {
                    this.drawScaledImage(img, placement.x, placement.y);
                    await this.sleep(250);
                }
            }
        }
        
        // 題名入力モーダルを表示
        this.showTitleModal();
    }
    
    setupTitleModal() {
        this.titleModal = document.getElementById('titleModal');
        this.titleInput = document.getElementById('titleInput');
        this.saveTitleBtn = document.getElementById('saveTitleBtn');
        this.skipTitleBtn = document.getElementById('skipTitleBtn');
        this.savedTitle = document.getElementById('savedTitle');
        this.displayTitle = document.getElementById('displayTitle');
        this.artworkTitle = document.getElementById('artworkTitle');
        this.canvasTitleText = document.getElementById('canvasTitleText');
        
        // イベントリスナー
        this.saveTitleBtn.addEventListener('click', () => this.saveTitle());
        this.skipTitleBtn.addEventListener('click', () => this.skipTitle());
        
        // Enterキーで保存
        this.titleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveTitle();
            }
        });
        
        // タッチ対応
        this.saveTitleBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.saveTitle();
        });
        
        this.skipTitleBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.skipTitle();
        });
    }
    
    showTitleModal() {
        this.titleModal.style.display = 'flex';
        this.titleModal.classList.add('show');
        this.titleInput.value = '';
        this.savedTitle.style.display = 'none';
        
        // モバイルでのフォーカス処理を改善
        setTimeout(() => {
            this.titleInput.focus();
            // iOS Safariでのフォーカス問題対応
            if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                this.titleInput.click();
            }
        }, 100);
    }
    
    hideTitleModal() {
        this.titleModal.classList.remove('show');
        setTimeout(() => {
            this.titleModal.style.display = 'none';
        }, 300);
    }
    
    saveTitle() {
        const title = this.titleInput.value.trim();
        if (title) {
            this.currentTitle = title;
            this.displayTitle.textContent = title;
            this.savedTitle.style.display = 'block';
            this.showStatus(`完成！「${title}」ができました！`);
            
            // キャンバス下に作品名を表示
            this.showArtworkTitle(title);
        } else {
            this.skipTitle();
        }
        
        setTimeout(() => {
            this.hideTitleModal();
        }, 2000);
    }
    
    skipTitle() {
        this.currentTitle = 'レモの福笑い';
        this.showStatus('完成！レモの福笑いができました！');
        
        // デフォルトタイトルを表示
        this.showArtworkTitle(this.currentTitle);
        this.hideTitleModal();
    }
    
    showArtworkTitle(title) {
        this.canvasTitleText.textContent = title;
        this.artworkTitle.style.display = 'flex';
        
        // キャンバスコンテナに額装スタイルを適用
        const canvasContainer = document.querySelector('.canvas-container');
        canvasContainer.classList.add('completed');
        
        // 目ボタンを表示
        this.togglePartsBtn.style.display = 'inline-block';
        this.updateToggleButtonIcon();
        
        // 少し遅延させてアニメーション効果
        setTimeout(() => {
            this.artworkTitle.classList.add('show');
        }, 500);
    }
    
    hideArtworkTitle() {
        this.artworkTitle.classList.remove('show');
        
        // 額装スタイルも削除
        const canvasContainer = document.querySelector('.canvas-container');
        canvasContainer.classList.remove('completed');
        
        // 目ボタンを非表示にし、パーツボックスを表示状態に戻す
        this.togglePartsBtn.style.display = 'none';
        this.partsVisible = true;
        const leftSide = document.querySelector('.parts-side.left-side');
        const rightSide = document.querySelector('.parts-side.right-side');
        leftSide.classList.remove('hidden');
        rightSide.classList.remove('hidden');
        
        setTimeout(() => {
            this.artworkTitle.style.display = 'none';
        }, 800);
    }

    togglePartsVisibility() {
        this.partsVisible = !this.partsVisible;
        const leftSide = document.querySelector('.parts-side.left-side');
        const rightSide = document.querySelector('.parts-side.right-side');
        
        if (this.partsVisible) {
            leftSide.classList.remove('hidden');
            rightSide.classList.remove('hidden');
        } else {
            leftSide.classList.add('hidden');
            rightSide.classList.add('hidden');
        }
        
        this.updateToggleButtonIcon();
    }
    
    updateToggleButtonIcon() {
        if (this.partsVisible) {
            this.togglePartsBtn.textContent = '👁️';
            this.togglePartsBtn.classList.remove('parts-hidden');
        } else {
            this.togglePartsBtn.textContent = '👁️‍🗨️';
            this.togglePartsBtn.classList.add('parts-hidden');
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    resetGame() {
        this.isGameActive = false;
        this.isDragging = false;
        this.revealedBoxIndex = 0;
        this.placedPositions = [];
        this.currentDragBox = null;
        this.randomOrder = [];
        this.currentTitle = '';
        
        // モーダルを隠す
        if (this.titleModal) {
            this.hideTitleModal();
        }
        
        // 作品名表示を隠す
        if (this.artworkTitle) {
            this.hideArtworkTitle();
        }
        
        this.clearCanvas();
        this.showStatus('新しいゲームを開始します...');
        
        // パーツボックスをクリア
        const leftBoxesContainer = document.getElementById('leftPartsBoxes');
        const rightBoxesContainer = document.getElementById('rightPartsBoxes');
        leftBoxesContainer.innerHTML = '';
        rightBoxesContainer.innerHTML = '';
        
        document.body.style.cursor = 'default';
        
        setTimeout(() => {
            this.startGame();
        }, 500);
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    showStatus(message) {
        document.getElementById('gameStatus').innerHTML = `<p>${message}</p>`;
    }

}

// ゲーム開始
document.addEventListener('DOMContentLoaded', () => {
    new LemonFukuwarai();
});