# 图拉Tula

macOS 上的本地图片压缩工具。压缩在这台电脑上完成，图片不会上传。

支持 JPEG、PNG、WebP 和 GIF。可以把文件或文件夹放进队列，按预设批量压缩。结果写在原图旁边的 `compressed` 文件夹里，不会覆盖原图。

## 环境

- macOS
- Node.js
- pnpm 10

## 开发

```bash
pnpm install
pnpm dev
```

```bash
pnpm test
pnpm typecheck
```

## 打包

```bash
pnpm dist
```

会在 `release` 目录生成两个未签名的安装包：

- `图拉Tula-0.1.0-arm64.dmg`：Apple 芯片
- `图拉Tula-0.1.0.dmg`：Intel

打开时系统会提示无法验证开发者。在访达中右键安装包或应用，选择「打开」。
