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

## 游戏时间转换说明

以北京时间为输入基准：

- **9 点跨天（夏令时 · 早上 9:00）**：比北京时间慢 3 小时（例：北京 24 日 12:00 → 24 日 09:00）
- **6 点跨天（下午 18:00）**：比北京时间快 6 小时（例：北京 24 日 12:00 → 24 日 18:00）
- **正式服时间**：
  - 夏令时（EDT）：比北京时间慢 12 小时
  - 冬令时（EST）：比北京时间慢 13 小时（例：北京 24 日 12:00 → 23 日 23:00）

CF 与 MT 项目使用相同的时间换算规则。
