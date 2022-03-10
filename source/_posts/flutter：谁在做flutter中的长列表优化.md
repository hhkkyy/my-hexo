---
title: flutter：谁在做flutter中的长列表优化
date: 2020-09-21 00:38:21
tags:
---
flutter中的滚动元素都是基于viewPort的，ViewPort接受一个Sliver的列表（一般而言Sliver对应一个渲染RenderSliver的Widget，Sliver本身并没有一个类）。如果和Flex布局比较，Sliver布局的一个显然的特征是Sliver布局允许通过调整offset对可视区域进行改变。Flutter中，可视区域的变动除了影响“滚动位置”之外，还允许每个单独的Sliver根据其在ViewPort中的位置改变自身。最常见的应用就是：在默认的ListView中，会利用这一点来对长列表进行动态渲染的优化，即只渲染视口附近的元素。

ListView实际上就是一个使用了SliverList的ScrollView，SliverList就是提供长列表优化的类，具体在createRenderObject方法中的RenderSliverList中实现。通过阅读代码发现：SliverList的长列表优化依赖于一个特殊的constraints。RenderSliverList是之前所说的RenderSliver的子类。而RenderSliver就提供这个特殊的约束：
```
abstract class RenderSliver extends RenderObject {
  // layout input
  @override
  SliverConstraints get constraints => super.constraints;
  // ...
}
```
即：要求RenderSliver内的constraints必须是一个SliverConstraints。（也就是其实RenderSliver也没干啥，只是做了一层检测，这也是由于Sliver并没有和Widget作很明显的区分，只是在使用时，需要去保证Sliver被用在ViewPort中，ViewPort会为Sliver提供这样一个SliverConstraints）。SliverConstraints的参数如下：
```
const SliverConstraints({
    @required this.axisDirection,
    @required this.growthDirection,
    @required this.userScrollDirection,
    @required this.scrollOffset,
    @required this.precedingScrollExtent,
    @required this.overlap,
    @required this.remainingPaintExtent,
    @required this.crossAxisExtent,
    @required this.crossAxisDirection,
    @required this.viewportMainAxisExtent,
    @required this.remainingCacheExtent,
    @required this.cacheOrigin,
  })
```
很容易看出来，SliverConstraints就是用于传递滚动区的滚动方向、最大缓存、滚动位置等等的一个类。在RenderSliver内，接收到constraints之后，再作具体处理。对于SliverList，这个具体做的事情就是长列表优化。这里performLayout里的东西过于琐碎而且不是很直接，就不具体列出了。关键在于：1、RenderSliver当然可以选择不进行长列表优化，也就是说，当我们需要的时候可以让某个元素始终保持被渲染（比如使用SliverToBoxAdapter，这个Sliver的child始终会被渲染）。2、RenderSliver可以做许多其他的事情，远不止长列表优化。其中就包括相对没那么常用但也比较常用的SliverPersistentHeader的吸顶功能。

我们常常能看见一些文章中说：flutter中的Sliver布局有动态渲染的策略，其实严格来说这是错误的。动态渲染并不是由整个Sliver布局提供，Sliver布局只是简单地将SliverConstraints丢给RenderSliver。具体进行长列表优化的则是RenderSliver。这一层也可以看出Flutter这部分设计的很灵活也非常可拓展。不过实际上常用的需求Flutter都已经内置Sliver为我们解决了，实在是省了很多心。