---
title: flutter json_serializable报错
date: 2020-09-07 00:16:34
tags:
---
最近json_serializable突然没法工作，准确地说是build_runner指令突然报错。显示Error: Method not found: 'SummaryBuilder'。大致看了一下是版本问题，但是近期项目并没有做过什么更新，就感觉有些奇怪。查了一下，发现有人提到过类似的问题
https://github.com/dart-lang/build/issues/2712
大概意思就是，某个版本的analyzer更新之后，就会报这个错误。然而analyzer根本没在pubspec.yaml里用到……最后调研了一下发现实际上算是一个analyzer的版本号问题。json_serilizable中用"\^"符号引用了0.39.x的analyzer，也就是默认匹配x最大的小版本。但是analyzer作出这个api更新的时候版本号继续沿用了0.39，于是导致所有用了^的库一夜之间就不能跑了（草）。
解决方法很简单，直接在pubspec.yaml中指定确切版本就可以了(这个问题最早出现在0.39.9，锁0.39.8就行)。
```
dev_dependencies:
  anaylyzer: 0.39.8
```
顺带一提，0.39更新到了0.39.17，现在analyzer已经0.40了，最后0.39版本还是没有修正这个问题，感觉完全就是版本号使用不规范……