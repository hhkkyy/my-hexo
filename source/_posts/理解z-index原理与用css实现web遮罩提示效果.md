---
title: 理解z-index原理与用css实现web遮罩提示效果
date: 2021-06-30 17:12:01
tags:
---
不管是web还是app，现在很流行一种对新用户的遮罩+高亮的指引。大概就像下图里这样
![引导off](/images/24121227-dde53540471a428a.png)
![引导on](/images/24121227-21d3c847199b40c7.png)

第一反应都会是加个全局的modal然后上面叠个东西，但是这样一来我们就得额外给modal上边加个元素，不方便维护不好说，也不好看。另外，如果页面中有滚动要素，或者是元素位置会根据数据变化，那整起来就需要先定位需要高亮的目标元素，更麻烦了。所以还是希望用纯css解决这个问题。

于是我们先跳出这个具体需求来看z-index的原理。如果去看mdn的话我们会发现一个叫“堆叠上下文”的东西：
> 对于一个已经定位的盒子（即其 position 属性值不是 static，这里要注意的是 CSS 把元素看作盒子），z-index 属性指定：
> 盒子在当前堆叠上下文中的堆叠层级。
> 盒子是否创建一个本地堆叠上下文。

这里直接说结论，z-index的堆叠方式如下:
1、在同一个堆叠上下文中，z-index会决定其中元素的堆叠顺序
2、若两个元素不在同一个堆叠上下文中，则它们的z-index**不会**影响他们之前相互的堆叠顺序。若堆叠上下文不同，它们之间的堆叠顺序由它们第一个具有共同堆叠上下文的祖先之间的堆叠顺序决定。例如：一个位于z-index: 1内的元素，即使其z-index为99999，也会被和它父元素同级的，z-index为2的元素覆盖。
3、body的根本身会创建一个堆叠上下文。

这里注意一点：无论position是relative，absolute还是fixed，都不影响它的堆叠上下文是继承自第一个有z-index的父元素。也就是说，即使position为fixed，它的定位是相对于屏幕的，其堆叠上下文也不会被嫁接到根上，还是会随着父元素改变。这一点是比较反直觉，但也是我们可以利用的。

下面是一段实验代码，可相对直观的了解z-index作用：
```
<template lang="pug">
div
  .bg__fixed
  .bg
    .box__1
      .box__1-1
      .box__1-2
      .box__1-3
      .box__1-4

    .box__2
      .box__2-1
</template>

<script>
export default {
}
</script>

<style lang="stylus">
.bg
  height 100vh
  width 100vw
  position relative

.box__1
  position absolute
  left 100px
  top 100px
  height 250px
  width 250px
  background red
  z-index 100

  > div
    position absolute
    width 100px
    height 100px

.box__1-1
  left 50px
  top 50px
  background gray
  z-index 100

.box__1-2
  left 100px
  top 100px
  background black
  z-index 105

.box__1-3
  left 0px
  top 100px
  background blue
  z-index 1

.box__1-4
  left -50px
  top -50px
  background green
  z-index -100

.box__2
  position absolute
  left 0
  top 0
  height 250px
  width 250px
  background purple
  z-index 90

  > div
    position fixed
    width 200px
    height 200px
    left 0
    top 0
    background pink
    z-index 1000
    position fixed

.bg__fixed
  width 100px
  position fixed
  height 400px
  left 180px
  top 50px
  background green
  z-index 95
</style>
```
![乱](/images/24121227-52687b93ddaa3a92.png)

直接看图很混乱，试一下代码就会很明白了。另外这里还有一个小点：当z-index为负数时，它会被流式布局的元素遮挡，但是即使为负数，它依然会覆盖在父元素的background上方

一般来说，如果我们的布局很简单，全是流式布局，那么这种情况下这个需求就很好搞：直接对需要高亮的元素进行一个：
position: relative
z-index: x（x>遮罩的z-index）
就行了
但是实际上我们的产品和ui常常会提一些需求，必须或者是最好用相对布局来做，有时候就导致了我们目标的元素被包在了新的堆叠上下文内，这样简单暴力的方法就没用了。

一个比较通用的方法如下：
```
<template lang="pug">  
.content
    .content__item(
      v-for="i in [1,2,3,4,5,6]"
    ) {{ i }}
    .content__item__button high light!
    .modal
</template>


<style lang="stylus">
.content
  width 300px

  > div
    height 50px
    display flex
    align-items center
    justify-content center

.content__item:nth-child(odd)
  background red
.content__item:nth-child(even)
  background green

.content__item__button
  background blue
  color white
  position relative
  z-index 101

.modal
  position fixed
  z-index 100
  height 100vh !important
  width 100vw
  top 0
  left 0
  background: black
  opacity: 0.6
</style>
```
思路就是，让需要被高亮的元素和遮罩层处于同一个父元素之下，这样可以保证它们处在同一个堆叠上下文，则可保证一定能使高亮元素能堆叠在遮罩层上。另一方面，当引导激活时，可以调整父元素对应的堆叠上下文，令其能覆盖其他所有元素。这样就可以保证引导页需要的效果：有且仅有目标元素在遮罩层上方。