---
title: vscode插件开发(4) server handler
date: 2020-11-23 00:52:10
tags:
---
vscode给出的lsp框架是靠handler运作的。
首先先看看跳转至定义的lsp请求：
请求：
```
{
    "jsonrpc": "2.0",
    "id" : 1,
    "method": "textDocument/definition",
    "params": {
        "textDocument": {
            "uri": "file:///p%3A/mseng/VSCode/Playgrounds/cpp/use.cpp"
        },
        "position": {
            "line": 3,
            "character": 12
        }
    }
}
```
响应
```
{
    "jsonrpc": "2.0",
    "id": "1",
    "result": {
        "uri": "file:///p%3A/mseng/VSCode/Playgrounds/cpp/provide.cpp",
        "range": {
            "start": {
                "line": 0,
                "character": 4
            },
            "end": {
                "line": 0,
                "character": 11
            }
        }
    }
}
```
这里看到是一个textDocument/definition的请求method，携带的参数是文件uri和位置，响应则是一个文件uri和一个range，很好理解这就是一个“点击某文件内的某位置”之后跳转到“另一文件的一个范围”的动作，在vscode里这个动作就是这样的：

```
connection.onDefinition(
  (textDocumentPositon: TextDocumentPositionParams): Definition => {
    // 能从请求中获取的信息
    const documentIdentifier = textDocumentPositon.textDocument;
    const position = textDocumentPositon.position;

    const document = documents.get(documentIdentifier.uri);

    // ...在这里分析语言查找来源

    // 返回一个location，会作为lsp的response
    return Location.create(textDocumentIdentifier.uri, {
        start: { line: 2, character: 5 },
        end: { line: 2, character: 6 }
    });
  }
);
```

lsp的各种请求可以在 https://microsoft.github.io/language-server-protocol/specifications/specification-current/#initialize 看到
vscode的lsp插件也完成了基本所有的message，但是比较迷惑的一件事是vscode好像没给出确切的handler的文档（暂存疑）。不过从lsp官网和vscode的命名可以大致猜出来，问题也不大（。