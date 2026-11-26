# Tools

Small browser tools hosted on GitHub Pages.

## 访问地址

```text
https://bole-sunyi.github.io/tools/
```

## 工具列表

| 工具 | 路径 |
| --- | --- |
| 工具首页 | `/` |
| 历史反馈风险提示 | `/risk-alert/` |
| Ultimate Survivor 活动计算器 | `/ultimate-survivor/` |
| Mod 取模计算器 | `/mod-calculator/` |
| 游戏时间转换 | `/game-time-converter/` |
| 时间戳转换 | `/timestamp-converter/` |
| 进制转换 | `/radix-converter/` |
| 发布更新内容生成 | `/release-update-helper/` |
| 手机传文件 | `/phone-transfer/` |

## 手机传文件

电脑打开 `/phone-transfer/` 后会生成二维码。手机扫码选择文件，文件通过 WebRTC 点对点传给电脑浏览器，无需安装程序或运行本地服务。Chrome / Edge 可以选择桌面目录直接保存；其他浏览器会使用默认下载方式。

## 游戏时间转换说明

以北京时间为输入基准：

- **夏令时跨天服**：早上 9:00 跨天（慢 3 小时）、下午 18:00 跨天（快 6 小时）
- **冬令时跨天服**：早上 10:00 跨天（慢 2 小时）、下午 19:00 跨天（快 7 小时）
- **正式服时间**：
  - 夏令时（EDT）：比北京时间慢 12 小时
  - 冬令时（EST）：比北京时间慢 13 小时（例：北京 24 日 12:00 → 23 日 23:00）

CF 与 MT 项目使用相同的时间换算规则。

## 历史反馈风险提示

按关键词、功能别名和机制模糊检索指定反馈表。公开页面不包含问题原文；需导入可信的私有 JSON 快照，或连接授权只读服务。支持 Excel（XLSX / XLS / CSV）、截图 OCR、DOCX、文本 PDF、TXT 和 MD。上传后自动解析并匹配，解析内容可按文件核对和编辑；结果分为历史问题与重点关注两个页签。每条结果引用工作表与行号，不生成无依据风险。不自动同步或修改钉钉；服务配置与限制见 [部署说明](risk-service/README.md)。
