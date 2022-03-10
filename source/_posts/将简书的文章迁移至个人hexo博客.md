---
title: 将简书的文章迁移至个人hexo博客
date: 2022-03-10 15:27:43
tags:
---

最近整了自己的网站，但是看起来有点空荡荡的，那就把简书的东西搬过来吧！

稍微写了个脚本，爬了一下个人页面里的文章然后丢到hexo里

```
const axios = require("axios")
const fs = require("fs")

// 在简书的请求header中复制此处需要的cookie，这会包含用于区分你用户以及登录的信息，具体是哪个字段生效我就没管了（
const cookie = "YOUR COOKIE HERE"

const contentURL = articleID => `https://www.jianshu.com/author/notes/${articleID}/content`

const articleListURL = noteID => `https://www.jianshu.com/author/notebooks/${noteID}/notes`

const notebooksURL = "https://www.jianshu.com/author/notebooks"

const headers = {
  "Accept": "application/json",
  "Cookie": cookie,
}

// 增加hexo专有的文档头，记得把时间弄对
const articleTop = article => {
  const padToTwo = number => number.toString().padStart(2, "0")
  const date = new Date(article.content_updated_at * 1000)
  return `---
title: ${article.title}
date: ${date.getFullYear()}-${padToTwo(date.getMonth() + 1)}-${padToTwo(date.getDate())} ${padToTwo(date.getHours())}:${padToTwo(date.getMinutes())}:${padToTwo(date.getSeconds())}
tags:
---
`
}

// 把图片下载到本地，然后替换掉文章里的链接
const migrateContentImage = content => {
  const imageReg = /\(https\:\/\/upload\-images\.jianshu\.io\/upload_images\/(.+)\?.+\)/g

  const result = Array.from(content.matchAll(imageReg))

  result.forEach(r => {
    downloadImage(r[0], r[1])
  })

  return content.replace(imageReg, (_, p) => "(/images/" + p + ")")
}

const downloadImage = async (src, fileName) => {
  const path = "source/images/" + fileName

  const writer = fs.createWriteStream(path)

  const res = await axios.get(src.slice(1,-1), {
    responseType: "stream",
  })

  res.data.pipe(writer)
}

(async () => {
  const notebooks = (await axios.get(notebooksURL, { headers })).data

  const notes = (await Promise.all(notebooks.map(n => axios.get(articleListURL(n.id), { headers }))))
    .map(n => n.data)
    .reduce((prev, next) => [...prev, ...next], [])

  const articles = (await Promise.all(notes.map(n => axios.get(contentURL(n.id), { headers }))))
    .map((n, index) => ({
      ...notes[index],
      content: n.data.content,
    }))
    .filter(a => a.shared)


  articles.forEach(article => {
    // 去掉非法文件名
    const fileName = article.title.replace(/[\:\\\/\:\*\?\"\<\>\|]/, "_")
    fs.writeFileSync("source/_posts/" + fileName + ".md", articleTop(article) + migrateContentImage(article.content))
  })
})()

```