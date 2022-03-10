---
title: flutter滚动检测的另一种思路
date: 2020-08-30 11:59:54
tags:
---
之前在flutter中作列表元素滚动检测都是使用的GlobalKey来实现：
```
final key = GlobalKey();
// ...
  Widget build(BuildContext context) {
    return ListView(
      controller: controller,
      children: [
        widget(
          key: key,
        ),
      ],
    );
  }
// ...

void onScroll() {
   final RenderBox target = key.currentContext?.findRenderObject();
  // ...
}
```
利用GlobalKey去找到对应widget当前的context，但是这样一方面需要提前根据数据生成GlobalKey，并且每次更新也可能需要更新GlobalKey的列表，比较繁琐；另一方面GlobalKey（被称为）是比较大的开销，还是希望尽量减少GlobalKey的使用。

后来见到了inview_notifier_list这个库 [https://github.com/rvamsikrishna/inview_notifier_list](https://github.com/rvamsikrishna/inview_notifier_list)，有了一些新的想法。

这个库的思路是：给子元素套一个Builder并且绑定一个key，在每次build的时候更新key对应的context，再根据这些context去检测滚动位置。
```
// ...
  Widget build(BuildContext context) {
    return ListView(
      controller: controller,
      children: [
        Builder(
          builder: (context) {
            contextMap[widgetID] = context;
            return widget();
          },
        ),
      ],
    );
  }
// ...

```
原先是维护的GlobalKey的集合，现在直接维护context集合，不需要提前生成，会自动在build时生成context集合，同时也不需要创建大量GlobalKey。感觉这样是更好的思路。