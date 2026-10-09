# KnowledgeLab 内容契约 v1

这是机器可读的课程生产中间产物协议，不是随意编辑的提示词示例。

## 两类 JSON

- `src/content/courses/<course-id>/course.plan.json`：知识节点和依赖、真实章节、规划中的章节、学习目标、实验引用与 MDX 路径。
- `src/content/labs/<lab-id>.lab.json`：学习问题、预测、用户控件、输出、不变量、边界、独立测试依据（oracles）与组件/数学文件路径。

Schema 位于 `schemas/course-plan.schema.json` 和 `schemas/lab.schema.json`。Schema 版本目前是 `schemaVersion: 1`。所有结构化数据中的 ID 均使用小写 kebab-case。

## 新增一节课程

1. 在对应课程计划增加 chapter（`id,title,coreQuestion,learningObjectives,conceptIds,prerequisites,dependsOnChapterIds,labIds,lessonPath,status`）。新章节在 `plannedChapters` 中已占位时，**沿用它原有的 `id`** 并从 `plannedChapters` 移除；依赖边指向真实章节的 id。
   确无合适交互的章节，可用 `coreTask`（可验证的静态思考任务）替代 `labIds`——二者必须择一，同时声明会被拒绝。
2. 新增一份 `.mdx`，在 Markdown 中引用仓库内的可信交互组件。
3. 每个新交互需要一份 `.lab.json`，提供 invariant 和 edge case，并给每条断言绑定至少一个 oracle ID。
4. 使用纯计算函数（`src/math`）与独立测试，确保 oracle 中的 `testFile` + `testName` 指向可实际执行的测试。
5. 运行 `npm run validate`、`npm test`、`npm run build`、`npm run test:e2e`；最后单独进行数学与教学内容审查。
6. 提交 PR，报告未通过或尚未执行的审核项目。不能直接将生成的代码部署。

`chapters` 与 `plannedChapters` 共用同一个 id 命名空间：章节从规划状态转为"真实"时 id 不变，因此两者的依赖边放在同一张图里检查环。

## 校验器能够拒绝

- Schema 中必填字段遗漏、列表为空或额外未定义字段；
- 课程知识节点引用不存在、出现依赖环；
- 章节的实验引用不存在、章节重复 ID；
- 章节依赖不存在的章节，或依赖尚未发布的规划章节，或依赖成环；
- 实验的 oracle ID 不存在、重复 oracle ID；
- 章节 MDX、组件、数学模块、测试源文件不存在；
- 实验声明的测试名字与测试源码不匹配。

**现阶段不能自动判断**：所写测试是否真正验证了某个数学声明，定理/推导是否正确，渲染画面是否有误导，学习者是否掌握目标概念。这些不能因 Schema 校验成功而被标记为“已验证”。

## 数据驱动注册与信任边界

`src/content/registry.ts` 在 Vite 编译阶段静态枚举可信的 `course.plan.json` 和 `.mdx`，再按 `/courses/<course-id>/<chapter-id>` 加载。发布到静态网站时需要配置 SPA 回退到 `index.html`。

当前 GitHub Actions 会安装依赖并执行 PR 的脚本，因此**不是**对恶意代码的安全沙箱。未来模型生成内容应先进入受限、隔离的构建空间，通过验证后生成待审核 PR，再由正式受信任环境构建发布。

## 质量状态

必须分别报告：

| 状态 | 证明材料 |
|---|---|
| Contract valid | 结构、依赖与引用校验记录 |
| Numerical verified | 可复现的解析/性质/参考测试结果 |
| Build verified | TypeScript 检查及打包成功 |
| Browser inspected | 浏览器真实操作、移动视口测试 |
| Content reviewed | 独立推导、术语、教学逻辑审核记录 |
| Published | 明确的发布与部署链接 |

前四项即使都通过，也不能自动推导出第五项通过。
