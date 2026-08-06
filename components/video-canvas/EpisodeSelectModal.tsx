"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, Square, CheckSquare } from "lucide-react";
import { fetchApi } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";

// ==========================================
// EpisodeSelectModal — 集数检测 + 选择 UI 二合一弹窗
//
// 用途：在资产表提取 / 分镜裂变前，先让 LLM 分析剧本的结构，
//       然后让用户勾选要处理的段落，避免 LLM 因输入过长而遗漏内容。
//
// 数据流：
//   ① 组件挂载 → fetch LLM 检测集数 → 展示选择列表
//   ② 用户勾选/取消 → 点击确认 → onConfirm({ episodes, text })
//   ③ 如果检测失败 → 展示错误 UI，提供"整段提取"降级按钮
// ==========================================

interface EpisodicInfo {
  id: number;
  label: string;   // 段落标签，如"第一集：初入长安"
  preview: string; // 段落前40字预览，用于 UI 展示和文本定位切割
}

interface EpisodeSelectResult {
  episodes: EpisodicInfo[]; // 用户选中的段落信息
  text: string;              // 选中段落的拼接文本（rough cut by preview matching）
}

interface EpisodeSelectModalProps {
  scriptText: string;       // 完整剧本原文
  title: string;            // 弹窗标题，如"选择提取范围"
  confirmLabel?: string;    // 确认按钮文字，默认"确认提取"
  preloadedEpisodes?: EpisodicInfo[]; // ★ 缓存命中时跳过检测，直接进入选择状态
  onEpisodesDetected?: (episodes: EpisodicInfo[]) => void; // ★ 检测完成后回调父级缓存
  onConfirm: (result: EpisodeSelectResult) => void;
  onCancel: () => void;
}

// ==========================================
// 集数检测 System Prompt
// ==========================================
const DETECTION_PROMPT = `你是一个剧本结构分析专家。请分析以下剧本，按照剧情段落识别出所有的集数/章节结构。

规则：
1. 如果剧本中明确标注了"第X集"、"Episode X"、"第一幕"等分段标记，严格按标记分段。
2. 如果剧本没有明确分段标记，则根据故事情节的起承转合、场景切换等剧情节点自行划分段落。
3. 每个段落输出：编号、标签（如"第一集"或根据内容概括的简短标签）、前40字预览（不含换行符，用于帮助用户判断段落内容）。

必须返回纯JSON数组，包含【所有】段落，不得遗漏任何内容：
[{"id":1, "label":"段落标签", "preview":"前40字内容预览..."}, ...]

注意：不要输出任何JSON之外的内容，不要用markdown代码块包裹。`;

export default function EpisodeSelectModal({
  scriptText,
  title,
  confirmLabel = "确认提取",
  preloadedEpisodes,
  onEpisodesDetected,
  onConfirm,
  onCancel,
}: EpisodeSelectModalProps) {

  // ==================== 状态 ====================
  // ★ 如果有预加载的集数（缓存命中），直接跳过检测，进入选择状态
  const hasPreloaded = preloadedEpisodes && preloadedEpisodes.length > 0;
  const [phase, setPhase] = useState<"detecting" | "selecting" | "error">(
    hasPreloaded ? "selecting" : "detecting"
  );
  const [episodes, setEpisodes] = useState<EpisodicInfo[]>(hasPreloaded ? preloadedEpisodes! : []);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    hasPreloaded ? new Set(preloadedEpisodes!.map((ep) => ep.id)) : new Set()
  );
  const [errorMsg, setErrorMsg] = useState("");

  // ==================== 阶段①：集数检测 ====================
  useEffect(() => {
    // ★ 缓存命中 → 跳过 LLM 检测，直接停留在 selecting 状态
    if (hasPreloaded) return;

    let cancelled = false;

    const detect = async () => {
      try {
        const token = localStorage.getItem("yr-ai-token");
        if (!token) throw new Error("[Episode Detect Error] 未登录，请先登录");

        const detectModel = useAppStore.getState().canvasSettings?.defaultLLMModel || "deepseek-v4-pro";

        const response = await fetchApi("/v1/chat/completions", {
          method: "POST",
          body: JSON.stringify({
            model: detectModel,
            messages: [
              { role: "system", content: DETECTION_PROMPT },
              { role: "user", content: `剧本内容：\n${scriptText}` },
            ],
            stream: false,
            max_tokens: 4096, // 集数检测输出很小，4096 足够
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          throw new Error(`[Episode Detect Error] HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content || "";

        if (!rawContent) throw new Error("[Episode Detect Error] LLM 返回空内容");

        // 解析 JSON（兼容 LLM 可能包裹 markdown code block）
        let cleanJson = rawContent.trim();
        const codeBlockMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) cleanJson = codeBlockMatch[1].trim();

        let parsed: EpisodicInfo[];
        try {
          parsed = JSON.parse(cleanJson);
        } catch {
          // JSON.parse 失败 → 尝试从文本中提取数组
          const arrStart = cleanJson.indexOf("[");
          const arrEnd = cleanJson.lastIndexOf("]");
          if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
            parsed = JSON.parse(cleanJson.substring(arrStart, arrEnd + 1));
          } else {
            throw new Error("[Episode Detect Error] LLM 返回内容无法解析为 JSON 数组");
          }
        }

        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error("[Episode Detect Error] 未检测到有效的段落结构");
        }

        // 校验必要字段
        for (const ep of parsed) {
          if (typeof ep.id !== "number" || !ep.label || !ep.preview) {
            throw new Error(`[Episode Detect Error] 段落数据格式不完整: ${JSON.stringify(ep)}`);
          }
        }

        if (!cancelled) {
          setEpisodes(parsed);
          setSelectedIds(new Set(parsed.map((ep) => ep.id))); // 默认全选
          setPhase("selecting");
          // ★ 通知父级：检测完成，可以缓存结果
          onEpisodesDetected?.(parsed);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error("[Episode Detect Error]", e);
          setErrorMsg(e.message || "集数检测失败");
          setPhase("error");
        }
      }
    };

    detect();
    return () => {
      cancelled = true;
    };
  }, [scriptText, preloadedEpisodes]);

  // ==================== 选择操作 ====================
  const toggleEpisode = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(episodes.map((ep) => ep.id)));
  const deselectAll = () => setSelectedIds(new Set());

  // ==================== 确认 → 拼接选中段落文本 ====================
  const handleConfirm = () => {
    const selected = episodes
      .filter((ep) => selectedIds.has(ep.id))
      .sort((a, b) => a.id - b.id); // 按原始顺序排列

    if (selected.length === 0) return;

    // 用 preview 文本在原文中定位，粗切割各段落。
    // 这里只做稳定的原文切片，不做任何语义改写，避免把剧情拼乱或丢失。
    const textParts: string[] = [];
    const fullText = scriptText;
    const normalizedFullText = fullText.replace(/\s+/g, "");

    for (let i = 0; i < selected.length; i++) {
      const ep = selected[i];
      // 取 preview 前40个非空白字作为搜索锚点，降低短预览命中偏差。
      const anchor = ep.preview.replace(/\s+/g, "").substring(0, 40);

      if (!anchor) continue;

      // 在去掉空白后的文本中找锚点
      const anchorIdx = normalizedFullText.indexOf(anchor);
      if (anchorIdx === -1) {
        // 找不到锚点时，不直接回退整段；优先保留原有已命中的段落，避免把段落边界全部冲掉。
        continue;
      }

      // 把 strippedText 索引映射回原文索引
      let charCount = 0;
      let originalStart = 0;
      for (let j = 0; j < fullText.length; j++) {
        if (fullText[j].match(/\S/)) {
          if (charCount === anchorIdx) {
            originalStart = j;
            break;
          }
          charCount++;
        }
        originalStart = j;
      }

      // 段落结束位置 = 下一段落的锚点位置（或文本末尾）
      let originalEnd = fullText.length;
      if (i < selected.length - 1) {
        const nextAnchor = selected[i + 1].preview.replace(/\s+/g, "").substring(0, 40);
        const nextAnchorIdx = normalizedFullText.indexOf(nextAnchor, anchorIdx + 1);
        if (nextAnchorIdx !== -1) {
          let nextCharCount = 0;
          for (let j = 0; j < fullText.length; j++) {
            if (fullText[j].match(/\S/)) {
              if (nextCharCount === nextAnchorIdx) {
                originalEnd = j;
                break;
              }
              nextCharCount++;
            }
          }
        }
      }

      const epText = fullText.substring(originalStart, originalEnd).trim();
      if (epText) textParts.push(epText);
    }

    // 降级：如果所有段落都找不到锚点 → 整段脚本。
    // 这是最后兜底，不参与正常拼接路径。
    const resultText = textParts.length > 0
      ? textParts.join("\n\n")
      : scriptText;

    onConfirm({ episodes: selected, text: resultText });
  };

  // ==================== 错误降级：整段提取 ====================
  const handleFallbackWhole = () => {
    onConfirm({
      episodes: [{ id: 1, label: "完整剧本", preview: scriptText.substring(0, 40).replace(/\n/g, " ") }],
      text: scriptText,
    });
  };

  // ==================== 检测中 UI ====================
  if (phase === "detecting") {
    return createPortal(
      <div
        className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-200"
        onClick={onCancel}
      >
        <div
          className="w-[420px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/[0.1] rounded-[24px] shadow-[0_40px_100px_rgba(0,0,0,0.95)] p-8 flex flex-col items-center gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-zinc-400" />
          </div>
          <p className="text-zinc-300 text-[14px] font-medium">正在分析剧本段落结构...</p>
          <p className="text-zinc-500 text-[11px] text-center leading-relaxed">
            LLM 正在按剧情识别集数/章节，<br />请稍候
          </p>
        </div>
      </div>,
      document.body
    );
  }

  // ==================== 错误 UI ====================
  if (phase === "error") {
    return createPortal(
      <div
        className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-200"
        onClick={onCancel}
      >
        <div
          className="w-[420px] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/[0.1] rounded-[24px] shadow-[0_40px_100px_rgba(0,0,0,0.95)] p-8 flex flex-col gap-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
              <X size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-zinc-200 text-[13px] font-medium">集数检测失败</p>
              <p className="text-zinc-500 text-[11px] mt-0.5 line-clamp-2">{errorMsg}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-5 py-2 text-[13px] text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/10 rounded-[12px] transition-all"
            >
              取消
            </button>
            <button
              onClick={handleFallbackWhole}
              className="px-5 py-2 text-[13px] font-bold text-white bg-white/10 hover:bg-white/15 rounded-[12px] transition-all"
            >
              整段提取
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // ==================== 选择 UI ====================
  const selectedCount = episodes.filter((ep) => selectedIds.has(ep.id)).length;
  const allSelected = selectedCount === episodes.length;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="w-[500px] max-h-[75vh] bg-[#0a0a0c]/95 backdrop-blur-3xl border border-white/[0.1] rounded-[24px] shadow-[0_40px_100px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-[15px] font-bold text-white tracking-wider">{title}</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              检测到剧本包含 <span className="text-white font-bold">{episodes.length}</span> 个段落
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* 快捷操作栏 */}
        <div className="px-6 py-2.5 border-b border-white/[0.05] flex items-center gap-3 shrink-0">
          <button
            onClick={allSelected ? deselectAll : selectAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px] font-medium transition-all border ${
              allSelected
                ? "bg-white/[0.1] text-white border-white/20"
                : "bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/10 border-white/[0.08]"
            }`}
          >
            {allSelected ? <CheckSquare size={13} /> : <Square size={13} />}
            {allSelected ? "已全选" : "全选"}
          </button>
          <button
            onClick={deselectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px] text-zinc-400 hover:text-white hover:bg-white/10 border border-white/[0.08] transition-all"
          >
            取消全选
          </button>
          <span className="ml-auto text-[11px] text-zinc-500 tabular-nums">
            已选 <span className="text-zinc-200 font-bold">{selectedCount}</span>/{episodes.length}
          </span>
        </div>

        {/* 段落列表 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-1.5">
          {episodes.map((ep) => {
            const isSelected = selectedIds.has(ep.id);
            return (
              <div
                key={ep.id}
                onClick={() => toggleEpisode(ep.id)}
                className={`flex items-start gap-3 p-3 rounded-[12px] cursor-pointer transition-all border group ${
                  isSelected
                    ? "bg-white/[0.06] border-white/20 hover:bg-white/[0.08]"
                    : "bg-[#050505]/40 border-white/[0.04] hover:border-white/10 hover:bg-white/[0.03]"
                }`}
              >
                <div
                  className={`mt-0.5 shrink-0 transition-colors ${
                    isSelected ? "text-white" : "text-zinc-600 group-hover:text-zinc-500"
                  }`}
                >
                  {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span
                    className={`text-[13px] font-bold truncate transition-colors ${
                      isSelected ? "text-white" : "text-zinc-300 group-hover:text-zinc-200"
                    }`}
                  >
                    {ep.label}
                  </span>
                  <span className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                    {ep.preview}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-end gap-3 shrink-0 bg-white/[0.01]">
          <button
            onClick={onCancel}
            className="px-5 py-2 text-[13px] text-zinc-400 hover:text-white bg-white/[0.02] hover:bg-white/10 rounded-[12px] transition-all"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className={`px-6 py-2 text-[13px] font-bold rounded-[12px] transition-all ${
              selectedCount > 0
                ? "bg-white/10 hover:bg-white/15 text-white"
                : "bg-white/[0.03] text-zinc-600 cursor-not-allowed"
            }`}
          >
            {confirmLabel} ({selectedCount}集)
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
