# Knowledge Map：现代图形管线与 Vulkan

## 主线位置

本课位于“计算机图形学与 GPU → 图形渲染管线”。已有光栅化课程回答**片元和属性如何算出来**；本课回答**应用怎样把一帧工作显式交给 GPU，并安全地把结果交给呈现系统**。两者共享同一个三角形，但问题边界不同。

## 先修与内部依赖

`opengl-state-model` 让读者识别被 Vulkan 拆开的旧模型；`explicit-resources` 与 `pipeline-state` 解释对象边界；`command-recording`、`queue-execution` 解释录制和执行的时间差；`swapchain-images`、`device-host-synchronization` 与 `image-layout-visibility` 汇合成 `frame-lifecycle`。

## 跨课程连接

- **Vulkan pipeline 与光栅化**：pipeline 保存固定绘制配置，光栅化课程解释这些状态怎样参与属性插值。前者回答“以什么状态执行”，后者回答“执行后像素怎样计算”。
- **显式同步与图形结果**：barrier/semaphore 保证执行依赖与可见性，不会修复顶点坐标、插值公式或深度值。
- **显式 API 与 GPU 计算**：command buffer → queue 的分离也用于计算 dispatch；本课先用图形呈现建立时序，后续 GPU 计算再讨论线程粒度、内存层级和性能。

## 边界

本文不教 Vulkan 初始化的全部结构体，也不把 synchronization2、dynamic rendering、descriptor indexing 作为前提。正式实现需结合 Vulkan 版本、feature 和 validation layer；本文伪代码只表达一帧的依赖方向。
