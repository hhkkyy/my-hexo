---
title: js 中的种子随机和“真随机”
date: 2020-12-28 19:27:25
tags:
---
来扯扯js里的种子随机
想当年刚学编程学c的时候感觉c的随机函数还要指定种子一步一步跳很麻烦——现在写前端写js了，遇到了需要通过种子固定结果的随机，人的一生啊，就是不可以预料。于是就到处找了一下在js里实现用种子随机的方法。

查了一点资料，明白了这个问题的大概情况：其实基本就是js阉割了这个接口（大概）

如果看java的源码可以发现其随机实现是这样的：
```
    protected int next(int bits) {
        long oldseed, nextseed;
        AtomicLong seed = this.seed;
        do {
            oldseed = seed.get();
            nextseed = (oldseed * multiplier + addend) & mask;
        } while (!seed.compareAndSet(oldseed, nextseed));
        return (int)(nextseed >>> (48 - bits));
    }
```
虽然我并不懂java（）但是这里的代码还是基本能看懂的，把这段代码换成数学公式其实就是：
X[n+1] = (a·X[n] + c) mod m
即一个数列的递推公式。这个东西是一种 "伪随机数生成器"（pseudo random number generator，PRNG），特别地，这个形式的PRNG叫线性同余法（linear congruential generator, LCG）。
一般地，一个PRNG要求其具有周期性，并且希望其是均匀分布的。
对于LCG有一个重要的Hull-Dobell定理:
当且仅当
(1) c与m互素
(2) a - 1可以被所有m的质因数整除
(3) 如果m能被4整除，那么a - 1也能被4整除
以上三个条件同时满足时，X是一个周期为m的序列。

（我承认我没彻底搞清楚）不过在js里实现种子随机的思路大概明确了：首先是按照LCG整的如下一段代码：
```
let _seed = initSeed
const seededRandom = _ => {
  _seed = (_seed * a+ b) % m

  return rnd = _seed / m
}
```
然后选取符合啥啥啥定理的三个abm参数就可以了。自然，早有老哥给我们选好了参数：
a=9301
b=49297
m=233280
当然你也可以自己去找参数，不过注意除了要符合Hull-Dobell定理之外，作为随机数生产器，要让m尽量大。

好，那么接下来问题就来了：js自己的random是怎么处理的呢？mdn直接告诉了我们答案
“Math.random() 函数返回一个浮点数,  伪随机数在范围从0到小于1，也就是说，从0（包括0）往上，但是不包括1（排除1），然后您可以缩放到所需的范围。实现将初始种子选择到随机数生成算法;它不能被用户选择或重置。”
哦！源赖氏js本来就有按种子随机的功能，只是他不给你用。
![js，不愧是你](/images/24121227-7ea727cafd2e6332.png)
此外，js中也有类似java中“真随机”的函数，“Crypto.getRandomValues() 方法让你可以获取符合密码学要求的安全的随机值。传入参数的数组被随机值填充（在加密意义上的随机）。”不过既然js主要是前端在用，那么密码学上的安全问题应该是基本用不上的（。