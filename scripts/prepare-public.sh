#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# prepare-public.sh
# git-crypt 暗号化対象ファイルの履歴クリーンアップスクリプト
#
# このスクリプトは以下を実行します:
# 1. 未暗号化ファイルを git index から削除→再追加（暗号化状態に修正）
# 2. git-filter-repo で過去履歴から平文を完全除去
#
# 注意: 破壊的操作です。実行前にバックアップを取ってください。
# ============================================================

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "=== Step 0: バックアップ確認 ==="
echo "このスクリプトは git 履歴を書き換えます。"
echo "リモートへの force push が必要になります。"
read -p "バックアップは取りましたか？ (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "中止します。バックアップを取ってから再実行してください。"
  exit 1
fi

echo ""
echo "=== Step 1: git-crypt が unlock 状態か確認 ==="
if ! git-crypt status &>/dev/null; then
  echo "ERROR: git-crypt status が失敗しました。git-crypt unlock を先に実行してください。"
  exit 1
fi

echo ""
echo "=== Step 2: 未暗号化ファイルの一覧を取得 ==="
UNENCRYPTED_FILES=$(git-crypt status 2>&1 | grep "NOT ENCRYPTED" | sed 's/.*encrypted: //' | sed 's/ \*\*\*.*//')
FILE_COUNT=$(echo "$UNENCRYPTED_FILES" | wc -l | tr -d ' ')
echo "未暗号化ファイル数: $FILE_COUNT"

if [[ "$FILE_COUNT" -eq 0 ]]; then
  echo "未暗号化ファイルはありません。Step 2 をスキップします。"
else
  echo ""
  echo "=== Step 3: 未暗号化ファイルを index から削除→再追加 ==="
  echo "$UNENCRYPTED_FILES" | while IFS= read -r file; do
    if [[ -n "$file" ]]; then
      echo "  fixing: $file"
      git rm --cached "$file" 2>/dev/null || true
    fi
  done

  git commit -m "chore: remove unencrypted files from index for re-encryption" || true

  echo "$UNENCRYPTED_FILES" | while IFS= read -r file; do
    if [[ -n "$file" && -f "$file" ]]; then
      git add "$file"
    fi
  done

  git commit -m "chore: re-add files as git-crypt encrypted" || true
fi

echo ""
echo "=== Step 4: git-crypt 暗号化状態を確認 ==="
REMAINING=$(git-crypt status 2>&1 | grep -c "NOT ENCRYPTED" || true)
if [[ "$REMAINING" -gt 0 ]]; then
  echo "WARNING: まだ $REMAINING ファイルが未暗号化です。"
  git-crypt status 2>&1 | grep "NOT ENCRYPTED"
  echo ""
  echo "手動で対処が必要な場合があります。"
else
  echo "OK: すべてのファイルが暗号化されています。"
fi

echo ""
echo "=== Step 5: git-filter-repo で履歴から平文を除去 ==="
echo ""
echo "以下のパターンに一致するファイルの過去バージョンを履歴から除去します:"
echo "  - .claude/**"
echo "  - prompt/**"
echo "  - openspec/**"
echo "  - .github/instructions/**"
echo "  - src-tauri/src/github/secrets.rs"
echo "  - CLAUDE.md"
echo ""
read -p "履歴の書き換えを実行しますか？ (y/N): " confirm2
if [[ "$confirm2" != "y" && "$confirm2" != "Y" ]]; then
  echo "履歴書き換えをスキップしました。"
  echo "手動で実行する場合: git filter-repo --invert-paths --path-glob '.claude/**' --path-glob 'prompt/**' ..."
  exit 0
fi

# git-filter-repo は fresh clone を推奨するが、--force で既存リポジトリでも実行可能
git filter-repo --force \
  --invert-paths \
  --path 'CLAUDE.md' \
  --path-glob '.claude/**' \
  --path-glob 'prompt/**' \
  --path-glob 'openspec/**' \
  --path-glob '.github/instructions/**' \
  --path 'src-tauri/src/github/secrets.rs'

echo ""
echo "=== Step 6: git-crypt を再初期化 ==="
echo "git-filter-repo が履歴を書き換えたため、git-crypt の再セットアップが必要です。"
echo ""
echo "以下を手動で実行してください:"
echo "  1. git-crypt init"
echo "  2. git-crypt add-gpg-user <YOUR-GPG-KEY-ID>"
echo "  3. 暗号化対象ファイルを再追加:"
echo "     git add CLAUDE.md .claude/ prompt/ openspec/ .github/instructions/ src-tauri/src/github/secrets.rs"
echo "     git commit -m 'chore: re-add encrypted files after history cleanup'"
echo "  4. リモートへ force push:"
echo "     git push --force-with-lease origin main"
echo ""
echo "=== 完了 ==="
