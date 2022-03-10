---
title: flutter Widget改写：带ellipsis的Wrap组件
date: 2020-07-15 19:32:14
tags:
---
前段时间遇到一个UI上的需求，大致是这样的：

页面的一个区域需要显示一串tag，数量多则换行显示。默认情况下只显示一行，如果一行显示不下，就会有一个“更多”的选项，允许用户展开全部tag

![收起状态](/images/24121227-822c9a4380221adc.png)

![展开状态](/images/24121227-7b097d5677d8295b.png)

（差不多这个意思

这个需求实际上和文字的“超过一定行数就省略”很类似，但是文字的ellipsis功能大部分平台，包括flutter都是自带的，但是wrap的省略功能并不是，这里需要我们自己去实现。

整个需求大体上和Wrap的功能是一致的，就是增加了一个省略的需求，那就先直接copy Wrap的代码。

Wrap代码主要分两部分：Widget类Wrap和RenderBox类RenderWrap。实际上就是flutter“三棵树”里的第一和第三棵。顺带吐个槽，虽然说起来Element树是比RenderBox树要上一层的，但是实际上自己写Element的场合比写RenderBox的场合还少不少。

在RenderWrap的performLayout可以找到布局相关的函数。先看原装正版的布局函数：
```
    double mainAxisExtent = 0.0;
    double crossAxisExtent = 0.0;
    double runMainAxisExtent = 0.0;
    double runCrossAxisExtent = 0.0;
    int childCount = 0;
    while (child != null) {
      child.layout(childConstraints, parentUsesSize: true);
      final double childMainAxisExtent = _getMainAxisExtent(child);
      final double childCrossAxisExtent = _getCrossAxisExtent(child);
      if (childCount > 0 && runMainAxisExtent + spacing + childMainAxisExtent > mainAxisLimit) {
        mainAxisExtent = math.max(mainAxisExtent, runMainAxisExtent);
        crossAxisExtent += runCrossAxisExtent;
        if (runMetrics.isNotEmpty)
          crossAxisExtent += runSpacing;
        runMetrics.add(_RunMetrics(runMainAxisExtent, runCrossAxisExtent, childCount));
        runMainAxisExtent = 0.0;
        runCrossAxisExtent = 0.0;
        childCount = 0;
      }

      runMainAxisExtent += childMainAxisExtent;
      if (childCount > 0)
        runMainAxisExtent += spacing;

      runCrossAxisExtent = math.max(runCrossAxisExtent, childCrossAxisExtent);
      childCount += 1;

      final WrapParentData childParentData = child.parentData as WrapParentData;
      childParentData._runIndex = runMetrics.length;
      child = childParentData.nextSibling;
    }
```

这一部分主要做的事情是，遍历child，一一添加，然后根据每个child的尺寸，计算当前的行/列的所占尺寸extent，也就是runMainAxisExtent（当前行宽度）和 runCrossAxisExtent（当前行高度）。
```
// child.layout类似一个“画出child”的动作，调用这个函数后child会可见，并且可以获得其高度和宽度
child.layout(childConstraints, parentUsesSize: true);
final double childMainAxisExtent = _getMainAxisExtent(child);
final double childCrossAxisExtent = _getCrossAxisExtent(child);
// 主轴长度超出限制，换行
if (childCount > 0 && runMainAxisExtent + spacing + childMainAxisExtent > mainAxisLimit) {
        // mainAxisExtent 为整个Wrap的主轴最大长度，每当拓展当前的runCrossAxisExtent之后，就去检测是否需要更新mainAxisExtent
        mainAxisExtent = math.max(mainAxisExtent, runMainAxisExtent);
        // crossAxisExtent 同理
        crossAxisExtent += runCrossAxisExtent;
        // 如果不是第一行，换行的时候也要把行间距加入
        if (runMetrics.isNotEmpty)
          crossAxisExtent += runSpacing;
        // runMetrics是一个记录每个child对应位置的变量，在后面设置offset的时候会用到
        runMetrics.add(_RunMetrics(runMainAxisExtent, runCrossAxisExtent, childCount));
        // 换行后当前的extent置零，当前行的child数量置零
        runMainAxisExtent = 0.0;
        runCrossAxisExtent = 0.0;
        childCount = 0;
}
```

主要需要改动的就是这一部分代码，可以看到flutter内部对MultiChildRenderObjectWidget做layout的时候是自己一个个把子元素丢进去的，也得益于这一点我们可以控制这个行为（我真不知道web怎么做这个需求）。

为了减少需要修改的代码量，我们采用这样一个策略：如果发现一个child渲染后会超出高度限制，那么就将这个child渲染为Constraint(0,0)，这样大部分的代码都不需要更改，基本只需要更改上述部分即可。

首先WWrap类需要多接受一个参数ellipsisWidget，这里我们把它直接放在children里方便使用（应当会有更正确的使用方法）

```
class WWrap extends MultiChildRenderObjectWidget {
  WWrap({
    Key key,
    this.direction = Axis.horizontal,
    this.alignment = WrapAlignment.start,
    this.spacing = 0.0,
    this.runAlignment = WrapAlignment.start,
    this.runSpacing = 0.0,
    this.crossAxisAlignment = WrapCrossAlignment.start,
    this.textDirection,
    this.verticalDirection = VerticalDirection.down,
    this.ellipsisWidget,
    List<Widget> children = const <Widget>[],
  }) : super(
    key: key,
    children: [...children, if(ellipsisWidget != null) ellipsisWidget],
  );
  // ...
  // 将hasEllipsis作为一个flag传入
  @override
  RenderWWrap createRenderObject(BuildContext context) {
    return RenderWWrap(
      direction: direction,
      alignment: alignment,
      spacing: spacing,
      runAlignment: runAlignment,
      runSpacing: runSpacing,
      crossAxisAlignment: crossAxisAlignment,
      textDirection: textDirection ?? Directionality.of(context),
      verticalDirection: verticalDirection,
      hasEllipsis: ellipsisWidget != null,
    );
  }
  // ...
}
```

在performLayout时，考虑以下几点：
是否需要显示eliipsisWidget：和“是否已经有子元素被省略”强对应，有省略就显示，没有则不显示
每个元素是否需要被忽略：
    检查：由于获得元素尺寸需要先行layout，故这里提前考虑ellipsisWidget的尺寸会更方便。渲染该元素+ellipsisWidget是否会导致换行：
        如果不会，正常渲染该元素；
        如果会，则：
            若该元素不是最后一个元素，那么加入后续元素后一定会导致换行，那么省略这个元素，换为ellipsisWidget
            若该元素是最后一个元素，则考虑没有ellipsisWidget时会不会换行，会换行，则省略，不会则正常渲染，转而隐藏ellipsisWidget
于是这部分代码改写如下：
```
child.layout(childConstraints, parentUsesSize: true);
lastChild.layout(childConstraints, parentUsesSize: true);
double childMainAxisExtent = _getMainAxisExtent(child);
double childCrossAxisExtent = _getCrossAxisExtent(child);

final WWrapParentData childParentData = child.parentData as WWrapParentData;

bool shouldPassChild = false;

if(_hasEllipsis) {
  final double ellipsisMainAxisExtent = _getMainAxisExtent(lastChild);

  // 若已有元素被跳过，显示ellipsis
  // 实际逻辑为：若渲染到ellipsisWidget（即最后一个child）时，hasChildPassed依然为false，那么就隐藏ellipsisWidget
  if(!hasChildPassed &&
    childParentData.nextSibling == null &&
    constraints.maxHeight != double.infinity) {
    lastChild.layout(BoxConstraints(maxHeight: 0, maxWidth: 0), parentUsesSize: true);
  }

  if (childCount > 0 && runMainAxisExtent + spacing * 2 + childMainAxisExtent + ellipsisMainAxisExtent > mainAxisLimit) {
    if(crossAxisExtent + runCrossAxisExtent + childCrossAxisExtent > constraints.maxHeight) {
      // 若即将超出范围的元素是最后一个元素：
      // 若没有ellipsis也超出，则跳过
      // 不然，不跳过，不显示ellipsis

      // 若即将超出范围的元素不是最后一个元素，跳过
      // 若已有元素被跳过，超出范围的元素即跳过
      if(childParentData.nextSibling != null) {
        final isLast = (childParentData.nextSibling.parentData as WWrapParentData).nextSibling == null;

        if(!isLast || hasChildPassed || (isLast && runMainAxisExtent + spacing+ childMainAxisExtent > mainAxisLimit)) {
          // 这几个flag用于处理spacing，若元素被跳过，则spacing也不会有
          hasChildPassed = true;
          shouldPassChild = true;
          childParentData._shouldSkip = true;
          // 忽略元素，更新元素尺寸
          child.layout(BoxConstraints(maxHeight: 0, maxWidth: 0), parentUsesSize: true);
          childMainAxisExtent = _getMainAxisExtent(child);
          childCrossAxisExtent = _getCrossAxisExtent(child);
        }
      }
    }

    if(runMainAxisExtent + spacing + childMainAxisExtent > mainAxisLimit) {
      mainAxisExtent = math.max(mainAxisExtent, runMainAxisExtent);
      crossAxisExtent += runCrossAxisExtent;
      if (runMetrics.isNotEmpty)
        crossAxisExtent += runSpacing;
      runMetrics.add(_RunMetrics(runMainAxisExtent, runCrossAxisExtent, childCount));
      runMainAxisExtent = 0.0;
      runCrossAxisExtent = 0.0;
      childCount = 0;
    }
  }
}
```

整个文件如下：
```
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';
import 'dart:math' as math;

class WWrap extends MultiChildRenderObjectWidget {
  WWrap({
    Key key,
    this.direction = Axis.horizontal,
    this.alignment = WrapAlignment.start,
    this.spacing = 0.0,
    this.runAlignment = WrapAlignment.start,
    this.runSpacing = 0.0,
    this.crossAxisAlignment = WrapCrossAlignment.start,
    this.textDirection,
    this.verticalDirection = VerticalDirection.down,
    this.ellipsisWidget,
    List<Widget> children = const <Widget>[],
  }) : super(
    key: key,
    children: [...children, if(ellipsisWidget != null) ellipsisWidget],
  );

  final Axis direction;
  final WrapAlignment alignment;
  final double spacing;
  final WrapAlignment runAlignment;
  final double runSpacing;
  final WrapCrossAlignment crossAxisAlignment;
  final TextDirection textDirection;
  final VerticalDirection verticalDirection;

  final Widget ellipsisWidget;

  @override
  RenderWWrap createRenderObject(BuildContext context) {
    return RenderWWrap(
      direction: direction,
      alignment: alignment,
      spacing: spacing,
      runAlignment: runAlignment,
      runSpacing: runSpacing,
      crossAxisAlignment: crossAxisAlignment,
      textDirection: textDirection ?? Directionality.of(context),
      verticalDirection: verticalDirection,
      hasEllipsis: ellipsisWidget != null,
    );
  }

  @override
  void updateRenderObject(BuildContext context, RenderWWrap renderObject) {
    renderObject
      ..direction = direction
      ..alignment = alignment
      ..spacing = spacing
      ..runAlignment = runAlignment
      ..runSpacing = runSpacing
      ..crossAxisAlignment = crossAxisAlignment
      ..textDirection = textDirection ?? Directionality.of(context)
      ..verticalDirection = verticalDirection
      ..hasEllipsis = ellipsisWidget != null;
  }

  @override
  void debugFillProperties(DiagnosticPropertiesBuilder properties) {
    super.debugFillProperties(properties);
    properties.add(EnumProperty<Axis>('direction', direction));
    properties.add(EnumProperty<WrapAlignment>('alignment', alignment));
    properties.add(DoubleProperty('spacing', spacing));
    properties.add(EnumProperty<WrapAlignment>('runAlignment', runAlignment));
    properties.add(DoubleProperty('runSpacing', runSpacing));
    properties.add(DoubleProperty('crossAxisAlignment', runSpacing));
    properties.add(EnumProperty<TextDirection>('textDirection', textDirection, defaultValue: null));
    properties.add(FlagProperty('hasEllipsis',
      value: ellipsisWidget != null,
    ));
    properties.add(EnumProperty<VerticalDirection>('verticalDirection', verticalDirection, defaultValue: VerticalDirection.down));
  }
}

class RenderWWrap extends RenderBox with ContainerRenderObjectMixin<RenderBox, WWrapParentData>,
                                        RenderBoxContainerDefaultsMixin<RenderBox, WWrapParentData> {
  RenderWWrap({
    List<RenderBox> children,
    Axis direction = Axis.horizontal,
    WrapAlignment alignment = WrapAlignment.start,
    double spacing = 0.0,
    WrapAlignment runAlignment = WrapAlignment.start,
    double runSpacing = 0.0,
    WrapCrossAlignment crossAxisAlignment = WrapCrossAlignment.start,
    TextDirection textDirection,
    VerticalDirection verticalDirection = VerticalDirection.down,
    bool hasEllipsis,
  }) : assert(direction != null),
       assert(alignment != null),
       assert(spacing != null),
       assert(runAlignment != null),
       assert(runSpacing != null),
       assert(crossAxisAlignment != null),
       _direction = direction,
       _alignment = alignment,
       _spacing = spacing,
       _hasEllipsis = hasEllipsis,
       _runAlignment = runAlignment,
       _runSpacing = runSpacing,
       _crossAxisAlignment = crossAxisAlignment,
       _textDirection = textDirection,
       _verticalDirection = verticalDirection {
    addAll(children);
  }

  Axis get direction => _direction;
  Axis _direction;
  set direction (Axis value) {
    assert(value != null);
    if (_direction == value)
      return;
    _direction = value;
    markNeedsLayout();
  }
  WrapAlignment get alignment => _alignment;
  WrapAlignment _alignment;
  set alignment (WrapAlignment value) {
    assert(value != null);
    if (_alignment == value)
      return;
    _alignment = value;
    markNeedsLayout();
  }

  double get spacing => _spacing;
  double _spacing;
  set spacing (double value) {
    assert(value != null);
    if (_spacing == value)
      return;
    _spacing = value;
    markNeedsLayout();
  }

  WrapAlignment get runAlignment => _runAlignment;
  WrapAlignment _runAlignment;
  set runAlignment (WrapAlignment value) {
    assert(value != null);
    if (_runAlignment == value)
      return;
    _runAlignment = value;
    markNeedsLayout();
  }

  double get runSpacing => _runSpacing;
  double _runSpacing;
  set runSpacing (double value) {
    assert(value != null);
    if (_runSpacing == value)
      return;
    _runSpacing = value;
    markNeedsLayout();
  }

  WrapCrossAlignment get crossAxisAlignment => _crossAxisAlignment;
  WrapCrossAlignment _crossAxisAlignment;
  set crossAxisAlignment (WrapCrossAlignment value) {
    assert(value != null);
    if (_crossAxisAlignment == value)
      return;
    _crossAxisAlignment = value;
    markNeedsLayout();
  }

  TextDirection get textDirection => _textDirection;
  set textDirection(TextDirection value) {
    if (_textDirection != value) {
      _textDirection = value;
      markNeedsLayout();
    }
  }
  TextDirection _textDirection;

  bool _hasEllipsis;
  bool get hasEllipsis => hasEllipsis;
  set hasEllipsis(bool value) {
    if (_hasEllipsis != value) {
      _hasEllipsis = value;
      markNeedsLayout();
    }
  }

  VerticalDirection get verticalDirection => _verticalDirection;
  VerticalDirection _verticalDirection;
  set verticalDirection(VerticalDirection value) {
    if (_verticalDirection != value) {
      _verticalDirection = value;
      markNeedsLayout();
    }
  }

  bool get _debugHasNecessaryDirections {
    assert(direction != null);
    assert(alignment != null);
    assert(runAlignment != null);
    assert(crossAxisAlignment != null);
    if (firstChild != null && lastChild != firstChild) {
      // i.e. there's more than one child
      switch (direction) {
        case Axis.horizontal:
          assert(textDirection != null, 'Horizontal $runtimeType with multiple children has a null textDirection, so the layout order is undefined.');
          break;
        case Axis.vertical:
          assert(verticalDirection != null, 'Vertical $runtimeType with multiple children has a null verticalDirection, so the layout order is undefined.');
          break;
      }
    }
    if (alignment == WrapAlignment.start || alignment == WrapAlignment.end) {
      switch (direction) {
        case Axis.horizontal:
          assert(textDirection != null, 'Horizontal $runtimeType with alignment $alignment has a null textDirection, so the alignment cannot be resolved.');
          break;
        case Axis.vertical:
          assert(verticalDirection != null, 'Vertical $runtimeType with alignment $alignment has a null verticalDirection, so the alignment cannot be resolved.');
          break;
      }
    }
    if (runAlignment == WrapAlignment.start || runAlignment == WrapAlignment.end) {
      switch (direction) {
        case Axis.horizontal:
          assert(verticalDirection != null, 'Horizontal $runtimeType with runAlignment $runAlignment has a null verticalDirection, so the alignment cannot be resolved.');
          break;
        case Axis.vertical:
          assert(textDirection != null, 'Vertical $runtimeType with runAlignment $runAlignment has a null textDirection, so the alignment cannot be resolved.');
          break;
      }
    }
    if (crossAxisAlignment == WrapCrossAlignment.start || crossAxisAlignment == WrapCrossAlignment.end) {
      switch (direction) {
        case Axis.horizontal:
          assert(verticalDirection != null, 'Horizontal $runtimeType with crossAxisAlignment $crossAxisAlignment has a null verticalDirection, so the alignment cannot be resolved.');
          break;
        case Axis.vertical:
          assert(textDirection != null, 'Vertical $runtimeType with crossAxisAlignment $crossAxisAlignment has a null textDirection, so the alignment cannot be resolved.');
          break;
      }
    }
    return true;
  }

  @override
  void setupParentData(RenderBox child) {
    if (child.parentData is! WWrapParentData)
      child.parentData = WWrapParentData();
  }

  double _computeIntrinsicHeightForWidth(double width) {
    assert(direction == Axis.horizontal);
    int runCount = 0;
    double height = 0.0;
    double runWidth = 0.0;
    double runHeight = 0.0;
    int childCount = 0;
    RenderBox child = firstChild;
    while (child != null && !(child.parentData as WWrapParentData)._shouldSkip) {
      final double childWidth = child.getMaxIntrinsicWidth(double.infinity);
      final double childHeight = child.getMaxIntrinsicHeight(childWidth);
      if (runWidth + childWidth > width) {
        height += runHeight;
        if (runCount > 0)
          height += runSpacing;
        runCount += 1;
        runWidth = 0.0;
        runHeight = 0.0;
        childCount = 0;
      }
      runWidth += childWidth;
      runHeight = math.max(runHeight, childHeight);
      if (childCount > 0)
        runWidth += spacing;
      childCount += 1;
      child = childAfter(child);
    }
    if (childCount > 0)
      height += runHeight + runSpacing;
    return height;
  }

  double _computeIntrinsicWidthForHeight(double height) {
    assert(direction == Axis.vertical);
    int runCount = 0;
    double width = 0.0;
    double runHeight = 0.0;
    double runWidth = 0.0;
    int childCount = 0;
    RenderBox child = firstChild;
    while (child != null && !(child.parentData as WWrapParentData)._shouldSkip) {
      final double childHeight = child.getMaxIntrinsicHeight(double.infinity);
      final double childWidth = child.getMaxIntrinsicWidth(childHeight);
      if (runHeight + childHeight > height) {
        width += runWidth;
        if (runCount > 0)
          width += runSpacing;
        runCount += 1;
        runHeight = 0.0;
        runWidth = 0.0;
        childCount = 0;
      }
      runHeight += childHeight;
      runWidth = math.max(runWidth, childWidth);
      if (childCount > 0)
        runHeight += spacing;
      childCount += 1;
      child = childAfter(child);
    }
    if (childCount > 0)
      width += runWidth + runSpacing;
    return width;
  }

  @override
  double computeMinIntrinsicWidth(double height) {
    switch (direction) {
      case Axis.horizontal:
        double width = 0.0;
        RenderBox child = firstChild;
        while (child != null) {
          width = math.max(width, child.getMinIntrinsicWidth(double.infinity));
          child = childAfter(child);
        }
        return width;
      case Axis.vertical:
        return _computeIntrinsicWidthForHeight(height);
    }
    return null;
  }

  @override
  double computeMaxIntrinsicWidth(double height) {
    switch (direction) {
      case Axis.horizontal:
        double width = 0.0;
        RenderBox child = firstChild;
        while (child != null) {
          width += child.getMaxIntrinsicWidth(double.infinity);
          child = childAfter(child);
        }
        return width;
      case Axis.vertical:
        return _computeIntrinsicWidthForHeight(height);
    }
    return null;
  }

  @override
  double computeMinIntrinsicHeight(double width) {
    switch (direction) {
      case Axis.horizontal:
        return _computeIntrinsicHeightForWidth(width);
      case Axis.vertical:
        double height = 0.0;
        RenderBox child = firstChild;
        while (child != null) {
          height = math.max(height, child.getMinIntrinsicHeight(double.infinity));
          child = childAfter(child);
        }
        return height;
    }
    return null;
  }

  @override
  double computeMaxIntrinsicHeight(double width) {
    switch (direction) {
      case Axis.horizontal:
        return _computeIntrinsicHeightForWidth(width);
      case Axis.vertical:
        double height = 0.0;
        RenderBox child = firstChild;
        while (child != null) {
          height += child.getMaxIntrinsicHeight(double.infinity);
          child = childAfter(child);
        }
        return height;
    }
    return null;
  }

  @override
  double computeDistanceToActualBaseline(TextBaseline baseline) {
    return defaultComputeDistanceToHighestActualBaseline(baseline);
  }

  double _getMainAxisExtent(RenderBox child) {
    switch (direction) {
      case Axis.horizontal:
        return child.size.width;
      case Axis.vertical:
        return child.size.height;
    }
    return 0.0;
  }

  double _getCrossAxisExtent(RenderBox child) {
    switch (direction) {
      case Axis.horizontal:
        return child.size.height;
      case Axis.vertical:
        return child.size.width;
    }
    return 0.0;
  }

  Offset _getOffset(double mainAxisOffset, double crossAxisOffset) {
    switch (direction) {
      case Axis.horizontal:
        return Offset(mainAxisOffset, crossAxisOffset);
      case Axis.vertical:
        return Offset(crossAxisOffset, mainAxisOffset);
    }
    return Offset.zero;
  }

  double _getChildCrossAxisOffset(bool flipCrossAxis, double runCrossAxisExtent, double childCrossAxisExtent) {
    final double freeSpace = runCrossAxisExtent - childCrossAxisExtent;
    switch (crossAxisAlignment) {
      case WrapCrossAlignment.start:
        return flipCrossAxis ? freeSpace : 0.0;
      case WrapCrossAlignment.end:
        return flipCrossAxis ? 0.0 : freeSpace;
      case WrapCrossAlignment.center:
        return freeSpace / 2.0;
    }
    return 0.0;
  }

  bool _hasVisualOverflow = false;

  @override
  void performLayout() {
    final BoxConstraints constraints = this.constraints;
    assert(_debugHasNecessaryDirections);
    _hasVisualOverflow = false;
    RenderBox child = firstChild;
    if (child == null) {
      size = constraints.smallest;
      return;
    }
    BoxConstraints childConstraints;
    double mainAxisLimit = 0.0;
    bool flipMainAxis = false;
    bool flipCrossAxis = false;
    switch (direction) {
      case Axis.horizontal:
        childConstraints = BoxConstraints(maxWidth: constraints.maxWidth);
        mainAxisLimit = constraints.maxWidth;
        if (textDirection == TextDirection.rtl)
          flipMainAxis = true;
        if (verticalDirection == VerticalDirection.up)
          flipCrossAxis = true;
        break;
      case Axis.vertical:
        childConstraints = BoxConstraints(maxHeight: constraints.maxHeight);
        mainAxisLimit = constraints.maxHeight;
        if (verticalDirection == VerticalDirection.up)
          flipMainAxis = true;
        if (textDirection == TextDirection.rtl)
          flipCrossAxis = true;
        break;
    }
    assert(childConstraints != null);
    assert(mainAxisLimit != null);
    final double spacing = this.spacing;
    final double runSpacing = this.runSpacing;
    final List<_RunMetrics> runMetrics = <_RunMetrics>[];
    double mainAxisExtent = 0.0;
    double crossAxisExtent = 0.0;
    double runMainAxisExtent = 0.0;
    double runCrossAxisExtent = 0.0;
    int childCount = 0;

    bool hasChildPassed = false;

    while (child != null) {
      child.layout(childConstraints, parentUsesSize: true);
      lastChild.layout(childConstraints, parentUsesSize: true);
      double childMainAxisExtent = _getMainAxisExtent(child);
      double childCrossAxisExtent = _getCrossAxisExtent(child);

      final WWrapParentData childParentData = child.parentData as WWrapParentData;

      bool shouldPassChild = false;

      if(_hasEllipsis) {
        final double ellipsisMainAxisExtent = _getMainAxisExtent(lastChild);

        // 若已有元素被跳过，显示ellipsis
        if(!hasChildPassed &&
          childParentData.nextSibling == null &&
          constraints.maxHeight != double.infinity) {
          lastChild.layout(BoxConstraints(maxHeight: 0, maxWidth: 0), parentUsesSize: true);
        }

        if (childCount > 0 && runMainAxisExtent + spacing * 2 + childMainAxisExtent + ellipsisMainAxisExtent > mainAxisLimit) {
          if(crossAxisExtent + runCrossAxisExtent + childCrossAxisExtent > constraints.maxHeight) {
            // 若即将超出范围的元素是最后一个元素：
            // 若没有ellipsis也超出，则跳过
            // 不然，不跳过，不显示ellipsis

            // 若即将超出范围的元素不是最后一个元素，跳过
            // 若已有元素被跳过，超出范围的元素即跳过
            if(childParentData.nextSibling != null) {
              final isLast = (childParentData.nextSibling.parentData as WWrapParentData).nextSibling == null;

              if(!isLast || hasChildPassed || (isLast && runMainAxisExtent + spacing + childMainAxisExtent > mainAxisLimit)) {
                hasChildPassed = true;
                shouldPassChild = true;
                childParentData._shouldSkip = true;
                child.layout(BoxConstraints(maxHeight: 0, maxWidth: 0), parentUsesSize: true);
                childMainAxisExtent = _getMainAxisExtent(child);
                childCrossAxisExtent = _getCrossAxisExtent(child);
              }
            }
          }

          if(runMainAxisExtent + spacing + childMainAxisExtent > mainAxisLimit) {
            mainAxisExtent = math.max(mainAxisExtent, runMainAxisExtent);
            crossAxisExtent += runCrossAxisExtent;
            if (runMetrics.isNotEmpty)
              crossAxisExtent += runSpacing;
            runMetrics.add(_RunMetrics(runMainAxisExtent, runCrossAxisExtent, childCount));
            runMainAxisExtent = 0.0;
            runCrossAxisExtent = 0.0;
            childCount = 0;
          }
        }
      } else if (childCount > 0 && runMainAxisExtent + spacing + childMainAxisExtent > mainAxisLimit) {
        mainAxisExtent = math.max(mainAxisExtent, runMainAxisExtent);
        crossAxisExtent += runCrossAxisExtent;
        if (runMetrics.isNotEmpty)
          crossAxisExtent += runSpacing;
        runMetrics.add(_RunMetrics(runMainAxisExtent, runCrossAxisExtent, childCount));
        runMainAxisExtent = 0.0;
        runCrossAxisExtent = 0.0;
        childCount = 0;
      }

      runMainAxisExtent += childMainAxisExtent;
      if (childCount > 0 && !shouldPassChild)
        runMainAxisExtent += spacing;
      runCrossAxisExtent = math.max(runCrossAxisExtent, childCrossAxisExtent);
      childCount += 1;
      childParentData._runIndex = runMetrics.length;
      child = childParentData.nextSibling;
    }
    if (childCount > 0) {
      mainAxisExtent = math.max(mainAxisExtent, runMainAxisExtent);
      crossAxisExtent += runCrossAxisExtent;
      if (runMetrics.isNotEmpty)
        crossAxisExtent += runSpacing;
      runMetrics.add(_RunMetrics(runMainAxisExtent, runCrossAxisExtent, childCount));
    }

    final int runCount = runMetrics.length;
    assert(runCount > 0);

    double containerMainAxisExtent = 0.0;
    double containerCrossAxisExtent = 0.0;

    switch (direction) {
      case Axis.horizontal:
        size = constraints.constrain(Size(mainAxisExtent, crossAxisExtent));
        containerMainAxisExtent = size.width;
        containerCrossAxisExtent = size.height;
        break;
      case Axis.vertical:
        size = constraints.constrain(Size(crossAxisExtent, mainAxisExtent));
        containerMainAxisExtent = size.height;
        containerCrossAxisExtent = size.width;
        break;
    }

    _hasVisualOverflow = containerMainAxisExtent < mainAxisExtent || containerCrossAxisExtent < crossAxisExtent;

    final double crossAxisFreeSpace = math.max(0.0, containerCrossAxisExtent - crossAxisExtent);
    double runLeadingSpace = 0.0;
    double runBetweenSpace = 0.0;
    switch (runAlignment) {
      case WrapAlignment.start:
        break;
      case WrapAlignment.end:
        runLeadingSpace = crossAxisFreeSpace;
        break;
      case WrapAlignment.center:
        runLeadingSpace = crossAxisFreeSpace / 2.0;
        break;
      case WrapAlignment.spaceBetween:
        runBetweenSpace = runCount > 1 ? crossAxisFreeSpace / (runCount - 1) : 0.0;
        break;
      case WrapAlignment.spaceAround:
        runBetweenSpace = crossAxisFreeSpace / runCount;
        runLeadingSpace = runBetweenSpace / 2.0;
        break;
      case WrapAlignment.spaceEvenly:
        runBetweenSpace = crossAxisFreeSpace / (runCount + 1);
        runLeadingSpace = runBetweenSpace;
        break;
    }

    runBetweenSpace += runSpacing;
    double crossAxisOffset = flipCrossAxis ? containerCrossAxisExtent - runLeadingSpace : runLeadingSpace;

    child = firstChild;
    for (int i = 0; i < runCount; ++i) {
      final _RunMetrics metrics = runMetrics[i];
      final double runMainAxisExtent = metrics.mainAxisExtent;
      final double runCrossAxisExtent = metrics.crossAxisExtent;
      final int childCount = metrics.childCount;

      final double mainAxisFreeSpace = math.max(0.0, containerMainAxisExtent - runMainAxisExtent);
      double childLeadingSpace = 0.0;
      double childBetweenSpace = 0.0;

      switch (alignment) {
        case WrapAlignment.start:
          break;
        case WrapAlignment.end:
          childLeadingSpace = mainAxisFreeSpace;
          break;
        case WrapAlignment.center:
          childLeadingSpace = mainAxisFreeSpace / 2.0;
          break;
        case WrapAlignment.spaceBetween:
          childBetweenSpace = childCount > 1 ? mainAxisFreeSpace / (childCount - 1) : 0.0;
          break;
        case WrapAlignment.spaceAround:
          childBetweenSpace = mainAxisFreeSpace / childCount;
          childLeadingSpace = childBetweenSpace / 2.0;
          break;
        case WrapAlignment.spaceEvenly:
          childBetweenSpace = mainAxisFreeSpace / (childCount + 1);
          childLeadingSpace = childBetweenSpace;
          break;
      }

      childBetweenSpace += spacing;

      double childMainPosition = flipMainAxis ? containerMainAxisExtent - childLeadingSpace : childLeadingSpace;

      if (flipCrossAxis)
        crossAxisOffset -= runCrossAxisExtent;

      while (child != null) {
        final WWrapParentData childParentData = child.parentData as WWrapParentData;
        if (childParentData._runIndex != i)
          break;
        final double childMainAxisExtent = _getMainAxisExtent(child);
        final double childCrossAxisExtent = _getCrossAxisExtent(child);
        final double childCrossAxisOffset = _getChildCrossAxisOffset(flipCrossAxis, runCrossAxisExtent, childCrossAxisExtent);
        if (flipMainAxis)
          childMainPosition -= childMainAxisExtent;
        childParentData.offset = _getOffset(childMainPosition, crossAxisOffset + childCrossAxisOffset);
        if (flipMainAxis)
          childMainPosition -= childBetweenSpace;
        else
          childMainPosition += childMainAxisExtent + (childParentData._shouldSkip ? 0 : childBetweenSpace);
        child = childParentData.nextSibling;
      }

      if (flipCrossAxis)
        crossAxisOffset -= runBetweenSpace;
      else
        crossAxisOffset += runCrossAxisExtent + runBetweenSpace;
    }
  }

  @override
  bool hitTestChildren(BoxHitTestResult result, { Offset position }) {
    return defaultHitTestChildren(result, position: position);
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    // TODO(ianh): move the debug flex overflow paint logic somewhere common so
    // it can be reused here
    if (_hasVisualOverflow)
      context.pushClipRect(needsCompositing, offset, Offset.zero & size, defaultPaint);
    else
      defaultPaint(context, offset);
  }

  @override
  void debugFillProperties(DiagnosticPropertiesBuilder properties) {
    super.debugFillProperties(properties);
    properties.add(EnumProperty<Axis>('direction', direction));
    properties.add(EnumProperty<WrapAlignment>('alignment', alignment));
    properties.add(DoubleProperty('spacing', spacing));
    properties.add(EnumProperty<WrapAlignment>('runAlignment', runAlignment));
    properties.add(DoubleProperty('runSpacing', runSpacing));
    properties.add(DoubleProperty('crossAxisAlignment', runSpacing));
    properties.add(EnumProperty<TextDirection>('textDirection', textDirection, defaultValue: null));
    properties.add(EnumProperty<VerticalDirection>('verticalDirection', verticalDirection, defaultValue: VerticalDirection.down));
  }
}

class _RunMetrics {
  _RunMetrics(this.mainAxisExtent, this.crossAxisExtent, this.childCount);

  final double mainAxisExtent;
  final double crossAxisExtent;
  final int childCount;
}

/// Parent data for use with [RenderWrap].
class WWrapParentData extends ContainerBoxParentData<RenderBox> {
  int _runIndex = 0;
  bool _shouldSkip = false;
}
```

实际上代码有很多地方处理的比较粗糙，比如通过layout(0,0)来隐藏元素，把ellipsis直接加入children这些地方，从架构上来说还是有不少改进的空间。不过既然是fork的代码嘛……还是优先确保可用性