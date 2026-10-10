# 生成模型原型审查记录

课程 generative-models；实现章节 sampling-not-averaging、noise-to-distribution、diffusion-training、diffusion-sampling、flow-matching；实验 generative-flow-lab。

## 教学设计自检

沿用全局规划 ID，迁移到正式计划，不新增平行课程。五节从平均答案矛盾进入整体分布，再分别追踪训练与生成。Diffusion 与 FM 分支可独立进入，关键公式直接出现，条件平均、score 和连续性方程深入可展开。主线没有同时引入 ELBO/SDE 等完整体系。其余三节仍为规划。

迁移题包括 3:1 混合比例、提供真实图的训练作弊、减少采样步数、固定初始状态。答案解释机制与条件，不用 Agent 自评替代学习效果。

## 数学及视觉证据

双峰平方损失、加噪数字例子与线性路径可直接计算。生成实验的独立 oracle：中点数值积分检验密度质量/均值；有限差分检验连续性方程残差；单高斯精确映射检验中点积分误差收敛；奇函数及零中央轨迹检验边界。7 条新增数学测试通过。

DDPM 均值式采用 beta/a/bar-a 约定，明确与前文 alpha 系数的区别。score 推导限于高斯加噪与非零 sigma；FM 分布结论附正则性/唯一性条件。实验是已知解析场，不是已训练网络，有限样本与解析密度分别标注。图源、轴、caption/title 和原创来源在 visual-brief.md。

原论文来源：Ho 等 DDPM（2020，https://arxiv.org/abs/2006.11239）；Song 等 score-based SDE（2020，https://arxiv.org/abs/2011.13456）；Lipman 等 Flow Matching（2022，https://arxiv.org/abs/2210.02747）。本轮核对摘要与既有公式推导；没有声称对原论文所有结论进行完整独立复核。

## 实际工程验收

- validate：4 门课程的协议与全局归属通过。
- typecheck/test/build：通过，78 项测试；包体积约 1.08 MB，静态 eager 注册警告仍在，已有中文数学字符警告来自旧课程。
- browser：64 项桌面/移动端测试通过，含公式、折叠答案、预设、键盘控件与中央反例。
- visual：Chromium 1440/390 五节截图检查，曲线与轨迹非空、无页面横向溢出、未见内容重叠；SVG 采用向量图，无 canvas。最终坐标标签调整后复查实验截图。

独立内容与数学审查未执行；作者自检不等于独立复核。真实学习者理解、图像训练和生产发布均未验证。保持 prototype；按维护者要求提交并推送源码，Git 推送不代表课程发布或独立审查通过。
