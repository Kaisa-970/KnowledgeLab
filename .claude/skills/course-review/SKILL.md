---
name: course-review
description: 独立审查课程叙事、知识连接、事实数学正确性、图片许可和交互效果。在提交新课或重大改稿之前必须使用。
---

# Course Review — 两条相互独立的验收线

必读：`AGENTS.md`、**`docs/LEARNING_EXPERIENCE_CONTRACT.md`**、`docs/LEARNING_DESIGN.md`、`docs/COURSE_STANDARD.md`、`docs/VISUAL_ASSETS.md`、`docs/templates/learning-brief.md`。

## A. 认知效果与叙事审查（不以 CI 代替）

1. **已知/未知**：是否区分真实确认和角色假设？对已掌握基础是否省略或用链接唤醒？
2. **最小闭环**：不读长证明也能看见一个具体矛盾、用新模型解释并预测未示范的变化吗？有正确答案吗？
3. **认知负荷**：同一段是否无必要引入多个数学对象、坐标系和术语？有没有重复比喻/无关知识清单？
4. **渐进路径**：关键公式是否出现在当前需要时？次要代数/实现能否深入查到，而不会阻断主线？有自然退出点？
5. **知识联系**：只保留帮助本次解释的先修、对比与迁移；不为图谱丰富强凑关系。
6. **学习证据分级**：Agent 评估的是“教学设计”，真实理解必须靠学习者自己解释、预测和反馈；没有数据记录**未验证**。

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
| Learner model / assumptions | 已检查/待修改/未检查 | | P0/P1/P2 |
| Minimal loop / cognitive load | ... | | |
| Main/deep path / natural exit | ... | | |
| Unseen transfer check | ... | | |
| Actual learner feedback | 已收集/未验证 | | |
| Narrative | 通过/修改/未检查 | | P0/P1/P2 |
| Knowledge links | ... | | |
| Mathematical truth | ... | | |
| Visual rights and accuracy | ... | | |
| Build and browser | ... | | |

**硬性拒绝**：开篇无有效动机、错误公式、误导图示、将无许可图直接嵌入、虚报测试或版权结论。允许无图、无交互，但必须能交付相应的可验证学习任务；不得以 CI、点击或 Agent 自评宣称读者已经理解。审查范围应与改动风险匹配：新课程和重大改稿执行完整审查；局部修正只复核受影响的叙事、数学、媒介或交互部分，并明确未覆盖项。


状态升级时按 `docs/CONTENT_CONTRACTS.md` 记录报告、审核版本、作者/独立审稿人、覆盖章节与分项结论。局部修复复用已有报告，只更新受影响证据；内容、数学或交互变化使旧结论失效时改回 pending，必要时降为 prototype。不得仅凭文件存在宣称 reviewed。
