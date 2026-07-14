# Plan: SwiftFilter

現在、アプリケーションの除外処理をnode.js上で行っている
この処理をSwift上で事前に行うようにする。

これにより、stdio 間でやりとりするデータが大幅に減るためパフォーマンスが向上するほか、
ウィンドウタイトルなしの奇妙なウィンドウが発生しないようになる

setting.json を監視し、変更があったら除外ルールを更新するようにする

# Plan: icon option

icons.json の生成だけを行うオプションをswift helperに追加する

# Plan: invert option

除外ルールにマッチしたアプリケーションのリストを取得するオプションをswift helperに追加する
これは、除外ルールの適正検査に使うものである

# Plan: Mainの権限判定をもうちょっと優しくする

checkPermission で一度有効判定になったらその時点で繰り返しを止める
