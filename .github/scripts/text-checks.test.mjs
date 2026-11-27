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
    const boom = Object.assign(new Error('boom'), { status: 500 });
    await expect(
      caller.writeOrWarn(async () => {
        throw boom;
      }, warn),
    ).rejects.toThrow('boom');
    expect(warnings).toHaveLength(1);
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

function fakes({ comments = [], failWith = {}, pulls = {}, actions = {} } = {}) {
  const calls = { list: 0, create: [], update: [], delete: [] };
  const maybeFail = (name) => {
    if (failWith[name]) throw Object.assign(new Error(name), { status: failWith[name] });
  };
  const github = {
    paginate: async () => {
      calls.list += 1;
      return comments;
    },
    rest: {
      issues: {
        listComments: () => undefined,
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
      pulls,
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

describe('中継（workflow_run）', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'text-checks-relay-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  // 本物の zip を作る（unzip の呼び出しまで通すため）
  function zipOf(text, name = caller.RELAY_FILE) {
    const src = path.join(dir, name);
    writeFileSync(src, text);
    const out = path.join(dir, `a-${Math.random().toString(36).slice(2)}.zip`);
    const r = spawnSync(
      'python3',
      [
        '-I',
        '-c',
        'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1],"w");z.write(sys.argv[2],sys.argv[3])',
        out,
        src,
        name,
      ],
      { encoding: 'utf8' },
    );
    expect(r.status).toBe(0);
    return readFileSync(out);
  }

  const relayJson = (o = {}) =>
    JSON.stringify({
      event: 'pull_request_review_comment',
      action: 'created',
      pr_number: 9,
      id: 21,
      ...o,
    });

  function relayFakes({
    json = relayJson(),
    run = {},
    artifacts,
    reviewComment,
    review,
    ...rest
  } = {}) {
    const calls = { reviewComment: 0, review: 0, download: 0 };
    const f = fakes({
      ...rest,
      pulls: {
        getReviewComment: async (p) => {
          calls.reviewComment += 1;
          if (reviewComment instanceof Error) throw reviewComment;
          return { data: reviewComment, params: p };
        },
        getReview: async (p) => {
          calls.review += 1;
          if (review instanceof Error) throw review;
          return { data: review, params: p };
        },
      },
      actions: {
        listWorkflowRunArtifacts: async () => ({
          data: {
            artifacts: artifacts ?? [
              { id: 100, name: caller.RELAY_ARTIFACT, expired: false, size_in_bytes: 300 },
            ],
          },
        }),
        downloadArtifact: async () => {
          calls.download += 1;
          return { data: zipOf(json) };
        },
      },
    });
    const context = {
      repo: { owner: 'o', repo: 'r' },
      eventName: 'workflow_run',
      payload: {
        workflow_run: {
          id: 77,
          conclusion: 'success',
          event: 'pull_request_review_comment',
          ...run,
        },
      },
    };
    return { ...f, relayCalls: calls, context };
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
  const goodComment = (o = {}) => ({
    body: email,
    html_url: 'https://example.test/rc/21',
    user: { login: 'dave' },
    pull_request_url: 'https://api.example.test/repos/o/r/pulls/9',
    ...o,
  });
  const noWrites = (f) =>
    expect(f.calls.create.length + f.calls.update.length + f.calls.delete.length).toBe(0);

  test('正しい artifact なら API から取り直した本文を検査し、知らせを作る', async () => {
    const f = relayFakes({ reviewComment: goodComment() });
    await go(f);
    expect(f.calls.create).toHaveLength(1);
    expect(f.calls.create[0].issue_number).toBe(9);
    expect(f.calls.create[0].body.split('\n').slice(0, 2)).toEqual([
      `${config.marker}:public-comment-review_comment-21`,
      '対象のコメント: https://example.test/rc/21',
    ]);
    expect(f.logs.failed).toHaveLength(1);
  });

  test('レビュー本文も、PR の番号つきで取り直して検査する', async () => {
    const f = relayFakes({
      json: relayJson({ event: 'pull_request_review', action: 'submitted', id: 31 }),
      run: { event: 'pull_request_review' },
      review: {
        body: email,
        html_url: 'https://example.test/r/31',
        user: { login: 'erin' },
        pull_request_url: 'https://api.example.test/repos/o/r/pulls/9',
      },
    });
    await go(f);
    expect(f.calls.create[0].body).toContain(`${config.marker}:public-comment-review-31`);
  });

  test('取り直したコメントが OK なら、既存の知らせを消す', async () => {
    const f = relayFakes({
      reviewComment: goodComment({ body: '直しました' }),
      comments: [noticeOf(4, 'public-comment-review_comment-21')],
    });
    await go(f);
    expect(f.calls.delete.map((c) => c.comment_id)).toEqual([4]);
  });

  test('artifact に本文を入れても使わない（取り直した本文だけを見る）', async () => {
    const f = relayFakes({
      json: relayJson({ body: email }),
      reviewComment: goodComment({ body: '直しました' }),
    });
    await expect(go(f)).rejects.toThrow('項目が不正');
    noWrites(f);
  });

  test.each([
    ['JSON ではない', '{oops'],
    ['配列', '[]'],
    ['null', 'null'],
    ['未知の event', relayJson({ event: 'issue_comment' })],
    [
      'event と action の組が不正（review の deleted）',
      relayJson({ event: 'pull_request_review', action: 'deleted' }),
    ],
    ['未知の action', relayJson({ action: 'closed' })],
    ['PR の番号が文字列', relayJson({ pr_number: '9' })],
    ['id が小数', relayJson({ id: 1.5 })],
    ['id が 0', relayJson({ id: 0 })],
    ['id が負', relayJson({ id: -3 })],
    [
      'id が大きすぎる',
      '{"event":"pull_request_review_comment","action":"created","pr_number":9,"id":9007199254740993}',
    ],
    [
      '項目が足りない',
      JSON.stringify({ event: 'pull_request_review_comment', action: 'created', id: 21 }),
    ],
  ])('不正な artifact は弾く: %s', async (_name, json) => {
    const f = relayFakes({ json, reviewComment: goodComment() });
    await expect(go(f)).rejects.toThrow('中継の artifact');
    expect(f.relayCalls.reviewComment + f.relayCalls.review).toBe(0);
    noWrites(f);
  });

  test('実行の event と artifact の event が食い違えば弾く', async () => {
    const f = relayFakes({ run: { event: 'pull_request_review' }, reviewComment: goodComment() });
    await expect(go(f)).rejects.toThrow('一致しません');
    noWrites(f);
  });

  test('artifact が無い・複数ある・期限切れ・大きすぎるときは弾く', async () => {
    for (const artifacts of [
      [],
      [{ id: 1, name: 'other', expired: false, size_in_bytes: 10 }],
      [
        { id: 1, name: caller.RELAY_ARTIFACT, expired: false, size_in_bytes: 10 },
        { id: 2, name: caller.RELAY_ARTIFACT, expired: false, size_in_bytes: 10 },
      ],
      [{ id: 1, name: caller.RELAY_ARTIFACT, expired: true, size_in_bytes: 10 }],
      [{ id: 1, name: caller.RELAY_ARTIFACT, expired: false, size_in_bytes: 10_000_000 }],
    ]) {
      const f = relayFakes({ artifacts, reviewComment: goodComment() });
      await expect(go(f)).rejects.toThrow('中継の artifact');
      expect(f.relayCalls.download).toBe(0);
    }
  });

  test('zip に決まった名前のファイルが無ければ弾く', async () => {
    const f = relayFakes({ reviewComment: goodComment() });
    f.github.rest.actions.downloadArtifact = async () => ({
      data: zipOf(relayJson(), 'other.json'),
    });
    await expect(go(f)).rejects.toThrow('展開できません');
  });

  test('コメントが指定の PR のものでなければ弾く', async () => {
    const f = relayFakes({
      reviewComment: goodComment({
        pull_request_url: 'https://api.example.test/repos/o/r/pulls/10',
      }),
    });
    await expect(go(f)).rejects.toThrow('指定の PR のものではありません');
    noWrites(f);
  });

  test('PR の番号が前方一致するだけ（pulls/90 と pulls/9）でも弾く', async () => {
    const f = relayFakes({
      reviewComment: goodComment({
        pull_request_url: 'https://api.example.test/repos/o/r/pulls/90',
      }),
    });
    await expect(go(f)).rejects.toThrow('指定の PR のものではありません');
  });

  test('取り直しが 404 なら削除済みとして扱い、知らせだけ消す', async () => {
    const f = relayFakes({
      json: relayJson({ action: 'deleted' }),
      reviewComment: Object.assign(new Error('Not Found'), { status: 404 }),
      comments: [noticeOf(4, 'public-comment-review_comment-21')],
    });
    await go(f);
    expect(f.calls.delete.map((c) => c.comment_id)).toEqual([4]);
    expect(f.calls.create).toHaveLength(0);
    expect(f.logs.failed).toHaveLength(0);
  });

  test('レビューの取り直しが 404 でも削除済み扱い', async () => {
    const f = relayFakes({
      json: relayJson({ event: 'pull_request_review', action: 'edited', id: 31 }),
      run: { event: 'pull_request_review' },
      review: Object.assign(new Error('Not Found'), { status: 404 }),
      comments: [noticeOf(4, 'public-comment-review-31')],
    });
    await go(f);
    expect(f.calls.delete.map((c) => c.comment_id)).toEqual([4]);
  });

  test('404 以外の取り直しの失敗は投げ直す', async () => {
    const f = relayFakes({ reviewComment: Object.assign(new Error('boom'), { status: 500 }) });
    await expect(go(f)).rejects.toThrow('boom');
  });

  test('削除と書いてあっても API にコメントが残っていれば通常どおり検査する', async () => {
    const f = relayFakes({ json: relayJson({ action: 'deleted' }), reviewComment: goodComment() });
    await go(f);
    expect(f.calls.create).toHaveLength(1);
  });

  test('github-actions[bot] のレビューコメントは一覧を取る前に飛ばす', async () => {
    const f = relayFakes({
      reviewComment: goodComment({ user: { login: 'github-actions[bot]' } }),
    });
    await go(f);
    expect(f.calls.list).toBe(0);
    noWrites(f);
  });

  test('中継の実行が成功でなければ何も読まない', async () => {
    const f = relayFakes({ run: { conclusion: 'failure' }, reviewComment: goodComment() });
    await go(f);
    expect(f.relayCalls.download).toBe(0);
    expect(f.calls.list).toBe(0);
  });
});
