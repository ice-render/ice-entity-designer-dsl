# 变更日志

本文件记录所有值得注意的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

> 本包是 `ice-entity-designer` 的 JSON DSL 层：多数版本是**跟随上游引擎 / 设计器的 peer 下限**，
> 只有少数版本带功能变更。更早版本的细节见对应的 `git tag` 与提交历史。

## [Unreleased]

> 下一个版本发布前，改动在这里累积。

## [0.0.38] - 2026-09-22

### 变更

- **跟版 `ice-entity-designer 0.12.2`**（`^0.11.0` → `^0.12.2`，devDependency 与 peerDependency 同步）：
  0.x 的 caret 锁的是 minor，`^0.11.0` **吃不到 0.12.x** —— 之前装本包会被顶回设计器 0.11，
  0.12 的增量（虚拟化 / `renderSubtreeTo` 重建产物）一起丢掉。
- 技能卡的运行时引用同步（`ice-entity-designer@^0.2.0` / `ice-render@^2.0.0` / 家族引擎「2.2.0」都是旧写法）。

## [0.0.37] - 2026-09-21

### 变更

- 跟版 `ice-render ^4.2.0` 与 `ice-entity-designer 0.12.x`（依赖与 peer 对齐）；补发布门禁
  `prepublishOnly = npm run verify`（`types:check` + `test` + `build`），避免发布时打包旧产物。

## [0.0.36] - 2026-09-21

### 变更

- lock 对齐 `ice-render 4.1.0` 与 `ice-entity-designer 0.11.0`。

## [0.0.34] - 2026-09-20

### 变更

- `ice-entity-designer` 从 `dependencies` 改为 **peer + devDependency**（`^0.9.1`）——
  同一个设计器实例在宿主里只能有一份，避免"两份副本各持一套类型注册"。

## 更早的版本（一行摘要）

| 版本 | 摘要 |
|---|---|
| 0.0.35 | peer 下限抬到 ice-render ^4.0.0 |
| 0.0.33 | peer 下限抬到 ice-render ^3.0.0 |
| 0.0.32 | peer 下限抬到 ice-render ^2.18.0（事件系统改版） |
| 0.0.31 | peer 下限抬到 ice-render ^2.17.0 |
| 0.0.30 | 依赖 ice-entity-designer ^0.6.0 + peer 下限 ice-render ^2.16.0 |
| 0.0.29 | 七个示例页 OO 化（不含功能变更） |
| 0.0.28 | 依赖对齐 ice-entity-designer 0.4.3 / ice-render 2.12.0 |
| 0.0.27 | 依赖对齐 ice-entity-designer 0.4.2 / ice-render 2.11.2 |
| 0.0.26 | 修掉场景布局把 ICE 当容器传导致的整页崩溃 + 补示例页 e2e |
| 0.0.25 | 依赖对齐 ice-entity-designer ^0.4.0 |
| ≤0.0.24 | 见 `git tag` 与提交历史 |
