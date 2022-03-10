---
title: 小程序神必bug：position: sticky 意外上滑
date: 2021-02-01 20:13:06
tags:
---
移动端交互上时常遇到需要吸顶的需求，之前在html框架上这个并不好做，需要监听滚动改变css。而position: sticky推出之后，这个需求变得简单起来，再加上移动端浏览器的兼容性普遍较好，可以安全在项目中使用。

然而！！

小程序总是会给我们意想不到的惊喜。

正常来说，position为sticky的元素在吸顶之后，除非其父元素移出屏幕，不然是会永远保持吸顶的，但是小程序中出了问题。一个最简单的复现方式为：
```
<scroll-view scroll-y="true">
    <div style="position: sticky"> 1 </div>
    <div> 2 </div>
</scroll-view>
```
在此代码下，如果进行长距离滚动，会发现第一个div吸顶了一段时间后罢工了，开始跟随滚动区滑动。
需要注意的是，如果不使用scroll-view而是使用一个overflow: auto的div进行滚动则不会有这个问题。显然是狗比小程序在scroll-view里干了奇怪的事情。
然而这毕竟是小程序，大手一挥直接把view元素的滚动监听给杀了，没办法只好继续用scroll-view。最后发现一个绕过bug的方法：
```
<scroll-view scroll-y="true">
    <div>
        <div style="position: sticky"> 1 </div>
        <div> 2 </div>
    </div>
</scroll-view>
```
不把div直接置于scroll-view的直接子元素内，外面套一个view即可。反正小程序也没长列表优化，套一个也没啥坏处。