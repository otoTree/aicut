# 技术规格书: 多集生成

## 1. 架构概述

为了支持多集生成，我们将在现有的 `VideoSkeleton` 之上引入一个“系列（Series）”层。
- **当前**：`输入 -> VideoSkeleton (一次性)`
- **新增**：`输入 (小说) -> SeriesBible + EpisodePlan -> [VideoSkeleton, VideoSkeleton, ...]`

## 2. 数据结构

### 2.1 剧集圣经 (Series Bible)
存储可跨剧集复用的全局资产。

```typescript
interface SeriesBible {
  id: string;
  name: string; // 小说标题
  artStyle: string;
  characters: Character[]; // 全局角色
  sceneDesigns: SceneDesign[]; // 全局重复场景
}
```

### 2.2 剧集规划 (Episode Plan)
表示叙事结构。

```typescript
interface EpisodeSummary {
  id: string;
  index: number; // 1-10
  title: string;
  summary: string; // 本集剧情
  status: 'pending' | 'generated';
  skeletonId?: string; // 链接到完整的 VideoSkeleton
}
```

### 2.3 扩展应用状态 (Extended App State)
我们可能需要在 `useStore` 中添加一个新的切片，或者为系列模式建立单独的存储。

```typescript
interface SeriesState {
  novelContent: string;
  bible: SeriesBible | null;
  episodes: EpisodeSummary[];
  // 将剧集 ID 映射到其完整的骨架数据
  episodeSkeletons: Record<string, VideoSkeleton>; 
}
```

## 3. 工作流与提示词 (Workflow & Prompts)

我们将生成过程分为 3 个独立的 LLM 调用。

### 3.1 第一步：圣经提取 (`analyze_series_bible`)
- **输入**：完整小说文本（或大块文本）。
- **系统提示词**：“分析小说。提取主要角色（姓名、外貌描述）、关键重复地点（场景设计）以及整体艺术风格。输出 JSON。”
- **输出**：`SeriesBible` 对象。

### 3.2 第二步：故事分段 (`segment_episodes`)
- **输入**：完整小说文本。
- **系统提示词**：“将这本小说切分为整整 10 个不同的剧集。为每一集提供标题和详细摘要。输出 JSON 数组。”
- **输出**：`EpisodeSummary[]`。

### 3.3 第三步：分集分镜生成 (`generate_episode_scenes`)
- **输入**：
    - `EpisodeSummary` (当前剧情)。
    - `SeriesBible` (上下文)。
- **系统提示词**：“生成本集的分镜头（Scenes）。
    - 使用圣经中定义的角色：[全局角色列表]。
    - 使用圣经中定义的场景：[全局场景列表]。
    - 如果出现新角色/场景，请在本地定义。
    - 输出：`Scenes` 列表（分镜头画面）。”
- **注意**：这将取代系列工作流中单体的 `generate_skeleton`。

## 4. 前端实现

### 4.1 UI 组件
- **NovelInput**：用于粘贴小说的大型文本区域。
- **BibleReview**：在生成前编辑/合并角色和场景的界面。
- **EpisodeList**：显示 1-10 集的侧边栏或网格。
- **EpisodeEditor**：现有的 `SkeletonEditor`，但作用域限定于特定剧集。

### 4.2 状态管理
- 修改 `useStore` 以处理 `SeriesState`。
- 确保切换剧集时可以将 `VideoSkeleton` 加载/卸载到编辑器视图中。

## 5. 存储
- **IndexedDB**：小说和 10 个剧集的数据可能会超出 LocalStorage 限制。我们应该依赖 `db-client.ts` (Dexie) 来存储系列数据。
- **结构**：
    - 表 `projects`：`{ id, type: 'single' | 'series', data: ... }`

## 6. 迁移策略
1.  实现 `SeriesBible` 和 `EpisodeSummary` 接口。
2.  在 `src/lib/prompts/index.ts` 中创建提示词模板。
3.  在 `SkeletonEditor`（或新的 `SeriesEditor`）中添加逻辑以处理该流程。
