---
name: course-review
description: 独立审查课程叙事、知识连接、事实数学正确性、图片许可和交互效果。在提交新课或重大改稿之前必须使用。
---

# Course Review — 两条相互独立的验收线

必读：`AGENTS.md`、`docs/LEARNING_DESIGN.md`、`docs/COURSE_STANDARD.md`、`docs/VISUAL_ASSETS.md`、`docs/templates/learning-brief.md`。

## A. 教学/叙事审查（不以 CI 代替）

1. 删除交互与公式，只读首尾、转折和过渡：是否能重建“问题 → 现有方法不足 → 新概念 → 机制 → 回扣/迁移”？
2. 每个新概念是否有必要性解释？反例是否解释认识局限？
3. 检查知识位置：先修、类比/比较、应用是否有具体关系理由，不是一串空标签。
4. 学习者能否用心智模型预测一个**未直接示范**的情境？是否有可评估答案？
5. 图示是否真的回答学习疑问？没有任何图的课程是否同样可读？

## B. 数学与工程审查（不以主观觉得好学代替）

1. 独立检查定义域、变量、形状、单位、端点和极限条件；必要时用不同算法交叉验证。
2. 核对文本、绘图代码、数学 oracle 是否使用一致的假设；测试本身可能共享相同错误。
3. 针对反例与高风险命题（如 Gibbs、收敛、概率独立性）专门寻找否定输入。
4. 若复用了外部图片，核对一手 URL、确切授权、修改记录、alt/caption；无授权退回链接或原创图。
5. 在真正可用的环境执行 `npm run validate`、`npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e`；没有执行就写“未验证”。
6. 比较 `course.plan.json`、Learning Brief 与最终章内容是否保持一致。

## 报告格式

| 检查项 | 结论 | 证据 / 具体问题 | 严重程度 |
| --- | --- | --- | --- |
| Narrative | 通过/修改/未检查 | | P0/P1/P2 |
| Knowledge links | ... | | |
| Mathematical truth | ... | | |
| Visual rights and accuracy | ... | | |
| Build and browser | ... | | |

**硬性拒绝**：开篇无有效动机、错误公式、误导图示、将无许可图直接嵌入、虚报测试或版权结论。允许无图、无交互，但必须能交付相应的可验证学习任务。

