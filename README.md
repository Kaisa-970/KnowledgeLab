# KnowledgeLab

**KnowledgeLab 是面向数学、编程、计算机图形学与 AI 的 AI-native 交互式学习平台。**

核心目标不是自动生成一篇文章，而是让课程生成 Agent 将学习需求转化为**可阅读、可操作、可验证、可持续迭代**的课程。

> 核心教学体验：先看见现象 → 动手改变条件 → 发现规律 → 理解数学/代码机制 → 迁移到真实问题。

## 当前状态

**Phase 0：基础工程 + 第一节人工校准的示范课程。** 本仓库尚未接入自动课程生成 Agent；现有 MDX 内容及实验用于明确未来 Agent 的输出质量基准，不应宣传为已经支持一键自动生成课程。

已包含：
- `AGENTS.md`：所有课程/代码 Agent 必须遵循的项目级约束；
- `docs/COURSE_STANDARD.md`：课程结构、质量标准和交互设计；
- `docs/AGENT_WORKFLOW.md`：生成/修改/验证/发布流水线；
- `docs/ARCHITECTURE.md`：当前实现、扩展边界和安全边界；
- `docs/ROADMAP.md`：按质量关卡推进的路线图；
- `src/content/lessons/linear-transformations.mdx`：矩阵与线性变换示范；
- `src/components/MatrixTransformLab.tsx`：可拖动基向量、调整矩阵元素的互动实验。

## 本地启动

要求 Node.js 22+ 与 npm。

```bash
npm install
npm run dev
```

打开终端提供的本地地址。

```bash
npm run typecheck
npm test
npm run build
```

## 技术选型

- Vite + React + TypeScript：课程网站与交互运行时
- MDX：文字、公式、React 实验组件的组合
- KaTeX（remark-math + rehype-katex）：数学公式渲染
- SVG：首个二维线性代数实验
- 后续按需引入 Three.js、代码沙箱、课程 Schema/生成器

## 推荐阅读顺序

1. `docs/PRODUCT.md` — 产品边界与设计原则
2. `AGENTS.md` — Agent 不可违反的行为规范
3. `docs/COURSE_STANDARD.md` — 一节合格课程长什么样
4. `docs/AGENT_WORKFLOW.md` — Agent 如何交付并自检
5. `docs/ARCHITECTURE.md` — 技术设计与未来扩展
6. `docs/ROADMAP.md` — 逐步实施的优先级

## 重要约束

用户可调整教学目标与偏好，但 Agent 不得凭空捏造定理、证明、实验结果、来源或通过状态。交互必须服务于理解，不能以装饰性动画替代因果解释。未通过数学/代码/交互验证的内容不得标记为“已完成”。

## License

尚未选择开源许可证；在明确授权前不要自动添加许可证文件。


## 课程数据协议（v1）

新课程不需要编辑 `src/App.tsx`。增加 `src/content/courses/<id>/course.plan.json`、MDX 和实验契约后，`src/content/registry.ts` 在**构建时**自动注册课程。课程计划是唯一事实来源；`src/content/labs/<id>.lab.json` 包含交互问题、实验不变量、反例及可执行测试索引。

```bash
npm run validate     # JSON Schema + 课程/实验依赖、文件和测试引用校验
npm run typecheck
npm test             # 数学 + 校验器的反例测试
npm run build
npx playwright install chromium
npm run test:e2e     # 桌面与移动浏览器交互测试
```

详情见 `docs/CONTENT_CONTRACTS.md`。当前浏览器检查由 CI 提供，但人工的教学质量审核尚未自动化。运行时不编译模型生成的任意 MDX。

> 注意：提交中的 `course.plan.json` 和 `lab.json` 只在 **schema / 引用**层面可机检，数学语义依旧需要独立数值验证与审阅。
