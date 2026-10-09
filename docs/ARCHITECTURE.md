# Architecture — 从课程样板走向 Agent 工厂

## 当前（Phase 0）

```text
课程元数据 JSON ─┐
MDX 教材─────────┼─> Vite + MDX 编译 ─> React 学习页面
React 交互组件 ──┤
数学纯函数与测试 ┘
```

文件结构：
- `src/content/courses/*/course.plan.json`：课程元数据与知识依赖；
- `src/content/lessons/*.mdx`：课程内容/交互引用；
- `src/components/*`：可复用 UI 与实验；
- `src/math/*`：数学算法纯函数；
- `docs/*`：规范、架构和路线图；
- `AGENTS.md`：所有执行者的根规范。

## 中长期演进（未实现）

```text
学习需求
  ↓
课程规划器 ──> 课程 Schema + 知识依赖图
  ↓
教学/交互设计 ─> Lab Contract（输入、输出、不变量、测试）
  ↓
内容生成器 ──> MDX
组件生成器 ──> TSX / 数学纯函数 / 测试
  ↓
隔离构建及数学校验
  ↓
浏览器交互/视觉检查（回馈修改）
  ↓
人类审核 + PR + CI
  ↓
可发布课程
```

先形成稳定、可审核的目录与交互标准，再引入 Agent SDK / 队列 / 远程运行器。不要在 Phase 0 假设已存在运行后端。

## 架构边界

- **内容与呈现分离**：课程元数据、MDX、组件、算法计算分别存储；同一可视化可复用。
- **计算与绘制分离**：SVG/Canvas/WebGL 使用数学模块计算的同一数据，不复制公式。
- **MDX 信任边界**：MDX 可执行 JS/JSX；只能编译可信仓库中经过检查的课程。对用户或 Agent 的即时生成结果，未来使用独立沙箱/预览服务及发布审批，**不能**直接在主应用动态 evaluate。
- **领域按需演进**：二维交互首先使用 SVG；需要 3D 相机、几何或场景时再加入 Three.js；编程执行采用隔离浏览器/服务端沙箱。
- **可追溯版本**：生成计划、引用来源、课程修订与测试报告应关联到 git commit。
- **可访问性/性能**：控制输入优先使用标准 HTML，页面主路径适配桌面/移动端，限制交互帧更新开销。

## 安全、版权与事实正确性

不编译未审核的第三方 MDX；不将私钥注入生成器容器；不运行未经隔离的用户提交程序；不自动抓取并复现受限教材内容；来自论文的时效性声明必须可追踪。

## 技术债与未来决策

- **历史状态（Phase 0）**：初始内容硬编码在 `src/App.tsx`；Phase 0.5 已改为基于可信文件的构建时路由注册。
- 数据采用简单 JSON，未来再增加 Schema 校验和知识图数据库。
- 尚无可视化 E2E 测试、课程审核 UI、Agent 服务、生产部署。
- 第一次交互原型用 SVG，后续选择统一坐标/可视化工具时应保留现有正确性测试。


## Phase 0.5：机器可校验的课程协议（已在特性分支实现）

- `schemas/course-plan.schema.json`、`schemas/lab.schema.json` 声明生成产物的数据形状。
- `scripts/validate-content.mjs` 枚举课程并校验 JSON Schema、知识节点依赖环、章节引用、实验引用、MDX/TSX/计算模块与测试 oracle 的存在。`scripts/validate-content.test.mjs` 故意输入错误数据验证拒绝能力。
- `src/content/registry.ts` 使用 Vite `import.meta.glob` 构建时收集受信任的本地 `course.plan.json` 和 `.mdx`，在 URL `/courses/:course/:chapter` 查找章节；`App.tsx` 不再维护课程列表。
- `e2e/matrix-lab.spec.ts` 通过 Playwright 验证预设/滑块对数值与 SVG 结果的影响，并检查移动浏览器视口。
- `.github/workflows/ci.yml` 依次执行协议校验、类型检查、数值测试、构建和浏览器交互测试；工作流权限仅 `contents: read`。

**安全现状**：CI 仍会执行 PR 中的 npm 脚本和代码，因此这不是将任意不可信 TSX/MDX 当成安全输入的沙箱。真正的自动生成执行器上线前，必须使用独立、最小权限、限制网络和资源的沙箱，并阻止无审核产物进入生产构建。

**质量现状**：Schema 与引用检查不检验推导的数学真值，Playwright 也不证明课程教学效果；独立的数学/内容审查以及对知识的实际理解测试仍需人工或专门的评估流程。
