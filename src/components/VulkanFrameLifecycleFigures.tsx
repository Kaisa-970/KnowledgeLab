import type { ReactNode } from 'react'

/** Original explanatory diagrams, not a hardware trace or a Vulkan renderer. */
function Panel({ anchor, title, subtitle, caption, children }: {
  anchor: string
  title: string
  subtitle: string
  caption: string
  children: ReactNode
}) {
  return <figure className="vk-figure" data-concept-figure={anchor} id={anchor}>
    <div className="vk-figure-head"><strong>{title}</strong><span>{subtitle}</span></div>
    {children}
    <figcaption>{caption}</figcaption>
  </figure>
}

function Triangle() {
  return <svg viewBox="0 0 120 90" role="img" aria-label="交换链图像中的三角形，原理示意">
    <rect x="1" y="1" width="118" height="88" rx="6" fill="#152f47" />
    <path d="M 60 16 L 20 72 L 100 72 Z" fill="#72d5bd" />
  </svg>
}

export function VulkanObjectBoundariesFigure() {
  return <Panel
    anchor="vulkan-object-boundaries"
    title="画的仍是三角形，状态有了明确的归属"
    subtitle="对象关系示意 · 非完整对象清单"
    caption="左边的 draw 读取 context 当下的状态，实际执行仍可异步。右边先创建资源和 pipeline，再把引用它们的动作录入 command buffer，最后提交到 queue。命令记录的是引用和参数，不会把 buffer 中的数据复制一份。"
  >
    <div className="vk-object-grid">
      <div className="vk-object-lane">
        <h3>OpenGL / 当前 context</h3>
        <div className="vk-object-card"><b>绑定当前状态</b><code>program · VAO · framebuffer</code><span>先改当前状态，再发起 draw</span></div>
        <div className="vk-flow-link">↓ draw 读取这些绑定</div>
        <div className="vk-object-card"><b>驱动处理并交给 GPU</b><span>依 API 规则管理许多依赖与资源细节</span></div>
      </div>
      <div className="vk-object-lane">
        <h3>Vulkan / 显式引用</h3>
        <div className="vk-object-pair">
          <div className="vk-object-card vk-blue"><b>资源</b><code>buffer / image</code><span>描述数据用途；backing memory 另行绑定</span></div>
          <div className="vk-object-card vk-orange"><b>pipeline</b><code>shader + 配置</code><span>怎样绘制</span></div>
        </div>
        <div className="vk-flow-link">↓ bind · draw · barrier，录入</div>
        <div className="vk-object-card"><b>command buffer</b><span>这次用哪些资源，做哪些动作</span></div>
        <div className="vk-flow-link">↓ submit 到 queue</div>
        <div className="vk-object-card vk-purple"><b>GPU 执行</b><span>按命令与同步依赖推进工作</span></div>
      </div>
    </div>
  </Panel>
}

export function VulkanCommandLifecycleFigure() {
  const states = [
    { name: 'initial', event: '分配 / reset 后', detail: '还没有可执行命令' },
    { name: 'recording', event: 'begin', detail: 'CPU 记录 bind、draw 等动作' },
    { name: 'executable', event: 'end', detail: '录完了，GPU 尚未因此开工' },
    { name: 'pending', event: 'submit', detail: '已提交；等待或执行中，不可重录' },
  ]
  return <Panel
    anchor="vulkan-command-lifecycle"
    title="写好命令与执行命令，是两个时间点"
    subtitle="主状态路径 · 不使用 ONE_TIME_SUBMIT 或并发重提交"
    caption="这里省略 invalid 分支：未设 ONE_TIME_SUBMIT 时，执行完回到 executable；设了该标志则变为 invalid，需 reset 后再录。状态在设备执行结束时改变，fence 让 CPU 确认完成；不是 CPU 等待才使状态改变。"
  >
    <ol className="vk-states" aria-label="command buffer 状态变化">
      {states.map(state => <li key={state.name} data-command-state={state.name}>
        <span className="vk-state-event">{state.event} ↓</span>
        <strong>{state.name}</strong>
        <span>{state.detail}</span>
      </li>)}
    </ol>
    <div className="vk-completion"><b>pending → executable</b><span>执行结束后返回；随后可 reset → initial → 重新录制。</span></div>
    <div className="vk-fence-note">CPU 等对应的提交 fence → 确认这份 command buffer 已不在使用中。</div>
  </Panel>
}

export function VulkanFrameLifecycleFigure() {
  return <Panel
    anchor="vulkan-frame-lifecycle"
    title="跟踪这一帧：slot 0 画进 image 2"
    subtitle="依赖关系示意 · 不表示耗时或完整硬件时序"
    caption="示例用两份 frame slot、三张交换链图像，且 graphics 与 present 使用同一 queue family。renderFinished 按 image 分配是一种安全复用策略，不是 Vulkan 唯一方案。GPU 的提交完成与呈现完成是两个边界，fence 只证明前一个。"
  >
    <div className="vk-identities">
      <div><b>frame slot = 0</b><span>command[0] · uniform[0]</span><span>fence[0] · imageAvailable[0]</span></div>
      <div><b>acquired image = 2</b><span>image[2] · view[2]</span><span>renderFinished[2]</span></div>
    </div>
    <div className="vk-frame-flow">
      <div className="vk-flow-step" data-frame-event="acquire">
        <b className="vk-actor">CPU</b>
        <div><strong>等 fence[0]，再 acquire</strong><span>复用 slot 0；本次返回 image 2。</span></div>
      </div>
      <div className="vk-dependency" data-sync-edge="acquire-render"><span>↓ imageAvailable[0]</span><small>submit 中指定设备侧等待；CPU 可以继续</small></div>
      <div className="vk-flow-step vk-purple" data-frame-event="render">
        <b className="vk-actor">GPU</b>
        <div><strong>执行 command[0]</strong><span>转换 image[2] 布局 → draw → 转为可呈现布局</span></div>
      </div>
      <div className="vk-outputs">
        <div className="vk-device-output" data-sync-edge="render-present"><span>↓ renderFinished[2]</span><small>呈现操作等待渲染完成</small></div>
        <div className="vk-host-output" data-sync-edge="render-host"><span>↪ fence[0] → CPU</span><small>可复用 command[0]、uniform[0]；不证明呈现完成</small></div>
      </div>
      <div className="vk-flow-step vk-orange" data-frame-event="present">
        <b className="vk-actor">呈现</b>
        <div><strong>接收 image[2]</strong><span>按呈现模式交给窗口系统；API 返回不等于已显示。</span></div>
        <div className="vk-triangle"><Triangle /></div>
      </div>
    </div>
    <div className="vk-index-note">下一次 CPU 用 slot 1；下一张 image 由 acquire 决定，并不跟着 slot 轮换。</div>
  </Panel>
}
