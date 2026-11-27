// issue と PR の本文、およびコメント（issue コメント・PR のレビューコメント・レビュー本文）のチェックの呼び出し側（#99）。
// 書き方チェックは本文だけ、公開内容チェックは本文とコメントの両方に掛ける。
// 判定は brain #110 の本体の写し（.github/scripts/text-checks/ の Python）に任せ、
// ここでは「対象外の判定」「本体の CLI を --json で呼ぶ」「知らせる文を作る」「GitHub への読み書き」をする。
// workflow 側は run() を呼ぶだけにして、分岐をテストできる形でここに集める。
// レビュー系（行コメント・レビュー本文）は fork の PR だと起こしたイベントも中継の中身も信用できないので、
// 中継は「どの PR か」のヒントにだけ使い、その PR のレビューとレビューコメントを全部取り直して検査する（定期の総ざらいも同じ処理）。
// 当たった文字そのものや追加の禁止語は、知らせる文にもログにも出さない（本体も規則名だけを返す）。
// 長い行は区切って検査するので、区切りの切れ目でできた断片が元の行に無い形に当たることがある（誤検知側なので受け入れる）。
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHECKS_DIR = path.join(__dirname, 'text-checks');
// このリポのフォームとテンプレートの見出しを、本体の見出しの別名として渡す設定（brain #135・#139）。
const HEADINGS_CONFIG = path.join(__dirname, '..', 'text-checks.headings.json');
// 知らせのコメントを書くのは Actions の GITHUB_TOKEN だけ。別の作者のコメントは同じ目印があっても自分のものとして扱わない。
const NOTICE_AUTHOR = 'github-actions[bot]';
// fork の PR のレビュー系イベントは中継ワークフローが artifact で PR の番号だけ渡す（text-checks-review-relay.yml）。
const RELAY_ARTIFACT = 'text-checks-relay';
const RELAY_FILE = 'relay.json';
const RELAY_MAX_BYTES = 4096;

function isBotActor(login, config) {
  if (!login) return false;
  return login.endsWith('[bot]') || (config.skipActors || []).includes(login);
}

// イベントごとに payload の形が違うので、workflow 側の分岐を増やさないようここで1つの形に揃える。
// コメントの通知は issue / PR 側のコメント欄に出すため、number は常に issue / PR の番号を返す。
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
        comment: { id: comment.id, url: comment.html_url, type: 'issue_comment' },
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

// レート制限は待てば直る一時的な失敗で、黙って警告にすると知らせが抜けたまま気づけない。
// 権限の 403 と見分けるため、ヘッダーで判定して落とす側に回す。
function isRateLimited(err) {
  const h = err?.response?.headers || {};
  // 二次レート制限はヘッダーが付かないことがあるので、メッセージでも見る。
  // 429 はヘッダーの有無にかかわらずレート制限。403 は権限不足のこともあるので、制限の兆候があるときだけそうみなす。
  return (
    err?.status === 429 ||
    h['retry-after'] !== undefined ||
    String(h['x-ratelimit-remaining']) === '0' ||
    /rate limit/i.test(err?.message || '')
  );
}

// fork の PR や Dependabot が起こしたイベントは token が読み取り専用で、書き込みが 403 になる。
// 書けないこと自体で検査を落とすと判定が見えなくなるので、権限の失敗だけ警告にして判定は続ける（NG なら呼び出し側が落とす）。
async function writeOrWarn(write, warn) {
  try {
    await write();
    return true;
  } catch (err) {
    if (err?.status === 403 && !isRateLimited(err)) {
      warn(
        `知らせのコメントの書き込みが ${err.status} で拒否されたため、作れませんでした（権限不足の可能性）。判定は有効です。`,
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

// 写しの正規表現は、数字だけの非常に長い行で計算量が二乗に増える（6.5万桁で約2分）。
// 公開リポの本文は誰でも書けるので、止まらない検査で runner を塞がれないよう、時間に上限を付ける。
const CLI_TIMEOUT_MS = 15_000;
// 長い行は検査の前に区切る。区切った行どうしは 200 字重ねるので、200 字以内の秘密の形は境界をまたいでも見つかる。
// それより長い形が境界にちょうどまたがると見逃しうるが、行ごと検査できずに全体が止まるよりは受け入れる。
const MAX_LINE = 1000;
const LINE_OVERLAP = 200;
const TIMEOUT_RULE = '検査が時間内に終わらない';
// 総ざらいの全体の持ち時間。ジョブの上限は5分で、checkout などの前後の処理と、実行が打ち切られて何も報告できなくなる事態を避けるため、手前の3分半で自分から止める。
const SWEEP_DEADLINE_MS = 3.5 * 60 * 1000;
// 出力が大きくても spawnSync が途中で切れて JSON が壊れないよう、既定の 1 MiB より広げる。
const CLI_MAX_BUFFER = 16 * 1024 * 1024;
// Python の str.splitlines が行の終わりとみなす文字。行番号の対応を本体と揃えるために同じ集合で区切る。
const LINE_BREAKS = new Set([
  '\n',
  '\r',
  '\v',
  '\f',
  '\x1c',
  '\x1d',
  '\x1e',
  '\x85',
  '\u2028',
  '\u2029',
]);

function pythonSplitLines(text) {
  const lines = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!LINE_BREAKS.has(text[i])) continue;
    lines.push(text.slice(start, i));
    if (text[i] === '\r' && text[i + 1] === '\n') i++;
    start = i + 1;
  }
  if (start < text.length) lines.push(text.slice(start));
  return lines;
}

function runCli(script, args, text, extraFile, timeoutMs = CLI_TIMEOUT_MS) {
  // 親の環境に残った値が本体の設定を差し替えないよう、この2つは必ず外してから渡し直す。
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !INHERITED_BLOCKLIST.has(k)),
  );
  if (extraFile) env.PUBLIC_TEXT_EXTRA_FILE = extraFile;
  return spawnSync('python3', [path.join(CHECKS_DIR, script), ...args, '--json'], {
    input: text,
    encoding: 'utf8',
    env,
    timeout: timeoutMs,
    maxBuffer: CLI_MAX_BUFFER,
  });
}

// 終了コードが無いとき（起動できない・出力過多・シグナルで終了）は、その原因を書く。
function cliFailure(script, r) {
  return new Error(
    `${script} が異常終了しました（終了コード／原因: ${r.status ?? r.error?.code ?? r.signal ?? '不明'}）`,
  );
}

// 時間切れだけを要確認に回す。出力過多（ENOBUFS）やコマンドが無いなどの異常は、握りつぶさず呼び出し側で落とす。
function timedOut(r) {
  return r.error?.code === 'ETIMEDOUT';
}

// 長い行を区切り、区切った後の各行が元の何行目かを返す。長い行が無ければ本文をそのまま使う。
function splitLongLines(text) {
  const lines = pythonSplitLines(text);
  if (!lines.some((l) => l.length > MAX_LINE)) return { text, origin: null };
  const out = [];
  const origin = [];
  lines.forEach((line, i) => {
    if (line.length <= MAX_LINE) {
      out.push(line);
      origin.push(i + 1);
      return;
    }
    for (let start = 0; ; start += MAX_LINE - LINE_OVERLAP) {
      out.push(line.slice(start, start + MAX_LINE));
      origin.push(i + 1);
      if (start + MAX_LINE >= line.length) break;
    }
  });
  return { text: out.join('\n'), origin };
}

// 区切った行の結果を元の行番号に戻し、同じ規則・同じ行は1つにまとめる。
// 重なりの部分に当たったものは二重に数えうるので、区切った行の件数は目安。
function mapBack(items, origin) {
  if (!origin) return items;
  const merged = new Map();
  for (const it of items) {
    const line = origin[it.line - 1];
    const key = `${it.rule}\u0000${line}`;
    const cur = merged.get(key);
    if (cur) cur.count += it.count;
    else merged.set(key, { ...it, line });
  }
  return [...merged.values()];
}

// 公開内容チェック。本文が空（終了コード 2）は書いてはいけないものが無いので OK とする。
// 時間内に終わらないものは通さず、要確認として人の目に回す。
function runPublicCheck(text, { extraFile = null, timeoutMs = CLI_TIMEOUT_MS } = {}) {
  const { text: body, origin } = splitLongLines(text || '');
  const r = runCli('public_text_check.py', [], body, extraFile, timeoutMs);
  if (timedOut(r))
    return { ok: false, hits: [{ rule: TIMEOUT_RULE, line: 0, count: 1 }], notices: [] };
  if (r.status === 2) return { ok: true, hits: [], notices: [] };
  if (r.status !== 0 && r.status !== 1) throw cliFailure('public_text_check.py', r);
  const data = JSON.parse(r.stdout);
  return { ok: data.ok, hits: mapBack(data.hits, origin), notices: mapBack(data.notices, origin) };
}

// 書き方チェック。kind は issue か pr。既定ではこのリポの見出しの設定を渡す。configFile: null で本体の既定だけで判定する。
function runFormatCheck(
  text,
  kind,
  { configFile = HEADINGS_CONFIG, timeoutMs = CLI_TIMEOUT_MS } = {},
) {
  const args = ['--kind', kind, ...(configFile ? ['--config', configFile] : [])];
  const r = runCli('format_check.py', args, text || '', null, timeoutMs);
  if (timedOut(r))
    return { ok: false, problems: ['検査が時間内に終わりませんでした。目視で確認してください'] };
  if (r.status !== 0 && r.status !== 1) throw cliFailure('format_check.py', r);
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

// 行番号が何百もあると知らせが長くなるので、先頭の一部だけ並べて残りは数にする。
const MAX_LISTED_LINES = 50;
function lineList(lines) {
  const shown = lines.slice(0, MAX_LISTED_LINES).join('・');
  const rest = lines.length - MAX_LISTED_LINES;
  return rest > 0 ? `${shown}行目、ほか ${rest} 行` : `${shown}行目`;
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
    if (result.hits.every((h) => h.rule === TIMEOUT_RULE))
      return [
        marker,
        ...source,
        '公開内容チェック: 要確認',
        '自動で確認できなかったので目視で確認してください',
      ].join('\n');
    const rows = groupHits(result.hits).map(
      (g) => `- ${g.rule}: ${g.count}件、${lineList(g.lines)}`,
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

// 作者と目印の鍵が完全に一致するものだけ。別の作者が同じ目印を書いても編集・削除しない。
// 古い順に並べるのは、同時に走った実行が同じ知らせを2つ作ったとき、一番古い1つを本物として残して残りを消すため。
function findNotices(existing, config, key) {
  const marker = `${config.marker}:${key}`;
  return existing
    .filter((c) => c.user?.login === NOTICE_AUTHOR && (c.body || '').startsWith(`${marker}\n`))
    .sort((x, y) => x.id - y.id);
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

async function deleteAllNotices(env, key) {
  for (const found of findNotices(env.existing, env.config, key))
    await deleteNotice({ ...env, found });
}

// コメントは公開内容チェックだけ。編集履歴に元の文字が残るので、直ったときは知らせ自体を消して履歴を増やさない。
async function checkComment(env, { body, comment }, deleted, { recheck = false } = {}) {
  const key = commentKey(comment);
  // コメントが消えたら、そのコメントの知らせも消す。本文の検査はしない。
  if (deleted) {
    await deleteAllNotices(env, key);
    env.core.info('コメントが削除されたので、検査せず知らせだけ整理しました。');
    return [];
  }
  let pub = runPublicCheck(body, { extraFile: env.extraFile });
  if (pub.ok && recheck && findNotices(env.existing, env.config, key).length > 0) {
    // 一覧を取ってから検査するまでに編集されていることがあるので、知らせを消す前に今の本文を取り直して見る。
    // 取り直しから削除までの間の小さな競合は残る（今の並行グループでは完全には直列にできない）。
    const fresh = await fetchSource(env, env.number, comment.type, comment.id);
    if (fresh.gone) {
      await deleteAllNotices(env, key);
      return [];
    }
    if (fresh.body !== (body ?? null))
      pub = runPublicCheck(fresh.body, { extraFile: env.extraFile });
  }
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

// 書き方チェックはコメントには掛けず本文だけ。直ったときは同じ知らせを OK に更新する。
async function checkBody(env, { body, author, kind, labels, draft }) {
  const failures = [];
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

// issues / pull_request_target / issue_comment の1件分。deleted はコメントが消えたことを表す。
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

  const failures = target.comment
    ? await checkComment(env, target, deleted)
    : await checkBody(env, target);

  if (failures.length > 0) core.setFailed(failures.join(' / '));
  else if (!deleted) core.info('All text checks passed.');
}

// 中継の artifact は PR の作者に書き換えられる前提で、番号1つだけをヒントとして受け取る。
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
  if (Object.keys(data).join(',') !== 'pr_number')
    throw new Error('中継の artifact の項目が不正です');
  if (!isPositiveInt(data.pr_number)) throw new Error('中継の artifact の番号が不正です');
  return { prNumber: data.pr_number };
}

// 圧縮して小さく見せた巨大なファイルや、止まらない展開に備えて、出力の上限と時間の上限を付ける。
function unzipRelay(buffer, dir) {
  const file = path.join(dir, `text-checks-relay-${process.pid}.zip`);
  fs.writeFileSync(file, Buffer.from(buffer), { mode: 0o600 });
  try {
    const r = spawnSync('unzip', ['-p', file, RELAY_FILE], {
      encoding: 'utf8',
      maxBuffer: RELAY_MAX_BYTES,
      timeout: 10_000,
    });
    if (r.error || r.status !== 0) throw new Error('中継の artifact を展開できません');
    return r.stdout;
  } finally {
    fs.rmSync(file, { force: true });
  }
}

async function loadRelay({ github, context, tmpDir }) {
  const { owner, repo } = context.repo;
  const { data } = await github.rest.actions.listWorkflowRunArtifacts({
    owner,
    repo,
    run_id: context.payload.workflow_run.id,
    name: RELAY_ARTIFACT,
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
  return parseRelayPayload(unzipRelay(dl.data, tmpDir)).prNumber;
}

// 中継が無い・壊れている・読めないのは普通に起きる（衝突で動かない、改ざん）ので、ヒント無しに戻して続ける。
// レート制限だけは握りつぶさない。
async function loadRelayHint(args) {
  try {
    return await loadRelay(args);
  } catch (err) {
    if (isRateLimited(err)) throw err;
    args.core.info(`中継の artifact は使いません: ${err.message}`);
    return null;
  }
}

// 起こした実行の head と一致する PR だけを対象にする。番号は信用せず、head の sha か、head のリポジトリとブランチで確かめる。
// sha が完全に一致すれば、マージ・クローズ済みの PR でもレビューは後から付くので対象にする。
// ブランチだけの一致は、push で sha が進んだ開いた PR にだけ使う（閉じた PR は同じブランチの別の PR と取り違えうる）。
async function findPullsForRun(args) {
  const { github, context, core } = args;
  const { owner, repo } = context.repo;
  const run = context.payload.workflow_run;
  const fullName = run.head_repository?.full_name;
  const sameHead = (pr) => {
    if (run.head_sha && pr.head?.sha === run.head_sha) return true;
    return (
      pr.state === 'open' &&
      Boolean(fullName) &&
      pr.head?.repo?.full_name === fullName &&
      pr.head?.ref === run.head_branch
    );
  };

  let hinted = null;
  const hint = await loadRelayHint(args);
  if (hint) {
    try {
      const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: hint });
      if (sameHead(pr)) hinted = pr.number;
      else core.info(`中継の PR #${hint} は、起こした実行の head と一致しないので使いません。`);
    } catch (err) {
      if (err?.status !== 404) throw err;
    }
  }
  const headOwner = run.head_repository?.owner?.login;
  const listed =
    headOwner && run.head_branch
      ? await github.paginate(github.rest.pulls.list, {
          owner,
          repo,
          state: 'all',
          head: `${headOwner}:${run.head_branch}`,
          per_page: 100,
        })
      : [];
  if (hinted === null) return listed.filter(sameHead).map((pr) => pr.number);
  // 同じ head の別の PR（base 違い）の実行は、同じ並行グループで打ち切られうる。どの実行が残っても全部の PR を見るよう、
  // ヒントが無いときと同じ判定（開いた PR は同じブランチ、閉じた PR は sha の完全一致）で、1回の実行にまとめて見る。
  return [...new Set([hinted, ...listed.filter(sameHead).map((pr) => pr.number)])];
}

const RELAY_WORKFLOW_PATH = '.github/workflows/text-checks-review-relay.yml';
const RELAY_EVENTS = new Set(['pull_request_review', 'pull_request_review_comment']);
// 閉じた PR にも後からレビューが付く。総ざらいは毎時なので、1回飛んだり遅れたりしても穴が開かないよう、周期より広い3時間に取る。
const CLOSED_WINDOW_MS = 3 * 60 * 60 * 1000;

// 持ち時間（run が決める deadline）を過ぎたかどうか。deadline が無い呼び出しでは時間で止めない。
function pastDeadline({ clock, deadline }) {
  return deadline !== undefined && clock() >= deadline;
}

const NOTICE_KEY_RE = /^public-comment-(review|review_comment)-(\d+)$/;

// 一覧のページがずれて取りこぼしただけで知らせを消さないよう、消す前に元を1件ずつ取り直し、404 のときだけ消す。
async function fetchSource({ github, context }, number, type, id) {
  const { owner, repo } = context.repo;
  try {
    const res =
      type === 'review'
        ? await github.rest.pulls.getReview({ owner, repo, pull_number: number, review_id: id })
        : await github.rest.pulls.getReviewComment({ owner, repo, comment_id: id });
    return { gone: false, body: res.data?.body ?? null };
  } catch (err) {
    if (err?.status === 404) return { gone: true, body: null };
    throw err;
  }
}

async function sourceIsGone(env, number, type, id) {
  return (await fetchSource(env, number, type, id)).gone;
}

// PR のレビューとレビューコメントをすべて取り直して検査し、元が無くなった知らせを片づける。
// 起こしたイベントの id を使わないので、中継の中身が偽でも、中継が動かなくても、本物の NG を取りこぼさない。
// 返すのは NG の一覧。落とすかどうかは呼び出し側が決める。
async function sweepPull(args, number) {
  const { github, context, core, config, extraFile } = args;
  const { owner, repo } = context.repo;
  const list = (fn, params) => github.paginate(fn, { owner, repo, ...params, per_page: 100 });
  const existing = await list(github.rest.issues.listComments, { issue_number: number });
  const reviews = await list(github.rest.pulls.listReviews, { pull_number: number });
  const reviewComments = await list(github.rest.pulls.listReviewComments, { pull_number: number });
  const env = { github, context, core, config, extraFile, existing, number };

  // 新しい投稿を先頭にして、残りは毎時ずらした位置から検査する。時間切れで途中までになっても、起こしたばかりの投稿は先に見られ、
  // 古い投稿もいつまでも後回しにならない。
  const hourIndex = Math.floor(args.clock() / 3_600_000);
  const stamp = (x) => Date.parse(x.updated_at ?? x.submitted_at ?? x.created_at) || 0;
  const newestFirst = [
    ...reviews.map((x) => ({ type: 'review', x })),
    ...reviewComments.map((x) => ({ type: 'review_comment', x })),
  ].sort((a, b) => stamp(b.x) - stamp(a.x));
  const sources = orderWithinPr(newestFirst, hourIndex, number).map(({ type, x }) => ({
    number,
    body: x.body ?? null,
    author: x.user?.login ?? null,
    comment: { id: x.id, url: x.html_url, type },
  }));

  const failures = [];
  for (const [i, target] of sources.entries()) {
    // 時間切れで途中までのときは、確認していない分の知らせを「元が無い」と誤って消さないよう、片づけもしない。
    if (pastDeadline(args)) return { failures, left: sources.length - i };
    if (shouldSkipComment(target)) continue;
    failures.push(...(await checkComment(env, target, false, { recheck: true })));
  }

  // 消えたレビューコメントは消えたことを知らせる手段が無いので、知らせはここで片づける。issue コメントの知らせには触らない。
  const live = new Set(sources.map((t) => commentKey(t.comment)));
  const prefix = `${config.marker}:`;
  for (const c of existing) {
    if (c.user?.login !== NOTICE_AUTHOR || !(c.body || '').startsWith(prefix)) continue;
    const key = c.body.slice(prefix.length).split('\n', 1)[0];
    const m = NOTICE_KEY_RE.exec(key);
    if (!m || live.has(key)) continue;
    // 片づけ1件ごとに API を呼ぶので、時間切れならここで止めて、片づけが途中であることを報告する。
    if (pastDeadline(args)) return { failures, left: 0, cleanupCut: true };
    if (await sourceIsGone(env, number, m[1], Number(m[2])))
      await deleteNotice({ ...env, found: c });
  }
  return { failures, left: 0, cleanupCut: false };
}

// 1つの PR の失敗で残りを止めない。失敗した PR は最後にまとめて落とす。レート制限だけは続けても無駄なのですぐ投げる。
// NG で実行まで落とすのは、起こした本人の投稿の結果を知らせたいとき（中継）だけ。毎時の総ざらいは同じ NG が直るまで毎回見つかるので、NG は警告にとどめる。
// ただし時間切れと失敗は、見えないまま残らないよう毎時の総ざらいでも落とす。
async function sweepEach(args, numbers, { failOnNg }) {
  const { core } = args;
  const ng = [];
  const errored = [];
  const unchecked = [];
  for (const [i, number] of numbers.entries()) {
    if (pastDeadline(args)) {
      unchecked.push(...numbers.slice(i).map((n) => `#${n}`));
      break;
    }
    try {
      const { failures, left, cleanupCut } = await sweepPull(args, number);
      if (left > 0) {
        core.warning(`PR #${number}: 時間切れで残り ${left} 件のコメントが未確認です。`);
        unchecked.push(`#${number}（途中まで）`);
      }
      if (cleanupCut) {
        core.warning(`PR #${number}: 時間切れで古い知らせの片づけが途中です。`);
        unchecked.push(`#${number}（片づけ途中）`);
      }
      if (failures.length === 0) continue;
      core.warning(`PR #${number}: ${failures.join(' / ')}`);
      ng.push(`PR #${number}: ${failures.join(' / ')}`);
    } catch (err) {
      if (isRateLimited(err)) throw err;
      core.warning(`PR #${number} の総ざらいに失敗しました: ${err.message}`);
      errored.push(`#${number}`);
    }
  }
  const messages = failOnNg ? ng : [];
  if (errored.length > 0) messages.push(`総ざらいに失敗した PR: ${errored.join(', ')}`);
  if (unchecked.length > 0) {
    // 例外にはせず、見たところまでの結果は残して実行を落とす。放っておくと見えないので、毎時の総ざらいでも落とす。
    // 毎時の総ざらいでは並びを毎時並べ替えるので、同じ PR がいつも後回しになることはない（中継は並べ替えない）。
    const text = `時間切れのため未確認の PR: ${unchecked.join(', ')}`;
    messages.push(text);
  }
  if (messages.length > 0) core.setFailed(messages.join(' / '));
}

// fork の PR のレビュー系イベント用。既定ブランチのコードと書き込み権限で動き、中継の実行が成功したかどうかは見ない。
// 起こした本人の投稿の結果なので、NG なら他のイベントと同じく落とす。
async function runRelay(args) {
  const run = args.context.payload.workflow_run;
  // PR の作者が別の workflow を同じ名前で作っても、この中継の実行以外は相手にしない。path に付く @ref は取り除いて比べる。
  if (
    String(run.path || '').split('@')[0] !== RELAY_WORKFLOW_PATH ||
    !RELAY_EVENTS.has(run.event)
  ) {
    args.core.info('想定した中継の実行ではないので何もしません。');
    return;
  }
  const tmpDir = args.tmpDir || process.env.RUNNER_TEMP || os.tmpdir();
  const numbers = await findPullsForRun({ ...args, tmpDir });
  if (numbers.length === 0) {
    args.core.info('対応する PR が見つからないので何もしません。');
    return;
  }
  await sweepEach(args, numbers, { failOnNg: true });
}

// 時間切れで打ち切られても同じ末尾の PR がいつも未確認にならないよう、毎時、番号をハッシュで並べ替える。
// 時刻だけで決まるので同じ時間なら同じ順になる。ずらすだけの回し方では PR どうしの順が固定され、重い PR の直後の PR がいつも後回しになるため、順そのものを毎時変える。
function hourHash(hourIndex, n) {
  let h = 0x811c9dc5;
  for (const ch of `${hourIndex}:${n}`) {
    h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  }
  // 末尾の1文字しか違わない入力でも並びが散るよう、最後に混ぜる（murmur3 の仕上げ）。
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function sweepOrder(numbers, hourIndex) {
  return [...numbers].sort((a, b) => hourHash(hourIndex, a) - hourHash(hourIndex, b) || a - b);
}

// 1つの PR の中では、いちばん新しい投稿を先頭に置き、残りは毎時ずらした位置から回す。
// 先頭が新しい順のままだと、時間切れの PR で古い投稿がいつまでも未確認になるため。
function orderWithinPr(items, hourIndex, number) {
  if (items.length <= 2) return [...items];
  const [newest, ...rest] = items;
  const offset = hourHash(hourIndex, number) % rest.length;
  return [newest, ...rest.slice(offset), ...rest.slice(0, offset)];
}

// 中継が動かなかった（衝突・初回の承認待ち・中継の削除）ぶんは、定期の総ざらいで拾う。開いた PR と、最近閉じた・最近レビューコメントが動いた PR が対象。
// NG は警告、時間切れと失敗は赤。NG まで赤にすると、直るまで毎時の実行が赤くなり続けてしまう。
async function runSweepAll(args) {
  const { github, context } = args;
  const { owner, repo } = context.repo;
  const cutoff = args.clock() - CLOSED_WINDOW_MS;
  const open = await github.paginate(github.rest.pulls.list, {
    owner,
    repo,
    state: 'open',
    per_page: 100,
  });
  // 更新の新しい順なので、窓より古いものが出たらその先は全部古い。ページを取りすぎないよう打ち切る。
  const closed = await github.paginate(
    github.rest.pulls.list,
    { owner, repo, state: 'closed', sort: 'updated', direction: 'desc', per_page: 100 },
    (response, done) => {
      const recent = response.data.filter((pr) => Date.parse(pr.updated_at) >= cutoff);
      if (recent.length < response.data.length) done();
      return recent;
    },
  );
  // 閉じた PR の updated_at はレビューコメントが付いても動かないことがあるので、リポ全体の更新済みレビューコメントからも PR を拾う。
  const touched = await github.paginate(github.rest.pulls.listReviewCommentsForRepo, {
    owner,
    repo,
    sort: 'updated',
    direction: 'desc',
    since: new Date(cutoff).toISOString(),
    per_page: 100,
  });
  const parsed = touched.map((c) => pullNumberOf(c.pull_request_url, owner, repo));
  const fromComments = new Set(parsed.filter(Boolean));
  const dropped = parsed.length - parsed.filter(Boolean).length;
  const all = [...new Set([...open, ...closed].map((pr) => pr.number).concat([...fromComments]))];
  const numbers = sweepOrder(all, Math.floor(args.clock() / 3_600_000));
  await sweepEach(args, numbers, { failOnNg: false });
  args.core.info(
    `PR ${numbers.length} 件（開いた ${open.length} 件、最近閉じた ${closed.length} 件、最近更新のレビューコメントから ${fromComments.size} 件）を総ざらいしました。`,
  );
  if (dropped > 0)
    args.core.info(`PR を特定できないレビューコメントが ${dropped} 件ありました（対象外）。`);
}

// 他のリポジトリの URL や形の違うものは数に入れない。
function pullNumberOf(url, owner, repo) {
  const m = /\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)$/.exec(String(url || ''));
  return m &&
    m[1].toLowerCase() === owner.toLowerCase() &&
    m[2].toLowerCase() === repo.toLowerCase()
    ? Number(m[3])
    : null;
}

async function run(input) {
  const { context } = input;
  // clock はテストで差し替える。
  const clock = input.clock ?? Date.now;
  const args = { ...input, clock, deadline: clock() + SWEEP_DEADLINE_MS };
  if (context.eventName === 'workflow_run') return runRelay(args);
  if (context.eventName === 'schedule' || context.eventName === 'workflow_dispatch')
    return runSweepAll(args);
  const target = resolveTarget(context.eventName, context.payload);
  const deleted = Boolean(target.comment) && context.payload.action === 'deleted';
  return processTarget({ ...args, target, deleted });
}

module.exports = {
  timedOut,
  sweepOrder,
  orderWithinPr,
  cliFailure,
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
  findNotices,
  parseRelayPayload,
  unzipRelay,
  isRateLimited,
  findPullsForRun,
  sweepPull,
  processTarget,
  runRelay,
  runSweepAll,
  run,
};
