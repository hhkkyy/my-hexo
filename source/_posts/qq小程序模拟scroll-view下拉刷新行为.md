---
title: qq小程序模拟scroll-view下拉刷新行为
date: 2020-12-21 19:48:17
tags:
---
![小程序唯一该去的地方是历史的垃圾箱](/images/24121227-9028ba99d76e79e3.png)
微信小程序在2.10终于给出了scroll-view的下拉刷新——好消息来啦！宣称完全兼容微信小程序的qq小程序并不兼容这一点，于是我们自己给他整一个下拉刷新。

首先我们需要区分微信还是qq，有两种办法：
1、判断是否存在全局变量“qq”：platform = typeof qq === "undefined" ? "wx" : "qq"
2、通过接口 wx.getSystemInfoSync() 来获取系统信息。qq和微信给出的数据结构是不一样的（《完全兼容》）其中qq会多出一个AppPlatform的字段，值为“qq”（微信没用有这个字段）。

之后就是给他整个下拉刷新，不算复杂：
```
scroll-view.refreshable-scroll-view(
  style="transform: translate(0, {{ offset }}px); {{ !isTouching ? 'transition: 0.3s' : '' }}"
  scroll-y="{{ true }}"
  refresher-enabled="{{ true }}"
  bindrefresherrefresh="onRefresh"
  bindscrolltolower="onLoadMore"
  refresher-triggered="{{ refresherTriggered }}"
  bindtouchstart="onTouchStart"
  bindtouchmove="onTouchMove"
  bindtouchend="onTouchEnd"
  bindscroll="onScroll"
  class="{{ cls }}"
)
  slot
```
pug写的wxml，不太关键

js部分
```
  data: {
    // 滚动距离
    offset: 0,
    // 是否正在触摸，如果触摸结束会给元素一个transition的样式让他有个弹回动画
    isTouching: false,
  },

  // 从哪里开始滑动
  startY: null,
  // 始终记录scrollTop，伟大的小程序不喜欢我们通过元素去获取scrollTop，所以我们通过scroll事件来记录
  scrollTop: 0,

  methods: {
    onScroll(detail) {
      this.scrollTop = detail.detail.scrollTop
    },

    // 不需要兼容的微信环境直接丢出事件即可
    onRefresh() {
      this.triggerEvent("refresh")
    },

    onLoadMore() {
      this.triggerEvent("loadmore")
    },

    // 优雅的小程序并不总是能检测到scrollTop的归零，所以我们给他一个50的容错
    onTouchStart(detail) {
      if(store.platform === "wx" || this.scrollTop > 50) return

      this.startY = detail.touches[0].clientY

      this.$set({
        isTouching: true,
      })
    },

    // 简单的光标跟随，如果想要的话可以给offset做一下处理（比如除个2）
    onTouchMove(detail) {
      if(store.platform === "wx" ||  !this.data.isTouching) return

      this.$set({
        offset: Math.max(0, detail.touches[0].clientY - this.startY),
      })
    },

    // 触控结束事件，距离足够则刷新
    onTouchEnd(detail) {
      if(store.platform === "wx") return

      if(this.data.offset > 100) {
        this.triggerEvent("refresh")
      }

      this.$set({
        isTouching: false,
      })

      wx.nextTick(() => {
        this.$set({
          offset: 0,
        })
      })
    },
  },
```

ios上scroll-view会允许溢出，上述代码依然有效但是可以做一些体验上的优化