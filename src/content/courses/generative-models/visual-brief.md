
# 原理图的职责：一篇文章而不是五节课程

组件源文件：`src/components/GenerativePrincipleFigures.tsx`。每张静态图对应一个关键认知障碍：

- `GenerationRoadmapFigure`：训练与生成各自更新什么。
- `NoiseSupervisionFigure`：人为加入的噪声怎样变成训练标签。
- `ScoreFieldFigure`：为什么噪声预测与局部概率结构相连。
- `DiffusionSamplingFigure`：估计干净数据与采样下一步状态为什么不同。
- `FlowPathsFigure`：训练的条件直线和推理积分轨迹为什么不同。
- `RouteComparisonFigure`：比较分布路径、网络目标与采样器，不滥用随机/确定性的分类。

数字图案/噪声块是概念示意，**不是已训练模型的生成图像**；FM 右图是定性解释，不是实际积分出的数值轨迹；score 曲线来自解析高斯混合。图示需要在该处真的促进原理理解，不能因为已有组件就硬插。

旧 `GenerativeFlowLab` 使用解析速度场，放在本文末尾可选展开，不要求操作才能理解主线。不新增滑块、动画或对旧实验做装饰性扩展。数学和视觉语义仍需独立审核。
