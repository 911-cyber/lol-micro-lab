# LoL Micro Lab — Mid Duel

ブラウザーで遊ぶミッド1v1専用ゲーム。10体から自分のチャンピオンを選び、エズリアルBOTと対戦します。タワー破壊で一本、二本先取で勝利。ラウンド間に双方が装備を一つ選び、持ち越します。ほかのトレーニングモードは削除しました。

## 遊ぶ

既存の「LoL Micro Lab (Edge)」ショートカットから起動。チャンピオンと難易度を選び「ミッド1v1を開始」。操作設定はロビーまたはEscから開けます。

| 入力 | 操作 |
| --- | --- |
| 右クリック／長押し | 地面へ移動／敵へ通常攻撃 |
| A → 左クリック | 射程を表示してAttack Move |
| Shift＋右クリック／X | Attack Moveを即入力 |
| S／H | 停止・予約スキル解除 |
| QWER | チャンピオンのスキル |
| Shift＋QWER | 狙いを表示、キーを離して発射 |
| D／F | ヒール／フラッシュ |
| C長押し | AA射程 |
| ` 長押し | 直接クリックをチャンピオンだけに制限 |
| Space長押し／Y | 自分を中央に／カメラ固定切替 |
| 画面端／矢印／中ドラッグ | カメラ移動 |
| ミニマップ左／右クリック | カメラ移動／移動命令 |
| Esc | 狙い解除、または設定と一時停止 |
| T／M | 新しい対戦／チャンピオン選択 |

設定にはクイックキャスト、キーを離して発射、通常キャスト、Attack Moveの優先位置、カメラ固定、画面端移動と速度があります。ブラウザーごとに自動保存。

## 対戦

- 盾・武器の前衛3体、ローブ・杖の後衛3体。タワー奥の拠点から30秒間隔で歩いて来ます。前後列の間隔は4.8、横は1.7、接近時も約1.3の中心間隔を保ちます。レーン全長は80。ミニオンへのラストヒット、チャンピオンを攻撃した際のミニオン・タワー反撃を実装。
- BOTはCS、距離維持、可視の弾への反応、Q／W／E／R、マナ、AAの発射前停止を持ちます。反応は難易度別で、カーソルや将来の入力を読みません。
- 死亡は5秒で復活。単独のタワー攻撃は軽減、ミニオンを伴うAAでタワーを壊します。
- ラウンド結果にはCS、取り逃し、被弾、AAキャンセルに応じたコーチングを表示。会話型AIはこのUIには出していません。

## 実装と確認

ES modules。`src/input.js`／`controls.js`／`aim.js`が操作、`camera.js`／`minimap.js`が視点、`player.js`が移動とタワー経路、`combat.js`／`abilities.js`が攻撃とスキル、`duel.js`が対戦とBOT、`duel-overlay.js`／`ui.js`がHUD、`champions.js`／`presentation.js`が描画と演出。

Three.js 0.180.0と実際の座標・衝突判定を使う統合テスト：

```
node --experimental-vm-modules tests/controls.test.cjs /path/to/three.module.js
node --experimental-vm-modules tests/duel.test.cjs /path/to/three.module.js
node --experimental-vm-modules tests/minions.test.cjs /path/to/three.module.js
```

確認記録は `CONTROLS-TEST-RESULTS.json` と `DUEL-TEST-RESULTS.json` と `MINION-TEST-RESULTS.json`。WebGL描画とブラウザー上の操作は別途実画面で確認。

## LoLとの違い

このゲームはLoLクライアントの完全再現ではありません。全QWERを最初から使える専用対戦ルールです。HPは100へ正規化し、ダメージ、アイテム、ウェーブ間隔、各スキルの細部を簡略化しています。レベル上げ、ルーン、リコール、フルショップ、視界の霧、スキルの進化・全チャージ仕様は未実装。詠唱時間はシミュレーション推定値です。

基礎マナ・自然回復・ランク1のマナ消費と待ち時間は取得済みのRiot Data Dragon 16.20.1から静的データ化。チャージの回復時間などクライアント専用情報までこのデータだけで保証できません。

カメラは俯角52度、水平旋回−57度、垂直画角40度の透視投影。この角度は添付のレーン戦画像に寄せた実装上の選択値で、LoL公式の俯角を意味しません。Riotの公開資料に確定的なカメラ角度の数値は見つからなかったため、公式の描画例を参考に操作しやすい配置を選択しました。

参照： [Riotの描画パイプライン](https://www.riotgames.com/en/news/trip-down-lol-graphics-pipeline)、[Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon)、[公式キー設定ガイド](https://support.riotgames.com/en-us/league-of-legends/performance/hotkeys-keybindings-faq)。

非公式ファン制作。Riot Games非公認。


