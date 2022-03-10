---
title: flutter滚动简探：当你滚动ListView的时候flutter做了什么(1)
date: 2020-07-24 18:54:20
tags:
---
引：之前项目遇到一个需求，需要两个嵌套的TabBarView在内部滑动到底之后可以滑外部，抄了点代码然后修修补补姑且算是完成了，有的地方也只是看着函数和类的命名半猜着改的，也不知道具体是哪里调了这个函数，总之挺不满意的。所以就想着去看一下flutter内部滚动的实现，结果一看发现滚动相关的东西是真的非常庞大……不过好消息是，比较庞杂的部分，大概率开发者也不会去接触，剩下的一些，倒是可以一看，有所用处的。

```
class ListView extends BoxScrollView {
  // 省略一万个构造函数
  @override
  Widget buildChildLayout(BuildContext context) {
    if (itemExtent != null) {
      return SliverFixedExtentList(
        delegate: childrenDelegate,
        itemExtent: itemExtent,
      );
    }
    return SliverList(delegate: childrenDelegate);
  }

  @override
  void debugFillProperties(DiagnosticPropertiesBuilder properties) {
    super.debugFillProperties(properties);
    properties.add(DoubleProperty('itemExtent', itemExtent, defaultValue: null));
  // ...
 }
```

ListView里唯一做了override的函数是buildChildLayout，康康哪里用了这个函数

```
abstract class BoxScrollView extends ScrollView {
  // ...
 @override
  List<Widget> buildSlivers(BuildContext context) {
    Widget sliver = buildChildLayout(context);
    // ...
  }
  // ...
}
```

只有这一个地方，直接看buildSlivers，发现在ScrollView里面，ScrollView是一个普通的StateLessWidget，buildSlivers用在了build函数里

```
abstract class ScrollView extends StatelessWidget {
  // 这里是传入 buildViewport 的 Widget
  @protected
  Widget buildViewport(
    BuildContext context,
    ViewportOffset offset,
    AxisDirection axisDirection,
    List<Widget> slivers,
  ) {
    if (shrinkWrap) {
      return ShrinkWrappingViewport(
        axisDirection: axisDirection,
        offset: offset,
        slivers: slivers,
      );
    }
    return Viewport(
      axisDirection: axisDirection,
      offset: offset,
      slivers: slivers,
      cacheExtent: cacheExtent,
      center: center,
      anchor: anchor,
    );
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> slivers = buildSlivers(context);
    final AxisDirection axisDirection = getDirection(context);

    final ScrollController scrollController =
        primary ? PrimaryScrollController.of(context) : controller;
    final Scrollable scrollable = Scrollable(
      dragStartBehavior: dragStartBehavior,
      axisDirection: axisDirection,
      controller: scrollController,
      physics: physics,
      semanticChildCount: semanticChildCount,
      // viewportBuilder 在内层直接通过 widget.viewportBuilder(context, position) 作为child传入了
      viewportBuilder: (BuildContext context, ViewportOffset offset) {
        // 这里调了通过 buildSlivers 得到的 slivers
        return buildViewport(context, offset, axisDirection, slivers);
      },
    );
    // ...
  }
  // ...
}
```

在ScrollView这一层可以看到，最终build出的内容是一个Viewport 或者 ShrinkWrappingViewport，两者都是一个 MultiChildRenderObjectWidget，内部的布局逻辑大部分也是比较类似的。同时我们发现，平时常用的 'slivers' 就是用在了ViewPort里面。关于 ViewPort 内部具体做了什么可以参考这篇文章：
[https://segmentfault.com/a/1190000015086603](https://segmentfault.com/a/1190000015086603)

简单概括来说，Sliver类似一个允许用户选择“哪一部分可以被看到”的Flex组件，显然，这个特性可以用来做滚动页面。同时可以发现flutter的滚动区也是一个一个renderBox画出来的，让人有一种自己可以控制flutter所有行为的错觉（？）。

滚动布局方面的东西，实际上都由Viewport处理了，剩下的无非就是两件事：获取用户的手势和处理手势与布局之间的关系。继续读代码，可以发现手势部分也是被封成了一块稳定且基本不需要改动的模块。从ScrollView中可以发现viewportBuilder是在Scrollable里调的，而Scrollable内部则是这样：
```
  @override
  Widget build(BuildContext context) {
    Widget result = _ScrollableScope(
      scrollable: this,
      position: position,
      // TODO(ianh): Having all these global keys is sad.
      child: Listener(
        onPointerSignal: _receivedPointerSignal,
        child: RawGestureDetector(
          key: _gestureDetectorKey,
          gestures: _gestureRecognizers,
          behavior: HitTestBehavior.opaque,
          excludeFromSemantics: widget.excludeFromSemantics,
          child: Semantics(
            explicitChildNodes: !widget.excludeFromSemantics,
            child: IgnorePointer(
              key: _ignorePointerKey,
              ignoring: _shouldIgnorePointer,
              ignoringSemantics: false,
              child: widget.viewportBuilder(context, position),
            ),
          ),
        ),
      ),
    );
```
Listener组件看起来很陌生，但是常用的GestureDetector组件其实就是Listener的简单包装，Listener组件内部对手势做了很详尽的处理，不太需要修改，（并且由于我不是很想读这一块），所以这里就不多关心。实际上我们更多关心的还是：手势如何对Viewport的布局造成影响。于是我们先回到Viewport
```
  @override
  RenderViewport createRenderObject(BuildContext context) {
    return RenderViewport(
      axisDirection: axisDirection,
      crossAxisDirection: crossAxisDirection ?? Viewport.getDefaultCrossAxisDirection(context, axisDirection),
      anchor: anchor,
      offset: offset,
      cacheExtent: cacheExtent,
      cacheExtentStyle: cacheExtentStyle,
    );
  }
```
Viewport的createRenderObject如图，可以看到这里能影响显示区域的只有一个offset，offset是一个叫ViewportOffset的玩意，而继续读代码可以发现，有时候会见到的ScrollPosition就是ViewportOffset的子类（察觉）。

在ScrollPosition看它改写了哪些方法，很容易发现最关键的地方：
```
@override
double get pixels => _pixels;
double _pixels;
```
其余的改写都是一些最大滚动区，jumpTo之类的方法，并不是特别关键。所以要知道手势何时影响了Viewport，最重要就是要知道手势如何影响ScrollPosition中的pixels。

可以在Scrollable中看到，Listener给出的事件是在_gestureRecognizers中监听的，而_gestureRecognizers是在setCanDrag方法中注册的
```
          _gestureRecognizers = <Type, GestureRecognizerFactory>{
            VerticalDragGestureRecognizer: GestureRecognizerFactoryWithHandlers<VerticalDragGestureRecognizer>(
              () => VerticalDragGestureRecognizer(),
              (VerticalDragGestureRecognizer instance) {
                instance
                  ..onDown = _handleDragDown
                  ..onStart = _handleDragStart
                  ..onUpdate = _handleDragUpdate
                  ..onEnd = _handleDragEnd
                  ..onCancel = _handleDragCancel
                  ..minFlingDistance = _physics?.minFlingDistance
                  ..minFlingVelocity = _physics?.minFlingVelocity
                  ..maxFlingVelocity = _physics?.maxFlingVelocity
                  ..dragStartBehavior = widget.dragStartBehavior;
              },
            ),
          };
```
寻找setCanDrag方法，发现追根溯源一大串，最终是在Viewport的layout函数里面间接调用了。好，喜大普奔，不是我们需要关心的事情了。来关心一下几个handleDrag：

```
  void _handleDragDown(DragDownDetails details) {
    assert(_drag == null);
    assert(_hold == null);
    _hold = position.hold(_disposeHold);
  }

  void _handleDragUpdate(DragUpdateDetails details) {
    // _drag might be null if the drag activity ended and called _disposeDrag.
    assert(_hold == null || _drag == null);
    _drag?.update(details);
  }

  void _handleDragEnd(DragEndDetails details) {
    // _drag might be null if the drag activity ended and called _disposeDrag.
    assert(_hold == null || _drag == null);
    _drag?.end(details);
    assert(_drag == null);
  }

  void _handleDragCancel() {
    // _hold might be null if the drag started.
    // _drag might be null if the drag activity ended and called _disposeDrag.
    assert(_hold == null || _drag == null);
    _hold?.cancel();
    _drag?.cancel();
    assert(_hold == null);
    assert(_drag == null);
  }
```

于是我们发现，实际上就是ScrollPosition在中间协调手势和viewPort位置的关系。回到文章开头的问题，要自己控制滚动行为，实际上就是需要有一个满足需求的ScrollPosition来处理Drag和Hold方法。

当然，之后还会有Physics给出的goBallistic等方法来处理用户手势结束后的滚动动作，这些就在之后的文章再谈吧。