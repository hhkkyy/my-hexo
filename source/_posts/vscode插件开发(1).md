---
title: vscode插件开发(1)
date: 2020-10-26 01:04:32
tags:
---
这期从最简单的hello world(其实就是实例代码)开始
vscode插件开发现在有非常方便的脚手架工具，直奔主题地：
```npm install -g yo generator-code```
安装这两个依赖，然后使用官方的脚手架工具
```yo code```
会自动生成一个带hello world的demo插件工程。直接f5就可以运行了。vscode会打开一个新的窗口专门给这个插件调试用，ctrl+shift+p之后可以输入指令hello world，就会弹出一个hello world的提示。

![![MHTM{$GLF6EASMRY)3O9A}K.png](/images/24121227-a019be2a9d94e12e.png)
](/images/24121227-95ee51ce0707699d.png)

那么这个项目的代码和vscode干了什么呢？首先看vscode看了什么：
f5之后vscode会生成.vscode文件夹，会有extensions.json launch.json settings.json tasks.json四个文件。这些文件会规定vscode在f5的时候干些什么，总的来说就是干两件事：
第一件是运行yarn run compile，这会在根目录下生成一个out/的文件夹，其中是项目的编译结果
另一个就是打开一个新的专门给插件用的vscode窗口，并且在这个窗口中启用项目的插件

再看代码本身：代码逻辑在src/extension.ts中：
```
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "my-plugin" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('my-plugin.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from my-pluginmmm!');
	});

	context.subscriptions.push(disposable);
}
```
具体的api暂且不说，可以直观地看到是注册了一个指令叫'my-plugin.helloWorld',当输入这个指令时会弹出一个提示。那么这个指令的名字是怎么和“hello world”对应的呢？这就是在package.json中可以看到的设置：
```
	"activationEvents": [
        "onCommand:my-plugin.helloWorld"
	],
	"main": "./out/extension.js",
	"contributes": {
		"commands": [
			{
				"command": "my-plugin.helloWorld",
				"title": "Hello World"
			}
		]
	},

```
可以看到activationEvents中规定了一个事件：onCommand:my-plugin.helloWorld。onCommand表示命令激活，也就是从ctrl shift p进入的时候激活的（当然还有别的激活方式）。下面则有对命令的具体定义，可以看到my-plugin.helloWorld有一个title Hello World也就是在指令菜单中实际输入/看到的那个名字。输入Hello World会触发my-plugin.helloWorld指令，而这个指令的事件则定义在extension.ts中，可以看到这样整个逻辑就捋通了。