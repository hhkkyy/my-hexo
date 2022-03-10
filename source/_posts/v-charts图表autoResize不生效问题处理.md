---
title: v-charts图表autoResize不生效问题处理
date: 2020-11-16 17:59:10
tags:
---
v-charts(vue包装的echarts)带有一个autoResize属性，但是在之前的开发中发现resize失效，而且仅在宽度减小时失效，增大时正常改变。

经检查发现原因为：
1、autoResize是检测“父元素” 的尺寸变化来进行resize的
2、在flex布局下，如果子元素已被指定宽度，则flex容器会被子元素强制撑开
3、echarts会给元素强制加上一个width的样式
综合作用导致该结果

解决方法：利用css性质使flex容器不会被撑开
为flex容器元素设置css: overflow: hidden即可