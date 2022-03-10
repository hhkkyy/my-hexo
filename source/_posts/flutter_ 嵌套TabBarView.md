---
title: flutter: 嵌套TabBarView
date: 2020-08-14 17:55:18
tags:
---
前几期聊了半天的滚动机制和NestedScrollView的实现，这次把初始的需求搞定一下
首先第一件事……拷代码（
先是TabBarView，整个文件，抄了
```
class NestedTabBarView extends StatefulWidget {
  // ...
}

class _NestedTabBarViewState extends State<NestedTabBarView> {
  // ...

  @override
  Widget build(BuildContext context) {
    return NotificationListener<ScrollNotification>(
      onNotification: _handleScrollNotification,
      // 把PageView和PageController名字都改了，前面加个Nested
      child: NestedPageView(
        dragStartBehavior: widget.dragStartBehavior,
        controller: _pageController,
        physics: widget.physics == null ? _kTabBarViewPhysics : _kTabBarViewPhysics.applyTo(widget.physics),
        children: _childrenWithKey,
      ),
    );
  }
}
```
非私有也不改动的类（比如metrics和physics）直接删掉

然后拷PageView代码，也是非私有也不改动的类去掉

然后看到有个_PagePosition
```
class _PagePosition extends ScrollPositionWithSingleContext implements PageMetrics {
  // ...
}
```
我们的Position需要重写drag，applyUserOffset等函数，所以需要implement一个ScrollActivity，也不能从ScrollPositionWithSingleContext开始拓展
于是就把ScrollPositionWithSingleContext里的函数也拿出来缝合一下（代码很多不具体放了）
```
class NestedPagePosition extends ScrollPosition
    implements PageMetrics, ScrollActivityDelegate {
  // ... 这里现在都是缝合的代码
}
```

于是我们基本完成了准备工作，现在还没开始写联动相关的东西。
和NestedScrollView对比可以发现一个明显的问题，NestedScrollView是用一个组件同时控制了内外的滚动，这里的TabBarView还是希望能减少一点外层重新包装的工作量，所以我们使用了InheritedWidget来处理：
```
class NestedPageControllerProvider extends InheritedWidget {
  const NestedPageControllerProvider({
    Key key,
    @required this.controller,
    @required Widget child,
  }) : assert(controller != null),
       super(key: key, child: child);

  const NestedPageControllerProvider.none({
    Key key,
    @required Widget child,
  }) : controller = null,
       super(key: key, child: child);

  final ScrollController controller;
  static ScrollController of(BuildContext context) {
    final NestedPageControllerProvider result = context.dependOnInheritedWidgetOfExactType<NestedPageControllerProvider>();
    return result?.controller;
  }

  @override
  bool updateShouldNotify(NestedPageControllerProvider oldWidget) => controller != oldWidget.controller;

  @override
  void debugFillProperties(DiagnosticPropertiesBuilder properties) {
    super.debugFillProperties(properties);
    properties.add(DiagnosticsProperty<ScrollController>('controller', controller, ifNull: 'no controller', showName: false));
  }
}
```
（其实就是抄的PrimaryScrollController）

于是build函数里就多了一个PrimaryScrollController
```
  @override
  Widget build(BuildContext context) {
    final AxisDirection axisDirection = _getDirection(context);
    final ScrollPhysics physics = widget.pageSnapping
        ? _kPagePhysics.applyTo(widget.physics)
        : widget.physics;

    return NotificationListener<ScrollNotification>(
      onNotification: (ScrollNotification notification) {
        if (notification.depth == 0 &&
            widget.onPageChanged != null &&
            notification is ScrollUpdateNotification) {
          final PageMetrics metrics = notification.metrics;
          final int currentPage = metrics.page.round();
          if (currentPage != _lastReportedPage) {
            _lastReportedPage = currentPage;
            widget.onPageChanged(currentPage);
          }
        }
        return false;
      },
      // 包在了这一层
      child: NestedPageControllerProvider(
        controller: widget.controller,
        child: Scrollable(
          dragStartBehavior: widget.dragStartBehavior,
          axisDirection: axisDirection,
          controller: widget.controller,
          physics: physics,
          viewportBuilder: (BuildContext context, ViewportOffset position) {
            return Viewport(
              cacheExtent: 0.0,
              cacheExtentStyle: CacheExtentStyle.viewport,
              axisDirection: axisDirection,
              offset: position,
              slivers: <Widget>[
                SliverFillViewport(
                      viewportFraction: widget.controller.viewportFraction,
                      delegate: widget.childrenDelegate,
                    )
              ],
            );
          },
        ),
      ),
    );
  }
```

加入灵魂：coordinator（其实本来不想加的，但是出了一些问题，见下）
和NestedScrollView一样，coordinator是一个ScrollActivityDelegate并且会在需要协调的时候把drag方法传给Position
```
class NestedPageCoordinator
    implements ScrollActivityDelegate, ScrollHoldController {
  // _outerController 可能没有
  NestedPageController _outerController;
  NestedPageController _selfController;

  ScrollDragController _currentDrag;

  NestedPageCoordinator(NestedPageController selfController,
      NestedPageController parentController) {
    // 比较粗暴的方法，不过可以用。这里没有考虑比较复杂的生命周期，最好应该是写成一个函数并且在一些生命周期里运行的
    _selfController = selfController;
    _selfController?.coordinator = this;

    _outerController = parentController;
    _outerController?.coordinator = this;
  }

  NestedPageController getOuterController() {
    return _outerController;
  }

  bool isOuterControllerEnable() {
    return _outerController != null && _outerController.hasClients;
  }

  NestedPageController getInnerController() {
    return _selfController;
  }

  bool isInnerControllerEnable() {
    return _selfController != null && _selfController.hasClients;
  }

  // 做了一些简单的处理：
  // 当滑动超出内部滚动区域极限时，就去外部滚动
  // 特别地：当外部滚动区正在滚动（不在某个page的位置）时，只允许滚动外部
  @override
  void applyUserOffset(double delta) {
    updateUserScrollDirection(
        delta > 0.0 ? ScrollDirection.forward : ScrollDirection.reverse);

    NestedPagePosition innerPosition =
        (getInnerController().position as NestedPagePosition);
    NestedPagePosition outPosition = isOuterControllerEnable()
        ? (getOuterController().position as NestedPagePosition)
        : null;

    if (
        (delta < 0
            ? innerPosition.pixels < innerPosition.maxScrollExtent
            : innerPosition.pixels > innerPosition.minScrollExtent)
            && outPosition?.isAtPage == true) {
      innerPosition.applyUserOffset(delta);
    } else {
      outPosition.applyUserOffset(delta);
    }
  }

  @override
  AxisDirection get axisDirection => _outerController.position.axisDirection;

  @override
  void cancel() {
    goBallistic(0.0);
  }

  // 和applyUserOffset思路类似，不过这里不需要处理“外部滚动区域滑到一半”的情况
  @override
  void goBallistic(double velocity) {
    NestedPagePosition innerPosition =
        (getInnerController().position as NestedPagePosition);
    NestedPagePosition outPosition = isOuterControllerEnable()
        ? (getOuterController().position as NestedPagePosition)
        : null;

      if (innerPosition.pixels < innerPosition.maxScrollExtent &&
          innerPosition.pixels > innerPosition.minScrollExtent) {
        innerPosition.goBallistic(velocity);
        outPosition?.goIdle();
      } else {
        outPosition?.goBallistic(velocity);
        innerPosition.goIdle();
      }

    _currentDrag?.dispose();
    _currentDrag = null;
  }

  @override
  void goIdle() {
    beginActivity(IdleScrollActivity(this), IdleScrollActivity(this));
  }

  @override
  double setPixels(double pixels) {
    return 0.0;
  }

  ScrollHoldController hold(VoidCallback holdCancelCallback) {
    beginActivity(
        HoldScrollActivity(delegate: this, onHoldCanceled: holdCancelCallback),
        HoldScrollActivity(delegate: this, onHoldCanceled: holdCancelCallback));

    return this;
  }

  // coordinator的drag函数不需要特殊处理
  Drag drag(DragStartDetails details, VoidCallback dragCancelCallback) {
    final ScrollDragController drag = ScrollDragController(
      delegate: this,
      details: details,
      onDragCanceled: dragCancelCallback,
    );

    beginActivity(
        DragScrollActivity(this, drag), DragScrollActivity(this, drag));

    assert(_currentDrag == null);
    _currentDrag = drag;
    return drag;
  }

  // beginActivity会同时处理内外的activity
  void beginActivity(
      ScrollActivity newOuterActivity, ScrollActivity newInnerActivity) {
    getInnerController().position.beginActivity(newInnerActivity);
    if (isOuterControllerEnable()) {
      getOuterController().position.beginActivity(newOuterActivity);
    }

    _currentDrag?.dispose();
    _currentDrag = null;

    if (!newOuterActivity.isScrolling) {
      updateUserScrollDirection(ScrollDirection.idle);
    }
  }

  ScrollDirection get userScrollDirection => _userScrollDirection;
  ScrollDirection _userScrollDirection = ScrollDirection.idle;

  void updateUserScrollDirection(ScrollDirection value) {
    assert(value != null);
    if (userScrollDirection == value) return;
    _userScrollDirection = value;
    getOuterController().position.didUpdateScrollDirection(value);
    if (isOuterControllerEnable()) {
      getInnerController().position.didUpdateScrollDirection(value);
    }
  }
}
```

可以看到coordinator处理了具体的内外联动。这里需要注意一件事情：一个coordinator内部按理是会有多个innerPosition的，但是这里只有一个，实际上是依赖了生命周期中，每当一级tab滑动到位时，二级tab会重新创建scrollPosition，然后在此时给coordinator的innerController赋值，也就是innerController始终是“当前活跃”的controller

ScrollPosition的主要改写如下：
```
class NestedPagePosition extends ScrollPosition
    implements PageMetrics, ScrollActivityDelegate {
  // ...
  
  // 只有在“有可能导致外部滚动”的时候会使用coordinator.drag，不然就作标准处理
  // 这里本来是不想引入coordinator的，因为只有子TabBarView会影响外部的，反过来并不会
  // 所以原先是希望，每个position关联一个外部的position，然后直接在positiond的drag和applyUserOffset里进行联动的
  // 这样的好处之一是可以进行多层的嵌套，而当前的设计只能有两层
  // 但是在内外联动，导致外部滑动时，发现drag事件被强行终止，activity变为idleActivity
  // 之后导致出现一些奇怪的问题
  // 具体原因还不是很明白，但是暴露了对滚动流程还是有不了解的细节
  // （甚至不知道为什么引入了coordinator就好了）
  @override
  Drag drag(DragStartDetails details, VoidCallback dragCancelCallback) {
    final innerPosition = coordinator?.getOuterController()?.position;

    if (coordinator != null &&
      coordinator.isInnerControllerEnable() &&
      coordinator.isOuterControllerEnable() &&
      innerPosition is NestedPagePosition &&
      innerPosition.isAtPage) {
      return coordinator.drag(details, dragCancelCallback);
    } else {
      final ScrollDragController drag = ScrollDragController(
        delegate: this,
        details: details,
        onDragCanceled: dragCancelCallback,
        carriedVelocity: physics.carriedMomentum(_heldPreviousVelocity),
        motionStartDistanceThreshold: physics.dragStartDistanceMotionThreshold,
      );
      beginActivity(DragScrollActivity(this, drag));
      assert(_currentDrag == null);
      _currentDrag = drag;
      return drag;
    }
  }
}
```

使用时直接把两个NestedTabBarView嵌套即可