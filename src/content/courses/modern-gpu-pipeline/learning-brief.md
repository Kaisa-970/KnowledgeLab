# Learning Brief：现代图形管线与 Vulkan

## 归属与范围

知识位置：计算机图形学与 GPU → 图形渲染管线 → 现代图形管线与 Vulkan。已有光栅化课程回答**片元和属性如何算出来**；本课回答**应用怎样把一帧工作显式交给 GPU，并把结果交给呈现系统**。两者共享同一个三角形，但问题边界不同。本文覆盖一帧的对象与时间边界，不展开完整实例/设备选择、descriptor 设计或多 queue 所有权转移。

## 学习者模型

- **确认已掌握**：用户有 OpenGL 使用经验；可以把 vertex buffer、shader、draw call 和交换缓冲作为已知词汇。
- **暂时假设**：尚未确认用户如何理解 OpenGL 异步执行、GPU 资源生命周期和图像布局；正文用一帧时序补上这些桥。
- **当前卡点**：知道对象分工仍解释不了为什么要拆；需要看见隐式管理隐藏了哪些等待、存储和 CPU 工作安排。
- **目标**：沿同一个三角形解释资源覆盖争用、并行准备与内存分配，再追踪 CPU 录制、GPU 执行、呈现，对资源复用情境做正确预测。

## 认知缺口与最小闭环

OpenGL 把许多状态绑定和提交细节收在 context 中，但不能假定有 OpenGL 经验就一定误以为 draw 同步完成。用 CPU 更新下一帧顶点、GPU 仍在读旧顶点的执行链直接展示争用：普通 OpenGL 更新维持顺序语义，可能等待，orphaning 可为新存储提供机会；Vulkan 应用按已知资源寿命选择存储并取得完成证明。驱动能追踪已提交命令，不能替应用预知后续全部策略。

另两条必要桥梁：独立 command buffer 让不同线程用各自 command pool 录制，再集中提交；资源与 VkDeviceMemory 分离让多个资源子分配到大块内存。正文说明同一个 OpenGL context 不能同时给多线程使用，但不否认多共享 context 方案；显式管理不保证更快，也不保证消除碎片或完全控制驻留。

最小闭环使用一个三角形和“两份 frame slot、三张 swapchain image”：预测 frame slot 0 的 fence 完成是否意味着对应 swapchain image 已呈现；追踪 `imageAvailable[slot] → submit → renderFinished[image] → present`；用两个不同索引解释 CPU 侧 frame 资源与 present 侧图像的复用；再将 acquired image 改成另一张，预测哪个索引变化。

核心理解：**分离资源、存储、命令和完成证明，应用才可以分别安排写入位置、并行录制与安全复用；对象的生命周期约束是获得这些选择时要承担的责任。**

## 主路径与深入路径

- **主路径**：同一三角形每帧更新的存储争用 → Vulkan 对象边界与子分配动机 → 独立命令录制的并行机会 → command buffer 状态 → acquire/submit/present → frame slot 与 swapchain image 的双索引。
- **深入**：pipeline barrier 连接执行依赖、内存可见性和 image layout；说明本文 binary semaphore 与 CPU 可等待的 fence 的区别。
- **边界**：提交 fence 完成不等于显示器已经显示；present wait semaphore 的安全复用要依赖再次 acquire 对应 image，不能只依赖 frame fence。本文假设单 graphics/present queue family，不展开 ownership transfer。

## 图示决策

1. `vulkan-object-boundaries`：同一三角形的 OpenGL 可变 context 与 Vulkan 显式对象分解，解释对象为何存在。
2. `vulkan-command-lifecycle`：command buffer 从 initial 经 recording、executable 到 pending，再在执行完成后返回 executable 或变为 invalid，解释录制与执行的差别。
3. `vulkan-frame-lifecycle`：CPU、GPU、present 三条泳道，标出两个索引和三个信号，解释谁等待谁。

原创静态 SVG，表达教学对象关系与时序，不伪装成驱动 trace 或硬件测量。

## 技术核验与未验证项

- 核对 Khronos 的 command buffer/synchronization、threading、memory allocation、swapchain semaphore reuse，以及 OpenGL glBufferSubData/glBufferData 参考文档。OpenGL Wiki 的 streaming/context 页面请求 403，不计为已读来源；链接与本轮证据在 `course-review.md`。
- E2E 覆盖状态转移、索引区分、页面布局；本文没有额外数值算法，不为测试数量创建模拟器。
- 作者自检覆盖内容、源码、构建和浏览器截图；本轮另由不同上下文 Agent 独立检查正文、图示源码和 Khronos 技术依据。真实学习者迁移回答尚未完成，课程保持 `prototype`。

## 本轮补桥的局部检验（2026-10-25）

此前只有“获得复用和并行边界”的结论，没有解释边界为何有用。本轮先写 CPU 准备 B、GPU 仍读 A 的短执行链，再分别推到完成证明、独立录制与子分配。未示范变化：即使 B 已写好且新命令在另一线程录完，也不能据此覆盖 A；仍需覆盖 A 所有旧访问的完成证明。依据在资源争用段和迁移题展开中。独立 Agent 审查支持该解释有依据，不是学习者试读。

压力风险：memory type 和分配器细节容易抢占一帧主线；正文只保留支撑“资源与存储为何分离”的条件，不展开分配器实现，也不新增图或交互。
