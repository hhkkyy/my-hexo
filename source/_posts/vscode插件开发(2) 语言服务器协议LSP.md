---
title: vscode插件开发(2) 语言服务器协议LSP
date: 2020-11-02 16:04:47
tags:
---
LSP（language sever protocol）是用来处理语言解析等等东西在各式ide里应用的玩意。ide主要干的活还是要提供各类语言的解析跳转高亮等等等等的东西，所以lsp就显得很重要。放两张图就能大概理解LSP是具体干什么的，为什么需要LSP。
![LSP](/images/24121227-a7eed152849c4976.png)
LSP主要解决了几个问题：
1、语言插件的复用。举个例子：Eclipse里C++相关的支持是用java写的，原因很简单：eclipse本身是java写的。但是这样如果要在vscode里面写C++那就又得拿js写一遍，相当于重复造了轮子。
2、进程独立。语言解析这件事本身是很重的，有时候会需要花非常长的时间来完成。比如我在vscode里写flutter的时候就经常能看到插件花很长时间解析，要是这时候整个vscode都卡住那就别玩了。所以干脆把这块东西单独抽出来放在服务器上。
LSP现在支持的功能大概如下
![盗个图](/images/24121227-139e5492f5fb1900.png)
所以实际上在涉及各种语言解析的时候，插件需要起一个server来处理，文件夹大体上就会长这样
```
├── client // 语言客户端
│   ├── package.json
│   ├── src
│   │   ├── test // 单元测试文件
│   │   └── extension.js // 语言客户端的入口文件
├── package.json // 插件的描述文件
└── server // 语言服务端
    └── package.json
    └── src
        └── server.js // 语言服务端的入口文件
```
具体的业务逻辑主要会在server里面实现