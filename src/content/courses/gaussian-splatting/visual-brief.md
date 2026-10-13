
# Visual Brief：3D Gaussian Splatting 的原理图

组件源文件：`src/components/GaussianSplattingFigures.tsx`；实验组件：`src/components/GaussianProjectionLab.tsx`；共享计算：`src/math/gaussian-splatting.ts`（配套单元测试 `src/math/gaussian-splatting.test.ts`）。

全部图为**原创 SVG**，无外部素材，因此不涉及第三方图片许可。数值全部由上述数学模块计算，图与测试共用同一套函数；正文中出现的每个数字都可在测试或该模块的返回值中复现。

## 1. `SplatPipelineFigure` — 两条运行链

- **课程 / 章节 / 位置**：`gaussian-splatting` / `gaussian-splatting-projection` / 开篇
- **学习问题**：训练与渲染共用什么、各自更新什么？
- **呈现形式**：结构图（HTML 列表 + 容器样式，无 SVG）
- **必须包含**：训练侧（多视角照片与位姿 → 可微光栅化与损失 → 反向传播参数 → 自适应增密剪枝）；渲染侧（冻结参数 → 剔除 → 逐 tile 排序 → 前向合成）
- **事实依据**：Kerbl 等 2023 原文的训练与渲染流程
- **Caption**：机制示意；说明渲染时排序被当作常量、梯度不穿过排序
- **数学检查**：无数值断言，仅流程顺序；与实验组件、正文描述一致

## 2. `DepthIntoExtentFigure` — 25 倍反例

- **学习问题**：朴素"丢掉深度分量"的规则在什么情况下失效、失效多少？
- **预期观察**：左图各向同性但离轴，两法半轴相差约 1.118 倍；右图校正椭圆是 62 px 长条，朴素椭圆只有 2.5 px，几乎看不见
- **呈现形式**：原创 SVG，两个同级 `<svg>` 共用同一 viewBox 尺度（`HALF_W=0.32`、`HALF_H=0.20`），因此两面板可直接比大小
- **图中对象与单位**：归一化屏幕坐标 $u$，两个椭圆分别对应 `corrected` 与 `naive` 两条协方差路径；横纵同一比例尺
- **事实与精度依据**：`compareFootprints(1, 2, 0.01, σ_along)`；$\sigma_\text{along}=0.01$ 与 $0.5$ 两组
- **数学检查**：椭圆 `rx/ry` 直接取 `ellipseAxes` 的半轴，角度取 `angle`；不引入任何手调缩放系数。测试 `on the optical axis the naive footprint is exact...`、`a needle along the view axis smears 25x...` 覆盖数值
- **Caption 声明**：概念示意 + 解析计算；标注朴素结果被校正椭圆包含
- **Alt**：说明左图两法有小幅差异、右图朴素把 62 px 长条画成 2.5 px 的点
- **手机布局**：SVG 随容器缩放，`width:100%;height:auto`；两面板在 560 px 宽度内并排，极窄屏仍保持同一尺度

## 3. `PerspectiveRayFigure` — 俯视图的几何解释

- **学习问题**：为什么深度的展开会变成屏幕上的横向长度？
- **预期观察**：近端投影点与远端投影点在成像平面上的间隔，明显大于横向尺度本身
- **呈现形式**：原创 SVG 俯视图
- **图中对象与单位**：相机在左（原点），成像平面是右侧竖线，$z$ 向右增大，$x$ 向上；世界单位经统一比例换算为像素
- **事实与精度依据**：投影关系 $u=x/z$；近端 $z=1.5$、远端 $z=2.5$、横向 $x=1$
- **数学检查**：两条射线端点由 $x/z$ 计算，不手绘；`clipW` 式符号约定在本图用 $z>0$ 约定，与正文一致
- **Caption 声明**：概念示意，说明虚线为中心视线
- **Alt**：描述近端样本投影更靠外、远端更靠内
- **边界**：这不是渲染结果的截图，不表示真实高斯的像素覆盖

## 4. `FootprintAxesFigure` — 椭圆足迹与主轴

- **学习问题**：足迹的大小与朝向由什么决定？
- **预期观察**：一个约 62 px × 2.5 px 的横向椭圆，$\sigma=1$ 与 $\sigma=2$ 两条等值线
- **呈现形式**：原创 SVG，viewBox 收窄到 `HALF_W=0.185`、`HALF_H=0.058`，并在 caption 中标明横向放大约 1350 倍
- **事实依据**：`ellipseAxes(projectedCovariance(...))`
- **数学检查**：半轴 = 特征值平方根；测试 `the comparison helper agrees with the two covariance paths it wraps` 断言 $\sigma_1=\sqrt{0.125^2}$、$\sigma_2=\sqrt{0.005^2}$
- **Caption 声明**：解析数据，说明放大倍数与"不是屏幕截图"
- **Alt**：长轴约 62 px、短轴约 2.5 px，标出两个主方向
- **边界**：极端轴比下短轴接近一条线，图中不人为加宽到 1 px 以免误导；caption 显式说明

## 5. `SplatBlendingFigure` — 前向 α 合成

- **学习问题**：为什么透射率与顺序无关、颜色与顺序有关？
- **预期观察**：三层 α=0.45/0.35/0.30，贡献分别为 0.450/0.1925/0.10725，三者之和 0.74975 加最终透射率 0.25025 等于 1
- **呈现形式**：原创 SVG（三个叠加椭圆 + 数值列）
- **事实与精度依据**：前向混合 $C=\sum c\alpha\prod(1-\alpha)$
- **数学检查**：数值由 `compositeFrontToBack` 的同一公式手算复核；测试 `front-to-back compositing depends on order...` 断言 0.8/0.16/0.012 与透射率不变
- **Caption 声明**：解析数据；指出排序错误表现为颜色变化而非几何穿帮
- **Alt**：三个沿深度排列的半透明椭圆及各自贡献与剩余透射率

## 6. `LinearizationLimitFigure` — 一阶近似何时失效

- **学习问题**：$\Sigma'=J\Sigma J^\top$ 在什么参数区间可信？
- **预期观察**：$\sigma_\text{along}\lesssim 0.1$ 时预测与实测几乎重合；$\sigma_\text{along}=0.5$ 时实测是预测的两倍以上；朴素线（灰虚线）始终不变
- **呈现形式**：原创 SVG 折线图
- **数据来源**：共享数学模块 `sampleProjectedPoints` 与 `empiricalCovariance`，每点 20000 样本（测试用 40000~60000）
- **事实与精度依据**：蒙特卡洛精确投影的样本标准差，不是论文实验数据的重绘
- **数学检查**：测试 `the linearization is a tangent-space scale, and deep Gaussians break it` 与 `shrinking the depth extent converges...` 断言趋势与量级
- **Caption 声明**：解析数据 + 蒙特卡洛实测；说明这是本文的独立数值观察
- **Alt**：折线图，随深度尺度增大实测足迹超出公式预测，朴素预测保持不变
- **边界**：图只到 $\sigma_\text{along}=0.5$，不外推到极端值；caption 说明近似失效的机制是深度后尾接近相机平面

## 7. `SplatParameterFigure` — 参数清单

- **学习问题**：一个高斯携带多少个可学参数、各自作用是什么？
- **呈现形式**：HTML 表格（无 SVG）
- **事实依据**：3 位置 + 3 尺度 + 4 旋转 + 1 不透明度 + 48 球谐 = 59；原文 SH 取 3 阶
- **数学检查**：维数按原文明列，`scale-is-length-test` 对应尺度进入协方差的方式
- **Caption 声明**：结构事实，不含优化器状态

## 8. 交互实验 `GaussianProjectionLab`

- 控件与读数见 `src/content/labs/gaussian-splatting-projection-lab.lab.json`
- 组件与数学模块同源：两个面板、读数、展宽倍数、说明行全部由 `compareFootprints` / `horizontalFootprint` 产生
- 可访问性：三个滑块与一个复选框都有 `aria-label`，读数区 `role="status" aria-live="polite"`
- 已执行浏览器验证的覆盖范围见 `course-review.md`，未执行的不写成通过

## 审核状态

原创图，无第三方许可问题；版权与内容审核人尚未独立指定。数学数值已由单元测试覆盖，但图示的**视觉语义**（椭圆是否看起来正确地反映数值、缩放标注是否读者可理解）需要独立人工复查，本轮未执行。
