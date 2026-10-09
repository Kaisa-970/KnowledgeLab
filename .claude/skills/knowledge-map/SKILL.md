---
name: knowledge-map
description: 建立课程知识定位、先修依赖、概念对比与跨领域连接。新建概念、扩展课程体系、用户询问知识树位置时使用。
---

# Knowledge Map — 将碎片连接为网络

必读：`docs/LEARNING_DESIGN.md`、`docs/templates/learning-brief.md`、当前和相关课程的 `course.plan.json`。

## 过程

1. 确认正在讨论的是 `Course`（课程）、`Lesson`（教学单元）还是 `Concept`（知识概念），不能混作一个 ID。
2. 检索现有的概念和章节。避免重建同义概念；必须要引入新节点时说明其与已有节点的边界。
3. 至少给出：上游知识及具体需要的能力、一个同层连接/比较、一个可迁移应用；有证据不足时明确不写。
4. 对每条关系选择类型：`prerequisite`、`derives-from`、`generalizes`、`contrasts-with`、`same-principle`、`applied-in`，写明**理由与使用范围**。不要把所有箭头都写成先修关系。
5. 只有前置依赖进入现有 `knowledgeNodes.dependsOn` 和 `dependsOnChapterIds`；比较/应用等关系保留在 Learning Brief/课程正文，直到 schema 正式扩展。
6. 以一个桥接解释或复用问题帮助学习者从已学知识走向新概念，不只贴标签。

## 质量门槛

- 全部依赖无环、ID 不冲突，`npm run validate` 通过。
- 一条连接至少回答：**为什么相连？哪里相同？什么条件下不同？**
- 课程“下一步”能由当前问题自然引出，而不是随机推荐下一篇。
- 不假装现有仓库已提供跨课程全局知识图数据库。

## 示例

协方差矩阵 → 特征分解 → PCA 与局部点云平面拟合：PCA 用最大特征值方向寻找数据主轴；局部平面法线用最小特征值方向寻找变化最小的方向。共同数学底座，不同优化目标。

## 输出

`Knowledge Map` 表格（节点、关系、理由、先修状态）、需要修改的课程依赖与正文中的桥接段落、未确定关系清单。

