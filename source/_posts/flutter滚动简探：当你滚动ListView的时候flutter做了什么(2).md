---
title: flutter滚动简探：当你滚动ListView的时候flutter做了什么(2)
date: 2020-08-05 14:13:19
tags:
---
之前提到，滚动行为是由ScrollPosition中的Drag控制的，但是ScrollPosition本身并不提供具体的实现。在ListView（和大部分其他滚动组件中），使用的是一个类似于默认ScrollPositon的ScrollPositionWithSingleContext。ScrollPositionWithSingleContext的很多代码可以视为一种“标准”，可以根据它的实现来决定自己写ScrollPositon的时候怎么处理。
```
  // applyNewDimensions会在Viewport的performLayout函数中被调用
  // 也就是之前所说的，生成drag对象的setCanDrag会在Viewport每次layout的时候进行调用
  @override
  void applyNewDimensions() {
    super.applyNewDimensions();
    context.setCanDrag(physics.shouldAcceptUserOffset(this));
  }

  // 比较重要的函数
  // 会决定在“用户手指拖动屏幕时”Viewport的offset如何根据手势变化
  // 这里是交给了ScrollPhysics处理，调用setPixels去具体改变Viewport位置
  @override
  void applyUserOffset(double delta) {
    updateUserScrollDirection(delta > 0.0 ? ScrollDirection.forward : ScrollDirection.reverse);
    setPixels(pixels - physics.applyPhysicsToUserOffset(this, delta));
  }

  // goBallistic，在用户拖动结束之后被调用的函数
  // 同样由physics给出，默认的ListView里是一个类似惯性的动作，当然实际上可以很自由地去设计
  @override
  void goBallistic(double velocity) {
    assert(pixels != null);
    final Simulation simulation = physics.createBallisticSimulation(this, velocity);
    if (simulation != null) {
      beginActivity(BallisticScrollActivity(this, simulation, context.vsync));
    } else {
      goIdle();
    }
  }

  // beginActivity 间接处理了drag和hold的一些动作，比如hold和drag的dispose
  // beginActivity 的一个重要作用是丢出滚动的开始，更新，结束事件
  // （可是为什么要用Activity来处理滚动动作呢
  // 基本不需要修改，抄就行
  @override
  void beginActivity(ScrollActivity newActivity) {
    _heldPreviousVelocity = 0.0;
    if (newActivity == null)
      return;
    assert(newActivity.delegate == this);
    super.beginActivity(newActivity);
    _currentDrag?.dispose();
    _currentDrag = null;
    if (!activity.isScrolling)
      updateUserScrollDirection(ScrollDirection.idle);
  }

  // 会在scrollable中在触摸开始时被调用
  @override
  ScrollHoldController hold(VoidCallback holdCancelCallback) {
    final double previousVelocity = activity.velocity;
    final HoldScrollActivity holdActivity = HoldScrollActivity(
      delegate: this,
      onHoldCanceled: holdCancelCallback,
    );
    beginActivity(holdActivity);
    _heldPreviousVelocity = previousVelocity;
    return holdActivity;
  }

  // 会在scrollable中在手势刚开始移动时被调用
  @override
  Drag drag(DragStartDetails details, VoidCallback dragCancelCallback) {
 
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
    // drag对象会在Scollable中开始、进行、结束触摸移动的时候被用到
    // ScrollDragController 中传入了 ScrollActivity 也就是这里的ScrollPositionWithSingleContext，用这种方式可以间接调用到ScrollPositon（重要）
    // 比如之前提到的applyUserOffset就是在这里间接调用的
    return drag;
  }

```

可以看到有一部分东西是交由Physics完成的。注意其实这里可以不用Physics来写一些东西，如果确定某个滚动widget只有一种“physics”表现的话可以自己处理。但是用Physics的话可以更灵活地控制组件的滚动行为，总之看具体需求选择。

ScrollDragController 中，end 函数中会调用 delegate.goBallistic(velocity)

```
  @override
  void end(DragEndDetails details) {
    assert(details.primaryVelocity != null);
    // We negate the velocity here because if the touch is moving downwards,
    // the scroll has to move upwards. It's the same reason that update()
    // above negates the delta before applying it to the scroll offset.
    double velocity = -details.primaryVelocity;
    if (_reversed) // e.g. an AxisDirection.up scrollable
      velocity = -velocity;
    _lastDetails = details;

    // Build momentum only if dragging in the same direction.
    if (_retainMomentum && velocity.sign == carriedVelocity.sign)
      velocity += carriedVelocity;
    delegate.goBallistic(velocity);
  }
```
drag.end可以看到在Scrollable中滚动结束时调用了。goBallistic就是滚动结束之后的惯性滚动。
goBallistic里的东西比较迷惑，是在BallisticScrollActivity里的
```
    // 构造函数里会注册一个逐帧的动画事件
    _controller = AnimationController.unbounded(
      debugLabel: kDebugMode ? objectRuntimeType(this, 'BallisticScrollActivity') : null,
      vsync: vsync,
    )
      ..addListener(_tick)
      ..animateWith(simulation)
       .whenComplete(_end); 

  // _tick调用applyMoveTo，applyMoveTo又回头去调用ScrollPositionWithSingleContext的setPixels（……
  // _tick如果发现惯性滚动结束了，就会让ScrollPositionWithSingleContext回归idle状态
  void _tick() {
    if (!applyMoveTo(_controller.value))
      delegate.goIdle();
  }

  @protected
  bool applyMoveTo(double value) {
    return delegate.setPixels(value) == 0.0;
  }

```
_tick和applyMoveTo做了什么其实我们不太关心，因为ballistic的动作由simulation具体决定。发现simulation是由physics创建的，那么随便找一个physics看看它的simulation
```
class BouncingScrollSimulation extends Simulation {
  BouncingScrollSimulation({
    @required double position,
    @required double velocity,
    @required this.leadingExtent,
    @required this.trailingExtent,
    @required this.spring,
    Tolerance tolerance = Tolerance.defaultTolerance,
  }) : assert(position != null),
       assert(velocity != null),
       assert(leadingExtent != null),
       assert(trailingExtent != null),
       assert(leadingExtent <= trailingExtent),
       assert(spring != null),
       super(tolerance: tolerance) {
    if (position < leadingExtent) {
      _springSimulation = _underscrollSimulation(position, velocity);
      _springTime = double.negativeInfinity;
    } else if (position > trailingExtent) {
      _springSimulation = _overscrollSimulation(position, velocity);
      _springTime = double.negativeInfinity;
    } else {
      _frictionSimulation = FrictionSimulation(0.135, position, velocity);
      final double finalX = _frictionSimulation.finalX;
      if (velocity > 0.0 && finalX > trailingExtent) {
        _springTime = _frictionSimulation.timeAtX(trailingExtent);
        _springSimulation = _overscrollSimulation(
          trailingExtent,
          math.min(_frictionSimulation.dx(_springTime), maxSpringTransferVelocity),
        );
        assert(_springTime.isFinite);
      } else if (velocity < 0.0 && finalX < leadingExtent) {
        _springTime = _frictionSimulation.timeAtX(leadingExtent);
        _springSimulation = _underscrollSimulation(
          leadingExtent,
          math.min(_frictionSimulation.dx(_springTime), maxSpringTransferVelocity),
        );
        assert(_springTime.isFinite);
      } else {
        _springTime = double.infinity;
      }
    }
    assert(_springTime != null);
  }

  FrictionSimulation _frictionSimulation;
  Simulation _springSimulation;
  double _springTime;
  double _timeOffset = 0.0;

  Simulation _underscrollSimulation(double x, double dx) {
    return ScrollSpringSimulation(spring, x, leadingExtent, dx);
  }

  Simulation _overscrollSimulation(double x, double dx) {
    return ScrollSpringSimulation(spring, x, trailingExtent, dx);
  }

  Simulation _simulation(double time) {
    Simulation simulation;
    if (time > _springTime) {
      _timeOffset = _springTime.isFinite ? _springTime : 0.0;
      simulation = _springSimulation;
    } else {
      _timeOffset = 0.0;
      simulation = _frictionSimulation;
    }
    return simulation..tolerance = tolerance;
  }

  @override
  double x(double time) => _simulation(time).x(time - _timeOffset);

  @override
  double dx(double time) => _simulation(time).dx(time - _timeOffset);

  @override
  bool isDone(double time) => _simulation(time).isDone(time - _timeOffset);

  @override
  String toString() {
    return '${objectRuntimeType(this, 'BouncingScrollSimulation')}(leadingExtent: $leadingExtent, trailingExtent: $trailingExtent)';
  }
}
```

![Simulation看起来真的很麻烦](/images/24121227-4df5b16abf2847ae.png)

看起来simulation就是根据当前位置和速度以及整体的滚动空间等决定惯性动作的一个玩意，不过自己写的话似乎就很麻烦了，里面有很多奇怪的细节需要调整。

那么现在就比较清楚哪些东西是我们比较好改的了：
applyUserOffset: 可以决定拖动的时候如何改变滚动区域的位置，比如当拖动超出范围的时候让滚动速度比手势速度慢。当然实际上可能会在physics里处理具体动作

drag/hold：第一篇开头的时候提到的需求是：希望内外滚动区可以联动。于是这就很棒，drag函数可以帮我们处理手势滑动的时候应该调用谁的drag/hold

goBallistic：同上，可以决定应当移动内部和外部的哪个滚动区，不需要做惯性动作的就可以直接让他goIdle

下一期试着写写这个联动滚动吧。