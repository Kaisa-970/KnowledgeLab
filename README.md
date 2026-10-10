# KnowledgeLab

**KnowledgeLab 是面向数学、编程、计算机图形学与 AI 的系统化技术学习平台，以自然图文讲解为主，仅在确有价值时加入交互。**

核心目标不是自动生成一篇文章，而是让课程生成 Agent 将学习需求转化为**可阅读、可操作、可验证、可持续迭代**的课程。

> 核心教学体验：从真实问题切入 → 把关键因果机制讲透 → 用准确图与必要公式解释 → 按需深入与迁移。交互不是默认步骤。

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

## 全局课程体系

先回答“这个问题属于哪条知识主线”，而不是自动新增课程。规则见 [Curriculum Contract](docs/CURRICULUM_CONTRACT.md)；可机检规划见 [全局课程知识树](src/content/curriculum/curriculum.json)。现有 5 条主线与 18 个模块，区分已实现课程和规划课程。新增 Course 必须唯一归属 Track/Module；网站课程目录展示规划，章节页显示知识位置。

## 学习体验：先建立可迁移的心智模型

课程可靠性由 Course Contract v2 保证，但学习设计还必须遵循 **[Learning Experience Contract](docs/LEARNING_EXPERIENCE_CONTRACT.md)**：区分学习者已知与假设、围绕一个具体卡点设计最小理解闭环，用最短主路径先帮助读者形成准确的因果模型，再按需深入推导、实现和边界。课程正文可以是自然流畅的技术博客，不强制展示固定栏目。

- [透视校正插值：认知设计示例](docs/examples/perspective-cognitive-design.md)（对应现有课程）
- [VAE 与 Diffusion：认知设计示例](docs/examples/vae-diffusion-cognitive-design.md)（仅设计稿，尚未实现课程）

**边界**：Agent 的设计检查与 CI 不能证明学习者已经理解；无实际反馈时保持“理解效果未验证”。

## 默认教学风格 · 已校准基线

新课程与重大改稿默认执行 **[教学风格基线 v1](docs/TEACHING_STYLE_BASELINE.md)**。参照[生成模型单篇长文](src/content/lessons/generative-from-noise-to-image.mdx)的*讲授方法*：问题自然引入、因果链连续、困难机制解释透、关键原理图数学上可核验、公式不过度遮挡正文、简单内容简述、没有无价值的强制交互。这篇文章获得真实读者 **8.5/10**，评分仅适用于该版本，后续文章不自动继承分数，风格允许随反馈改进。

## 核心教学理念与 Agent Skills

KnowledgeLab **不是带动画的教科书**：先从值得追问的问题、已有解释的不足和认知转折自然引出知识，再用严格推导建立理解，并把概念放回知识网络中。图示与交互都是可选的解释手段；素材查找**优先一手官方/学术资料核验事实**，但图片嵌入必须另外核实版权/授权，无法复用时用可编辑的原创 SVG/数据图代替。

- `docs/LEARNING_DESIGN.md`：问题驱动的叙事、知识连接、教学质量审查；
- `docs/VISUAL_ASSETS.md`：视觉素材来源阶梯、授权核查、原创示意和验收；
- `docs/AGENT_TOOLKIT.md`：Agent 的工具选择与 Skill 路由；
- `.claude/skills/*/SKILL.md`：可被 Claude 类 Agent 读取的五份工作规程，也由 `AGENTS.md` 指引其他 Agent 显式读取；
- `docs/templates/learning-brief.md`、`docs/templates/visual-brief.md`：内部设计记录；
- `docs/examples/fourier-learning-brief.md`：针对已有傅里叶课程的叙事重构示例（**仅设计稿，不是已修改的课程**）。

这些是仓库级规范/Skills，**不是已部署的自治 Agent 服务，也不会自动安装图片检索或生成工具**。

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


## 课程数据协议（v2）

新课程不需要编辑 `src/App.tsx`。增加 `src/content/courses/<id>/course.plan.json`、MDX 和实验契约后，`src/content/registry.ts` 在**构建时**自动注册课程。课程计划是唯一事实来源；`src/content/labs/<id>.lab.json` 包含交互问题、实验不变量、反例及可执行测试索引。

每门课程还需提供课程级 `learning-brief.md`、`knowledge-map.md` 和 `knowledge-map.json`，由计划的 `design` 引用；局部修复复用现有设计。跨课程关系与 `prototype/reviewed/published` 状态证据按 [内容契约](docs/CONTENT_CONTRACTS.md) 校验，校验通过不代表内容已独立审核或获得发布授权。

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
