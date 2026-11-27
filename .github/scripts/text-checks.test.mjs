// text-checks のテスト（#99）。判定の本体は brain #110 の写し（Python）で、ここでは
// ①写しが元のコミットから一字もずれていないこと、②写しが本体と同じ結果を返すこと（本体の examples）、
// ③呼び出し側（text-checks-caller.cjs）が規則名だけを返し、当たった文字や追加の語を出さないこと、
// ④コメント（issue コメント・レビューコメント・レビュー本文）も同じ呼び出し側で扱え、GitHub への読み書きの分岐が想定どおりであることを偽の github で確かめる。
// 秘密の形の例は、検査ツールに本物と間違われないよう文字をつないで作る（どれも作り物）。

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const caller = require('./text-checks-caller.cjs');
const config = require('../text-checks.config.json');
const source = require('../text-checks.source.json');

const ROOT = path.resolve(import.meta.dirname, '../..');
const EXAMPLES = path.join(caller.CHECKS_DIR, 'examples');
const example = (name) => readFileSync(path.join(EXAMPLES, name), 'utf8');
const join = (...parts) => parts.join('');

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

describe('写しのずれ検査（brain #110 の本体）', () => {
  test('元のリポと固定したコミットが書いてある', () => {
    expect(source.status).toBe('vendored');
    expect(source.repo).toBe('kouiso/brain');
    expect(source.issue).toBe(110);
    expect(source.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  test.each(source.files.map((f) => [f.path, f]))('%s が写したときの中身と一致する', (_p, f) => {
    const actual = createHash('sha256')
      .update(readFileSync(path.join(ROOT, f.path)))
      .digest('hex');
    expect(actual).toBe(f.sha256);
  });

  test('写しの置き場所には、記録にないファイルが無い', () => {
    const listed = source.files.map((f) => f.path).sort();
    const present = listFiles(caller.CHECKS_DIR)
      .map((p) => path.relative(ROOT, p))
      .filter((p) => !p.includes('__pycache__'))
      .sort();
    expect(present).toEqual(listed);
  });
});

const CORE = { configFile: null };

describe('写しが本体と同じ結果を返す（本体の examples）', () => {
  test('issue_ok は緑、issue_ng は本体と同じ3件で赤', () => {
    expect(caller.runFormatCheck(example('issue_ok.md'), 'issue', CORE)).toEqual({
      ok: true,
      problems: [],
    });
    expect(caller.runFormatCheck(example('issue_ng.md'), 'issue', CORE)).toEqual({
      ok: false,
      problems: [
        '「今どこまで」が未記入です',
        '「次にやること」が未記入です',
        '見出し「誰の判断待ち」がありません',
      ],
    });
  });

  test('pr_ok は緑、pr_ng は本体と同じ2件で赤', () => {
    expect(caller.runFormatCheck(example('pr_ok.md'), 'pr', CORE)).toEqual({
      ok: true,
      problems: [],
    });
    expect(caller.runFormatCheck(example('pr_ng.md'), 'pr', CORE)).toEqual({
      ok: false,
      problems: [
        '見出し「変更内容」がありません',
        '「関連Issue」に #番号 か issue の URL がありません',
      ],
    });
  });

  test('public_ok は緑（コミット番号は注意だけで止めない）', () => {
    const r = caller.runPublicCheck(example('public_ok.md'));
    expect(r.ok).toBe(true);
    expect(r.hits).toEqual([]);
  });

  test('直すと赤から緑に変わる', () => {
    const fixed = example('issue_ng.md')
      .replace('### 今どこまで\n-', '### 今どこまで\n- 作った')
      .replace('<!-- ここに書く -->', '- 呼ぶ側を作る\n\n## 誰の判断待ち\n- 副長');
    expect(caller.runFormatCheck(fixed, 'issue', CORE).ok).toBe(true);
  });

  test('このリポの見出しの例は、設定なしでは赤、設定ありでは緑（本体の examples）', () => {
    for (const [name, kind] of [
      ['issue_skillsheet_example.md', 'issue'],
      ['issue_skillsheet_task_example.md', 'issue'],
      ['pr_skillsheet_example.md', 'pr'],
    ]) {
      expect(caller.runFormatCheck(example(name), kind, CORE).ok).toBe(false);
      expect(caller.runFormatCheck(example(name), kind)).toEqual({ ok: true, problems: [] });
    }
  });

  test('設定ありでも、別名の見出しが空なら赤', () => {
    expect(caller.runFormatCheck(example('issue_skillsheet_empty.md'), 'issue').ok).toBe(false);
  });
});

describe('このリポの見出しの設定', () => {
  test('設定は本体の examples の設定と同じ中身', () => {
    expect(readFileSync(caller.HEADINGS_CONFIG, 'utf8')).toBe(
      example('config_skillsheet_example.json'),
    );
  });

  test('フォームの形（### 見出し）の本文でも通る', () => {
    const issue =
      '### (Why?)なぜ、このタスクをやるのか？\n分かりやすくする。\n\n### (Complete!) 完成の定義(箇条書き)\n- 画面が直る\n';
    expect(caller.runFormatCheck(issue, 'issue')).toEqual({ ok: true, problems: [] });
    const pr =
      '## Issue リンク / Link to Issue\nCloses #99\n\n## 概要\n直した。\n\n## 見て欲しいポイント\n- 呼び出し側\n';
    expect(caller.runFormatCheck(pr, 'pr')).toEqual({ ok: true, problems: [] });
  });

  test('github-notify のフォームとテンプレートが通る', () => {
    // SBI フォーム（タスク概要・受け入れ基準）は別名で 背景・完了条件 に当たる
    const sbi =
      '### 親PBI\n#1\n\n### タスク概要\n呼び出しを足す。\n\n### 受け入れ基準\n- テストが通る\n';
    expect(caller.runFormatCheck(sbi, 'issue')).toEqual({ ok: true, problems: [] });
    // pull_request_template.md と同じ見出し構成（概要/変更内容/関連Issue + リポ固有の欄）
    const pr =
      '## 概要 / Summary\ntext-checks を移植した。\n\n## 変更内容 / Changes\n- workflow と写しを足した\n\n## 関連 Issue / Related Issue\n- Refs #99\n\n## Notification-loss Prevention Contribution\n- なし\n\n## Expected vs Actual\n- Expected: 通る\n- Actual: 通る\n\n## Verification\n- vitest\n';
    expect(caller.runFormatCheck(pr, 'pr')).toEqual({ ok: true, problems: [] });
  });

  test('beta フィードバックの issue は書き方チェックの対象外', () => {
    expect(
      caller.shouldSkipFormat({ kind: 'issue', author: 'someone', labels: ['beta'] }, config),
    ).toBe(true);
    expect(
      caller.shouldSkipFormat({ kind: 'issue', author: 'someone', labels: ['feedback'] }, config),
    ).toBe(true);
  });
});

describe('公開内容チェック（呼び出し側）', () => {
  const FAKE = {
    '秘密の値(よくある鍵の形)': join('これを使う: ', 'gh', 'p_', 'EXAMPLEONLY0000'),
    'DBの名前・接続先': join('接続先は ', 'postgres', '://example/test'),
    メールアドレス: join('連絡先は someone', '@', 'example.com'),
    金額: join('見積もりは 120,000', '円'),
  };

  test.each(Object.entries(FAKE))('作り物の例で赤になる: %s', (rule, text) => {
    const r = caller.runPublicCheck(`ふつうの1行目\n${text}`);
    expect(r.ok).toBe(false);
    expect(r.hits).toContainEqual({ rule, line: 2, count: 1 });
  });

  test('知らせる文には規則の名前と行だけを書き、当たった文字は書かない', () => {
    const text = FAKE.メールアドレス;
    const report = caller.formatReport('public', caller.runPublicCheck(text), config);
    expect(report.startsWith(`${config.marker}:public\n`)).toBe(true);
    expect(report).toContain('- メールアドレス: 1件、1行目');
    expect(report).not.toContain('example.com');
  });

  test('本文が空なら公開内容は OK（本体の終了コード 2）', () => {
    expect(caller.runPublicCheck('').ok).toBe(true);
    expect(caller.runPublicCheck('  \n').ok).toBe(true);
  });
});

describe('追加の禁止語（secret から一時ファイルで渡す）', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'text-checks-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('未設定なら一時ファイルを作らず、一般の規則だけで判定する', () => {
    expect(caller.writeExtraFile(undefined, dir)).toBeNull();
    expect(caller.writeExtraFile('  \n', dir)).toBeNull();
    expect(caller.runPublicCheck('サンプル商事さんの件', { extraFile: null }).ok).toBe(true);
  });

  test('語が当たると赤、知らせる文に語は出ない（規則名は番号だけ）', () => {
    const file = caller.writeExtraFile('# 注釈\nサンプル商事', dir);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const r = caller.runPublicCheck('サンプル商事さんの件', { extraFile: file });
    expect(r.hits).toEqual([{ rule: '追加の禁止語 1 番目', line: 1, count: 1 }]);
    const report = caller.formatReport('public', r, config, 'public-body');
    expect(report.startsWith(`${config.marker}:public-body\n`)).toBe(true);
    expect(report).not.toContain('サンプル商事');
  });
});

describe('対象外と知らせる文', () => {
  test('ボット・下書き PR・アラート系ラベルは書き方チェックを飛ばす', () => {
    expect(caller.shouldSkipFormat({ kind: 'issue', author: 'github-actions[bot]' }, config)).toBe(
      true,
    );
    expect(
      caller.shouldSkipFormat({ kind: 'pull_request', author: 'someone', draft: true }, config),
    ).toBe(true);
    expect(
      caller.shouldSkipFormat({ kind: 'issue', author: 'someone', labels: ['ci-failure'] }, config),
    ).toBe(true);
    expect(
      caller.shouldSkipFormat({ kind: 'issue', author: 'someone', labels: ['bug'] }, config),
    ).toBe(false);
    expect(
      caller.shouldSkipFormat({ kind: 'pull_request', author: 'someone', draft: false }, config),
    ).toBe(false);
  });

  test('書き方の結果の文は目印で始まり、足りないものを本体の文のまま並べる', () => {
    const r = caller.runFormatCheck(example('pr_ng.md'), 'pr');
    const report = caller.formatReport('format', r, config);
    expect(report.split('\n')[0]).toBe(`${config.marker}:format`);
    expect(report).toContain('- 見出し「変更内容」がありません');
    expect(caller.formatReport('format', { ok: true, problems: [] }, config)).toBe(
      `${config.marker}:format\n書き方チェック: OK`,
    );
  });
});

describe('検査の対象を揃える（resolveTarget）', () => {
  const user = (login) => ({ login });

  test('issues: 本文・作者・ラベルを返し、コメントは無い', () => {
    const t = caller.resolveTarget('issues', {
      issue: {
        number: 5,
        body: '本文',
        user: user('alice'),
        labels: [{ name: 'bug' }, { name: 'beta' }],
      },
    });
    expect(t).toEqual({
      number: 5,
      body: '本文',
      author: 'alice',
      kind: 'issue',
      labels: ['bug', 'beta'],
      draft: false,
      comment: null,
    });
  });

  test('pull_request_target: draft を引き継ぎ、本文が null でも落ちない', () => {
    const t = caller.resolveTarget('pull_request_target', {
      pull_request: { number: 7, body: null, user: user('bob'), draft: true },
    });
    expect(t).toMatchObject({
      number: 7,
      body: null,
      author: 'bob',
      kind: 'pull_request',
      draft: true,
      comment: null,
    });
  });

  test('issue_comment: issue 上のコメントは kind=issue、PR 上のコメントは kind=pull_request', () => {
    const comment = {
      id: 11,
      body: 'こめんと',
      html_url: 'https://example.test/c/11',
      user: user('carol'),
    };
    const onIssue = caller.resolveTarget('issue_comment', {
      issue: { number: 3, user: user('alice'), labels: [{ name: 'bug' }] },
      comment,
    });
    expect(onIssue).toEqual({
      number: 3,
      body: 'こめんと',
      author: 'carol',
      kind: 'issue',
      labels: ['bug'],
      draft: false,
      comment: { id: 11, url: 'https://example.test/c/11', type: 'issue_comment' },
    });
    const onPr = caller.resolveTarget('issue_comment', {
      issue: { number: 4, user: user('alice'), pull_request: { url: 'https://example.test/pr/4' } },
      comment,
    });
    expect(onPr).toMatchObject({ number: 4, kind: 'pull_request', labels: [] });
  });

  test('レビュー系は fork の payload を信用できないので、直接は扱わない', () => {
    expect(() => caller.resolveTarget('pull_request_review_comment', {})).toThrow(
      '未対応のイベント',
    );
    expect(() => caller.resolveTarget('pull_request_review', {})).toThrow('未対応のイベント');
  });

  test('作者が消えたアカウント（user が null）でも落ちない', () => {
    const t = caller.resolveTarget('issue_comment', {
      issue: { number: 3, user: null },
      comment: { id: 1, body: 'x', html_url: 'u', user: null },
    });
    expect(t.author).toBeNull();
  });

  test('未対応のイベントは明示的に失敗する', () => {
    expect(() => caller.resolveTarget('push', {})).toThrow('未対応のイベント');
  });
});

describe('コメントの検査（ループ防止・鍵・知らせる文）', () => {
  test('shouldSkipComment: github-actions[bot] だけ飛ばし、目印で始まる人のコメントは飛ばさない', () => {
    expect(caller.shouldSkipComment({ body: '普通', author: 'github-actions[bot]' })).toBe(true);
    // 目印つきでも人が書いたものは検査する（飛ばすと検査を逃れる抜け道になる）
    expect(
      caller.shouldSkipComment({ body: `${config.marker}:public-body\nok`, author: 'someone' }),
    ).toBe(false);
    expect(caller.shouldSkipComment({ body: '普通', author: 'someone' })).toBe(false);
    expect(caller.shouldSkipComment({ body: null, author: null })).toBe(false);
  });

  test('commentKey: 種類と id から一意の鍵を作る', () => {
    expect(caller.commentKey({ id: 12, type: 'issue_comment' })).toBe(
      'public-comment-issue_comment-12',
    );
    expect(caller.commentKey({ id: 12, type: 'review_comment' })).toBe(
      'public-comment-review_comment-12',
    );
    expect(caller.commentKey({ id: 12, type: 'review' })).toBe('public-comment-review-12');
  });

  test('formatReport: コメントの URL を目印の直後に載せる（本文は載せない）', () => {
    const url = 'https://example.test/issues/3#issuecomment-11';
    const key = caller.commentKey({ id: 11, type: 'issue_comment' });
    const ng = caller.formatReport(
      'public',
      caller.runPublicCheck(join('連絡先は someone', '@', 'example.com')),
      config,
      key,
      url,
    );
    expect(ng.split('\n').slice(0, 2)).toEqual([
      `${config.marker}:${key}`,
      `対象のコメント: ${url}`,
    ]);
    expect(ng).toContain('- メールアドレス: 1件、1行目');
    expect(ng).not.toContain('example.com');
    // コメントは編集では履歴に残るので、直すのではなく削除を案内する
    expect(ng).toContain('コメントを削除して書き直してください');
    expect(ng).not.toContain('本文を直してください');
    // 本文の知らせは今まで通り（URL の行が増えない）
    expect(
      caller.formatReport('public', { ok: true, hits: [], notices: [] }, config, 'public-body'),
    ).toBe(`${config.marker}:public-body\n公開内容チェック: OK（当たった規則はありません）`);
    const bodyNg = caller.formatReport(
      'public',
      caller.runPublicCheck(join('連絡先は someone', '@', 'example.com')),
      config,
      'public-body',
    );
    expect(bodyNg).toContain('本文を直してください');
  });

  test('formatReport: レビューは削除できないので、本文の編集と履歴の扱いを案内する', () => {
    const key = caller.commentKey({ id: 31, type: 'review' });
    const ng = caller.formatReport(
      'public',
      caller.runPublicCheck(join('連絡先は someone', '@', 'example.com')),
      config,
      key,
      'https://example.test/r/31',
      'review',
    );
    expect(ng).toContain('レビュー本文を編集して直してください');
    expect(ng).toContain('履歴には元の文字が残って見えます');
    expect(ng).toContain('リポジトリの管理者に連絡してください');
    expect(ng).not.toContain('コメントを削除して書き直してください');
  });

  test('作り物の秘密・メールを含むコメントは赤、ふつうの文は緑', () => {
    const secret = join('トークンは ', 'gh', 'p_', 'EXAMPLEONLY0000', ' です');
    const email = join('連絡は someone', '@', 'example.com', ' まで');
    expect(caller.runPublicCheck(secret).ok).toBe(false);
    expect(caller.runPublicCheck(email).ok).toBe(false);
    expect(caller.runPublicCheck('レビューありがとうございます。直しました。').ok).toBe(true);
  });

  test('writeOrWarn: 403 は警告にして続け、それ以外のエラーは投げ直す', async () => {
    const warnings = [];
    const warn = (m) => warnings.push(m);
    expect(await caller.writeOrWarn(async () => undefined, warn)).toBe(true);
    const forbidden = Object.assign(new Error('Resource not accessible by integration'), {
      status: 403,
    });
    expect(
      await caller.writeOrWarn(async () => {
        throw forbidden;
      }, warn),
    ).toBe(false);
    expect(warnings).toHaveLength(1);
    // レート制限は権限の 403 と違い、黙らず落とす
    for (const headers of [{ 'retry-after': '30' }, { 'x-ratelimit-remaining': '0' }]) {
      const limited = Object.assign(new Error('limited'), { status: 403, response: { headers } });
      await expect(
        caller.writeOrWarn(async () => {
          throw limited;
        }, warn),
      ).rejects.toThrow('limited');
    }
    const limited429 = Object.assign(new Error('429'), {
      status: 429,
      response: { headers: { 'retry-after': '5' } },
    });
    await expect(
      caller.writeOrWarn(async () => {
        throw limited429;
      }, warn),
    ).rejects.toThrow('429');
    // 残りがあるなら権限の 403 として警告にする
    const withRemaining = Object.assign(new Error('perm'), {
      status: 403,
      response: { headers: { 'x-ratelimit-remaining': '4999' } },
    });
    expect(
      await caller.writeOrWarn(async () => {
        throw withRemaining;
      }, warn),
    ).toBe(false);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).not.toContain('読み取り専用');
    const boom = Object.assign(new Error('boom'), { status: 500 });
    await expect(
      caller.writeOrWarn(async () => {
        throw boom;
      }, warn),
    ).rejects.toThrow('boom');
    expect(warnings).toHaveLength(2);
  });
});

// ---- GitHub への読み書き（偽の github で、呼ばれた API だけを確かめる） ----

const BOT = { login: 'github-actions[bot]' };
const email = join('連絡先は someone', '@', 'example.com');
const noticeOf = (id, key, text = 'x', user = BOT) => ({
  id,
  user,
  body: `${config.marker}:${key}\n${text}`,
});

const listFn = (key) => Object.assign(() => undefined, { key });

// lists は一覧 API ごとの返り値。`キー:番号` があればその PR 専用、なければ `キー` を使う。
// comments は配列なら全部の PR で同じ、オブジェクトなら PR の番号ごと。live はまだ存在するレビュー・レビューコメント（`review:1` など）。
function fakes({
  comments = [],
  lists = {},
  failWith = {},
  pulls = {},
  actions = {},
  live = [],
  fetchFail = null,
} = {}) {
  const calls = {
    list: 0,
    stopped: null,
    paginated: [],
    fetched: [],
    create: [],
    update: [],
    delete: [],
  };
  const fetchOne = (type, id) => async () => {
    calls.fetched.push(`${type}:${id}`);
    if (fetchFail) throw fetchFail;
    if (live.includes(`${type}:${id}`)) return { data: {} };
    throw Object.assign(new Error('Not Found'), { status: 404 });
  };
  const maybeFail = (name) => {
    if (failWith[name])
      throw failWith[name] instanceof Error
        ? failWith[name]
        : Object.assign(new Error(name), { status: failWith[name] });
  };
  const github = {
    paginate: async (fn, params, mapFn) => {
      calls.list += 1;
      calls.paginated.push({ key: fn.key, params });
      if (fn.key === 'issueComments')
        return Array.isArray(comments) ? comments : (comments[params.issue_number] ?? []);
      const n = params.issue_number ?? params.pull_number ?? params.state;
      const v = lists[`${fn.key}:${n}`] ?? lists[fn.key] ?? [];
      const data = typeof v === 'function' ? v(params) : v;
      // { pages: [[...], [...]] } なら複数ページ。octokit の paginate と同じく、ページごとに map へ渡し、done() で以降のページを取らない。
      const pages = data?.pages ?? [data];
      if (!mapFn) return pages.flat();
      calls.stopped = false;
      calls.pagesFetched = 0;
      const out = [];
      for (const page of pages) {
        calls.pagesFetched += 1;
        out.push(
          ...mapFn({ data: page }, () => {
            calls.stopped = true;
          }),
        );
        if (calls.stopped) break;
      }
      return out;
    },
    rest: {
      issues: {
        listComments: listFn('issueComments'),
        createComment: async (p) => {
          maybeFail('create');
          calls.create.push(p);
        },
        updateComment: async (p) => {
          maybeFail('update');
          calls.update.push(p);
        },
        deleteComment: async (p) => {
          maybeFail('delete');
          calls.delete.push(p);
        },
      },
      pulls: {
        list: listFn('pulls'),
        listReviews: listFn('reviews'),
        listReviewComments: listFn('reviewComments'),
        listReviewCommentsForRepo: listFn('repoReviewComments'),
        getReview: (p) => fetchOne('review', p.review_id)(),
        getReviewComment: (p) => fetchOne('review_comment', p.comment_id)(),
        ...pulls,
      },
      actions,
    },
  };
  const logs = { info: [], warning: [], failed: [] };
  const core = {
    info: (m) => logs.info.push(m),
    warning: (m) => logs.warning.push(m),
    setFailed: (m) => logs.failed.push(m),
  };
  return { github, core, calls, logs };
}

const ctx = (eventName, payload) => ({ repo: { owner: 'o', repo: 'r' }, eventName, payload });
const issueEvent = (body, labels = [{ name: 'beta' }]) =>
  ctx('issues', { action: 'edited', issue: { number: 5, body, user: { login: 'alice' }, labels } });
const commentEvent = (body, { action = 'created', login = 'carol', id = 11 } = {}) =>
  ctx('issue_comment', {
    action,
    issue: { number: 3, user: { login: 'alice' }, labels: [] },
    comment: { id, body, html_url: `https://example.test/c/${id}`, user: { login } },
  });
const exec = (f, context) =>
  caller.run({ github: f.github, context, core: f.core, config, extraFile: null });

describe('run: 本文の検査', () => {
  test('本文が NG で知らせが無ければ新規に作り、落とす', async () => {
    const f = fakes();
    await exec(f, issueEvent(email));
    expect(f.calls.create).toHaveLength(1);
    expect(f.calls.create[0]).toMatchObject({ owner: 'o', repo: 'r', issue_number: 5 });
    expect(f.calls.create[0].body.startsWith(`${config.marker}:public-body\n`)).toBe(true);
    expect(f.calls.create[0].body).toContain('本文を直してください');
    expect(f.logs.failed).toHaveLength(1);
  });

  test('本文が OK で以前の知らせがあれば OK に更新する', async () => {
    const f = fakes({ comments: [noticeOf(7, 'public-body', '公開内容チェック: 要確認')] });
    await exec(f, issueEvent('ふつうの文'));
    expect(f.calls.update).toHaveLength(1);
    expect(f.calls.update[0]).toMatchObject({ comment_id: 7 });
    expect(f.calls.update[0].body).toContain('公開内容チェック: OK');
    expect(f.calls.create).toHaveLength(0);
    expect(f.calls.delete).toHaveLength(0);
    expect(f.logs.failed).toHaveLength(0);
  });

  test('本文が OK で知らせも無ければ何も書かない', async () => {
    const f = fakes();
    await exec(f, issueEvent('ふつうの文'));
    expect(f.calls.create).toHaveLength(0);
    expect(f.calls.update).toHaveLength(0);
    expect(f.calls.delete).toHaveLength(0);
    expect(f.logs.failed).toHaveLength(0);
  });
});

describe('run: コメントの検査', () => {
  test('NG なら、コメントごとの鍵と URL つきで新規に作り、落とす', async () => {
    const f = fakes();
    await exec(f, commentEvent(email));
    expect(f.calls.create).toHaveLength(1);
    const body = f.calls.create[0].body;
    expect(f.calls.create[0].issue_number).toBe(3);
    expect(body.split('\n').slice(0, 2)).toEqual([
      `${config.marker}:public-comment-issue_comment-11`,
      '対象のコメント: https://example.test/c/11',
    ]);
    expect(body).not.toContain('example.com');
    expect(f.logs.failed).toHaveLength(1);
  });

  test('NG のまま編集されたら、同じ知らせを更新する（増やさない）', async () => {
    const f = fakes({ comments: [noticeOf(9, 'public-comment-issue_comment-11', '古い')] });
    await exec(f, commentEvent(email, { action: 'edited' }));
    expect(f.calls.update).toHaveLength(1);
    expect(f.calls.update[0].comment_id).toBe(9);
    expect(f.calls.create).toHaveLength(0);
  });

  test('OK になったら、既存の知らせを削除する（OK の知らせは残さない）', async () => {
    const f = fakes({ comments: [noticeOf(9, 'public-comment-issue_comment-11')] });
    await exec(f, commentEvent('直しました', { action: 'edited' }));
    expect(f.calls.delete).toEqual([{ owner: 'o', repo: 'r', comment_id: 9 }]);
    expect(f.calls.create).toHaveLength(0);
    expect(f.calls.update).toHaveLength(0);
    expect(f.logs.failed).toHaveLength(0);
  });

  test('OK で知らせも無ければ何もしない', async () => {
    const f = fakes();
    await exec(f, commentEvent('ふつうの文'));
    expect(f.calls.create.length + f.calls.update.length + f.calls.delete.length).toBe(0);
  });

  test('削除されたコメントは検査せず、知らせだけ消す', async () => {
    const f = fakes({ comments: [noticeOf(9, 'public-comment-issue_comment-11')] });
    // 本文は NG の形でも、削除では見ない
    await exec(f, commentEvent(email, { action: 'deleted' }));
    expect(f.calls.delete).toEqual([{ owner: 'o', repo: 'r', comment_id: 9 }]);
    expect(f.calls.create).toHaveLength(0);
    expect(f.logs.failed).toHaveLength(0);
  });

  test('削除されたコメントに知らせが無ければ何もしない', async () => {
    const f = fakes();
    await exec(f, commentEvent('x', { action: 'deleted' }));
    expect(f.calls.delete).toHaveLength(0);
  });

  test('github-actions[bot] のコメントは、コメント一覧を取る前に飛ばす', async () => {
    const f = fakes();
    await exec(f, commentEvent(email, { login: 'github-actions[bot]' }));
    expect(f.calls.list).toBe(0);
    expect(f.calls.create.length + f.calls.update.length + f.calls.delete.length).toBe(0);
    expect(f.logs.failed).toHaveLength(0);
  });

  test('目印で始まる人のコメントも検査する（抜け道にしない）', async () => {
    const f = fakes();
    await exec(f, commentEvent(`${config.marker}:public-body\n${email}`));
    expect(f.calls.create).toHaveLength(1);
    expect(f.logs.failed).toHaveLength(1);
  });

  test('コメントでは書き方チェックの知らせに触らない', async () => {
    const f = fakes({
      comments: [
        noticeOf(1, 'format', '書き方チェック: 足りない項目があります'),
        noticeOf(2, 'public-body', '公開内容チェック: 要確認'),
        noticeOf(3, 'public-comment-issue_comment-11'),
      ],
    });
    await exec(f, commentEvent('直しました', { action: 'edited' }));
    expect(f.calls.delete.map((c) => c.comment_id)).toEqual([3]);
    expect(f.calls.update).toHaveLength(0);
    expect(f.calls.create).toHaveLength(0);
  });

  test('別の鍵（id が前方一致するだけ）の知らせは自分のものとして扱わない', async () => {
    const f = fakes({ comments: [noticeOf(5, 'public-comment-issue_comment-111')] });
    await exec(f, commentEvent('直しました', { action: 'edited' }));
    expect(f.calls.delete).toHaveLength(0);
  });
});

describe('run: 重複した知らせ', () => {
  test('同じ鍵の知らせが複数あれば、一番古いものを更新し、残りを消す', async () => {
    const f = fakes({
      comments: [
        noticeOf(30, 'public-comment-issue_comment-11', '重複2'),
        noticeOf(10, 'public-comment-issue_comment-11', '古い'),
        noticeOf(20, 'public-comment-issue_comment-11', '重複1'),
      ],
    });
    await exec(f, commentEvent(email, { action: 'edited' }));
    expect(f.calls.update.map((c) => c.comment_id)).toEqual([10]);
    expect(f.calls.delete.map((c) => c.comment_id).sort()).toEqual([20, 30]);
    expect(f.calls.create).toHaveLength(0);
  });

  test('本文の知らせの重複も、古い1つを残して消す', async () => {
    const f = fakes({
      comments: [
        noticeOf(2, 'public-body', '公開内容チェック: 要確認'),
        noticeOf(1, 'public-body', '古い'),
      ],
    });
    await exec(f, issueEvent('ふつうの文'));
    expect(f.calls.update.map((c) => c.comment_id)).toEqual([1]);
    expect(f.calls.delete.map((c) => c.comment_id)).toEqual([2]);
  });

  test('OK や削除のときは、重複も含めてすべて消す', async () => {
    const comments = [
      noticeOf(1, 'public-comment-issue_comment-11'),
      noticeOf(2, 'public-comment-issue_comment-11'),
    ];
    for (const action of ['edited', 'deleted']) {
      const f = fakes({ comments });
      await exec(f, commentEvent(action === 'deleted' ? email : '直しました', { action }));
      expect(f.calls.delete.map((c) => c.comment_id).sort()).toEqual([1, 2]);
    }
  });

  test('重複の削除が 404（別の実行が先に消した）でも失敗にしない', async () => {
    const f = fakes({
      comments: [noticeOf(1, 'public-body'), noticeOf(2, 'public-body')],
      failWith: { delete: 404 },
    });
    await exec(f, issueEvent('ふつうの文'));
    expect(f.logs.warning).toHaveLength(0);
    expect(f.logs.failed).toHaveLength(0);
  });

  test('他の作者の同じ目印は重複として消さない', async () => {
    const f = fakes({
      comments: [
        noticeOf(1, 'public-body'),
        noticeOf(2, 'public-body', '偽', { login: 'mallory' }),
      ],
    });
    await exec(f, issueEvent('ふつうの文'));
    expect(f.calls.delete).toHaveLength(0);
  });
});

describe('run: 知らせの作者と書き込みの失敗', () => {
  test('同じ目印でも github-actions[bot] 以外の作者のコメントは編集も削除もしない', async () => {
    const mallory = { login: 'mallory' };
    const f = fakes({
      comments: [
        noticeOf(1, 'public-body', '偽', mallory),
        noticeOf(2, 'public-comment-issue_comment-11', '偽', mallory),
      ],
    });
    await exec(f, issueEvent('ふつうの文'));
    await exec(f, commentEvent('直しました', { action: 'edited' }));
    expect(f.calls.update).toHaveLength(0);
    expect(f.calls.delete).toHaveLength(0);
    // NG になっても偽物を更新せず、自分の知らせを新規に作る
    await exec(f, issueEvent(email));
    expect(f.calls.update).toHaveLength(0);
    expect(f.calls.create).toHaveLength(1);
  });

  test('作者が無い（消えたアカウント）知らせも触らない', async () => {
    const f = fakes({ comments: [{ id: 1, user: null, body: `${config.marker}:public-body\nx` }] });
    await exec(f, issueEvent('ふつうの文'));
    expect(f.calls.update).toHaveLength(0);
  });

  test('書き込みが 403 でも警告にして判定は続け、NG なら落とす', async () => {
    const f = fakes({ failWith: { create: 403 } });
    await exec(f, issueEvent(email));
    expect(f.logs.warning).toHaveLength(1);
    expect(f.logs.failed).toHaveLength(1);
  });

  test('書き込みが 403 でも OK なら落とさない', async () => {
    const f = fakes({
      comments: [noticeOf(9, 'public-comment-issue_comment-11')],
      failWith: { delete: 403 },
    });
    await exec(f, commentEvent('直しました', { action: 'edited' }));
    expect(f.logs.warning).toHaveLength(1);
    expect(f.logs.failed).toHaveLength(0);
  });

  test('知らせの削除が 404（すでに無い）なら失敗にしない', async () => {
    const f = fakes({
      comments: [noticeOf(9, 'public-comment-issue_comment-11')],
      failWith: { delete: 404 },
    });
    await exec(f, commentEvent('x', { action: 'deleted' }));
    expect(f.logs.warning).toHaveLength(0);
    expect(f.logs.failed).toHaveLength(0);
  });

  test('403 以外の書き込みエラーは投げ直す', async () => {
    const f = fakes({ failWith: { create: 500 } });
    await expect(exec(f, issueEvent(email))).rejects.toThrow('create');
  });
});

describe('中継（workflow_run）と総ざらい', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'text-checks-relay-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  // 本物の zip を作る（unzip の呼び出しまで通すため）。octokit と同じく ArrayBuffer で返す。
  function zipOf(text, name = caller.RELAY_FILE) {
    const src = path.join(dir, name);
    writeFileSync(src, text);
    const out = path.join(dir, `a-${Math.random().toString(36).slice(2)}.zip`);
    const r = spawnSync(
      'python3',
      [
        '-I',
        '-c',
        'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED);z.write(sys.argv[2],sys.argv[3])',
        out,
        src,
        name,
      ],
      { encoding: 'utf8' },
    );
    expect(r.status).toBe(0);
    const buf = readFileSync(out);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  const HEAD = { sha: 'sha-1', ref: 'feature', repo: { full_name: 'forker/r' } };
  const pr = (number, head = HEAD, state = 'open') => ({ number, state, head });
  const RUN = {
    id: 77,
    conclusion: 'success',
    event: 'pull_request_review_comment',
    path: '.github/workflows/text-checks-review-relay.yml',
    head_sha: 'sha-1',
    head_branch: 'feature',
    head_repository: { full_name: 'forker/r', owner: { login: 'forker' } },
  };
  const artifact = { id: 100, name: caller.RELAY_ARTIFACT, expired: false, size_in_bytes: 300 };
  const rc = (id, body, o = {}) => ({
    id,
    body,
    html_url: `https://example.test/rc/${id}`,
    user: { login: 'dave' },
    ...o,
  });
  const rv = (id, body, o = {}) => ({
    id,
    body,
    html_url: `https://example.test/r/${id}`,
    user: { login: 'erin' },
    ...o,
  });

  function relayFakes({
    json = '{"pr_number":9}',
    run = {},
    artifacts = [artifact],
    prs = {},
    ...rest
  } = {}) {
    const rel = { download: 0, listArtifacts: [], get: [] };
    const f = fakes({
      ...rest,
      pulls: {
        get: async (p) => {
          rel.get.push(p.pull_number);
          const v = prs[p.pull_number];
          if (!v) throw Object.assign(new Error('Not Found'), { status: 404 });
          return { data: v };
        },
      },
      actions: {
        listWorkflowRunArtifacts: async (p) => {
          rel.listArtifacts.push(p);
          return { data: { artifacts } };
        },
        downloadArtifact: async () => {
          rel.download += 1;
          return { data: zipOf(json) };
        },
      },
    });
    const context = {
      repo: { owner: 'o', repo: 'r' },
      eventName: 'workflow_run',
      payload: { workflow_run: { ...RUN, ...run } },
    };
    return { ...f, rel, context };
  }
  const go = (f) =>
    caller.run({
      github: f.github,
      context: f.context,
      core: f.core,
      config,
      extraFile: null,
      tmpDir: dir,
    });
  const writes = (f) => f.calls.create.length + f.calls.update.length + f.calls.delete.length;
  const created = (f) =>
    f.calls.create.map((c) => c.body.split('\n')[0].slice(config.marker.length + 1));

  describe('PR の特定', () => {
    test('artifact の番号が実行の head と一致すれば、その PR を総ざらいする', async () => {
      const f = relayFakes({
        prs: { 9: pr(9) },
        lists: { 'reviewComments:9': [rc(21, email)] },
      });
      await go(f);
      expect(f.rel.listArtifacts[0]).toMatchObject({ run_id: 77, name: caller.RELAY_ARTIFACT });
      expect(created(f)).toEqual(['public-comment-review_comment-21']);
    });

    test('番号が一致したら、同じ sha を head にする別の PR（base 違い）も一緒に見る', async () => {
      const f = relayFakes({
        prs: { 9: pr(9) },
        lists: {
          pulls: [pr(9), pr(10), pr(11, { ...HEAD, sha: 'other' })],
          'reviews:10': [rv(101, email)],
          'reviews:11': [rv(111, email)],
        },
      });
      await go(f);
      const swept = f.calls.paginated
        .filter((c) => c.key === 'reviews')
        .map((c) => c.params.pull_number);
      expect(swept).toEqual([9, 10]);
      expect(created(f)).toEqual(['public-comment-review-101']);
      expect(f.calls.paginated.find((c) => c.key === 'pulls').params).toMatchObject({
        state: 'all',
        head: 'forker:feature',
      });
    });

    test('番号の PR の head が実行と一致しなければ、その PR には何もしない', async () => {
      const other = { sha: 'zzz', ref: 'other', repo: { full_name: 'someone/r' } };
      const f = relayFakes({
        prs: { 9: pr(9, other) },
        lists: { 'reviewComments:9': [rc(21, email)], pulls: [] },
      });
      await go(f);
      expect(f.calls.paginated.filter((c) => c.key === 'reviewComments')).toHaveLength(0);
      expect(writes(f)).toBe(0);
    });

    test('偽の番号でも、head が合う本物の PR は一覧から見つけて検査する', async () => {
      const other = { sha: 'zzz', ref: 'other', repo: { full_name: 'someone/r' } };
      const f = relayFakes({
        json: '{"pr_number":5}',
        prs: { 5: pr(5, other) },
        lists: { pulls: [pr(9), pr(8, other)], 'reviewComments:9': [rc(21, email)] },
      });
      await go(f);
      expect(created(f)).toEqual(['public-comment-review_comment-21']);
      expect(f.calls.create[0].issue_number).toBe(9);
      expect(f.calls.paginated.find((c) => c.key === 'pulls').params.head).toBe('forker:feature');
    });

    test('番号の PR が見つからない（404）ときも、一覧から探す', async () => {
      const f = relayFakes({ lists: { pulls: [pr(9)], 'reviews:9': [rv(31, email)] } });
      await go(f);
      expect(created(f)).toEqual(['public-comment-review-31']);
    });

    test('push で sha が進んでいても、同じリポジトリとブランチなら同じ PR', async () => {
      const moved = { sha: 'sha-2', ref: 'feature', repo: { full_name: 'forker/r' } };
      const f = relayFakes({
        prs: { 9: pr(9, moved) },
        lists: { 'reviewComments:9': [rc(21, email)] },
      });
      await go(f);
      expect(created(f)).toEqual(['public-comment-review_comment-21']);
    });

    test('閉じた PR でも sha が完全に一致すれば検査する（ヒント経由・一覧経由とも）', async () => {
      const viaHint = relayFakes({
        prs: { 9: pr(9, HEAD, 'closed') },
        lists: { 'reviewComments:9': [rc(21, email)] },
      });
      await go(viaHint);
      expect(created(viaHint)).toEqual(['public-comment-review_comment-21']);

      const viaList = relayFakes({
        json: '{oops',
        lists: { pulls: [pr(9, HEAD, 'closed')], 'reviewComments:9': [rc(21, email)] },
      });
      await go(viaList);
      expect(viaList.calls.paginated.find((c) => c.key === 'pulls').params.state).toBe('all');
      expect(created(viaList)).toEqual(['public-comment-review_comment-21']);
    });

    test('閉じた PR で、ブランチが同じだけ（sha が違う）なら検査しない', async () => {
      const moved = { sha: 'sha-2', ref: 'feature', repo: { full_name: 'forker/r' } };
      const f = relayFakes({
        prs: { 9: pr(9, moved, 'closed') },
        lists: { pulls: [pr(9, moved, 'closed')], 'reviewComments:9': [rc(21, email)] },
      });
      await go(f);
      expect(f.calls.paginated.filter((c) => c.key === 'reviews')).toHaveLength(0);
      expect(writes(f)).toBe(0);
    });

    test('実行側のリポジトリ名が無いとき、未定義どうしの一致で通さない', async () => {
      const noRepo = { sha: 'sha-2', ref: 'feature', repo: undefined };
      const f = relayFakes({
        run: { head_repository: { owner: { login: 'forker' } } },
        prs: { 9: pr(9, noRepo) },
        lists: { pulls: [pr(9, noRepo)], 'reviewComments:9': [rc(21, email)] },
      });
      await go(f);
      expect(f.calls.paginated.filter((c) => c.key === 'reviews')).toHaveLength(0);
    });

    test.each([
      ['別の workflow', { path: '.github/workflows/evil.yml' }],
      ['path が無い', { path: undefined }],
      ['想定外の event', { event: 'issue_comment' }],
    ])('想定した中継の実行でなければ何もしない: %s', async (_n, run) => {
      const f = relayFakes({
        run,
        prs: { 9: pr(9) },
        lists: { pulls: [pr(9)], 'reviewComments:9': [rc(21, email)] },
      });
      await go(f);
      expect(f.rel.listArtifacts).toHaveLength(0);
      expect(f.calls.list).toBe(0);
      expect(writes(f)).toBe(0);
    });

    test('path に付く @ref は取り除いて比べる', async () => {
      const f = relayFakes({
        run: { path: '.github/workflows/text-checks-review-relay.yml@refs/pull/9/merge' },
        prs: { 9: pr(9) },
        lists: { 'reviewComments:9': [rc(21, email)] },
      });
      await go(f);
      expect(created(f)).toEqual(['public-comment-review_comment-21']);
    });

    test('中継の実行が失敗・取り消しでも総ざらいする', async () => {
      for (const conclusion of ['failure', 'cancelled']) {
        const f = relayFakes({
          run: { conclusion },
          lists: { pulls: [pr(9)], 'reviewComments:9': [rc(21, email)] },
        });
        await go(f);
        expect(created(f)).toEqual(['public-comment-review_comment-21']);
      }
    });

    test('head の情報が無ければ何もしない', async () => {
      const f = relayFakes({
        run: { head_repository: null, head_branch: null },
        lists: { pulls: [pr(9)] },
      });
      await go(f);
      expect(writes(f)).toBe(0);
    });
  });

  describe('artifact（ヒント）の読み取り', () => {
    const noHintButPr = { lists: { pulls: [pr(9)], 'reviewComments:9': [rc(21, email)] } };

    test.each([
      ['JSON ではない', '{oops'],
      ['配列', '[]'],
      ['null', 'null'],
      ['余分な項目（id）', '{"pr_number":9,"id":21}'],
      ['番号が文字列', '{"pr_number":"9"}'],
      ['番号が小数', '{"pr_number":1.5}'],
      ['番号が 0', '{"pr_number":0}'],
      ['番号が負', '{"pr_number":-3}'],
      ['番号が大きすぎる', '{"pr_number":9007199254740993}'],
      ['項目が無い', '{}'],
    ])('不正な artifact はヒントとして使わず、一覧から探す: %s', async (_name, json) => {
      const f = relayFakes({ json, ...noHintButPr });
      await go(f);
      expect(f.rel.get).toEqual([]);
      expect(created(f)).toEqual(['public-comment-review_comment-21']);
    });

    test('artifact が無い・複数・期限切れ・大きすぎるときもヒント無しで続ける', async () => {
      for (const artifacts of [
        [],
        [{ ...artifact, name: 'other' }],
        [artifact, { ...artifact, id: 101 }],
        [{ ...artifact, expired: true }],
        [{ ...artifact, size_in_bytes: 10_000_000 }],
      ]) {
        const f = relayFakes({ artifacts, ...noHintButPr });
        await go(f);
        expect(f.rel.download).toBe(0);
        expect(created(f)).toEqual(['public-comment-review_comment-21']);
      }
    });

    test('zip に決まった名前のファイルが無ければヒント無しで続ける', async () => {
      const f = relayFakes(noHintButPr);
      f.github.rest.actions.downloadArtifact = async () => ({
        data: zipOf('{"pr_number":9}', 'other.json'),
      });
      await go(f);
      expect(f.rel.get).toEqual([]);
      expect(created(f)).toEqual(['public-comment-review_comment-21']);
    });

    test('圧縮して小さく見せた巨大なファイル（出力の上限超え）もヒント無しで続ける', async () => {
      const f = relayFakes({
        json: `{"pr_number":9,"pad":"${'a'.repeat(50_000)}"}`,
        ...noHintButPr,
      });
      await go(f);
      expect(f.rel.get).toEqual([]);
      expect(f.logs.info.some((m) => m.includes('展開できません'))).toBe(true);
    });

    test('レート制限は握りつぶさず投げ直す', async () => {
      const f = relayFakes(noHintButPr);
      f.github.rest.actions.listWorkflowRunArtifacts = async () => {
        throw Object.assign(new Error('rate'), {
          status: 403,
          response: { headers: { 'x-ratelimit-remaining': '0' } },
        });
      };
      await expect(go(f)).rejects.toThrow('rate');
    });
  });

  describe('総ざらい（PR 単位）', () => {
    const base = { prs: { 9: pr(9) } };

    test('その PR のレビューもレビューコメントも全部検査する（偽の id に引きずられない）', async () => {
      const f = relayFakes({
        ...base,
        lists: {
          'reviews:9': [rv(31, email), rv(32, 'ふつう'), rv(33, null)],
          'reviewComments:9': [rc(21, '直した'), rc(22, email), rc(23, email)],
        },
      });
      await go(f);
      expect(created(f).sort()).toEqual([
        'public-comment-review-31',
        'public-comment-review_comment-22',
        'public-comment-review_comment-23',
      ]);
      // 起こした本人の投稿の結果なので、NG なら落とす
      expect(f.logs.failed).toHaveLength(1);
      expect(f.logs.failed[0]).toContain('PR #9');
      expect(f.logs.warning.some((m) => m.includes('PR #9'))).toBe(true);
    });

    test('レビューは種類つきの鍵なので、同じ id のレビューコメントと混ざらない', async () => {
      const f = relayFakes({
        ...base,
        lists: { 'reviews:9': [rv(5, email)], 'reviewComments:9': [rc(5, email)] },
      });
      await go(f);
      expect(created(f).sort()).toEqual([
        'public-comment-review-5',
        'public-comment-review_comment-5',
      ]);
    });

    test('直ったものは知らせを消し、github-actions[bot] の投稿は見ない', async () => {
      const f = relayFakes({
        ...base,
        comments: [noticeOf(4, 'public-comment-review_comment-21')],
        lists: {
          'reviewComments:9': [
            rc(21, '直した'),
            rc(22, email, { user: { login: 'github-actions[bot]' } }),
          ],
        },
      });
      await go(f);
      expect(f.calls.delete.map((c) => c.comment_id)).toEqual([4]);
      expect(f.calls.create).toHaveLength(0);
    });

    test('元が無くなったレビュー・レビューコメントの知らせは消し、他は消さない', async () => {
      const mallory = { login: 'mallory' };
      const f = relayFakes({
        ...base,
        comments: [
          noticeOf(1, 'public-comment-review_comment-99'), // 消えた行コメント
          noticeOf(2, 'public-comment-review-98'), // 消えたレビュー
          noticeOf(3, 'public-comment-review_comment-21', '要確認'), // まだ NG のものは残す
          noticeOf(4, 'public-comment-review_comment-97', '偽', mallory), // 他の作者
          noticeOf(5, 'public-comment-issue_comment-96'), // issue コメントの知らせは別の経路
          noticeOf(6, 'public-body'),
          noticeOf(7, 'format'),
          { id: 8, user: BOT, body: '目印の無いふつうの投稿' },
        ],
        lists: { 'reviewComments:9': [rc(21, email)] },
      });
      await go(f);
      expect(f.calls.delete.map((c) => c.comment_id).sort()).toEqual([1, 2]);
    });

    test('消えた知らせの重複もすべて消す', async () => {
      const f = relayFakes({
        ...base,
        comments: [
          noticeOf(1, 'public-comment-review-98'),
          noticeOf(2, 'public-comment-review-98'),
        ],
      });
      await go(f);
      expect(f.calls.delete.map((c) => c.comment_id).sort()).toEqual([1, 2]);
    });

    test('一覧は PR の番号でページをたどる', async () => {
      const f = relayFakes(base);
      await go(f);
      const keys = f.calls.paginated.map((c) => c.key).filter((k) => k !== 'pulls');
      expect(keys).toEqual(['issueComments', 'reviews', 'reviewComments']);
      expect(f.calls.paginated.every((c) => c.params.per_page === 100)).toBe(true);
    });
  });

  describe('片づけの安全性と失敗の扱い', () => {
    const base = { prs: { 9: pr(9) } };
    const stale = (id, n) => noticeOf(id, `public-comment-review-${n}`);

    test('別の PR の知らせは、その PR を総ざらいしても消さない', async () => {
      const f = relayFakes({
        ...base,
        comments: { 9: [stale(2, 97)], 3: [stale(1, 98)] },
      });
      await go(f);
      expect(f.calls.delete.map((c) => c.comment_id)).toEqual([2]);
      expect(
        f.calls.paginated
          .filter((c) => c.key === 'issueComments')
          .map((c) => c.params.issue_number),
      ).toEqual([9]);
    });

    test('一覧に無くても元がまだ有る（ページのずれ）なら消さない', async () => {
      const f = relayFakes({ ...base, comments: [stale(1, 98)], live: ['review:98'] });
      await go(f);
      expect(f.calls.fetched).toEqual(['review:98']);
      expect(f.calls.delete).toHaveLength(0);
    });

    test('元の取り直しが 404 のときだけ消す（レビューコメントも同じ）', async () => {
      const f = relayFakes({
        ...base,
        comments: [noticeOf(1, 'public-comment-review_comment-99')],
      });
      await go(f);
      expect(f.calls.fetched).toEqual(['review_comment:99']);
      expect(f.calls.delete.map((c) => c.comment_id)).toEqual([1]);
    });

    test('元の取り直しが 404 以外で失敗したら消さず、その PR を失敗として落とす', async () => {
      const f = relayFakes({
        ...base,
        comments: [stale(1, 98)],
        fetchFail: Object.assign(new Error('boom'), { status: 500 }),
      });
      await go(f);
      expect(f.calls.delete).toHaveLength(0);
      expect(f.logs.failed[0]).toContain('#9');
    });

    test('一覧の取得に失敗したら、何も消さない', async () => {
      const f = relayFakes({
        ...base,
        comments: [stale(1, 98)],
        lists: {
          reviewComments: () => {
            throw Object.assign(new Error('list failed'), { status: 502 });
          },
        },
      });
      await go(f);
      expect(f.calls.delete).toHaveLength(0);
      expect(f.calls.fetched).toHaveLength(0);
      expect(f.logs.failed[0]).toContain('#9');
    });

    test('1つの PR が失敗しても残りを続け、最後に失敗した PR を並べて落とす', async () => {
      const f = fakes({
        lists: {
          pulls: [pr(3), pr(4), pr(5)],
          'reviews:4': () => {
            throw Object.assign(new Error('boom'), { status: 500 });
          },
          'reviewComments:5': [rc(51, email)],
        },
      });
      await caller.run({
        github: f.github,
        context: ctx('schedule', {}),
        core: f.core,
        config,
        extraFile: null,
      });
      expect(f.calls.create.map((c) => c.issue_number)).toEqual([5]);
      expect(f.logs.failed).toEqual(['総ざらいに失敗した PR: #4']);
    });

    test('レート制限（二次レート制限のメッセージだけでも）は続けずすぐ投げる', async () => {
      const f = fakes({
        lists: {
          pulls: [pr(3), pr(4)],
          'reviews:3': () => {
            throw Object.assign(new Error('You have exceeded a secondary rate limit'), {
              status: 403,
            });
          },
        },
      });
      await expect(
        caller.run({
          github: f.github,
          context: ctx('schedule', {}),
          core: f.core,
          config,
          extraFile: null,
        }),
      ).rejects.toThrow('secondary rate limit');
      expect(
        f.calls.paginated.filter((c) => c.key === 'reviews').map((c) => c.params.pull_number),
      ).toEqual([3]);
    });

    test('二次レート制限の 403 は、書き込みでも警告にせず投げる', async () => {
      const err = Object.assign(new Error('You have exceeded a secondary rate limit.'), {
        status: 403,
      });
      await expect(
        caller.writeOrWarn(
          async () => {
            throw err;
          },
          () => undefined,
        ),
      ).rejects.toThrow('secondary rate limit');
    });
  });

  describe('定期の総ざらい（schedule / workflow_dispatch）', () => {
    for (const eventName of ['schedule', 'workflow_dispatch']) {
      test(`${eventName}: 開いた PR を全部まわって検査・片づけをする`, async () => {
        const f = fakes({
          comments: { 5: [noticeOf(50, 'public-comment-review-98')] },
          lists: {
            pulls: [pr(3), pr(4), pr(5)],
            'reviews:3': [rv(31, email)],
            'reviewComments:4': [rc(41, email)],
          },
        });
        await caller.run({
          github: f.github,
          context: ctx(eventName, {}),
          core: f.core,
          config,
          extraFile: null,
        });
        const pullsCall = f.calls.paginated.find((c) => c.key === 'pulls');
        expect(pullsCall.params).toMatchObject({
          owner: 'o',
          repo: 'r',
          state: 'open',
          per_page: 100,
        });
        const swept = f.calls.paginated
          .filter((c) => c.key === 'reviews')
          .map((c) => c.params.pull_number);
        expect(swept).toEqual([3, 4, 5]);
        expect(created(f)).toEqual([
          'public-comment-review-31',
          'public-comment-review_comment-41',
        ]);
        expect(f.calls.create.map((c) => c.issue_number)).toEqual([3, 4]);
        expect(f.calls.delete.map((c) => c.comment_id)).toEqual([50]);
        // 毎時の実行が赤くなり続けないよう、NG は警告にとどめる
        expect(f.logs.failed).toHaveLength(0);
        expect(f.logs.warning.some((m) => m.includes('PR #3'))).toBe(true);
      });
    }

    const NOW = Date.parse('2026-01-01T12:00:00Z');
    const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();
    const closedPr = (number, h) => ({ ...pr(number, HEAD, 'closed'), updated_at: hoursAgo(h) });
    const runSweep = (f) =>
      caller.run({
        github: f.github,
        context: ctx('schedule', {}),
        core: f.core,
        config,
        extraFile: null,
        now: NOW,
      });

    test('最近閉じた PR も総ざらいし、窓より古いものは打ち切って対象にしない', async () => {
      const f = fakes({
        lists: {
          'pulls:open': [pr(3)],
          'pulls:closed': [closedPr(6, 1), closedPr(7, 2.5), closedPr(8, 5), closedPr(9, 6)],
          'reviewComments:6': [rc(61, email)],
          'reviewComments:8': [rc(81, email)],
        },
      });
      await runSweep(f);
      const closedCall = f.calls.paginated.find(
        (c) => c.key === 'pulls' && c.params.state === 'closed',
      );
      expect(closedCall.params).toMatchObject({
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
      });
      expect(f.calls.stopped).toBe(true);
      const swept = f.calls.paginated
        .filter((c) => c.key === 'reviews')
        .map((c) => c.params.pull_number);
      expect(swept).toEqual([3, 6, 7]);
      expect(created(f)).toEqual(['public-comment-review_comment-61']);
    });

    test('窓の中だけなら打ち切らない（次のページも取る）', async () => {
      const f = fakes({ lists: { 'pulls:closed': [closedPr(6, 1), closedPr(7, 2)] } });
      await runSweep(f);
      expect(f.calls.stopped).toBe(false);
    });

    test('閉じた PR の失敗も1件ずつ分けて扱う', async () => {
      const f = fakes({
        lists: {
          'pulls:closed': [closedPr(6, 1), closedPr(7, 1)],
          'reviews:6': () => {
            throw Object.assign(new Error('boom'), { status: 500 });
          },
          'reviewComments:7': [rc(71, email)],
        },
      });
      await runSweep(f);
      expect(f.calls.create.map((c) => c.issue_number)).toEqual([7]);
      expect(f.logs.failed).toEqual(['総ざらいに失敗した PR: #6']);
    });

    test('閉じた一覧が複数ページでも、窓より古いものが出たらそれ以降のページは取らない', async () => {
      const f = fakes({
        lists: {
          'pulls:closed': { pages: [[closedPr(6, 1), closedPr(7, 5)], [closedPr(8, 1)]] },
        },
      });
      await runSweep(f);
      expect(f.calls.pagesFetched).toBe(1);
      const swept = f.calls.paginated
        .filter((c) => c.key === 'reviews')
        .map((c) => c.params.pull_number);
      expect(swept).toEqual([6]);
    });

    test('ページが全部窓の中なら、次のページも取る', async () => {
      const f = fakes({
        lists: { 'pulls:closed': { pages: [[closedPr(6, 1)], [closedPr(8, 2)]] } },
      });
      await runSweep(f);
      expect(f.calls.pagesFetched).toBe(2);
      const swept = f.calls.paginated
        .filter((c) => c.key === 'reviews')
        .map((c) => c.params.pull_number);
      expect(swept).toEqual([6, 8]);
    });

    test('PR の updated_at が動いていなくても、最近更新されたレビューコメントの PR を総ざらいする', async () => {
      const f = fakes({
        lists: {
          'pulls:closed': [closedPr(6, 100)],
          repoReviewComments: [
            { id: 1, pull_request_url: 'https://api.github.com/repos/o/r/pulls/20' },
            { id: 2, pull_request_url: 'https://api.github.com/repos/o/r/pulls/20' },
            { id: 3, pull_request_url: 'https://api.github.com/repos/other/x/pulls/21' },
            { id: 4, pull_request_url: 'not a url' },
            { id: 5 },
          ],
          'reviewComments:20': [rc(201, email)],
        },
      });
      await runSweep(f);
      const call = f.calls.paginated.find((c) => c.key === 'repoReviewComments');
      expect(call.params).toMatchObject({
        owner: 'o',
        repo: 'r',
        sort: 'updated',
        direction: 'desc',
        since: hoursAgo(3),
        per_page: 100,
      });
      const swept = f.calls.paginated
        .filter((c) => c.key === 'reviews')
        .map((c) => c.params.pull_number);
      expect(swept).toEqual([20]);
      expect(created(f)).toEqual(['public-comment-review_comment-201']);
      expect(f.calls.create[0].issue_number).toBe(20);
    });

    test('一覧とレビューコメント経由で同じ PR が重なっても1回だけ', async () => {
      const f = fakes({
        lists: {
          'pulls:open': [pr(3)],
          repoReviewComments: [
            { id: 1, pull_request_url: 'https://api.github.com/repos/o/r/pulls/3' },
          ],
        },
      });
      await runSweep(f);
      expect(f.calls.paginated.filter((c) => c.key === 'reviews')).toHaveLength(1);
    });

    test('開いた一覧と閉じた一覧に同じ PR があっても1回だけ', async () => {
      const f = fakes({ lists: { 'pulls:open': [pr(3)], 'pulls:closed': [closedPr(3, 1)] } });
      await runSweep(f);
      expect(f.calls.paginated.filter((c) => c.key === 'reviews')).toHaveLength(1);
    });

    test('開いた PR が無ければ何も書かない', async () => {
      const f = fakes();
      await caller.run({
        github: f.github,
        context: ctx('schedule', {}),
        core: f.core,
        config,
        extraFile: null,
      });
      expect(writes(f)).toBe(0);
    });
  });
});
