const axios = require("axios")
const fs = require("fs")

const cookie = '_ga=GA1.2.2076303826.1598800911; UM_distinctid=17c4af57c6e91f-05e70d0dbd3e59-b7a1b38-240000-17c4af57c6f99d; _gid=GA1.2.1481079163.1646707034; web_login_version=MTY0NjgxMTI1MA%3D%3D--9059aa6ded7c222abade15c9f021a99db01643da; remember_user_token=W1syNDEyMTIyN10sIiQyYSQxMSRXMm5SSUVEVXVCWnouLktHT2F6YXRlIiwiMTY0Njg4MTY3MC44MDY2MjM3Il0%3D--46db67649a78caed4cf907f3eb56a3cab7eb766d; read_mode=day; default_font=font2; locale=zh-CN; _m7e_session_core=4f0b65ced6ae297de9640860611f516f; CNZZDATA1279807957=629062401-1633335588-https%253A%252F%252Fwww.baidu.com%252F%7C1646877797; Hm_lvt_0c0e9d9b1e7d617b3e6842e85b9fb068=1646811167,1646811577,1646814537,1646881709; sensorsdata2015jssdkcross=%7B%22distinct_id%22%3A%221743ff5db5da06-08900fe1a69cee-3323766-2359296-1743ff5db5e38f%22%2C%22first_id%22%3A%22%22%2C%22props%22%3A%7B%22%24latest_traffic_source_type%22%3A%22%E7%9B%B4%E6%8E%A5%E6%B5%81%E9%87%8F%22%2C%22%24latest_search_keyword%22%3A%22%E6%9C%AA%E5%8F%96%E5%88%B0%E5%80%BC_%E7%9B%B4%E6%8E%A5%E6%89%93%E5%BC%80%22%2C%22%24latest_referrer%22%3A%22%22%7D%2C%22%24device_id%22%3A%221743ff5db5da06-08900fe1a69cee-3323766-2359296-1743ff5db5e38f%22%7D; Hm_lpvt_0c0e9d9b1e7d617b3e6842e85b9fb068=1646882763'

const contentURL = articleID => `https://www.jianshu.com/author/notes/${articleID}/content`

const articleListURL = noteID => `https://www.jianshu.com/author/notebooks/${noteID}/notes`

const notebooksURL = "https://www.jianshu.com/author/notebooks"

const headers = {
  "Accept": "application/json",
  "Cookie": cookie,
}

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
    const fileName = article.title.replace(/[\:\\\/\:\*\?\"\<\>\|]/, "_")
    fs.writeFileSync("source/_posts/" + fileName + ".md", articleTop(article) + migrateContentImage(article.content))
  })
})()
