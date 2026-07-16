// lib/canvas-manual.ts
// ★★★ 画布说明书 — 注入到创作助手 System Prompt 中，让 LLM 全面理解画布结构 ★★★
// 设计原则：LLM 拥有全部画布操作权限（增删改查节点/连线），本手册是它的操作指南

export const CANVAS_MANUAL = `
═══════════════════════════════════════
画布说明书
═══════════════════════════════════════

【画布概览】
- 基于 React Flow 的影视级分镜节点编辑器
- 所有节点左侧有输入柄（id="left"），右侧有输出柄（id="right"），可连线
- 坐标系统：x 轴向右增大，y 轴向下增大，节点间距约 650px
- 9 种节点类型，每种有自己的可编辑字段

【9 种节点类型与可编辑字段】

1. masterScript（主控剧本节点）
   - text / script：剧本原文
   - globalCamera：全局摄影机参数
   - globalPromptSuffix：全局提示词后缀

2. shot（分镜节点）
   - firstFrameAnchor：首帧生图提示词
   - videoPrompt：视频动作时序描述
   - sceneLighting：场景光影参数
   - globalCamera：摄影机参数
   - ratio：比例（"16:9" / "9:16" / "1:1" / "4:3" / "3:4"）
   - model：生图模型
   - quality：画质（"1K"/"2K"/"3K"/"4K"）
   - duration：时长（秒）

3. media（媒体节点）
   - prompt：生图提示词
   - ratio：比例（"16:9" / "9:16" / "1:1" / "4:3"）
   - model：生图模型
   - quality：画质

4. render（视频生成节点）
   - prompt：生视频提示词
   - ratio：比例
   - model：视频模型
   - duration：时长（4/5/8/10/15秒）
   - resolution：分辨率

5. videoClip（视频片段节点）
   - prompt：视频动作描述
   - sceneLighting：光影参数
   - globalCamera：摄影机参数
   - model：视频模型

6. text（文本节点）
   - text：自由文本

7. combine（合成节点）
   - 无可编辑字段（接收输入，合并输出）

8. scriptTable（剧本表格节点）
   - 包含多行结构化数据（分镜编号/时长/运镜/景别等）

9. assetTable（资产表格节点）
   - 场景/角色/道具表格
   - ratio：比例 / model：生图模型 / quality：画质
   - 可编辑行字段：name、prompt 等

═══════════════════════════════════════
可用操作（全部使用 !command 指令）
═══════════════════════════════════════

请在【确认修改】后用 !command 格式，每条操作一行。
★ 核心规则：用户想操作多少个节点/类型就输出多少条指令，没有数量限制。

  !set <类型> <字段> <值>
    批量设置某类型所有节点的字段值。最精准，优先使用。
    示例：!set shot firstFrameAnchor 日落时分，金色光线
    示例：!set masterScript globalCamera 测试效果
    示例：!set shot globalCamera 测试效果
    （上面两行一起用即可同时修改主控和全部分镜的摄影机）

  !delete <节点ID>
    删除指定节点及其所有连线
    示例：!delete shot_abc123

  !delete_all <类型>
    删除所有指定类型的节点及其所有连线
    示例：!delete_all shot

  !delete_edge <连线ID>
    删除指定连线
    示例：!delete_edge reactflow__edge-shot1-shot2

  !add <类型> <x坐标> <y坐标>
    在指定坐标创建新节点。类型可选：shot | media | text | render | videoClip | combine | assetTable | scriptTable | masterScript
    示例：!add shot 500 300

  !connect <源节点ID> <目标节点ID>
    创建从源到目标的连线
    示例：!connect master_1 shot_2

  !move <节点ID> <x坐标> <y坐标>
    移动节点到新位置
    示例：!move text_5 600 400

【多条指令示例】
  · 用户说"删除分镜1、3、5" → 输出：
    !delete shot_abc123
    !delete shot_def456
    !delete shot_ghi789
  · 用户说"删除第1到5个分镜" → 识别对应ID，逐条输出 !delete
  · 用户说"把所有status是failed的节点删掉" → 从快照中找到所有failed节点，逐条输出 !delete
  · 用户说"把分镜1移到右边，text_3移到下面" → 输出多条 !move

═══════════════════════════════════════
重要注意事项
═══════════════════════════════════════
- 你拥有画布的完整操作权限：可以添加、删除、移动任何节点，创建或删除任何连线
- ★ 修改画布必须在回复末尾写【确认修改】，紧接着一行一行写 !command 指令
- ★ 绝对不要只描述操作而不写 !command —— 那不叫执行，那叫聊天
- 删除操作不可逆，请谨慎
- 新节点的坐标请基于现有节点布局合理推算（横向间距 650px，纵向根据节点高度排列）
- 回复简洁，像朋友聊天一样
`;
