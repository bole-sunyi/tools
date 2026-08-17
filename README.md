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
