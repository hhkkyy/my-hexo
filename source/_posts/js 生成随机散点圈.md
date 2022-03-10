---
title: js 生成随机散点圈
date: 2020-12-07 00:26:20
tags:
---
最近公司的一个项目提了个ui需求，大概就是要在首页搞一个散点式的列表，如下图
![ui大意](/images/24121227-e3e68b0a0e43eff5.png)
问题来了，这个散点列表实际上是可能有无限多个的，显然不能直接按ui给的示意来定死位置；所以这个生成乱点位置的任务还是需要开发来完成的。
一开始是希望通过每个点生成后随机决定下一个点位置，如果重合/距离太近就重新生成的方式实现，但是太复杂。仔细思考下来，关键是要达到一个看起来随机分布的效果，实际上如果真的随机的话，可能反而会出现不美观的情况。所以最终实现是采用了以下思路：
1、首先，生成一个三角堆叠的规则网格，取各点为圆心
![初始](/images/24121227-7ebd061a84a7abdf.png)
2、各个圆按照给定的范围（保证不重叠）进行极坐标下的随机平移和大小调整
3、保证随机为按种子随机
代码如下：
```
const sqrt3 = 1.7320508075688772

const baseSize = 60

const range = baseSize / 2

Math.seed = 5;
Math.seededRandom = (max, min) => {
  max = max || 1;
  min = min || 0;
  Math.seed = (Math.seed * 9301 + 49297) % 233280;
　　
  const rnd = Math.seed / 233280.0;

  return min + rnd * (max - min);
}

export const getDots = (dotNum) => {
  let totalTop
  let totalBottom
  let totalLeft
  let totalRight

  const origin = []

  for(let i = 0; i < dotNum ;i++) {
    const column = Math.floor(i / 3)
    const row = i % 3

    origin.push({
      size: baseSize,
      x: (row == 1 ? baseSize : 0) + column * baseSize * 2,
      y: row * baseSize * sqrt3,
    })
  }

  origin
    .forEach(i => {
      const r = range / 3 * 2
      const sita = Math.seededRandom() * 2 * Math.PI

      i.x += r * Math.sin(sita) + r
      i.y += r * Math.cos(sita)
      i.size = Math.floor(Math.seededRandom() * 3) * baseSize / 3 + baseSize / 3 * 2

      const left = i.x
      const right = i.x + i.size
      const top = i.y
      const bottom = i.y + i.size

      totalLeft = totalLeft == null ? left : Math.min(left, totalLeft)
      totalRight = totalRight == null ? right : Math.max(right, totalRight)
      totalTop = totalTop == null ? top : Math.min(top, totalTop)
      totalBottom = totalBottom == null ? bottom : Math.max(bottom, totalBottom)
    })

  origin.forEach(i => {
    i.y -= totalTop
  })

  Math.seed = 5

  return {
    dots: origin,
    left: totalLeft,
    right: totalRight,
    top: totalTop,
    bottom: totalBottom,
  }
}


```