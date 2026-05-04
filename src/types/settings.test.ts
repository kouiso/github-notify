import { describe, expect, it } from 'vitest';
import {
  type CustomFilter,
  DEFAULT_INITIAL_FILTERS,
  type IssueStatusRule,
  isSearchView,
  migrateDefaultFilters,
} from './settings';

// テスト用のカスタムフィルタを生成するヘルパー
function makeFilter(overrides: Partial<CustomFilter> & { id: string; name: string }): CustomFilter {
  return {
    reasons: [],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
    ...overrides,
  };
}

describe('DEFAULT_INITIAL_FILTERS', () => {
  it('3件のデフォルトフィルタが定義されている', () => {
    expect(DEFAULT_INITIAL_FILTERS).toHaveLength(3);
  });

  it('最初のフィルタは default-important', () => {
    expect(DEFAULT_INITIAL_FILTERS[0].id).toBe('default-important');
  });

  it('default-important は重要な reason を含む', () => {
    const filter = DEFAULT_INITIAL_FILTERS[0];
    expect(filter.reasons).toContain('review_requested');
    expect(filter.reasons).toContain('mention');
    expect(filter.reasons).toContain('team_mention');
    expect(filter.reasons).toContain('assign');
    expect(filter.reasons).not.toContain('author');
  });

  it('default-needs-review は searchQuery を持つ', () => {
    const filter = DEFAULT_INITIAL_FILTERS[1];
    expect(filter.id).toBe('default-needs-review');
    expect(filter.searchQuery).toBeTruthy();
    expect(filter.searchQuery).toContain('review-requested:@me');
  });

  it('default-my-prs は searchQuery を持つ', () => {
    const filter = DEFAULT_INITIAL_FILTERS[2];
    expect(filter.id).toBe('default-my-prs');
    expect(filter.searchQuery).toBeTruthy();
    expect(filter.searchQuery).toContain('author:@me');
  });
});

describe('isSearchView', () => {
  it('searchQuery が空文字列の場合は false', () => {
    const filter = makeFilter({ id: 'a', name: 'A', searchQuery: '' });
    expect(isSearchView(filter)).toBe(false);
  });

  it('searchQuery が空白のみの場合は false', () => {
    const filter = makeFilter({ id: 'a', name: 'A', searchQuery: '   ' });
    expect(isSearchView(filter)).toBe(false);
  });

  it('searchQuery が undefined の場合は false', () => {
    const filter = makeFilter({ id: 'a', name: 'A' });
    expect(isSearchView(filter)).toBe(false);
  });

  it('searchQuery に文字列が設定されている場合は true', () => {
    const filter = makeFilter({ id: 'a', name: 'A', searchQuery: 'is:open is:pr author:@me' });
    expect(isSearchView(filter)).toBe(true);
  });

  it('DEFAULT_INITIAL_FILTERS の検索ビューは true になる', () => {
    // default-needs-review と default-my-prs が検索ビューと判定される
    expect(isSearchView(DEFAULT_INITIAL_FILTERS[1])).toBe(true);
    expect(isSearchView(DEFAULT_INITIAL_FILTERS[2])).toBe(true);
  });

  it('DEFAULT_INITIAL_FILTERS の default-important は false になる', () => {
    // searchQuery を持たないため
    expect(isSearchView(DEFAULT_INITIAL_FILTERS[0])).toBe(false);
  });
});

describe('migrateDefaultFilters', () => {
  describe('空配列の入力', () => {
    it('空配列を渡すと全デフォルトフィルタが追加される', () => {
      const { filters, changed } = migrateDefaultFilters([]);
      expect(changed).toBe(true);
      expect(filters.some((f) => f.id === 'default-important')).toBe(true);
      expect(filters.some((f) => f.id === 'default-needs-review')).toBe(true);
      expect(filters.some((f) => f.id === 'default-my-prs')).toBe(true);
    });

    it('空配列を渡すと 3 件のフィルタが返される', () => {
      const { filters } = migrateDefaultFilters([]);
      expect(filters).toHaveLength(3);
    });
  });

  describe('既に全デフォルトが揃っている場合', () => {
    it('変更不要な場合は changed = false', () => {
      const { filters, changed } = migrateDefaultFilters([...DEFAULT_INITIAL_FILTERS]);
      expect(changed).toBe(false);
      expect(filters).toHaveLength(DEFAULT_INITIAL_FILTERS.length);
    });

    it('ユーザーフィルタも保持される', () => {
      const userFilter = makeFilter({
        id: 'user-1',
        name: 'ユーザーフィルタ',
        // default-important の reason のサブセットではないため保持される
        reasons: ['ci_activity'],
      });
      const input = [...DEFAULT_INITIAL_FILTERS, userFilter];
      const { filters, changed } = migrateDefaultFilters(input);
      expect(changed).toBe(false);
      expect(filters.some((f) => f.id === 'user-1')).toBe(true);
    });
  });

  describe('旧デフォルト ID を持つフィルタの削除', () => {
    it('old default IDs は削除される', () => {
      const oldFilters: CustomFilter[] = [
        makeFilter({ id: 'default-review', name: 'Old Review', reasons: ['review_requested'] }),
        makeFilter({ id: 'default-mention', name: 'Old Mention', reasons: ['mention'] }),
        makeFilter({ id: 'default-assign', name: 'Old Assign', reasons: ['assign'] }),
        makeFilter({ id: 'default-author', name: 'Old Author', reasons: ['author'] }),
      ];
      const { filters, changed } = migrateDefaultFilters(oldFilters);
      expect(changed).toBe(true);
      // 旧フィルタは全て削除される
      expect(filters.some((f) => f.id === 'default-review')).toBe(false);
      expect(filters.some((f) => f.id === 'default-mention')).toBe(false);
      expect(filters.some((f) => f.id === 'default-assign')).toBe(false);
      expect(filters.some((f) => f.id === 'default-author')).toBe(false);
      // 新デフォルトが追加される
      expect(filters.some((f) => f.id === 'default-important')).toBe(true);
    });
  });

  describe('デフォルトの reason のサブセットフィルタの削除', () => {
    it('default-important の reason のサブセットであるフィルタは削除される', () => {
      const subsetFilter = makeFilter({
        id: 'custom-review',
        name: 'カスタムレビュー',
        reasons: ['review_requested', 'mention'],
        repositories: [],
      });
      const input = [...DEFAULT_INITIAL_FILTERS, subsetFilter];
      const { filters } = migrateDefaultFilters(input);
      // サブセットフィルタは削除される
      expect(filters.some((f) => f.id === 'custom-review')).toBe(false);
    });

    it('リポジトリスコープ付きのサブセットフィルタは保持される', () => {
      const scopedFilter = makeFilter({
        id: 'custom-scoped',
        name: 'リポジトリスコープ付き',
        reasons: ['review_requested'],
        repositories: ['owner/repo'],
      });
      const input = [...DEFAULT_INITIAL_FILTERS, scopedFilter];
      const { filters } = migrateDefaultFilters(input);
      // リポジトリ指定があれば保持される
      expect(filters.some((f) => f.id === 'custom-scoped')).toBe(true);
    });

    it('デフォルト以外の reason を含むフィルタは保持される', () => {
      const notSubsetFilter = makeFilter({
        id: 'custom-ci',
        name: 'CI通知',
        reasons: ['ci_activity'],
        repositories: [],
      });
      const input = [...DEFAULT_INITIAL_FILTERS, notSubsetFilter];
      const { filters } = migrateDefaultFilters(input);
      expect(filters.some((f) => f.id === 'custom-ci')).toBe(true);
    });

    it('検索ビューのユーザーフィルタは削除されない', () => {
      const searchFilter = makeFilter({
        id: 'custom-search',
        name: 'カスタム検索',
        searchQuery: 'is:open is:pr label:bug',
      });
      const input = [...DEFAULT_INITIAL_FILTERS, searchFilter];
      const { filters } = migrateDefaultFilters(input);
      expect(filters.some((f) => f.id === 'custom-search')).toBe(true);
    });
  });

  describe('searchQuery パッチ', () => {
    it('searchQuery が未設定の default-needs-review に searchQuery が補完される', () => {
      const brokenNeedsReview: CustomFilter = {
        id: 'default-needs-review',
        name: 'Needs My Review',
        reasons: [],
        enableDesktopNotification: false,
        enableSound: false,
        soundType: 'default',
        // searchQuery を意図的に省略（マイグレーション前の壊れた状態）
      };
      const input = [DEFAULT_INITIAL_FILTERS[0], brokenNeedsReview, DEFAULT_INITIAL_FILTERS[2]];
      const { filters, changed } = migrateDefaultFilters(input);
      expect(changed).toBe(true);
      const patchedFilter = filters.find((f) => f.id === 'default-needs-review');
      expect(patchedFilter?.searchQuery).toBe(DEFAULT_INITIAL_FILTERS[1].searchQuery);
    });

    it('searchQuery が未設定の default-my-prs に searchQuery が補完される', () => {
      const brokenMyPrs: CustomFilter = {
        id: 'default-my-prs',
        name: 'My PRs',
        reasons: [],
        enableDesktopNotification: false,
        enableSound: false,
        soundType: 'default',
        // searchQuery を意図的に省略
      };
      const input = [DEFAULT_INITIAL_FILTERS[0], DEFAULT_INITIAL_FILTERS[1], brokenMyPrs];
      const { filters, changed } = migrateDefaultFilters(input);
      expect(changed).toBe(true);
      const patchedFilter = filters.find((f) => f.id === 'default-my-prs');
      expect(patchedFilter?.searchQuery).toBe(DEFAULT_INITIAL_FILTERS[2].searchQuery);
    });
  });

  describe('デフォルトフィルタの順序', () => {
    it('default-important が先頭付近に追加される', () => {
      const { filters } = migrateDefaultFilters([]);
      const idx = filters.findIndex((f) => f.id === 'default-important');
      expect(idx).toBe(0);
    });

    it('default-needs-review は default-important の直後に配置される', () => {
      const { filters } = migrateDefaultFilters([]);
      const importantIdx = filters.findIndex((f) => f.id === 'default-important');
      const reviewIdx = filters.findIndex((f) => f.id === 'default-needs-review');
      expect(reviewIdx).toBe(importantIdx + 1);
    });

    it('default-my-prs は default-needs-review の直後に配置される', () => {
      const { filters } = migrateDefaultFilters([]);
      const reviewIdx = filters.findIndex((f) => f.id === 'default-needs-review');
      const myPrsIdx = filters.findIndex((f) => f.id === 'default-my-prs');
      expect(myPrsIdx).toBe(reviewIdx + 1);
    });
  });

  describe('デフォルトビュー名の日本語マイグレーション', () => {
    it('旧英語名のデフォルトビューが日本語名にリネームされる', () => {
      const oldNameFilters = [
        DEFAULT_INITIAL_FILTERS[0],
        { ...DEFAULT_INITIAL_FILTERS[1], name: 'Needs My Review' },
        { ...DEFAULT_INITIAL_FILTERS[2], name: 'My PRs' },
      ];
      const { filters, changed } = migrateDefaultFilters(oldNameFilters);
      expect(changed).toBe(true);
      expect(filters.find((f) => f.id === 'default-needs-review')?.name).toBe('レビュー待ち');
      expect(filters.find((f) => f.id === 'default-my-prs')?.name).toBe('自分のPR');
    });

    it('既に日本語名なら changed = false', () => {
      const { changed } = migrateDefaultFilters([...DEFAULT_INITIAL_FILTERS]);
      expect(changed).toBe(false);
    });
  });

  describe('戻り値の型チェック', () => {
    it('filters プロパティは配列', () => {
      const result = migrateDefaultFilters([]);
      expect(Array.isArray(result.filters)).toBe(true);
    });

    it('changed プロパティは boolean', () => {
      const result = migrateDefaultFilters([]);
      expect(typeof result.changed).toBe('boolean');
    });
  });
});

describe('IssueStatusRule', () => {
  it('CustomFilterにissueStatusRulesフィールドが設定できること', () => {
    const filter = makeFilter({
      id: 'test-filter',
      name: 'テスト',
      searchQuery: 'is:open is:pr review-requested:@me',
      issueStatusRules: [
        {
          repositoryPattern: 'getozinc/mypappy-*',
          requiredStatuses: ['コードレビュー'],
          enabled: true,
        },
      ],
    });
    expect(filter.issueStatusRules).toHaveLength(1);
    expect(filter.issueStatusRules![0].repositoryPattern).toBe('getozinc/mypappy-*');
    expect(filter.issueStatusRules![0].requiredStatuses).toEqual(['コードレビュー']);
    expect(filter.issueStatusRules![0].enabled).toBe(true);
  });

  it('issueStatusRulesが未設定の場合undefinedであること', () => {
    const filter = makeFilter({ id: 'no-rules', name: 'ルールなし' });
    expect(filter.issueStatusRules).toBeUndefined();
  });

  it('複数ルールを設定できること', () => {
    const rules: IssueStatusRule[] = [
      { repositoryPattern: 'org-a/*', requiredStatuses: ['Review'], enabled: true },
      { repositoryPattern: 'org-b/*', requiredStatuses: ['QA', 'Testing'], enabled: false },
    ];
    const filter = makeFilter({
      id: 'multi',
      name: 'マルチルール',
      searchQuery: 'is:open is:pr',
      issueStatusRules: rules,
    });
    expect(filter.issueStatusRules).toHaveLength(2);
    expect(filter.issueStatusRules![1].enabled).toBe(false);
    expect(filter.issueStatusRules![1].requiredStatuses).toEqual(['QA', 'Testing']);
  });
});

describe('migrateDefaultFilters — issueStatusRules保持', () => {
  it('マイグレーション時にissueStatusRulesが保持されること', () => {
    const filtersWithRules: CustomFilter[] = [
      {
        ...DEFAULT_INITIAL_FILTERS[0],
      },
      {
        ...DEFAULT_INITIAL_FILTERS[1],
        issueStatusRules: [
          { repositoryPattern: 'getozinc/*', requiredStatuses: ['コードレビュー'], enabled: true },
        ],
      },
      {
        ...DEFAULT_INITIAL_FILTERS[2],
      },
    ];
    const { filters } = migrateDefaultFilters(filtersWithRules);
    const needsReview = filters.find((f) => f.id === 'default-needs-review');
    expect(needsReview?.issueStatusRules).toHaveLength(1);
    expect(needsReview?.issueStatusRules?.[0].repositoryPattern).toBe('getozinc/*');
  });
});

describe('isSearchView — issueStatusRules付きフィルタ', () => {
  it('searchQuery付きかつissueStatusRules付きのフィルタをsearch viewとして判定すること', () => {
    const filter = makeFilter({
      id: 'with-rules',
      name: 'ルール付き',
      searchQuery: 'is:open is:pr review-requested:@me',
      issueStatusRules: [
        { repositoryPattern: 'org/*', requiredStatuses: ['Review'], enabled: true },
      ],
    });
    expect(isSearchView(filter)).toBe(true);
  });

  it('searchQueryなしでissueStatusRulesのみのフィルタはsearch viewではないこと', () => {
    const filter = makeFilter({
      id: 'only-rules',
      name: 'ルールのみ',
      issueStatusRules: [
        { repositoryPattern: 'org/*', requiredStatuses: ['Review'], enabled: true },
      ],
    });
    expect(isSearchView(filter)).toBe(false);
  });
});

describe('migrateDefaultFilters — author reason 削除', () => {
  it('旧デフォルトのまま（author含む5 reasons）なら author を除去', () => {
    const oldDefault = makeFilter({
      id: 'default-important',
      name: '重要な通知',
      reasons: ['review_requested', 'mention', 'team_mention', 'assign', 'author'],
    });
    const { filters, changed } = migrateDefaultFilters([
      oldDefault,
      makeFilter({
        id: 'default-needs-review',
        name: 'レビュー待ち',
        searchQuery: 'is:open is:pr review-requested:@me -reviewed-by:@me',
      }),
      makeFilter({
        id: 'default-my-prs',
        name: '自分のPR',
        searchQuery: 'is:open is:pr author:@me',
      }),
    ]);
    expect(changed).toBe(true);
    const important = filters.find((f) => f.id === 'default-important');
    expect(important?.reasons).not.toContain('author');
    expect(important?.reasons).toContain('review_requested');
    expect(important?.reasons).toContain('mention');
  });

  it('ユーザーがカスタマイズ（authorに加えて別reason追加）していたら触らない', () => {
    const customized = makeFilter({
      id: 'default-important',
      name: '重要な通知',
      reasons: ['review_requested', 'mention', 'team_mention', 'assign', 'author', 'comment'],
    });
    const { filters } = migrateDefaultFilters([
      customized,
      makeFilter({
        id: 'default-needs-review',
        name: 'レビュー待ち',
        searchQuery: 'is:open is:pr review-requested:@me -reviewed-by:@me',
      }),
      makeFilter({
        id: 'default-my-prs',
        name: '自分のPR',
        searchQuery: 'is:open is:pr author:@me',
      }),
    ]);
    const important = filters.find((f) => f.id === 'default-important');
    expect(important?.reasons).toContain('author');
    expect(important?.reasons).toContain('comment');
  });

  it('ユーザーがauthorを既に削除していたら何もしない', () => {
    const alreadyFixed = makeFilter({
      id: 'default-important',
      name: '重要な通知',
      reasons: ['review_requested', 'mention', 'team_mention', 'assign'],
    });
    const { filters, changed } = migrateDefaultFilters([
      alreadyFixed,
      makeFilter({
        id: 'default-needs-review',
        name: 'レビュー待ち',
        searchQuery: 'is:open is:pr review-requested:@me -reviewed-by:@me',
      }),
      makeFilter({
        id: 'default-my-prs',
        name: '自分のPR',
        searchQuery: 'is:open is:pr author:@me',
      }),
    ]);
    expect(changed).toBe(false);
    const important = filters.find((f) => f.id === 'default-important');
    expect(important?.reasons).not.toContain('author');
  });
});
