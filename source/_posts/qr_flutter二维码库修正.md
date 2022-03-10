---
title: qr_flutter二维码库修正
date: 2020-08-19 17:30:42
tags:
---
app里加二维码是一个很常见的需求，flutter自然也会面临这个需求。dart/flutter相关的二维码第三方库现在能找到的大概是这两个：
qr [https://pub.dev/packages/qr](https://pub.dev/packages/qr)
qr_flutter [https://pub.dev/packages/qr_flutter](https://pub.dev/packages/qr_flutter)
第一个是qr的dart库，和ui无关，第二个则是用第一个库进行渲染的一个二维码库。
一开始刚用的时候没发现这个库有什么问题，后来ui开始抠细节的时候发现一个很奇怪的事情：
![](/images/24121227-dcab0de21f569441.png)
定了不同尺寸的二维码居然看起来一样大（呆滞），代码如下
```
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      home: Scaffold(
        appBar: AppBar(),
        body: Row(
          children: <Widget>[
            Expanded(child: QrImage(
              data: 'datadatadatadatadatadatadatadatadata',
              padding: EdgeInsets.zero,
            )),
            Expanded(child: QrImage(
              data: 'datadatadatadatadatadatadatadatadata',
              padding: EdgeInsets.all(5),
            )),
            Expanded(child: QrImage(
              data: 'datadatadatadatadatadatadatadatadata',
              padding: EdgeInsets.all(10),
            )),
            Expanded(child: QrImage(
              data: 'datadatadatadatadatadatadatadatadata',
              padding: EdgeInsets.all(15),
            )),
          ],
        ),
      ),
    );
  }
}
```
一开始以为是QrImage里的padding处理有问题，结果发现外加padding或者直接调整尺寸也是一样。并且发现出现了二维码溢出边界的情况，于是发现事情不对；打开Debug Painting之后发现了问题：
![](/images/24121227-0511c5853afd6bca.png)
![](/images/24121227-d7cba0a3c75bd5e4.png)
外部施加的约束大小看起来并没有问题，但是二维码的实际大小并没有随着约束改变，这就给我看傻了。下面就是传统艺能看源码了：
```
  Widget _qrWidget(BuildContext context, ui.Image image, double edgeLength) {
    final painter = QrPainter.withQr(
      qr: _qr,
      color: widget.foregroundColor,
      gapless: widget.gapless,
      embeddedImageStyle: widget.embeddedImageStyle,
      embeddedImage: image,
      eyeStyle: widget.eyeStyle,
      dataModuleStyle: widget.dataModuleStyle,
    );
    return _QrContentView(
      edgeLength: edgeLength,
      backgroundColor: widget.backgroundColor,
      padding: widget.padding,
      semanticsLabel: widget.semanticsLabel,
      child: CustomPaint(painter: painter),
    );
  }
```
看起来是这个QrPainter的问题，实际上最后发现也确实是。QrPainter在这里主要干的是这样一件事：把二维码点阵的每一个小方块画出来，然后把所有小方块垒起来。这个逻辑没问题，但是细节上出了个小差错：
```
class _PaintMetrics {
  _PaintMetrics(
      {@required this.containerSize,
      @required this.gapSize,
      @required this.moduleCount}) {
    _calculateMetrics();
  }

  final int moduleCount;
  final double containerSize;
  final double gapSize;

  double _pixelSize;
  double get pixelSize => _pixelSize;

  double _innerContentSize;
  double get innerContentSize => _innerContentSize;

  double _inset;
  double get inset => _inset;

  void _calculateMetrics() {
    final gapTotal = (moduleCount - 1) * gapSize;
    var pixelSize = (containerSize - gapTotal) / moduleCount;
    _pixelSize = (pixelSize * 2).roundToDouble() / 2;
    _innerContentSize = (_pixelSize * moduleCount) + gapTotal;
    _inset = (containerSize - _innerContentSize) / 2;
  }
}
```
这一段是绘制单个小方块的代码，里面的pixelSize是单个小方块的尺寸，发现这里对单个小方块的尺寸做了圆整roundToDouble。不是很清楚为什么要加这个处理，但是这个圆整导致了尺寸上的问题。由于每个小方块的尺寸被限制为整数，整个二维码的尺寸就被限制为边长小方块的数量的整倍数的px数。也就是说二维码尺寸犟着不变就是因为这个原因。解决方法也很简单把圆整逻辑去掉就行了。

我在github提了issue[https://github.com/lukef/qr.flutter/issues/104](https://github.com/lukef/qr.flutter/issues/104)
比较僵硬的是这个作者基本不更新了……issue也一直没人管，所以就只能自己fork了一下，希望早日能继续更新吧。