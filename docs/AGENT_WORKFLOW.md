# Agent 课程生产流水线（v0.1）

这里描述**目标流程与当前手工执行规则**。仓库目前没有自治 Agent 后端，不得将其当成已经实现的功能。

## 角色 / 逻辑阶段

1. **Cognitive Designer / Planner**：先识别已有心智模型、具体理解障碍和期望深度，设计最短理解闭环；随后产出课程大纲、先修图与验收口径。
2. **Instruction Designer**：为每个概念选择合适的直觉模型、可见变量、反例与实验方案。
3. **Author**：编写准确的 MDX 叙述、定义、公式、推导与自测。
4. **Lab Developer**：复用组件优先，必要时创建新组件并分离纯计算模块。
5. **Verifier**：验证数学与代码行为、交互逻辑、可访问性、内容一致性。
6. **Publisher / Maintainer**：更新目录，记录验证范围；经审核再发布；支持局部修改。

早期这些角色可以由同一个编码 Agent 顺序承担；不用立即开发多 Agent 基础设施。

## 工作过程

### Step 0 — 先定位已有课程体系

按 `docs/CURRICULUM_CONTRACT.md` 检索 Track/Module/Course/Concept 与已有/规划章节；决定是直接解释、修章节、扩章节、加跨学科连接还是确需新课程。先说明知识位置。**任何新术语不自动获得独立 Course ID**；新课程必须解释现有课程为何不适合、长期范围和主归属。

### Step 1 — 读上下文

先检查 `AGENTS.md`、`docs/LEARNING_EXPERIENCE_CONTRACT.md`、已有章节与组件。区分确认已知、暂时假设、当前卡点和本次目标；不得仅凭“中级开发者”标签推断知识掌握，未知状态标注假设。

### Step 2 — 先设计最小理解闭环，再写 Learning Brief / Knowledge Map 与课程计划

对新课程、改变课程主线的重大改稿，或新增跨章节知识连接，先读取 `.claude/skills/learning-journey/SKILL.md` 和 `.claude/skills/knowledge-map/SKILL.md`，先选择一个可预测的最小例子、写出 Core Insight 和自然退出点；据此形成 Learning Brief（主路径、原理/边界展开与认知压力风险）及 Knowledge Map（真正有帮助的知识桥梁），最后产出课程计划。局部修正、测试修复和视觉/实现调整可复用已有设计，不要求重新生成整套工件。**是否交互由认知问题决定**，可使用 `coreTask`；计划缺失时不直接生成大量 MDX。

知识关系必须区分：现有 schema 的 `dependsOn` 是“先修依赖”，`same-principle` / `contrasts-with` / `applied-in` 等横向或下游联系记录在课程级 `knowledge-map.json`，使用 `{courseId, conceptId}` 端点。机器可校验引用，不代表已有知识网络页面。

### Step 3 — 单节纵向切片

先交付一个**短主路径 + 未演示变式预测 + 自然退出点**的章节；原理/实现/边界可在后面按需深入，而不是一次生成 20 篇空洞内容。完成样板并通过教学、数学、素材审核，再扩充课程。

### Step 4 — 实现与测试

- MDX 的主路径应像准确、通俗的技术博客，**即使不加载交互仍有完整因果叙事**。核心公式在需要时出现；不因内容覆盖率过度展开已知基础或长证明。组件独立命名并有准确类型。
- 为每个要配图的认知障碍执行 `visual-research`，按 `docs/VISUAL_ASSETS.md` 区分事实可信性和复用权利；不明授权只引用链接或独立自绘。需自绘时执行 `diagram-authoring`，校验几何、算法与移动端显示。
- 数学公式通过统一工具渲染；纯计算逻辑至少覆盖基本、边界与退化输入。
- 对非平凡实验，附可检验的不变量与一个明确的 oracle。
- 如果需要引用最新技术结论，优先用论文/原始文档，注明查证日期。

### Step 5 — 复核与发布

明确区分：
- **Static checked**：规范、公式和代码静态检查；
- **Build verified**：类型检查、自动测试与构建实际成功；
- **Interaction inspected**：浏览器中的操作结果和响应式检查；
- **Content reviewed**：数学推导、Learning Narrative、知识连接、视觉来源/授权与教学逻辑被独立校核；还须检查学习者假设、最小理解闭环、认知负荷和迁移预测，且不能把自检当作真实学习者已理解；
- **Published**：审核后推送到公开课程目录/部署环境。

绝不可将其中一项代替其他项。当前项目没有实际部署地址。

## Prompt 模板（用于未来生成器）

```text
你是 KnowledgeLab 的课程生产 Agent。
严格遵循仓库 AGENTS.md、docs/COURSE_STANDARD.md 与 docs/AGENT_WORKFLOW.md。
任务：{topic}
目标读者：{audience}
期望深度：{depth}
已学基础：{prerequisites}
必须覆盖：{must_cover}

先依据 docs/CURRICULUM_CONTRACT.md 定位已有知识/复用课程，再依据 docs/LEARNING_EXPERIENCE_CONTRACT.md 确认学习者已有模型、本次卡点和期望深度，设计最小理解闭环；再形成 Learning Brief、Knowledge Map 与课程计划。
经计划阶段确认后，先写一条短而可独立读完的主路径与迁移预测，再补深入证明/实现和边界，而不是一次展示全部正确内容。可用交互 Lab，也可用有根据的 coreTask，不能强迫每节有动画。
每一张图片/示意必须回答学习疑问，按 docs/VISUAL_ASSETS.md 调研一手事实、查明再发布授权；需要操作变量时才制作交互，说明输入如何影响输出。
不要跳过数学或运行时细节；不要杜撰事实、来源或测试结果。
输出文件改动、实际执行的验证、未完成项；不可宣称未执行的检查已通过。
```

## 各阶段 Skill 调用（未提供自动 Agent 服务）

按 `docs/AGENT_TOOLKIT.md` 执行路由：`learning-journey` / `knowledge-map` → （需要素材时）`visual-research` 或 `diagram-authoring` → `course-review`。Skill 文件位于 `.claude/skills`；没有自动发现机制的 Agent 应在开工前主动读取。**Skills 是明确的操作规范，并不意味着图片检索、网络下载、图像生成等工具已接入。**

新课程和重大改稿至少提供：叙事设计摘要、知识连接、实际视觉素材的权利记录（若有），以及独立于构建测试的教学质量检查。局部改动只需说明复用的设计依据和受影响范围。最终变更报告必须写明工具不可用/未完成验证的地方，且不得虚报学习者理解程度。

## 局部迭代

当用户要求“加强 PCA 第四节协方差的几何意义”时：定位相应章节及其组件 → 明确具体认知障碍 → 增加/修改相应实验和解释 → 运行相关测试 → 仅更新依赖受影响的目录及课程索引。不要重新生成整门课程或破坏已有进度。

## 安全闸门

未来 Agent 生成的 TSX/MDX 代码必须在隔离环境中验证，不可把不可信代码直接提交部署。令牌、私有内容与沙箱权限需要隔离；外部内容与模型输出一律视为不可信。设置执行时间、CPU/GPU 和网络限制，先产出候选 PR 而非无审核上线。


## 已落地的机器门禁（Phase 0.5）

1. `course.plan.json`：课程目标、知识节点依赖、章节问题和资源引用，采用 `schemas/course-plan.schema.json`。
2. `<lab-id>.lab.json`：实验预测、控件、可观察输出、不变量、边界与 oracle 绑定，采用 `schemas/lab.schema.json`。
3. `npm run validate`：自动发现课程、检查 Schema 与跨文件引用、环与 oracle 测试名字；无效产物不能通过 CI。
4. `npm test`：校验器的失败用例与独立编写的数学计算测试；不能用空 testName 或模型自称通过来替代实际 oracle。
5. `npm run test:e2e`：在 Chromium 桌面和移动视口检查页面/预设/滑块/可访问性基础路径。
6. **人工审查仍为必要阶段**：检查数学推导、实验是否促进理解、视觉体验和版权引用。

自动 Agent 仍未接入，不应误读本节为“已经有自治 Agent”。现阶段的 CI 只在可信 PR 开发流程中使用，并非不可信代码沙箱。
