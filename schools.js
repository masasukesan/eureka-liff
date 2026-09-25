// WALK, 入口ページの塾一覧(2026-09-25〜)。1塾=1ブロック。
// ここに書くのは HTML に載っても困らない値だけ(LIFF ID・/exec の URL・塾名)。
// ★LINEのトークン・スプレッドシートID・PINなどの秘密は絶対に書かない(このファイルは誰でも見られる)。
//
// 塾キー: 英小文字・数字・ハイフン(URL /s/<塾キー>/ になる)。一度決めたら変えない(LIFFのエンドポイントに入るため)。
// LIFF のエンドポイントURL:
//   欠席・振替   https://<このサイト>/s/<塾キー>/
//   マイページ   https://<このサイト>/s/<塾キー>/hub/
// 入退室タブレット(LIFFなし) https://<このサイト>/s/<塾キー>/tablet/  ← ハブの「教室のタブレットをつなぐ」に登録するURL
// GAS側のスクリプトプロパティ ABSENCE_EMBED_ORIGINS / HUB_EMBED_ORIGINS には https://<このサイト> を入れる。
window.WALK_SCHOOLS = {
  eureka: {
    name: '個別指導学習塾EUREKA',
    hub: {
      liffId: '2011507426-FOY9141W',
      execUrl: 'https://script.google.com/macros/s/AKfycbzBdIkY05qZrrbJKgJ-AGByfFIk41ey1yIdugYPOojR7pLtnHvRQ29CcLIqDS9sChpcPA/exec'
    },
    absence: {
      liffId: '2011507426-tZhrl4fx',
      execUrl: 'https://script.google.com/macros/s/AKfycbyrnq8-V17V67NAcbJ2co1LHTKT0NYyjtjA7jy8QIpm49artVQrrnpI27YoMeKNEwmN/exec'
    },
    // 入退室タブレット(2026-09-25〜)。鍵はここに書かない(ハブのQRが #k= で渡す)。
    tablet: {
      execUrl: 'https://script.google.com/macros/s/AKfycbzPLs_X1jMwLyZ40122I__HHN5E7NrsoA3ObgdSmQF2TPnrzECdmix6hm0Q-gu-ZsMI/exec'
    }
  }
};
