---
title: flutter中ios点击顶部栏“滚动到顶部”的实现和问题
date: 2020-09-13 23:58:07
tags:
---
ios中一个常见的交互是：点击顶部栏时，自动将当前的滚动区滚到顶部。在flutter中，大部分时候这件事是“自然完成”的，但是也有时候会遇到这个行为失效的情况。要解决这个问题首先自然是要看这个feature是如何实现的。
其实大部分都是Scaffold里面干的事：
Scaffold里有这样一段代码:
```
    switch (themeData.platform) {
      case TargetPlatform.iOS:
        _addIfNonNull(
          children,
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: _handleStatusBarTap,
            // iOS accessibility automatically adds scroll-to-top to the clock in the status bar
            excludeFromSemantics: true,
          ),
          _ScaffoldSlot.statusBar,
          removeLeftPadding: false,
          removeTopPadding: true,
          removeRightPadding: false,
          removeBottomPadding: true,
        );
        break;
      case TargetPlatform.android:
      case TargetPlatform.fuchsia:
        break;
    }
```
这里命名很舒服，可以直接看出来在干什么：如果是ios的话，那就给Scaffold加一个在状态栏上的点击区，点击的话就会触发一个函数，这个函数干的事情如下：
```
  final ScrollController _primaryScrollController = ScrollController();

  void _handleStatusBarTap() {
    if (_primaryScrollController.hasClients) {
      _primaryScrollController.animateTo(
        0.0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.linear, // TODO(ianh): Use a more appropriate curve.
      );
    }
  }
```
也就是，Scaffold会提供一个默认的ScrollController，而点击顶部栏会使得这个controller滚到顶部，在ScrollView的build函数中则会取这个controller:
```
  @override
  Widget build(BuildContext context) {
    final List<Widget> slivers = buildSlivers(context);
    final AxisDirection axisDirection = getDirection(context);

    // 注意，此处的primary不是传入的primary，
    // primary = primary ?? controller == null && identical(scrollDirection, Axis.vertical)
    final ScrollController scrollController = primary
      ? PrimaryScrollController.of(context)
      : controller;
    final Scrollable scrollable = Scrollable(
      dragStartBehavior: dragStartBehavior,
      axisDirection: axisDirection,
      controller: scrollController,
      physics: physics,
      semanticChildCount: semanticChildCount,
      viewportBuilder: (BuildContext context, ViewportOffset offset) {
        return buildViewport(context, offset, axisDirection, slivers);
      },
    );
    return primary && scrollController != null
      ? PrimaryScrollController.none(child: scrollable)
      : scrollable;
  }
```
如果指定controller的话，就不会使用PrimaryScrollview，如果不指定的话，则在primary为true时使用PrimaryController，而默认情况下controller为null，primary为true，因此一个裸体的ListView是会相应屏幕点击的。
知道了原理，就很容易分析自己代码里出的问题是什么，常见的可能就是：
1、没加Scaffold，这个其实并不常见（自相矛盾草），不过可以检查一下，一般总是会有Scaffold的
2、真正常见的：指定了controller，如果自己创建了一个Controller丢给ScrollView，那必然是会失效的。但是使用controller又是一个很常见且重要的需求，怎么办呢？也很简单，就是不要自己创建新的ScrollController，而是直接取PrimaryScrollController.of(context)这个controller，对其进行自己要做的操作。
3、相对不太常见且需要分析具体代码的：多个Scaffold导致的冲突。
注意到其实flutter里的这个点击状态栏并不是真的点击了状态栏，而是点击了“Scaffold提供的位于状态栏的可点击区域”，也就是说，如果有多个Scaffold就会有多个这样的区域。实际情况是，只有最内部的Scaffold的状态栏会有响应，而如果ScrollView所处位置取到的和点击的Scaffold不一致，自然也就不会有滚动到顶部的feature