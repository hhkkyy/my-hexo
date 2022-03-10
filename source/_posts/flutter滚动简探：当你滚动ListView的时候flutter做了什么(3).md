---
title: flutter滚动简探：当你滚动ListView的时候flutter做了什么(3)
date: 2020-08-09 17:07:40
tags:
---
这次离个题，来看看一个别的滚动组件是怎么处理的：NestedScrollView

NestedScrollView是处理嵌套滚动用的，直接看代码
```

class _NestedScrollViewState extends State<NestedScrollView> {
  final SliverOverlapAbsorberHandle _absorberHandle = SliverOverlapAbsorberHandle();

  _NestedScrollCoordinator _coordinator;

  @override
  void initState() {
    super.initState();
    _coordinator = _NestedScrollCoordinator(this, widget.controller, _handleHasScrolledBodyChanged);
  }
  // ...
}
```
NestedScrollView是个StatefulWidget，而state内有这样一个东西叫coordinator，看看在干嘛

```
class _NestedScrollCoordinator implements ScrollActivityDelegate, ScrollHoldController {
  _NestedScrollCoordinator(this._state, this._parent, this._onHasScrolledBodyChanged) {
    final double initialScrollOffset = _parent?.initialScrollOffset ?? 0.0;
    _outerController = _NestedScrollController(this, initialScrollOffset: initialScrollOffset, debugLabel: 'outer');
    _innerController = _NestedScrollController(this, initialScrollOffset: 0.0, debugLabel: 'inner');
  }

  final _NestedScrollViewState _state;
  ScrollController _parent;
  final VoidCallback _onHasScrolledBodyChanged;

  _NestedScrollController _outerController;
  _NestedScrollController _innerController;
  // ...
}
```
这里创建了两个一内一外的controller，这两个都是直接在build函数里用到的
```
  @override
  Widget build(BuildContext context) {
    return _InheritedNestedScrollView(
      state: this,
      child: Builder(
        builder: (BuildContext context) {
          _lastHasScrolledBody = _coordinator.hasScrolledBody;
          return _NestedScrollViewCustomScrollView(
            dragStartBehavior: widget.dragStartBehavior,
            scrollDirection: widget.scrollDirection,
            reverse: widget.reverse,
            physics: widget.physics != null
                ? widget.physics.applyTo(const ClampingScrollPhysics())
                : const ClampingScrollPhysics(),
            controller: _coordinator._outerController,
            slivers: widget._buildSlivers(
              context,
              _coordinator._innerController,
              _lastHasScrolledBody,
            ),
            handle: _absorberHandle,
          );
        },
      ),
    );
  }
```
也就是说，两个scrollView的position由这两个controller创建， 那看看创建的Position是什么
```
  @override
  ScrollPosition createScrollPosition(
    ScrollPhysics physics,
    ScrollContext context,
    ScrollPosition oldPosition,
  ) {
    return _NestedScrollPosition(
      coordinator: coordinator,
      physics: physics,
      context: context,
      initialPixels: initialScrollOffset,
      oldPosition: oldPosition,
      debugLabel: debugLabel,
    );
  }
```
_NestedScrollPosition是被使用的position，这里重点看这个position的drag函数
```
  @override
  Drag drag(DragStartDetails details, VoidCallback dragCancelCallback) {
    return coordinator.drag(details, dragCancelCallback);
  }
```
很简单就一句话，但是要注意一件事，这里返回的drag是最终在scrollable里被使用的drag对象，也就是说，通过这种形式，nestedScrollview把内外滚动的drag都交给了coordinator处理
那我们回到coordinator，发现coordinator做的事也很简单：
```
  Drag drag(DragStartDetails details, VoidCallback dragCancelCallback) {
    final ScrollDragController drag = ScrollDragController(
      delegate: this,
      details: details,
      onDragCanceled: dragCancelCallback,
    );
    beginActivity(
      DragScrollActivity(_outerPosition, drag),
      (_NestedScrollPosition position) => DragScrollActivity(position, drag),
    );
    assert(_currentDrag == null);
    _currentDrag = drag;
    return drag;
  }

  @override
  void applyUserOffset(double delta) {
    updateUserScrollDirection(delta > 0.0 ? ScrollDirection.forward : ScrollDirection.reverse);
    assert(delta != 0.0);
    if (_innerPositions.isEmpty) {
      _outerPosition.applyFullDragUpdate(delta);
    } else if (delta < 0.0) {
      // dragging "up"
      // TODO(ianh): prioritize first getting rid of overscroll, and then the
      // outer view, so that the app bar will scroll out of the way asap.
      // Right now we ignore overscroll. This works fine on Android but looks
      // weird on iOS if you fling down then up. The problem is it's not at all
      // clear what this should do when you have multiple inner positions at
      // different levels of overscroll.
      final double innerDelta = _outerPosition.applyClampedDragUpdate(delta);
      if (innerDelta != 0.0) {
        for (_NestedScrollPosition position in _innerPositions)
          position.applyFullDragUpdate(innerDelta);
      }
    } else {
      // dragging "down" - delta is positive
      // prioritize the inner views, so that the inner content will move before the app bar grows
      double outerDelta = 0.0; // it will go positive if it changes
      final List<double> overscrolls = <double>[];
      final List<_NestedScrollPosition> innerPositions = _innerPositions.toList();
      for (_NestedScrollPosition position in innerPositions) {
        final double overscroll = position.applyClampedDragUpdate(delta);
        outerDelta = math.max(outerDelta, overscroll);
        overscrolls.add(overscroll);
      }
      if (outerDelta != 0.0)
        outerDelta -= _outerPosition.applyClampedDragUpdate(outerDelta);
      // now deal with any overscroll
      for (int i = 0; i < innerPositions.length; ++i) {
        final double remainingDelta = overscrolls[i] - outerDelta;
        if (remainingDelta > 0.0)
          innerPositions[i].applyFullDragUpdate(remainingDelta);
      }
    }
  }
```
drag函数同样是只要正常使用，而drag里间接调用的applyUserOffset，则进行了一些处理。决定了具体哪些条件下滚动内部还是外部scrollView。也就是说其实最核心的就是处理applyUserOffset（以及goBallistic）时内外滚动的分配。

PageView也和我们的需求相关，但是主要是由Physics处理了行为，就不细读了。