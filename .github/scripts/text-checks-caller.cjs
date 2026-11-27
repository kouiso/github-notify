// issue と PR の本文、およびコメント（issue コメント・PR のレビューコメント・レビュー本文）のチェックの呼び出し側（#99）。
// 書き方チェックは本文だけ、公開内容チェックは本文とコメントの両方に掛ける。
// 判定は brain #110 の本体の写し（.github/scripts/text-checks/ の Python）に任せ、
// ここでは「対象外の判定」「本体の CLI を --json で呼ぶ」「知らせる文を作る」「GitHub への読み書き」をする。
// workflow 側は run() を呼ぶだけにして、分岐をテストできる形でここに集める。
// 当たった文字そのものや追加の禁止語は、知らせる文にもログにも出さない（本体も規則名だけを返す）。
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHECKS_DIR = path.join(__dirname, 'text-checks');
// このリポのフォームとテンプレートの見出しを、本体の見出しの別名として渡す設定（brain #135・#139）。
const HEADINGS_CONFIG = path.join(__dirname, '..', 'text-checks.headings.json');
// 知らせのコメントを書くのは Actions の GITHUB_TOKEN だけ。別の作者のコメントは同じ目印があっても自分のものとして扱わない。
const NOTICE_AUTHOR = 'github-actions[bot]';
// fork の PR のレビュー系イベントは中継ワークフローが artifact で渡す（text-checks-review-relay.yml）。
const RELAY_ARTIFACT = 'text-checks-relay';
const RELAY_FILE = 'relay.json';
const RELAY_MAX_BYTES = 4096;

function isBotActor(login, config) {
  if (!login) return false;
  return login.endsWith('[bot]') || (config.skipActors || []).includes(login);
}

// イベントごとに payload の形が違うので、workflow 側の分岐を増やさないようここで1つの形に揃える。
// コメントの通知は issue / PR 側のコメント欄に出すため、number は常に issue / PR の番号を返す。
// レビュー系（行コメント・レビュー本文）は fork の PR だと payload を信用できないので、ここでは扱わず中継経由で API から取り直す。
const COMMENT_TYPES = {
  issue_comment: 'issue_comment',
  pull_request_review_comment: 'review_comment',
  pull_request_review: 'review',
};

function resolveTarget(eventName, payload) {
  const labelsOf = (issue) => (issue.labels || []).map((l) => l.name);
  const loginOf = (obj) => obj?.user?.login ?? null;
  switch (eventName) {
    case 'issues':
      return {
        number: payload.issue.number,
        body: payload.issue.body ?? null,
        author: loginOf(payload.issue),
        kind: 'issue',
        labels: labelsOf(payload.issue),
        draft: false,
        comment: null,
      };
    case 'pull_request_target':
      return {
        number: payload.pull_request.number,
        body: payload.pull_request.body ?? null,
        author: loginOf(payload.pull_request),
        kind: 'pull_request',
        labels: [],
        draft: Boolean(payload.pull_request.draft),
        comment: null,
      };
    case 'issue_comment': {
      // issue_comment は PR 上のコメントでも飛んでくるので、PR かどうかは issue.pull_request の有無で見分ける。
      const { issue, comment } = payload;
      return {
        number: issue.number,
        body: comment.body ?? null,
        author: loginOf(comment),
        kind: issue.pull_request ? 'pull_request' : 'issue',
        labels: labelsOf(issue),
        draft: false,
        comment: { id: comment.id, url: comment.html_url, type: COMMENT_TYPES[eventName] },
      };
    }
    default:
      throw new Error(`未対応のイベントです: ${eventName}`);
  }
}

// 知らせのコメントの目印に使う鍵。コメントごとに別の知らせ1つを更新できるよう、種類と id で一意にする。
function commentKey(comment) {
  return `public-comment-${comment.type}-${comment.id}`;
}

// 目印で始まる本文までは飛ばさない。人が目印つきの本文を書くだけで検査を逃れられてしまうため、飛ばすのは作者で決める。
// GITHUB_TOKEN のコメントはもともとワークフローを起動しないが、念のため Actions のボットは見ない。
function shouldSkipComment({ author }) {
  return author === NOTICE_AUTHOR;
}

// fork の PR や Dependabot が起こしたイベントは token が読み取り専用で、コメントを書けず 403 になる。
// 書けないこと自体で検査を落とすと判定が見えなくなるので、書き込みだけ警告にして判定は続ける（NG なら呼び出し側が落とす）。
async function writeOrWarn(write, warn) {
  try {
    await write();
    return true;
  } catch (err) {
    if (err && err.status === 403) {
      warn(
        'コメントを書く権限がないため、知らせのコメントは作れませんでした（fork の PR や Dependabot の読み取り専用 token）。判定は有効です。',
      );
      return false;
    }
    throw err;
  }
}

function shouldSkipFormat({ kind, author, labels = [], draft = false }, config) {
  if (isBotActor(author, config)) return true;
  if (kind === 'pull_request' && draft) return true;
  if (kind === 'issue' && labels.some((l) => (config.skipIssueLabels || []).includes(l)))
    return true;
  return false;
}

// 追加の禁止語はリポにもログにも置かないので、secret の中身だけを runner の一時ファイルに書いて
// 本体へはパスで渡す（1行1語、# で始まる行は注釈）。未設定なら null。
function writeExtraFile(raw, dir) {
  if (!raw?.trim()) return null;
  const file = path.join(dir, `public-text-extra-${process.pid}.txt`);
  fs.writeFileSync(file, raw.endsWith('\n') ? raw : `${raw}\n`, { mode: 0o600 });
  return file;
}

const INHERITED_BLOCKLIST = new Set(['PUBLIC_TEXT_EXTRA_FILE', 'TEXT_CHECKS_CONFIG']);

function runCli(script, args, text, extraFile) {
  // 親の環境に残った値が本体の設定を差し替えないよう、この2つは必ず外してから渡し直す。
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !INHERITED_BLOCKLIST.has(k)),
  );
  if (extraFile) env.PUBLIC_TEXT_EXTRA_FILE = extraFile;
  return spawnSync('python3', [path.join(CHECKS_DIR, script), ...args, '--json'], {
    input: text,
    encoding: 'utf8',
    env,
  });
}

// 公開内容チェック。本文が空（終了コード 2）は書いてはいけないものが無いので OK とする。
function runPublicCheck(text, { extraFile = null } = {}) {
  const r = runCli('public_text_check.py', [], text || '', extraFile);
  if (r.status === 2) return { ok: true, hits: [], notices: [] };
  if (r.status !== 0 && r.status !== 1)
    throw new Error(`public_text_check.py が終了コード ${r.status} で止まりました`);
  const data = JSON.parse(r.stdout);
  return { ok: data.ok, hits: data.hits, notices: data.notices };
}

// 書き方チェック。kind は issue か pr。既定ではこのリポの見出しの設定を渡す。configFile: null で本体の既定だけで判定する。
function runFormatCheck(text, kind, { configFile = HEADINGS_CONFIG } = {}) {
  const args = ['--kind', kind, ...(configFile ? ['--config', configFile] : [])];
  const r = runCli('format_check.py', args, text || '', null);
  if (r.status !== 0 && r.status !== 1)
    throw new Error(`format_check.py が終了コード ${r.status} で止まりました`);
  const data = JSON.parse(r.stdout);
  return { ok: data.ok, problems: data.problems };
}

// 規則ごとにまとめる（同じ規則が何行にも当たったら1行にする）。
function groupHits(hits) {
  const byRule = new Map();
  for (const h of hits) {
    const g = byRule.get(h.rule) || { rule: h.rule, count: 0, lines: [] };
    g.count += h.count;
    g.lines.push(h.line);
    byRule.set(h.rule, g);
  }
  return [...byRule.values()];
}

// 直し方の案内。コメントは編集しても履歴に元の文字が残るので削除を勧める。
// レビューは送信後に削除できないため、本文の編集と履歴の扱いを案内する。
function ngAdvice(sourceUrl, commentType) {
  const head =
    '公開リポに書いてはいけない形の文字が見つかりました。当たった文字はここには書きません。';
  if (!sourceUrl) return `${head}本文を直してください。`;
  if (commentType === 'review')
    return `${head}レビューは削除できないため、レビュー本文を編集して直してください。編集しても履歴には元の文字が残って見えます。履歴の削除が必要な場合は、リポジトリの管理者に連絡してください。`;
  return `${head}コメントは編集しても履歴に残るため、直すのではなくコメントを削除して書き直してください。`;
}

// sourceUrl はコメントの検査のときだけ渡す。どのコメントの話かを示すための URL で、本文の一部は載せない。
function formatReport(kind, result, config, key = kind, sourceUrl = null, commentType = null) {
  const marker = `${config.marker}:${key}`;
  const source = sourceUrl ? [`対象のコメント: ${sourceUrl}`] : [];
  if (kind === 'public') {
    // OK の知らせは本文だけ。コメントは OK になったら知らせごと消すので、URL つきの OK は作らない。
    if (result.ok) return `${marker}\n公開内容チェック: OK（当たった規則はありません）`;
    const rows = groupHits(result.hits).map(
      (g) => `- ${g.rule}: ${g.count}件、${g.lines.join('・')}行目`,
    );
    return [
      marker,
      ...source,
      '公開内容チェック: 要確認',
      ngAdvice(sourceUrl, commentType),
      ...rows,
    ].join('\n');
  }
  if (result.ok) return `${marker}\n書き方チェック: OK`;
  return [
    marker,
    '書き方チェック: 足りない項目があります',
    ...result.problems.map((p) => `- ${p}`),
  ].join('\n');
}

// 知らせのコメントを探す。作者と目印の鍵が完全に一致するものだけ。別の作者が同じ目印を書いても編集・削除しない。
function findNotices(existing, config, key) {
  const marker = `${config.marker}:${key}`;
  return existing
    .filter((c) => c.user?.login === NOTICE_AUTHOR && (c.body || '').startsWith(`${marker}\n`))
    .sort((x, y) => x.id - y.id);
}

// 同時に走った実行が同じ知らせを2つ作ることがあるので、一番古い1つを本物として使い、残りは重複として消す。
function findNotice(existing, config, key) {
  return findNotices(existing, config, key)[0];
}

async function deleteNotice({ github, context, core, found }) {
  const { owner, repo } = context.repo;
  await writeOrWarn(async () => {
    try {
      await github.rest.issues.deleteComment({ owner, repo, comment_id: found.id });
    } catch (err) {
      // 同時に別の実行が消していた場合は目的を果たしているので失敗にしない。
      if (!(err && err.status === 404)) throw err;
    }
  }, core.warning);
}

// 同じ目印の知らせがあれば更新、なければ「要確認」のときだけ新規に作る。
async function upsertNotice(env, key, text, ok) {
  const { github, context, core, existing, config, number } = env;
  const { owner, repo } = context.repo;
  const [found, ...duplicates] = findNotices(existing, config, key);
  for (const dup of duplicates) await deleteNotice({ ...env, found: dup });
  if (found) {
    if (found.body === text) return;
    await writeOrWarn(
      () => github.rest.issues.updateComment({ owner, repo, comment_id: found.id, body: text }),
      core.warning,
    );
  } else if (!ok) {
    await writeOrWarn(
      () => github.rest.issues.createComment({ owner, repo, issue_number: number, body: text }),
      core.warning,
    );
  }
}

// そのコメントの知らせを、重複も含めてすべて消す。
async function deleteAllNotices(env, key) {
  for (const found of findNotices(env.existing, env.config, key))
    await deleteNotice({ ...env, found });
}

// コメントは公開内容チェックだけ。編集履歴に元の文字が残るので、直ったときは知らせ自体を消して履歴を増やさない。
async function checkComment(env, { body, comment }, deleted) {
  const key = commentKey(comment);
  // コメントが消えたら、そのコメントの知らせも消す。本文の検査はしない。
  if (deleted) {
    await deleteAllNotices(env, key);
    env.core.info('コメントが削除されたので、検査せず知らせだけ整理しました。');
    return [];
  }
  const pub = runPublicCheck(body, { extraFile: env.extraFile });
  if (pub.ok) {
    await deleteAllNotices(env, key);
    return [];
  }
  const report = formatReport('public', pub, env.config, key, comment.url, comment.type);
  await upsertNotice(env, key, report, false);
  return [publicFailure(pub)];
}

function publicFailure(pub) {
  return `公開内容チェック: ${groupHits(pub.hits)
    .map((g) => g.rule)
    .join(', ')}`;
}

// 本文は公開内容と書き方の両方。直ったときは同じ知らせを OK に更新する。
async function checkBody(env, { body, author, kind, labels, draft }) {
  const failures = [];
  // 本文が空（承認だけのレビューなど）は書いてはいけないものが無いので OK。
  const pub = runPublicCheck(body, { extraFile: env.extraFile });
  await upsertNotice(
    env,
    'public-body',
    formatReport('public', pub, env.config, 'public-body'),
    pub.ok,
  );
  if (!pub.ok) failures.push(publicFailure(pub));

  if (shouldSkipFormat({ kind, author, labels, draft }, env.config)) {
    // 対象外でも upsert は通す。対象になる前の指摘コメントが残り続けるのを防ぐため
    const skipped = `${env.config.marker}:format\n書き方チェック: 対象外（ボット・下書き・対象外ラベルのため検査していません）`;
    await upsertNotice(env, 'format', skipped, true);
    return failures;
  }
  const fmt = runFormatCheck(body, kind === 'issue' ? 'issue' : 'pr');
  await upsertNotice(env, 'format', formatReport('format', fmt, env.config), fmt.ok);
  if (!fmt.ok) failures.push(`書き方チェック: ${fmt.problems.length}件不足`);
  return failures;
}

// 検査の本体。target は resolveTarget か中継の取り直しで作った形、deleted はコメントが消えたことを表す。
async function processTarget({
  github,
  context,
  core,
  config,
  extraFile,
  target,
  deleted = false,
}) {
  const { owner, repo } = context.repo;

  // Actions のボットのコメントは見ない。一覧を取る前に抜けて、無駄な API 呼び出しも避ける。
  if (target.comment && shouldSkipComment(target)) {
    core.info('Actions のボットのコメントなので検査しません。');
    return;
  }

  const existing = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: target.number,
    per_page: 100,
  });
  const env = { github, context, core, config, extraFile, existing, number: target.number };

  // 書き方チェックは本文だけ。コメントには掛けず、本文の知らせにも触らない。
  const failures = target.comment
    ? await checkComment(env, target, deleted)
    : await checkBody(env, target);

  if (failures.length > 0) core.setFailed(failures.join(' / '));
  else if (!deleted) core.info('All text checks passed.');
}

// 中継の artifact は fork の PR から書き換えられる前提で、形を厳しく確かめてから使う。
const RELAY_ACTIONS = {
  pull_request_review: ['submitted', 'edited'],
  pull_request_review_comment: ['created', 'edited', 'deleted'],
};

function isPositiveInt(v) {
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
}

function parseRelayPayload(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('中継の artifact が JSON として読めません');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data))
    throw new Error('中継の artifact の形が不正です');
  const keys = Object.keys(data).sort().join(',');
  if (keys !== 'action,event,id,pr_number') throw new Error('中継の artifact の項目が不正です');
  const { event, action, pr_number: prNumber, id } = data;
  if (!Object.hasOwn(RELAY_ACTIONS, event)) throw new Error('中継の artifact の event が不正です');
  if (!RELAY_ACTIONS[event].includes(action))
    throw new Error('中継の artifact の action が不正です');
  if (!isPositiveInt(prNumber) || !isPositiveInt(id))
    throw new Error('中継の artifact の番号が不正です');
  return { event, action, prNumber, id };
}

// zip の中の決まった1ファイルだけを標準出力に出す。他のファイルは展開しない。
function unzipRelay(buffer, dir) {
  const file = path.join(dir, `text-checks-relay-${process.pid}.zip`);
  fs.writeFileSync(file, Buffer.from(buffer), { mode: 0o600 });
  try {
    const r = spawnSync('unzip', ['-p', file, RELAY_FILE], {
      encoding: 'utf8',
      maxBuffer: RELAY_MAX_BYTES,
    });
    if (r.status !== 0) throw new Error('中継の artifact を展開できません');
    return r.stdout;
  } finally {
    fs.rmSync(file, { force: true });
  }
}

async function loadRelay({ github, context, tmpDir }) {
  const { owner, repo } = context.repo;
  const run = context.payload.workflow_run;
  const { data } = await github.rest.actions.listWorkflowRunArtifacts({
    owner,
    repo,
    run_id: run.id,
    per_page: 100,
  });
  const matches = (data.artifacts || []).filter((a) => a.name === RELAY_ARTIFACT && !a.expired);
  if (matches.length !== 1) throw new Error('中継の artifact が1つだけ見つかりません');
  if (!(matches[0].size_in_bytes <= RELAY_MAX_BYTES))
    throw new Error('中継の artifact が大きすぎます');
  const dl = await github.rest.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: matches[0].id,
    archive_format: 'zip',
  });
  const relay = parseRelayPayload(unzipRelay(dl.data, tmpDir));
  // 起こした側のイベントと artifact の中身が食い違うものは捨てる。
  if (relay.event !== run.event) throw new Error('中継の artifact の event が実行と一致しません');
  return relay;
}

// artifact の中身は信用しない。番号だけを使い、本文・作者・URL は API から取り直して、その PR のものか確かめる。
// 取り直せない（404）ものは消えたものとして扱う。
async function resolveRelayTarget({ github, context, relay }) {
  const { owner, repo } = context.repo;
  const type = COMMENT_TYPES[relay.event];
  const gone = { number: relay.prNumber, comment: { id: relay.id, url: null, type } };
  const base = { kind: 'pull_request', labels: [], draft: false };
  const prPath = `/pulls/${relay.prNumber}`;
  try {
    if (relay.event === 'pull_request_review_comment') {
      const { data: c } = await github.rest.pulls.getReviewComment({
        owner,
        repo,
        comment_id: relay.id,
      });
      if (!String(c.pull_request_url || '').endsWith(prPath))
        throw new Error('取り直したコメントが指定の PR のものではありません');
      return {
        deleted: false,
        target: {
          ...base,
          number: relay.prNumber,
          body: c.body ?? null,
          author: c.user?.login ?? null,
          comment: { id: relay.id, url: c.html_url, type },
        },
      };
    }
    const { data: r } = await github.rest.pulls.getReview({
      owner,
      repo,
      pull_number: relay.prNumber,
      review_id: relay.id,
    });
    if (r.pull_request_url && !String(r.pull_request_url).endsWith(prPath))
      throw new Error('取り直したレビューが指定の PR のものではありません');
    return {
      deleted: false,
      target: {
        ...base,
        number: relay.prNumber,
        body: r.body ?? null,
        author: r.user?.login ?? null,
        comment: { id: relay.id, url: r.html_url, type },
      },
    };
  } catch (err) {
    if (err && err.status === 404)
      return {
        deleted: true,
        target: {
          ...base,
          number: relay.prNumber,
          body: null,
          author: null,
          comment: gone.comment,
        },
      };
    throw err;
  }
}

// fork の PR のレビュー系イベント用。既定ブランチのコードと書き込み権限で動き、中継の artifact から番号だけ受け取る。
async function runRelay(args) {
  const { context, core } = args;
  const run = context.payload.workflow_run;
  if (!run || run.conclusion !== 'success') {
    core.info('中継の実行が成功していないので検査しません。');
    return;
  }
  const tmpDir = args.tmpDir || process.env.RUNNER_TEMP || os.tmpdir();
  const relay = await loadRelay({ ...args, tmpDir });
  const { target, deleted } = await resolveRelayTarget({ ...args, relay });
  await processTarget({ ...args, target, deleted });
}

async function run(args) {
  const { context } = args;
  if (context.eventName === 'workflow_run') return runRelay(args);
  const target = resolveTarget(context.eventName, context.payload);
  const deleted = Boolean(target.comment) && context.payload.action === 'deleted';
  return processTarget({ ...args, target, deleted });
}

module.exports = {
  CHECKS_DIR,
  HEADINGS_CONFIG,
  isBotActor,
  resolveTarget,
  commentKey,
  shouldSkipComment,
  writeOrWarn,
  shouldSkipFormat,
  writeExtraFile,
  runPublicCheck,
  runFormatCheck,
  groupHits,
  formatReport,
  NOTICE_AUTHOR,
  RELAY_ARTIFACT,
  RELAY_FILE,
  findNotice,
  findNotices,
  parseRelayPayload,
  unzipRelay,
  resolveRelayTarget,
  processTarget,
  runRelay,
  run,
};
