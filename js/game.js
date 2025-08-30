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
        
        // 元画像のサイズとスケール設定
        this.originalImageSize = { width: 608, height: 859 };
        this.canvasScale = this.calculateCanvasScale();
        
        // レモのパーツ定義
        this.parts = [
            { name: 'body', file: 'body.png', displayName: '体' },
            { name: 'head', file: 'head.png', displayName: '頭' },
            { name: 'l_leg', file: 'l_leg.png', displayName: '左足' },
            { name: 'r_leg', file: 'r_leg.png', displayName: '右足' },
            { name: 'l_hand', file: 'l_hand.png', displayName: '左手' },
            { name: 'r_hand', file: 'r_hand.png', displayName: '右手' },
            { name: 'head_top', file: 'head_top.png', displayName: '頭の上' },
            { name: 'antenna', file: 'antenna.png', displayName: 'アンテナ' },
            { name: 'antenna_ball', file: 'antenna_ball.png', displayName: 'アンテナボール' },
            { name: 'mouth_lower', file: 'mouth_lower.png', displayName: '下唇' },
            { name: 'mouth_upper', file: 'mouth_upper.png', displayName: '上唇' },
            { name: 'l_eye', file: 'l_eye.png', displayName: '左目' },
            { name: 'r_eye', file: 'r_eye.png', displayName: '右目' }
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
                const imagePath = `レモふくわらい/${part.file}`;
                
                img.onload = () => {
                    console.log(`✓ 読み込み成功: ${imagePath} (${img.width}x${img.height})`);
                    this.images[part.name] = img;
                    resolve();
                };
                
                img.onerror = (error) => {
                    console.error(`✗ 読み込み失敗: ${imagePath}`, error);
                    reject(error);
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
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
        
        // キャンバスでのドラッグ継続・終了
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // 全体でのマウス離す処理
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
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
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.handleMouseMove(mouseEvent);
    }

    handleTouchEnd(e) {
        e.preventDefault();
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
        
        this.clearCanvas();
        this.drawScaledImage(img, x, y);
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
        
        this.showStatus('完成！レモの福笑いができました！');
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