---
title: 小程序input的placeholder在安卓机上的样式问题
date: 2021-03-10 15:53:50
tags:
---
![小程序……治疗低血压的超人](/images/24121227-70620201634656ec.png)

话不多说直接开喷。
首先小程序不知道为什么要搞一套长得像html和css的东西但是又要搞出不同的表现已经不是一天两天了，但是遇到各种神奇jb bug还是得骂一骂。

对于一个标准的html规范，input的placeholder的样式是用以下方式展示的：
```
input::-webkit-input-placeholder {
  // some style
}
```
但是小程序的特立独行早已广为人知，小程序是这么整的：
```
// 首先，小程序当然是直接把标准的placeholder选择器杀了
<input placeholder-class="placeholder-class">
</input>

.placeholder-class {
   // some style
}
```
你以为这就完了？没有。
上面的代码在ios设备上运行正常，但是对安卓设备有明显的问题：当用户对input focus的时候，安卓设备的placeholder即使没有任何输入也会直接变为输入内容的样式，非常nm刺激。
于是我们只能整一个组件来判断内容是否为空来给他加上不同的样式但是这样就要写一大堆东西我懒得放到这篇文章里反正这些代码是个人都会而且毫无意义。

![今天的血压也是很高呢。](/images/24121227-70620201634656ec.png)
