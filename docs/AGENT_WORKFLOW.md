# Agent 课程生产流水线（v0.1）

这里描述**目标流程与当前手工执行规则**。仓库目前没有自治 Agent 后端，不得将其当成已经实现的功能。

## 角色 / 逻辑阶段

1. **Planner**：接收需求，产出课程大纲、先修图、目标、每节疑问与验收口径。
2. **Instruction Designer**：为每个概念选择合适的直觉模型、可见变量、反例与实验方案。
3. **Author**：编写准确的 MDX 叙述、定义、公式、推导与自测。
4. **Lab Developer**：复用组件优先，必要时创建新组件并分离纯计算模块。
5. **Verifier**：验证数学与代码行为、交互逻辑、可访问性、内容一致性。
6. **Publisher / Maintainer**：更新目录，记录验证范围；经审核再发布；支持局部修改。

早期这些角色可以由同一个编码 Agent 顺序承担；不用立即开发多 Agent 基础设施。

## 工作过程

### Step 1 — 读上下文

先检查 `AGENTS.md`、课程规范、现有章节与组件，确定目标难度、默认教学语言、领域和约束。禁止忽略已有知识图与重复建造组件。

### Step 2 — 在需要时先写 Knowledge Map 与 Learning Brief，再给课程计划

对新课程、改变课程主线的重大改稿，或新增跨章节知识连接，先读取 §.claude/skills/learning-journey/SKILL.md§ 和 §.claude/skills/knowledge-map/SKILL.md§，形成内部 Learning Brief（起点、认知冲突、转折、新概念出现理由、回扣）和 Knowledge Map（先修、横向关系、应用及原因）；再产出课程计划。局部修正、测试修复和视觉/实现调整可复用已有设计，不要求重新生成整套工件。**是否交互由认知问题决定**，可使用 §coreTask§；计划缺失时不直接生成大量 MDX。

知识关系必须区分：现有 schema 的 §dependsOn§ 是“先修依赖”，§same-principle§ / §contrasts-with§ / §applied-in§ 等横向或下游联系暂记在 Learning Brief，不能谎称已有全局图谱。

### Step 3 — 单节纵向切片

先交付一个**自然叙事、包含必要推导与可验证学习任务**的章节（根据需要可加静态图/交互），而不是一次生成 20 篇空洞内容。完成样板并通过教学、数学、素材审核，再扩充课程。

### Step 4 — 实现与测试

- MDX **即使不加载交互仍然具有完整因果叙事**，公式应在解释问题所需时出现；组件独立命名并具有准确类型。
- 为每个要配图的认知障碍执行 §visual-research§，按 §docs/VISUAL_ASSETS.md§ 区分事实可信性和复用权利；不明授权只引用链接或独立自绘。需自绘时执行 §diagram-authoring§，校验几何、算法与移动端显示。
- 数学公式通过统一工具渲染；纯计算逻辑至少覆盖基本、边界与退化输入。
- 对非平凡实验，附可检验的不变量与一个明确的 oracle。
- 如果需要引用最新技术结论，优先用论文/原始文档，注明查证日期。

### Step 5 — 复核与发布

明确区分：
- **Static checked**：规范、公式和代码静态检查；
- **Build verified**：类型检查、自动测试与构建实际成功；
- **Interaction inspected**：浏览器中的操作结果和响应式检查；
- **Content reviewed**：数学推导、Learning Narrative、知识连接、视觉来源/授权与教学逻辑被独立校核；
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

先依据 docs/LEARNING_DESIGN.md 形成内部 Learning Brief（动机、认知障碍、发现过程、回扣）和 Knowledge Map（先修、对比、迁移与具体理由），再返回课程计划。
经计划阶段确认后，一次实现一节自然叙事、保留必要证明/实现、具有可验证学习任务的 MDX 课程。可用交互 Lab，也可用有根据的 coreTask，不能强迫每节有动画。
每一张图片/示意必须回答学习疑问，按 docs/VISUAL_ASSETS.md 调研一手事实、查明再发布授权；需要操作变量时才制作交互，说明输入如何影响输出。
不要跳过数学或运行时细节；不要杜撰事实、来源或测试结果。
输出文件改动、实际执行的验证、未完成项；不可宣称未执行的检查已通过。
```

## 各阶段 Skill 调用（未提供自动 Agent 服务）

按 §docs/AGENT_TOOLKIT.md§ 执行路由：§learning-journey§ / §knowledge-map§ → （需要素材时）§visual-research§ 或 §diagram-authoring§ → §course-review§。Skill 文件位于 §.claude/skills§；没有自动发现机制的 Agent 应在开工前主动读取。**Skills 是明确的操作规范，并不意味着图片检索、网络下载、图像生成等工具已接入。**

新课程和重大改稿至少提供：叙事设计摘要、知识连接、实际视觉素材的权利记录（若有），以及独立于构建测试的教学质量检查。局部改动只需说明复用的设计依据和受影响范围。最终 PR 报告必须写明工具不可用/未完成验证的地方。

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
