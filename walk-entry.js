// WALK, 入口ページの共通ロジック(2026-09-25〜)。
// URL /s/<塾キー>/(欠席・振替) /s/<塾キー>/hub/(マイページ) から塾と種類を決め、
// schools.js の LIFF ID・/exec URL で「LIFFログイン → GASを iframe に表示(Googleの帯なし)」を行う。
// GAS側の 14_hub_embed.gs / 05_absence_embed.gs と対。GAS画面は自分へのリンク/フォームを
// postMessage(nav/post/ready)で頼んでくるので、ここで iframe に流し込む。
// 元にしたのは ユリイカ専用の /hub/index.html と /index.html(2026-09-24版)。動きは同じ。
(function () {
  var KINDS = {
    hub: {
      title: 'マイページ',
      menu: 'マイページ',
      consent: 'ご本人の確認のため、初回だけ確認画面が出ます。表示されたら「許可する」を選んでください。',
      fields: []
    },
    absence: {
      title: '欠席・振替のご連絡',
      menu: '欠席・遅刻連絡',
      consent: '欠席連絡には、本人確認のため、初回のみ確認画面が表示されます。表示されたら「許可する」を選んでください。',
      fields: [['flow', 'absence']]
    },
    // 2026-09-25追加: 教室の入退室タブレット。LINEログインは使わない。
    // URL は /s/<塾キー>/tablet/#k=<教室の鍵>(ハブの「教室のタブレットをつなぐ」のQRがこの形)。
    // 鍵は # の後ろに置くので、この入口ページのサーバー(Cloudflare)には送られない。
    tablet: {
      title: '入退室',
      menu: '入退室',
      consent: '',
      noLiff: true
    }
  };

  function parsePath(p) {
    var m = /^\/s\/([a-z0-9-]{1,40})(?:\/(?:(hub|tablet)\/?)?)?$/.exec(String(p || ''));
    if (!m) return null;
    return { key: m[1], kind: m[2] || 'absence' };
  }

  function findSchool(schools, key) {
    if (!schools || !Object.prototype.hasOwnProperty.call(schools, key)) return null;
    return schools[key];
  }

  function start(win) {
    var doc = win.document;
    var msg = doc.getElementById('msg');
    var frame = doc.getElementById('app');
    var shown = false;

    function stopSpin() {
      var sp = doc.querySelector('.spinner');
      if (sp) sp.style.display = 'none';
    }
    function fail(text) { stopSpin(); msg.textContent = text; }

    var route = parsePath(win.location.pathname);
    var school = route && findSchool(win.WALK_SCHOOLS, route.key);
    var conf = school && school[route.kind];
    if (!route || !conf || !conf.execUrl || (!conf.liffId && !(KINDS[route.kind] && KINDS[route.kind].noLiff))) {
      doc.title = 'ページが見つかりません';
      fail('ページが見つかりません。LINEの教室アカウントのメニューから開き直してください。');
      return { ok: false };
    }
    var kind = KINDS[route.kind];
    var LIFF_ID = conf.liffId;
    var GAS_EXEC_URL = conf.execUrl;
    doc.title = kind.title;
    frame.setAttribute('title', kind.title);
    doc.getElementById('consentText').textContent = kind.consent;

    function showApp() {
      if (shown) return;
      shown = true;
      doc.getElementById('loading').style.display = 'none';
      frame.style.display = 'block';
    }
    function postToFrame(url, fields) {
      var form = doc.createElement('form');
      form.method = 'POST';
      form.action = url;
      form.target = 'app';
      form.style.display = 'none';
      for (var i = 0; i < fields.length; i++) {
        var el = doc.createElement('input');
        el.type = 'hidden';
        el.name = String(fields[i][0]);
        el.value = String(fields[i][1]);
        form.appendChild(el);
      }
      doc.body.appendChild(form);
      form.submit();
      doc.body.removeChild(form);
    }
    function isOurExec(u) {
      return typeof u === 'string' && (u === GAS_EXEC_URL || u.indexOf(GAS_EXEC_URL + '?') === 0);
    }
    win.addEventListener('message', function (ev) {
      // GASの画面(googleusercontent.com)からの頼みだけ受ける。
      if (!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(ev.origin || '')) return;
      var d = ev.data;
      if (!d || typeof d !== 'object') return;
      if (d.walk === 'ready') { showApp(); return; }
      if (d.walk === 'nav' && isOurExec(d.url)) { frame.src = d.url; return; }
      if (d.walk === 'post' && isOurExec(d.url) && Array.isArray(d.fields)) { postToFrame(d.url, d.fields); return; }
    });
    // readyが来なくても、iframeが読み込み終わったら表示する(旧端末対策)。
    frame.addEventListener('load', function () { if (frame.getAttribute('data-started')) win.setTimeout(showApp, 1500); });

    if (kind.noLiff) {
      // タブレット: # の後ろの鍵を付けて、そのまま iframe で開く。
      var km = /(?:^#|&)k=([A-Za-z0-9_-]{8,200})(?:&|$)/.exec(String(win.location.hash || ''));
      if (!km) {
        fail('この端末はまだつながっていません。ハブの「教室のタブレットをつなぐ」に出るQRを読んで開いてください。');
        return { ok: false, key: route.key, kind: route.kind };
      }
      frame.setAttribute('data-started', '1');
      frame.src = GAS_EXEC_URL + '?k=' + km[1];
      return { ok: true, key: route.key, kind: route.kind };
    }

    var liff = win.liff;
    var done = (async function () {
      try {
        await liff.init({ liffId: LIFF_ID });
        msg.textContent = 'ログインを確認しています…';
        if (!liff.isLoggedIn()) {
          if (!liff.isInClient()) {
            fail('お手数ですが、LINEアプリのメニューにある「' + kind.menu + '」からお開きください。');
            return;
          }
          doc.getElementById('loading').style.display = 'none';
          doc.getElementById('consentNotice').style.display = 'block';
          doc.getElementById('proceedBtn').addEventListener('click', function () { liff.login(); });
          return;
        }
        var idToken = liff.getIDToken();
        if (!idToken) { fail('ログイン情報を取得できませんでした。時間をおいてお試しください。'); return; }
        msg.textContent = '本人確認をしています…';
        frame.setAttribute('data-started', '1');
        postToFrame(GAS_EXEC_URL, kind.fields.concat([['action', 'liffAuth'], ['idToken', idToken]]));
      } catch (e) {
        fail('エラーが発生しました。時間をおいてお試しください。');
      }
    })();
    return { ok: true, key: route.key, kind: route.kind, liffId: LIFF_ID, done: done };
  }

  window.WALK_ENTRY = { parsePath: parsePath, KINDS: KINDS };
  if (!window.WALK_ENTRY_NO_AUTOSTART) window.WALK_ENTRY.result = start(window);
})();
