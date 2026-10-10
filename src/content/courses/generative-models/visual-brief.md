
# 原理图的职责：一篇文章而不是五节课程

组件源文件：`src/components/GenerativePrincipleFigures.tsx`。每张静态图对应一个关键认知障碍：

- `GenerationRoadmapFigure`：训练与生成各自更新什么。
- `NoiseSupervisionFigure`：人为加入的噪声怎样变成训练标签。
- `ScoreFieldFigure`：为什么噪声预测与局部概率结构相连。
- `DiffusionSamplingFigure`：三幅按明确高斯加噪公式计算的分布曲线，从标准高斯向双峰数据分布反向展示；下方对照干净估计与下一步采样状态。**它展示的是边缘分布，绝不是一张图逐步去噪的实际录像**。
- `FlowPathsFigure`：左图用真实可计算的两条相交训练直线；右图用 z~N(0,1) 到 x~N(1,0.5²) 独立配对的**解析高斯平均速度场 ODE 解**，展示真实数学上的曲线路径，而非定性猜测。
- 末尾路线比较由紧凑文字完成，不再为凑第六张图复用文本型卡片；不滥用随机/确定性的分类。

数字图案/噪声块是概念示意，**不是已训练模型的生成图像**；FM 右图来自验证过的解析 ODE 解；score 曲线来自解析高斯混合。图示需要在该处真的促进原理理解，不能因为已有组件就硬插。

旧 `GenerativeFlowLab` 使用解析速度场，放在本文末尾可选展开，不要求操作才能理解主线。不新增滑块、动画或对旧实验做装饰性扩展。数学和视觉语义仍需独立审核。


数据依据与测试：共享 `src/math/generative.ts` 中的 `diffusionBridgeDensity`、`gaussianBridgePosition`、`gaussianBridgeVelocity`。单元测试分别检验分布归一化、二阶矩、纯噪声/干净混合终端与轨迹满足 ODE，避免图画得顺眼却描述了错误的数学过程。
