#!/bin/bash

echo "🚀 Vercelデプロイ準備中..."

# Vercelがインストールされているかチェック
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLIがインストールされていません。インストール中..."
    npm install -g vercel
fi

# プロジェクトをVercelにデプロイ
echo "📤 Vercelにデプロイ中..."
vercel --prod

echo "✅ デプロイ完了！"
echo "🌐 ウェブサイトにアクセスしてください"