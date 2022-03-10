---
title: js模拟滚动行为
date: 2020-12-14 01:30:49
tags:
---
web滚动定制化程度难以令人满意，无限滚动之类的效果也不好，所以在需要相对高地定制滚动的地方我用了假滚动来进行处理：

总体思路是监控元素的拖拽动作：

首先，滚动由css的transform: translate模拟，要滚多远就让他有多少translate

touchStart：记录开始拖拽

touchMove：进行拖拽，修改translate的值。

touchEnd: 开始进行惯性滚动，速度降为0后则停止

之前用的项目是小程序，就用小程序来示范（虽然小程序非常屎）代码如下：

```

    onTouchStart(detail) {

      // 手指触摸屏幕时结束惯性滚动

      this.isDoingBallistic = false

      // 记录滚动开始处，用于校准offset（touchMove传入的是鼠标当前位置，需要减去滚动开始的位置）

      this.data.startX = detail.changedTouches[0].clientX

      // 记录上一刻滚动和时间戳，用于记录速度

      this.data.lastX = detail.changedTouches[0].clientX

      this.data.lastTimeStamp = detail.timeStamp

    },

    onTouchEnd(detail) {

      this.data.lastScrollLeft = this.data.scrollLeft

      // 结束时开始惯性滚动

      this.isDoingBallistic = true

      this.goBallistic()

    },

    onTouchMove(detail) {

      // 计算出当前滚动的offset

      this.scrollLeft = this.data.lastScrollLeft + (detail.changedTouches[0].clientX - this.data.startX) * this.data.speed,

      // 计算速度，速度用于惯性滚动

      this.data.velocity = (detail.changedTouches[0].clientX - this.data.lastX) / (detail.timeStamp - this.data.lastTimeStamp)

      this.data.lastX = detail.changedTouches[0].clientX

      this.data.lastTimeStamp = detail.timeStamp

    },



    // 惯性滚动

    goBallistic() {

      const now = new Date()

      wx.nextTick(() => {

        this.onNextTick(now)

      })

    },

    onNextTick(lastTick) {

      if(!this.isDoingBallistic) return

      const deltaTime = new Date() - lastTick

      this.scrollLeft = this.data.scrollLeft + this.data.velocity * deltaTime,

      this.data.lastScrollLeft = this.data.scrollLeft

       // 速度衰减，有很多系数可以随意调整

        if(this.data.velocity > MIN_VELOCITY) {

          this.data.velocity = this.data.velocity / Math.pow(VEL_DECREASE, deltaTime / 5)

        } else {

          this.data.velocity = 0

        }

      }

      this.goBallistic()

    },

```

在小程序上跑会稍微有点卡，实际上比较建议在pc上做这样的模拟滚动，可以获得完全可控的滚动，缺点是性能差（一直在改内联样式）