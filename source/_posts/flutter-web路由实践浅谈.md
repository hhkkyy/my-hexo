---
title: flutter web路由实践浅谈
date: 2022-03-31 10:38:26
tags:
---

flutter web面世已经有一段时间了，一路上也算是经过了官方不少的优化；虽说可能距离实际生产使用还是有一定距离，不过怎么说也可以玩玩。今天就谈谈flutter web某个在官方demo上都表现比较僵硬的问题：路由。

在讨论如何处理flutter web的路由之前，首先要理解app和web对路由处理的本质差异：
在app内，整个路由栈都是由app自己进行存储和控制的，当前未被使用的页面会被缓存，当回退时重新利用。优点自然是对路由有更准确的掌控，并且能保存之前页面的状态。缺点，呃，我感觉比起web模式没什么缺点。

在浏览器里，有一些重要的东西使得app模式变得不可能：浏览器的url栏和前进后退（乃至刷新）操作。这些操作随时可能销毁掉代码中自己存储的路由栈，导致app模式完全不可用。而相应地在浏览器中，路由栈则由浏览器进行存储和控制，业务代码则要负责每个url如何映射到对应的页面、整个应用（可以将fltterweb视为spa）在未初始化的时候如何处理url等。

需要注意的是，某种意义上来说，web模式的路由是app模式路由的子集，是一种牺牲了体验的妥协。换句话来说，我们完全可以在能满足app模式的框架下面，把他退化成web模式。而在flutter中，我们用Navigator2.0的api来实现这一点。

navigator2.0的简单用法如下：
```
class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final delegate = MyRouteDelegate();

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Flutter Demo',
      routeInformationParser: MyRouteParser(),
      routerDelegate: delegate,
    );
  }
}
```
注意到我们引入了两个东西，一个叫routeInformationParser，一个叫routerDelegate，先看这个parser，MyRouteParser是这样一个东西
```
class MyRouteParser extends RouteInformationParser<String> {
  @override
  Future<String> parseRouteInformation(RouteInformation routeInformation) {
    return SynchronousFuture(routeInformation.location!);
  }

  @override
  RouteInformation restoreRouteInformation(String configuration) {
    return RouteInformation(location: configuration);
  }
}
```
这是一个最简单的实现，对于flutter web的场景，需要注意的是RouteInformation的location属性，在官方注释中可以看到这样一段：
```
  /// The location of the application.
  ///
  /// The string is usually in the format of multiple string identifiers with
  /// slashes in between. ex: `/`, `/path`, `/path/to/the/app`.
  ///
  /// It is equivalent to the URL in a web application.
  final String? location;
```
注释声称，location属性在web场景下就对应url，严格来说这么说不太对，location实际上对于的是web场景下url的hash。
我们不详细阐述hash在routeProvider、delegate等等东西内部的层层传递，结论上来说，parseRouteInformation在web内负责解析url，restoreRouteInformation在web内则负责在创建新页面时改变浏览器的url。至于最简单的处理，就是直接把hash原样传来传去。

然后是delegate，delegate具体的写法请参照官网文档，这里强调几个方法：
```
  @override
  Future<void> setInitialRoutePath(String configuration) {
    return setNewRoutePath(configuration);
  }

  @override
  Future<void> setNewRoutePath(String configuration) {
    if(isWeb) {
      _stack
        ..clear()
        ..add(configuration);
      return SynchronousFuture<void>(null);
    }
  }
```
setInitialRoutePath是页面刷新/新开页面时会触发的函数
setNewRoutePath则是直接修改url或者使用浏览器后退、前进时触发的函数。
对于flutter web来说（就我目前的认知），后退、前进和修改地址栏的行为是不可区分的，这或许和flutter使用hash策略有关，如果使用popstate来实现或许可以稍作区分。
因此，一旦触发setNewRoutePath，那么app内部的路由存储就会错乱，这到底是进入了新路由，还是进行了前进或者后退的操作？而解决的方法也很简单，就是直接开摆！
既然分不清那就不分了……反正，他们web就是不分的。

上面的setNewRoutePath的实现中可以看到，在stack中粗暴地直接清空stack然后添加单个新页面。这覆盖了浏览器操作，然后我们要做的就是覆盖flutter内部的函数：
```
  bool _onPopPage(Route<dynamic> route, dynamic result) {
    js.context.callMethod("browserBack");
    return true;
  }

  void push(String newRoute) {
    setNewRoutePath(newRoute);
    notifyListeners();
  }
```
并且在index.html的script内添加：
```
    window.browserBack = () => {
      history.go(-1)
    }
```
这样flutter内部的push和pop也和我们一起摆烂了，改造结束之后，url就不会有app和web的缝合奇怪表现了，特别地，现在也可以点击flutter内部的后退直接后退到之前的其他页面了。