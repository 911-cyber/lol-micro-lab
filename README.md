最新版：[ミッド1v1・二本先取と装備選択](MID-DUEL.md)

最新版：既存モードのミクロ分析と対面の発射後の隙を改善。[変更内容](MICRO-TRAINING.md)

# LoL Micro Lab

LoLが上手くなるための3Dミクロトレーナー。

最新の操作改善：[全10体の詠唱・移動・AAと頭上HPバー](CASTING-RULES.md)。停止するスキルと移動できる例外を分け、主要な対象／貫通ルールを修正しました。厳密なLoL本体との時間・数値一致は未検証です。

最新の演出改善：[アッシュ／エズリアルの攻撃と対面の動き](CHAMPION-POLISH.md)。攻撃の構え・発射・命中、効果音ON/OFF、対面の距離調整と構え中の停止を追加しました。

現在の実装は[Skills Training](SKILLS-TRAINING.md)を参照してください。10体のチャンピオン、QWER、ヒール／フラッシュ、対面スキル回避、専用の練習空間とプレイ分析コーチを実装しています。操作はQWERスキル、Dヒール、Fフラッシュ、H難易度、T再開始です。

以下は初期カメラ実装時の記録です。

## 現在地: Camera v0.3
今はゲーム機能を増やす前に、LoLのPoint & Clickカメラ感を合わせています。

### 実装済み
- Free / unlocked camera
- 画面端 Edge Scroll
- MMBドラッグでカメラ移動
- Space長押しで自キャラへセンター
- YでCamera Lock / Unlock
- Mouse Wheel Zoom
- 右クリック移動
- FOV / Pitch / Distance / Pan Speed / Edge Size をゲーム内で調整

### 次にやること
1. カメラ角度・距離・速度を実際の使用感に合わせる
2. 右クリック移動をLoL寄りにする
3. Attack Move / AA timing
4. Kiting
5. Spacing
6. Dodge
7. Last Hit
8. Combined training

開発中はWeb版で試し、完成時にはWindows向けダウンロード版も作る方針です。
