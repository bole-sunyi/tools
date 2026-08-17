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
| 手机传文件 | `/phone-transfer/`（需运行本地 Node.js 服务） |

## 手机传文件

该功能由 GitHub Pages 页面和电脑本地接收服务配合使用。电脑端在仓库根目录执行：

```bash
npm install
npm run start:phone-transfer
```

然后打开 `http://localhost:8787/desktop.html` 生成二维码。手机和电脑连接同一 Wi‑Fi 后扫码选择文件，文件会保存到电脑桌面。首次运行 Windows 防火墙提示时，请允许 Node.js 访问专用网络。

## 游戏时间转换说明

以北京时间为输入基准：

- **夏令时跨天服**：早上 9:00 跨天（慢 3 小时）、下午 18:00 跨天（快 6 小时）
- **冬令时跨天服**：早上 10:00 跨天（慢 2 小时）、下午 19:00 跨天（快 7 小时）
- **正式服时间**：
  - 夏令时（EDT）：比北京时间慢 12 小时
  - 冬令时（EST）：比北京时间慢 13 小时（例：北京 24 日 12:00 → 23 日 23:00）

CF 与 MT 项目使用相同的时间换算规则。
