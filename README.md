# hello16｜曾洲宁的成长记录网站

这是一个温柔、可爱、简洁的静态网站模板，适合记录 16 的成长、照片、生日和家人留言。

## 直接预览

双击 `index.html` 就可以在浏览器里打开。

第一版默认访问口令：

```text
hello16
```

注意：这个口令只是前端展示用的“轻量遮挡”，不是真正的服务器级加密。只给家人看时，正式部署建议配合平台的访问保护、Cloudflare Access、Vercel Deployment Protection，或把仓库设为私有后只分享部署地址。

## 后续怎么改内容

主要改 `config.js`。

常见修改：

```js
childName: "曾洲宁",
nickname: "16",
birthDate: "2024-06-01",
passcode: "只有家人知道的口令",
```

## 怎么替换照片

把真实照片放入 `images` 文件夹，然后在 `config.js` 里替换图片路径。

例如：

```js
heroPhoto: "images/cover.jpg"
```

相册里也可以改成：

```js
photos: ["images/day-01.jpg", "images/day-02.jpg"]
```

## 隐私建议

1. 不要公开详细住址、幼儿园、学校、身份证明等信息。
2. 上传照片前，建议去掉照片 EXIF 定位信息。
3. 网站已加入 `noindex, nofollow` 和 `robots.txt`，但这只能降低被搜索引擎收录的概率，不能保证绝对私密。
4. 真正只给家人看，建议启用平台访问保护或密码保护。

## 部署到 Vercel

这个网站是纯静态项目，Vercel 不需要构建命令。

网页端上传：

1. 打开 Vercel Dashboard，新建项目或使用静态站点上传入口。
2. 上传本目录的全部文件，或上传外层生成好的 `hello16_site_vercel.zip`。
3. Framework Preset 选择 `Other`，Build Command 留空，Output Directory 留空。
4. 部署完成后，在项目设置里绑定 `hello16.group`。

CLI 部署：

```powershell
cd D:\code\hello16_site\mnt\data\hello16_site
npm install -g vercel
vercel login
vercel --prod
```

如果是第一次部署，Vercel 会询问项目名称、团队和是否链接已有项目。这个目录里已经包含 `vercel.json`，会给全站响应加上 `X-Robots-Tag: noindex, nofollow`。

## 域名

你想用的域名是：

```text
hello16.group
```

请先到域名注册商确认是否可购买。购买后可把网站部署到 GitHub Pages、Vercel 或 Netlify，再绑定域名。

如果使用 GitHub Pages，本压缩包里已经包含 `CNAME` 文件，内容是 `hello16.group`。
