// WALK, 入口ページの説明文(OGP)を塾×種類ごとに差し込む(2026-10-05〜)。Cloudflare Pages Functions。
// LINE などのリンクプレビューは JS を実行しないので、サーバーが返す HTML の時点で <title> と og:* を入れておく。
// /s/* は本来 _redirects で /entry/ を返すが、Function が動くときは _redirects は使われない(Cloudflare の仕様)。
// そのため、ここで /entry/ を取ってきて、<title>・description・og:title・og:description だけ書き換えて同じURLのまま返す(転送しない)。
// 本文・スクリプトは一切変えない。塾名は schools.js の name を読む(塾を足すときに、このファイルは触らない)。
// 何か失敗したときは、書き換えずにそのままの /entry/ を返す(entry/index.html の共通の説明文が出る)。
// 呼ばれるのは /s/* だけ(このファイルの置き場所 functions/s/ と _routes.json)。ほかの静的ファイルは Function を通らない(無料・回数制限なし)。

var OGP_TEXT = {
  hub: { title: 'マイページ', desc: '授業の記録・お知らせ・お友だちへの紹介などを見られます(LINEでひらきます)' },
  absence: { title: '欠席・振替のご連絡', desc: 'お休み・遅刻のご連絡はこちらから' },
  meeting: { title: '面談のご予約', desc: 'ご希望の日時を選んで、面談を予約できます(LINEでひらきます)' },
  tablet: { title: '入退室', desc: '教室の入退室の記録用ページです' },
  trial: { title: '体験授業のご予約', desc: 'ご希望の日時を選んで、体験授業を予約できます' }
};
var OGP_NOT_FOUND = { title: 'ページが見つかりません', desc: 'LINEの教室アカウントのメニューから開き直してください。' };

// walk-entry.js の parsePath と同じ形だけ受け付ける。
function ogpParsePath(p) {
  var m = /^\/s\/([a-z0-9-]{1,40})(?:\/(?:(hub|tablet|meeting|trial)\/?)?)?$/.exec(String(p || ''));
  if (!m) return null;
  return { key: m[1], kind: m[2] || 'absence' };
}

// schools.js の本文から、塾キーのブロックの先頭にある name: '…' を読む。無ければ ''。
// (schools.js はブラウザ用のスクリプトなので実行はせず、文字として読む。name はブロックの最初に書く決まり)
function ogpSchoolName(schoolsJs, key) {
  if (!/^[a-z0-9-]{1,40}$/.test(String(key || ''))) return '';
  var re = new RegExp('(?:^|[\\n{,])[ \\t]*(?:' + key + "|'" + key + "'|\"" + key + '")[ \\t]*:[ \\t]*\\{\\s*' +
    "name[ \\t]*:[ \\t]*(?:'((?:[^'\\\\\\n]|\\\\.)*)'|\"((?:[^\"\\\\\\n]|\\\\.)*)\")");
  var m = re.exec(String(schoolsJs || ''));
  if (!m) return '';
  return (m[1] !== undefined ? m[1] : m[2]).replace(/\\(.)/g, '$1').trim();
}

function ogpEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 塾×種類の文言。未登録の塾・知らない形は「ページが見つかりません」(塾名は出さない)。
function ogpTextFor(pathname, schoolsJs) {
  var route = ogpParsePath(pathname);
  var name = route ? ogpSchoolName(schoolsJs, route.key) : '';
  if (!route || !name) return OGP_NOT_FOUND;
  var t = OGP_TEXT[route.kind];
  return { title: name + ' ' + t.title, desc: t.desc };
}

// 1つのタグを差し替える。無ければ </head> の前に足す。
function ogpSetTag(html, re, tag) {
  if (re.test(html)) return html.replace(re, function () { return tag; });
  return html.replace(/<\/head>/i, function () { return tag + '\n</head>'; });
}

function buildEntryHtml(pathname, schoolsJs, entryHtml) {
  var t = ogpTextFor(pathname, schoolsJs);
  var title = ogpEsc(t.title), desc = ogpEsc(t.desc);
  var h = String(entryHtml);
  h = ogpSetTag(h, /<title>[^<]*<\/title>/i, '<title>' + title + '</title>');
  h = ogpSetTag(h, /<meta name="description"[^>]*>/i, '<meta name="description" content="' + desc + '">');
  h = ogpSetTag(h, /<meta property="og:title"[^>]*>/i, '<meta property="og:title" content="' + title + '">');
  h = ogpSetTag(h, /<meta property="og:description"[^>]*>/i, '<meta property="og:description" content="' + desc + '">');
  return h;
}

export async function onRequest(context) {
  var request = context.request;
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next();
  try {
    var url = new URL(request.url);
    var page = await context.env.ASSETS.fetch(new URL('/entry/', url));
    var schools = await context.env.ASSETS.fetch(new URL('/schools.js', url));
    if (!page.ok) return context.next();
    if (!schools.ok) return page;
    var html = buildEntryHtml(url.pathname, await schools.text(), await page.text());
    var headers = new Headers(page.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('etag');
    headers.set('content-type', 'text/html; charset=utf-8');
    return new Response(request.method === 'HEAD' ? null : html, { status: 200, headers: headers });
  } catch (e) {
    // 書き換えに失敗しても、入口ページそのものは返す(Function が動くと _redirects は効かないため、next() だと 404 になりうる)。
    try { return await context.env.ASSETS.fetch(new URL('/entry/', request.url)); } catch (e2) { return context.next(); }
  }
}
