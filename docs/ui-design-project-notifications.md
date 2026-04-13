# UI設計: プロジェクトごとの通知別管理

> GitHub Desktop のリポジトリ切り替えと同じメンタルモデル。
> プロジェクトを選ぶと、通知/ビュー/ダッシュボードが全部そのプロジェクトの世界になる。

## 設計原則

| 原則 | 説明 |
|------|------|
| **コンテキスト分離** | プロジェクトAの作業中にBの情報は見えない |
| **ビュー定義は共通** | ビューはグローバル定義。プロジェクト切替でスコープだけ変わる |
| **通知設定はプロジェクト単位** | プロジェクトごとに「どの通知を受けるか」を設定 |
| **タブバッジで他プロジェクトを把握** | 中身は隠れるが未読件数だけ見える |

---

## サイドバー: プロジェクトタブバー

サイドバー最上部にタブバーを配置。GitHub Desktop のリポジトリセレクタと同様、
選択したプロジェクトのリポジトリに画面全体がスコープされる。

### 「すべて」選択時（デフォルト）

```
┌──────────────────┐
│ ┌───┐┌────┐┌────┐│
│ │ALL ││案件A││案件B││ [+]
│ └━━━┘└──7─┘└──3─┘│
│ ──────────────── │ ← 全リポジトリ
│                  │
│ ◆ ダッシュボード     │
│ ◆ 受信トレイ   18  │
│                  │
│ ─ ビュー ─────── │
│ ◇ 重要な通知  5  ● │
│ ◇ レビュー待ち    │
│ ◇ 自分のPR      │
│ + ビューを追加   │
│                  │
│ [user]     [⚙]  │
└──────────────────┘
```

### 「案件A」タブ選択時

```
┌──────────────────┐
│ ┌───┐┌────┐┌────┐│
│ │ALL ││案件A││案件B││ [+]
│ └───┘└━━━━┘└──3─┘│
│ ───── ● ──────── │ ← 案件Aカラーライン
│                  │
│ ◆ ダッシュボード     │ ← repo-1, repo-2 のみ
│ ◆ 受信トレイ    7  │ ← repo-1, repo-2 のみ
│                  │
│ ─ ビュー ─────── │
│ ◇ 重要な通知  3  ● │ ← repo-1, repo-2 のみ
│ ◇ レビュー待ち    │ ← repo-1, repo-2 のみ
│ ◇ 自分のPR   1  │ ← repo-1, repo-2 のみ
│ + ビューを追加   │
│                  │
│ [user]     [⚙]  │
└──────────────────┘

※ 案件Bの通知は一切表示されない
※ 案件Bタブの「3」バッジで未読があることだけわかる
```

### 「案件B」タブ選択時

```
┌──────────────────┐
│ ┌───┐┌────┐┌────┐│
│ │ALL ││案件A││案件B││ [+]
│ └───┘└──7─┘└━━━━┘│
│ ───── ● ──────── │ ← 案件Bカラーライン
│                  │
│ ◆ ダッシュボード     │ ← repo-3, repo-4 のみ
│ ◆ 受信トレイ    3  │ ← repo-3, repo-4 のみ
│                  │
│ ─ ビュー ─────── │
│ ◇ 重要な通知  1   │ ← repo-3, repo-4 のみ
│ ◇ レビュー待ち    │ ← repo-3, repo-4 のみ
│ ◇ 自分のPR      │ ← repo-3, repo-4 のみ
│ + ビューを追加   │
│                  │
│ [user]     [⚙]  │
└──────────────────┘

※ 案件Aの通知は一切表示されない
```

### タブバーの詳細

```
  選択中                    非選択（バッジ付き）  非選択（バッジ付き）
┌────────┐  ┌───────────┐  ┌───────────┐
│  ALL   │  │ ● 案件A  7 │  │ ● 案件B  3 │  [+]
└━━━━━━━━┘  └───────────┘  └───────────┘
                ↑ カラードット     ↑ 未読バッジ
```

- 選択中タブ: 下線 or 背景色でアクティブ表示
- 非選択タブ: プロジェクトカラードット + 未読バッジ
- `[+]` ボタン: 新規プロジェクト作成（設定のプロジェクトタブを開く）
- タブが多い場合: 横スクロール or `…` メニュー

---

## 設定ダイアログ: プロジェクト編集

### プロジェクト一覧

```
┌─────────────────────────────────────┐
│  設定                                │
├─────────────────────────────────────┤
│  [プロジェクト] [フィルター] [外観] [アカウント] │
├─────────────────────────────────────┤
│                                     │
│  ● 案件A     2リポ     [編集] [削除] │
│  ● 案件B     4リポ     [編集] [削除] │
│                                     │
│  [     + プロジェクトを追加     ]     │
└─────────────────────────────────────┘
```

### プロジェクト編集（通知設定を追加）

```
┌─────────────────────────────────────┐
│  プロジェクトを編集                    │
├─────────────────────────────────────┤
│                                     │
│  [案件A                       ]     │
│                                     │
│  カラー:                             │
│  (●)(●)(●)(●)(●)(●)(●)              │
│                                     │
│  リポジトリ (2件選択):                 │
│  ┌───────────────────────────┐      │
│  │ ☑ org/repo-1             │      │
│  │ ☑ org/repo-2             │      │
│  │ ☐ org/repo-3             │      │
│  │ ☐ other-org/repo-4       │      │
│  └───────────────────────────┘      │
│                                     │
│  ── 通知設定 ──────────── NEW ──    │
│                                     │
│  ☑ デスクトップ通知                  │
│                                     │
│  通知する種類:                        │
│  ☑ レビュー依頼  ☑ メンション        │
│  ☑ チームメンション  ☑ アサイン      │
│  ☐ 作成者  ☐ CI                     │
│  ☐ コメント  ☐ 状態変更              │
│                                     │
│  ☑ 通知音                           │
│    [標準] [ソフト] [チャイム]          │
│                                     │
│  [      保存      ] [キャンセル]      │
└─────────────────────────────────────┘
```

---

## 操作フロー

### フロー1: 「案件Aのメンションだけ通知」

```
1. 設定 > プロジェクト > [+ プロジェクトを追加]
   名前: 案件A
   リポジトリ: ☑ org/repo-1, ☑ org/repo-2
   通知: ☑ デスクトップ通知
         ☑ メンション ☑ レビュー依頼 ☑ アサイン
         ☑ 通知音 → 標準
   → [保存]

2. サイドバーに [案件A] タブが出現
   → タップで案件Aの世界に切り替わる
   → 完了（ビュー作成不要）
```

### フロー2: 「案件Bは通知なし、見るだけ」

```
1. 設定 > プロジェクト > [+ プロジェクトを追加]
   名前: 案件B
   リポジトリ: ☑ org/repo-3, ☑ org/repo-4
   通知: ☐ デスクトップ通知
   → [保存]

2. サイドバーに [案件B] タブが出現
   → 案件Bの通知はリストで確認できるが通知は来ない
```

### フロー3: 案件Aの作業中に案件Bの新着に気づく

```
                  案件Aタブ選択中
┌───┐┌────┐┌──────────┐
│ALL ││案件A││ ● 案件B  3 │  ← 「3件来てるな」とわかる
└───┘└━━━━┘└──────────┘
                         ↑ 中身は見えないがバッジで把握
                           タブ切替で確認可能
```

### フロー4: プロジェクトにリポジトリを追加

```
1. 設定 > プロジェクト > 案件A [編集]
   リポジトリ: ☑ repo-1, ☑ repo-2, ☑ repo-5 (追加)
   → [保存]

2. 案件Aタブの全ビューが自動的に repo-5 も対象にする
   → ビューの再編集不要
```

---

## 型定義

```typescript
// types/settings.ts

export interface RepositoryGroup {
  id: string;
  name: string;
  repositories: string[];
  color?: string | null;
  // ↓ NEW: プロジェクト単位の通知設定
  enableDesktopNotification: boolean;
  notifyReasons: NotificationReason[];   // 空配列 = 通知なし
  enableSound: boolean;
  soundType: SoundType;
}

// CustomFilter は変更なし
// ビューはグローバル共通定義。プロジェクトタブ切替でスコープが変わる。
```

## スコープ判定ロジック

```typescript
// App.tsx — プロジェクトタブによるスコープ

const activeGroup = activeGroupId
  ? repositoryGroups.find(g => g.id === activeGroupId)
  : null;

// プロジェクト選択時: そのグループのリポジトリだけに絞る
// 「すべて」選択時: 全リポジトリ
const scopedItems = activeGroup
  ? inbox.items.filter(item =>
      activeGroup.repositories.includes(item.repositoryFullName)
    )
  : inbox.items;

// scopedItems を全ビュー・ダッシュボード・受信トレイに渡す
// → ビュー定義の変更不要。入力データがスコープされるだけ。
```

## デスクトップ通知判定ロジック

```typescript
// hooks/use-inbox-notification.ts

function shouldNotify(
  item: InboxItem,
  groups: RepositoryGroup[],
  globalDesktopNotification: boolean,
): boolean {
  if (!globalDesktopNotification) return false;

  // アイテムが属するプロジェクトを探す
  const group = groups.find(g =>
    g.repositories.includes(item.repositoryFullName)
  );

  if (group) {
    // プロジェクトに属する → プロジェクトの通知設定に従う
    return group.enableDesktopNotification
      && (group.notifyReasons.length === 0
          || group.notifyReasons.includes(item.reason));
  }

  // どのプロジェクトにも属さない → グローバルフィルタで判定（既存挙動）
  return customFilters.some(f =>
    f.enableDesktopNotification && checkFilterMatch(item, f)
  );
}
```

---

## 変更ファイル一覧

### Phase 0: フィルタロジック統合（技術的負債解消）
- `src/hooks/use-inbox-notification.ts` — `checkFilterMatch` を `lib/filters/match-filter.ts` に統合
- `src/components/layout/sidebar.tsx` — ローカル `matchesFilter` を削除、統合版を使用
- `src/hooks/use-inbox.ts` — `shouldShowItem` の参照先を統合版に切替

### Phase 1: 型定義 + Rust側永続化
- `src/types/settings.ts` — `RepositoryGroup` に通知設定フィールド追加
- `src/lib/tauri/schemas.ts` — Valibot スキーマ更新
- `src-tauri/src/storage/config.rs` — 新フィールドの保存/読み込み

### Phase 2: サイドバーのタブバー化
- `src/components/layout/sidebar.tsx` — プロジェクトセクションをタブバーに置換
- `src/components/layout/sidebar-icons.tsx` — タブ用アイコン追加（必要に応じて）
- `src/App.tsx` — `activeGroupId` の管理をタブバーに接続

### Phase 3: プロジェクト編集に通知設定UI追加
- `src/components/settings/group-manager.tsx` — 通知設定セクション追加

### Phase 4: 通知判定ロジック改修
- `src/hooks/use-inbox-notification.ts` — プロジェクト単位の通知判定
- `src/hooks/use-inbox.ts` — プロジェクトスコープの反映
- `src/lib/filters/match-filter.ts` — `globalExcludeReasons` の全経路適用
