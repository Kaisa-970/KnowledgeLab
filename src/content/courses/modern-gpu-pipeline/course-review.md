# Vulkan 基础教程：制作与审查记录

课程 `modern-gpu-pipeline`；章节 `vulkan-frame-lifecycle`；无 Lab，使用 `coreTask`。课程与章节状态均为 `prototype`。2026-10-25 更新：内容与技术事实有不同上下文 Agent 的独立复核，最终页面由作者逐图检查；没有真实学习者验收，不升级为 reviewed/published。

## 教学范围

课程归属为“计算机图形学与 GPU → 图形渲染管线”，沿用全局目录中已有的规划课程，没有为新问题另造课程体系。读者已确认有 OpenGL 基础；全文沿同一个三角形解释为什么要把资源、存储、命令和完成证明分开，再追踪它们的一帧生命周期。核心闭环是区分 frame slot 与 acquired image，用索引变化预测哪些资源可以复用，并解释为什么“下一帧已准备完”仍不证明旧数据可以覆盖。

## 标题承诺与本轮补桥

原稿较充分地回答了“拆成什么、生命周期如何”，却只用“获得并行和复用边界”重述拆分收益。本轮补足三条实际因果关系：

1. CPU 更新下一帧顶点时，GPU 可能仍读旧存储；等待与换存储各有代价。独立资源提供另一处写入位置，完成证明决定旧存储何时可以复用。正文明确驱动能追踪已提交命令，缺少的是应用未来的完整策略。
2. 多线程修改同一当前状态需要协调；独立 command pool/command buffer 允许各线程录制，再集中提交。正文没有宣称 OpenGL 完全不能并行，也区分 CPU 并行准备与 GPU 并行执行。
3. 每个小资源独立分配会增加分配成本；资源与 VkDeviceMemory 分开，多个资源才能按大小、对齐和 memory type 要求绑定到大块内存的不同区间。控制权增加，同时增加管理责任，不保证消除碎片或完全控制物理驻留。

保留三张已有静态图；不为补桥增加交互或 API 初始化清单。同步术语表与职责表在实际截图中曾显示成 Markdown 管道原文，现改为带 caption、行列表头的 HTML 表格，浏览器断言检查实际表格和行数。

本篇是 Vulkan 入门的第一条纵向切片，不覆盖实例/设备初始化、descriptor、完整绘制代码、多个 queue family 的 ownership transfer 或性能优化。示意图明确假设 graphics 与 present 使用同一 queue family；command buffer 状态图说明省略的 `invalid` 分支及 `ONE_TIME_SUBMIT` 条件。

## 作者检查

| 检查项 | 结论 | 证据与范围 |
| --- | --- | --- |
| 学习者已知与假设 | 已记录 | OpenGL 使用经验为确认基础；异步执行、Vulkan 同步和资源布局作为未知点补桥，没有在正文宣称读者已经掌握其他概念。 |
| 最小理解闭环 | 作者自检 + 独立设计复核 | 正文先展示存储争用及可选策略，再追踪录制、提交、执行、呈现；结尾用 slot 0、image 1/2 和异线程准备 B 的变化题检查迁移预测。正文提供了推理依据，但没有学习者作答证据。 |
| 技术主张 | 作者核对 + 独立 Agent 复核 | 对照 Khronos 的 command buffer、synchronization、threading、memory allocation、swapchain semaphore reuse、synchronization examples，以及 OpenGL glBufferSubData/glBufferData 参考文档。原规范用于状态/时序 oracle，无新增数值算法。OpenGL Wiki 请求 403，未将其冒充已读来源，改核对官方 Refpages 源码。 |
| 图示语义与实际渲染 | 作者实际读图；图源码另经独立复核 | 三张原创关系/时序图分别解释对象边界、command buffer 状态和 acquire/submit/present。已打开桌面、手机全页及三图两个视口的最终截图，并检查首屏和表格局部；检查标签、顺序、箭头方向、双索引关系和裁切。最终证据 `.tutorial-review/vulkan-final-20261025/`。 |
| 素材来源 | 无外部图片 | 所有图均为仓库内原创 HTML/CSS/SVG 教学示意，不表示硬件 trace 或实际 Vulkan 渲染结果。 |
| 内容与学习效果 | 独立 Agent 检查设计；学习效果未验证 | 独立复核未发现新增核心机制缺口，但没有真实学习者试读、迁移题回答或学习压力反馈。 |

## 独立复核的具体发现

不同上下文审稿 Agent `/root/vulkan_review` 先不看 Learning Brief，阅读 MDX 和三张图源码，并核对 Khronos 一手文档。结论是三条因果桥已基本兑现标题，无新增 P0；指出原文有两处 P1：

- “semaphore 不能替代 barrier”过于绝对。已改为按已有依赖覆盖范围和 layout 转换要求判断；有正确 semaphore signal/wait 且无需 layout 转换时，额外 barrier 可能不必添加。依据是 Khronos Guide synchronization examples 的 semaphore 章节。
- “semaphore 不能被 CPU 等待”缺少类型限定。已限定本文的 binary semaphore，避免与支持主机等待/查询的 timeline semaphore 混淆。

该独立审查覆盖内容与图示源码，不包含最终页面截图、实际 Vulkan 程序运行或真人理解；上述范围由作者的浏览器检查与未验证项分别记录。

## 本轮验证

| 命令/检查 | 结果 |
| --- | --- |
| `npm run validate` | 通过，6 门课程。图示源码审计 0 risk、43 manual hints；这些提示来自其他课程，源码审计本身不检查实际渲染。 |
| `npm run typecheck` | 通过。 |
| `npm test` | 127/127 通过。Vulkan 概念由浏览器断言覆盖，不含独立 Vulkan 数值模块。 |
| `npm run build` | 通过。存在两条未改动透视插值课程的 KaTeX 中文字符警告。 |
| `npm run test:e2e -- --workers=2` | 126/126 通过，最终稿含两张语义表格的断言。首次制作时目录课程数断言仍为旧值 5；登记 Vulkan 后同步为 6。 |
| Vulkan E2E | 8/8 通过，包含桌面、移动端、320px 和 390px 无横向溢出，以及两张实际表格的行数检查。 |
| 浏览器截图 | 1440×1000 桌面与 390×844 手机：各 3 张图、页面错误 0、横向溢出 0px。全页、逐图、首屏与表格局部已打开检查；截图脚本自身不宣称已人工验收，查看范围由本报告记录。 |

## 未完成

- 已有独立 Agent 的内容/技术复核，但未收集维护者的最终课程验收；不据此自动升级为 `Content reviewed`。
- 尚无真实学习者反馈；不能声称教程已经通俗、低压力或已帮助读者掌握 Vulkan。
- 未实现或运行 Vulkan 绘制程序；本篇讲清首要对象与同步生命周期，不是可直接编译的 Vulkan 三角形教程。
- 课程与章节保持 `prototype`，未发布。
