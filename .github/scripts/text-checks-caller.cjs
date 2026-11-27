// issue と PR の本文、およびコメント（issue コメント・PR のレビューコメント・レビュー本文）のチェックの呼び出し側（#99）。
// 書き方チェックは本文だけ、公開内容チェックは本文とコメントの両方に掛ける。
// 判定は brain #110 の本体の写し（.github/scripts/text-checks/ の Python）に任せ、
// ここでは「対象外の判定」「本体の CLI を --json で呼ぶ」「知らせる文を作る」だけをする。
// 当たった文字そのものや追加の禁止語は、知らせる文にもログにも出さない（本体も規則名だけを返す）。
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const CHECKS_DIR = path.join(__dirname, 'text-checks');
// このリポのフォームとテンプレートの見出しを、本体の見出しの別名として渡す設定（brain #135・#139）。
const HEADINGS_CONFIG = path.join(__dirname, '..', 'text-checks.headings.json');

function isBotActor(login, config) {
  if (!login) return false;
  return login.endsWith('[bot]') || (config.skipActors || []).includes(login);
}

// イベントごとに payload の形が違うので、workflow 側の分岐を増やさないようここで1つの形に揃える。
// コメントの通知は issue / PR 側のコメント欄に出すため、number は常に issue / PR の番号を返す。
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
    case 'pull_request_review_comment': {
      const { pull_request: pr, comment } = payload;
      return {
        number: pr.number,
        body: comment.body ?? null,
        author: loginOf(comment),
        kind: 'pull_request',
        labels: [],
        draft: Boolean(pr.draft),
        comment: { id: comment.id, url: comment.html_url, type: COMMENT_TYPES[eventName] },
      };
    }
    case 'pull_request_review': {
      const { pull_request: pr, review } = payload;
      return {
        number: pr.number,
        // コメントなしの承認などでは本文が null になる。
        body: review.body ?? null,
        author: loginOf(review),
        kind: 'pull_request',
        labels: [],
        draft: Boolean(pr.draft),
        comment: { id: review.id, url: review.html_url, type: COMMENT_TYPES[eventName] },
      };
    }
    default:
      throw new Error(`未対応のイベントです: ${eventName}`);
  }
}

// このワークフローが作った知らせのコメントを自分で検査すると、知らせが知らせを呼ぶ無限ループになる。
function isOwnNotice(body, config) {
  return typeof body === 'string' && body.startsWith(config.marker);
}

// 知らせのコメントの目印に使う鍵。コメントごとに別の知らせ1つを更新できるよう、種類と id で一意にする。
function commentKey(comment) {
  return `public-comment-${comment.type}-${comment.id}`;
}

// コメント側の検査を飛ばす条件。自分の知らせ（ループ防止）と Actions のボット。
function shouldSkipComment({ body, author }, config) {
  return isOwnNotice(body, config) || author === 'github-actions[bot]';
}

// fork の PR から飛んだレビュー系のイベントは token が読み取り専用で、コメントを書けず 403 になる。
// 書けないこと自体で検査を落とすと本文の判定が見えなくなるので、書き込みだけ警告にして判定は続ける。
async function writeOrWarn(write, warn) {
  try {
    await write();
    return true;
  } catch (err) {
    if (err && err.status === 403) {
      warn(
        'コメントを書く権限がないため、知らせのコメントは作れませんでした（fork の PR の読み取り専用 token）。判定は有効です。',
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

function runCli(script, args, text, extraFile) {
  const env = { ...process.env };
  delete env.PUBLIC_TEXT_EXTRA_FILE;
  delete env.TEXT_CHECKS_CONFIG;
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

// sourceUrl はコメントの検査のときだけ渡す。どのコメントの話かを示すための URL で、本文の一部は載せない。
function formatReport(kind, result, config, key = kind, sourceUrl = null) {
  const marker = `${config.marker}:${key}`;
  const source = sourceUrl ? [`対象のコメント: ${sourceUrl}`] : [];
  if (kind === 'public') {
    if (result.ok)
      return [marker, ...source, '公開内容チェック: OK（当たった規則はありません）'].join('\n');
    const rows = groupHits(result.hits).map(
      (g) => `- ${g.rule}: ${g.count}件、${g.lines.join('・')}行目`,
    );
    return [
      marker,
      ...source,
      '公開内容チェック: 要確認',
      '公開リポに書いてはいけない形の文字が見つかりました。当たった文字はここには書きません。本文を直してください。',
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

module.exports = {
  CHECKS_DIR,
  HEADINGS_CONFIG,
  isBotActor,
  resolveTarget,
  isOwnNotice,
  commentKey,
  shouldSkipComment,
  writeOrWarn,
  shouldSkipFormat,
  writeExtraFile,
  runPublicCheck,
  runFormatCheck,
  groupHits,
  formatReport,
};
