# KnowledgeLab Agent 工具与 Skill 路由

本文件描述**Agent 应在何时使用何种能力**，不保证任意运行环境已安装某个工具。平台不同可以换用等效实现，但交付标准不得降低。

## 1. Skill 目录（仓库内可执行的工作说明）

规范位置：`.claude/skills/<skill-name>/SKILL.md`。这些文件是本仓库版本控制下的操作规程；其他编码 Agent 必须通过 `AGENTS.md` 中的路由主动读取。**添加 Skill 文件不等于部署了自动课程 Agent，或自动获得联网、图像生成和浏览器权限。**

| 触发情况 | 必读 Skill | 输出 |
| --- | --- | --- |
| 新课程规划、现有课程重构/开头太像教材 | `learning-journey` | Knowledge Map + Narrative Brief + 可验证学习目标 |
| 添加概念/章节，或询问“它在知识树哪里” | `knowledge-map` | 带类型的上下游连接说明及课程依赖更新 |
| 想给某段知识配图/引用论文图 | `visual-research` | 视觉任务、来源与授权判定、使用方式 |
| 需要自己绘制示意图/流程图/几何图 | `diagram-authoring` | 可编辑、可核验的原创图及说明 |
| 内容准备好提交 PR / 要检查教学味道 | `course-review` | 独立内容审查、数学与媒介质量报告 |

多条触发条件可串行调用。**先做 learning-journey 和 knowledge-map，再决定 visual-research / diagram-authoring**，不要反过来让资源绑架叙事。

## 2. 工具选择表

| 需求 | 能力/工具类别 | 使用准则与回退 |
| --- | --- | --- |
| 查事实、论文、官方说明 | 检索/浏览原始网页及论文 PDF | 优先一手和近期版本，记录具体出处；无网络时明示待核验 |
| 找现成图 | 图片/网页检索、来源页及许可证检查 | 搜到不等于有权复制；不明授权只能链接或另画 |
| 画二维精确图 | SVG、React、JS/Python 绘图库 | 纯数学模块决定坐标和数值；必要时加单测 |
| 画流程/时序 | SVG、Mermaid、程序化图 | 对照执行链校核，避免用错误箭头制造错误心智模型 |
| 三维关系 | Three.js / WebGL（可用时） | 能用二维解释就不强上三维 |
| 概念照片/风格化素材 | 有权限的图像生成工具 | 不能冒充真实论文结果，不能交给它绘制精确公式 |
| 运行/验证 | TypeScript、Node、Vite、Playwright、数学 oracle | 只报告实际执行的命令与结果 |
| 版本管理 | Git/GitHub PR | 小规模独立改动、可审阅，不能自动无审核发布 |

**工具缺失**：报告无法使用的工具与影响；采用更稳妥的静态解释、可编辑 SVG 或仅链接参考。不得虚构搜索、授权、截图、浏览器验证或生成结果。

## 3. 默认工作流

```text
学习需求
  → learning-journey：找问题、认知转折、自然叙事
  → knowledge-map：上游先修／同层对比／下游应用
  → 选媒介：无需图／静态图／交互／实物照片
      ├─ visual-research：研究可信资料并核查可复用权利
      └─ diagram-authoring：独立生成示意图并检查几何/数据
  → 章节 MDX + 必要交互与数学模块
  → course-review：教学链、连接、推导、素材与权限审查
  → validate / typecheck / test / build / browser
  → PR + 未完成事项报告
```

## 4. 每次 PR 应附的证据

- **Learning Narrative**：起点困惑、转折点、概念出现理由、结尾回扣；
- **Knowledge connections**：至少一个解释清楚的先修与一个真实的迁移连接；关系类别；
- **Visual provenance**：图片本身、来源、许可、是否改作、caption / alt；无需图则说明无需；
- **Review outcomes**：数学/论证/模型正确性、版权与可访问性、运行测试分别记录；
- **Limitations**：无法联网、未在浏览器查看、未验证授权/论文结论时不得假装已经完成。

不要让测试通过代替人工认知质量审核，也不要让教学审查代替算法测试。

