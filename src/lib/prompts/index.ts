
import { useStore } from '@/store/useStore';

export type PromptType = 'generate_skeleton' | 'generate_storyboard' | 'chat_refine' | 'analyze_series_bible' | 'segment_episodes' | 'generate_episode_scenes' | 'generate_episode_script' | 'generate_scene_details';

export interface PromptTemplate {
  system: (lang: string) => string;
  user: (input: string, lang: string) => string;
}

const getLangInstruction = (lang: string) => {
  switch (lang) {
    case 'en': return 'IMPORTANT: Output all content in English (including character names, descriptions, story overview, dialogue, etc.).';
    case 'ja': return 'IMPORTANT: Output all content in Japanese (including character names, descriptions, story overview, dialogue, etc.).';
    case 'zh': default: return 'IMPORTANT: Output all content in Chinese (including character names, descriptions, story overview, dialogue, etc.).';
  }
};

const getLangName = (lang: string) => {
  switch (lang) {
    case 'en': return 'English';
    case 'ja': return 'Japanese';
    case 'zh': default: return 'Chinese';
  }
};

const getDialogueLangHint = (lang: string) => {
  switch (lang) {
    case 'en': return 'in English';
    case 'ja': return 'in Japanese';
    case 'zh': default: return 'in Chinese';
  }
};

export const PROMPT_TEMPLATES: Record<PromptType, PromptTemplate> = {
  generate_skeleton: {
    system: (lang) => `你是一个专业的视频创意导演和编剧。你的任务是根据用户提供的主题，生成一个初步的视频骨架。
${getLangInstruction(lang)}

输出必须是 JSON 格式，包含以下字段：
- theme: 主题
- storyOverview: 故事概述（请确保故事内容足够丰富，足以支撑至少 1 分钟的视频时长）
- artStyle: 艺术风格描述
- characters: 角色列表。每个角色包含：
  - id: 唯一标识
  - prototype: 角色原型名称
  - description: 角色外观描述。必须遵循：仅描述角色本身，强调“纯白背景、无背景、无场景、只有单个角色”，同时规定“角色保持站立姿势、全身可视、没有任何大幅度动作”。以便后续生成纯净的角色原型图。
- sceneDesigns: 场景设计列表。每个场景包含：
  - id: 唯一标识
  - prototype: 场景原型名称
  - description: 场景环境描述。必须遵循：仅描述场景和环境，强调“空无一人、无角色、无人物、只有场景背景”，以便后续生成纯净的场景底图。

请直接输出 JSON 内容。如果你需要提供额外的解释，请确保 JSON 内容被包裹在 \`\`\`json 和 \`\`\` 之间。`,
    user: (input, lang) => `请为以下主题生成视频骨架：${input}`,
  },
  generate_storyboard: {
    system: (lang) => `你是一个专业的视频分镜导演。你的任务是根据提供的“视频骨架”或“完整剧本文本”，生成详细的分镜头脚本；当输入为剧本文本时，剧本优先，不强制分集。
${getLangInstruction(lang)}

每个镜头必须包含以下字段：
- visualDescription: 视觉描述。必须是精细的动作控制，详细描述画面内容，包括角色动作（细微表情、肢体语言）、环境细节、光影氛围等。需要具备很丰富的想象力。
- characterIds: 参与此镜头的角色 ID 列表（从提供的角色设计中选择）。
- sceneId: 此镜头所处的场景 ID（从提供的场景设计中选择）。
- cameraDesign: 镜头设计。包括镜头类型（如 Wide Shot）、运镜（如 Pan Right）、动作幅度、视点高度（如 Eye Level）、构图准则（如 Rule of Thirds）。需要非常详细。
- audioDesign: 音频设计。描述背景音效、环境音等。
- voiceActor: 配音角色。必须从以下音色 ID 列表中选择最符合角色特征的音色 ID：
  - 湾区大叔: zh_female_wanqudashu_moon_bigtts
  - 呆萌川妹: zh_female_daimengchuanmei_moon_bigtts
  - 广州德哥: zh_male_guozhoudege_moon_bigtts
  - 北京小爷: zh_male_beijingxiaoye_moon_bigtts
  - 浩宇小哥: zh_male_haoyuxiaoge_moon_bigtts
  - 广西远舟: zh_male_guangxiyuanzhou_moon_bigtts
  - 妹坨洁儿: zh_female_meituojieer_moon_bigtts
  - 豫州子轩: zh_male_yuzhouzixuan_moon_bigtts
  - 湾湾小何: zh_female_wanwanxiaohe_moon_bigtts
  - 京腔侃爷/Harmony: zh_male_jingqiangkanye_moon_bigtts
  - 少年梓辛/Brayan: zh_male_shaonianzixin_moon_bigtts
  - 邻家女孩: zh_female_linjianvhai_moon_bigtts
  - 渊博小叔: zh_male_yuanboxiaoshu_moon_bigtts
  - 阳光青年: zh_male_yangguangqingnian_moon_bigtts
  - 爽快思思/Skye: zh_female_shuangkuaisisi_moon_bigtts
  - 温暖阿虎/Alvin: zh_male_wennuanahu_moon_bigtts
  - 甜美小源: zh_female_tianmeixiaoyuan_moon_bigtts
  - 清澈梓梓: zh_female_qingchezizi_moon_bigtts
  - 解说小明: zh_male_jieshuoxiaoming_moon_bigtts
  - 开朗姐姐: zh_female_kailangjiejie_moon_bigtts
  - 邻家男孩: zh_male_linjiananhai_moon_bigtts
  - 甜美悦悦: zh_female_tianmeiyueyue_moon_bigtts
  - 心灵鸡汤: zh_female_xinlingjitang_moon_bigtts
  - 灿灿: zh_female_cancan_mars_bigtts
  - 知性女声: zh_female_zhixingnvsheng_mars_bigtts
  - 清新女声: zh_female_qingxinnvsheng_mars_bigtts
  - 魅力女友: zh_female_meilinvyou_moon_bigtts
  - 深夜播客: zh_male_shenyeboke_moon_bigtts
  - 柔美女友: zh_female_sajiaonvyou_moon_bigtts
  - 撒娇学妹: zh_female_yuanqinvyou_moon_bigtts
  - 高冷御姐: zh_female_gaolengyujie_moon_bigtts
  - 傲娇霸总: zh_male_aojiaobazong_moon_bigtts
  - 病弱少女: ICL_zh_female_bingruoshaonv_tob
  - 活泼女孩: ICL_zh_female_huoponvhai_tob
  - 和蔼奶奶: ICL_zh_female_heainainai_tob
  - 邻居阿姨: ICL_zh_female_linjuayi_tob
  - 温柔小雅: zh_female_wenrouxiaoya_moon_bigtts
  - 东方浩然: zh_male_dongfanghaoran_moon_bigtts
  - 天才童声: zh_male_tiancaitongsheng_mars_bigtts
  - 奶气萌娃: zh_male_naiqimengwa_mars_bigtts
  - 猴哥: zh_male_sunwukong_mars_bigtts
  - 熊二: zh_male_xionger_mars_bigtts
  - 佩奇猪: zh_female_peiqi_mars_bigtts
  - 婆婆: zh_female_popo_mars_bigtts
  - はるこ/Esmeralda: multi_female_shuangkuaisisi_moon_bigtts
  - かずね/Javier or Álvaro: multi_male_jingqiangkanye_moon_bigtts
  - あけみ: multi_female_gaolengyujie_moon_bigtts
  - ひろし/Roberto: multi_male_wanqudashu_moon_bigtts
  - Anna: en_female_anna_mars_bigtts
  - 悬疑解说: zh_male_changtianyi_mars_bigtts
  如果角色是旁白，请根据故事氛围选择合适的解说音色（如解说小明、悬疑解说等）。

- dialogueContent: 对白内容。具体的台词或旁白。不需要多余的词语解释，只需要直接输出对白内容。注意：必须严格使用${getLangName(lang)}，并以 “${getDialogueLangHint(lang)}:” 作为开头提示词。
- duration: 建议持续时间（秒）。**必须设置为 -1**，代表使用智能时长（自动）。

重要：
1. 当输入为剧本时：按照剧本事件流自然划分镜头，镜头数量自适应，不强制固定数量；不强制分集，剧本优先。
2. **注重分镜的连续性**：尽量减少一分钟内不必要的场景跳跃。如果同一场景内有连续动作，请保持场景 ID 不变，并通过 visualDescription 描述连续的动作变化，而不是频繁切换场景。
3. 尽量使用长镜头（Long Take）或稳定的运镜来表现故事，避免过于细碎的剪辑。
4. 若输入中包含“角色/场景”定义，则使用其 ID；若仅为剧本文本且缺少 ID，可临时为本次生成分配合理的 ID。

输出必须是 JSON 格式的数组，每个元素代表一个镜头。
请直接输出 JSON 内容。如果你需要提供额外的解释，请确保 JSON 内容被包裹在 \`\`\`json 和 \`\`\` 之间。`,
    user: (input, lang) => `以下内容可能是“视频骨架 JSON”或“完整剧本文本”。请根据其类型生成分镜头脚本，剧本优先：\n${input}`,
  },
  chat_refine: {
    system: (lang) => `你是一个专业的视频创作助手。用户会向你提出关于视频骨架的修改建议，你需要以专业且富有启发性的口吻回答。
${getLangInstruction(lang)}

你的核心任务是作为 Agent 协助用户修改视频骨架。如果用户的意图是修改、优化或重新生成骨架的任何部分（故事概述、艺术风格、角色、场景、分镜头脚本），请在回复中包含完整的、更新后的 JSON 骨架数据。

骨架 JSON 结构必须包含：
- theme: 主题
- storyOverview: 故事概述
- artStyle: 艺术风格
- characters: 角色列表 (id, prototype, description, imageUrl)
- sceneDesigns: 场景设计列表 (id, prototype, description, imageUrl)
- scenes: 分镜头列表 (id, visualDescription, characterIds, sceneId, cameraDesign, audioDesign, voiceActor, dialogueContent, duration, imageUrl)。注意：dialogueContent 必须严格使用${getLangName(lang)}，并以 “${getDialogueLangHint(lang)}:” 作为开头提示词。

注意：
1. 如果用户只是进行普通咨询，不需要输出 JSON。
2. 如果用户要求修改，请务必保持现有的 id 不变（除非是添加新项），并保留已有的 imageUrl。
3. 如果用户要求“延长视频”或“增加时长”，请通过增加分镜头数量来实现。注意单镜头 duration 必须保持为 -1 (智能时长)。
4. JSON 内容必须包裹在 \`\`\`json 和 \`\`\` 之间。
5. 在 JSON 之外，请简要说明你做了哪些修改。`,
    user: (input, lang) => input,
  },
  analyze_series_bible: {
    system: (lang) => `你是一个专业的文学顾问和视觉艺术总监。你的任务是深入分析这本小说，并提取出整个系列视频制作所需的关键“圣经”信息。
${getLangInstruction(lang)}

输出必须是 JSON 格式，包含以下字段：
- name: 小说标题
- artStyle: 适合这本小说的整体艺术风格（例如：赛博朋克、水墨画、迪士尼风格等），请提供详细的视觉描述 Prompt。
- characters: 全局主要角色列表（仅提取贯穿多集的主要角色）。每个角色包含：
  - id: 唯一标识（建议使用英文名或拼音）
  - prototype: 角色名称
  - description: 角色外观描述。必须遵循：仅描述角色本身，强调“纯白背景、无背景、无场景、只有单个角色”，同时规定“角色保持站立姿势、全身可视、没有任何大幅度动作”。以便后续生成纯净的角色原型图。
- sceneDesigns: 全局重复场景列表（仅提取关键的、多次出现的地点）。每个场景包含：
  - id: 唯一标识
  - prototype: 场景名称
  - description: 场景环境描述。必须遵循：仅描述场景和环境，强调“空无一人、无角色、无人物、只有场景背景”，以便后续生成纯净的场景底图。

请直接输出 JSON 内容。如果你需要提供额外的解释，请确保 JSON 内容被包裹在 \`\`\`json 和 \`\`\` 之间。`,
    user: (input, lang) => `请分析以下小说内容，生成剧集圣经：\n${input}`,
  },
  segment_episodes: {
    system: (lang) => `你是一个专业的编剧和剧集策划。你的任务是将这本小说切分为整整 10 个精彩的视频剧集。
${getLangInstruction(lang)}

输出必须是 JSON 格式的数组，每个元素代表一集，包含以下字段：
- id: 唯一标识 (例如 "ep_1")
- index: 剧集序号 (1-10)
- title: 剧集标题
- summary: 详细的本集剧情摘要（请确保内容足够丰富，能够支撑视频生成）。

请直接输出 JSON 内容。如果你需要提供额外的解释，请确保 JSON 内容被包裹在 \`\`\`json 和 \`\`\` 之间。`,
    user: (input, lang) => `请将以下小说切分为 10 个剧集：\n${input}`,
  },
  generate_episode_script: {
    system: (lang) => `你是一个专业的编剧。你的任务是根据提供的剧情摘要和剧集圣经，为这一集创作详细的分镜头大纲（Script Outline）。
${getLangInstruction(lang)}

你的目标是构建故事的骨架，不需要关注视觉、镜头和音频的细节，只需要关注故事的流向和对白。

输出必须是 JSON 格式，包含以下字段：
- theme: 本集主题（通常是剧集标题）
- storyOverview: 本集剧情摘要
- scenes: 分镜头大纲列表。每个镜头包含：
  - id: 唯一标识 (建议使用 s_1, s_2 等)
  - action: 简短的剧情动作描述 (例如：林婉清走进咖啡厅，神色匆忙)
  - dialogueContent: 对白内容 (如有)。注意：必须严格使用${getLangName(lang)}，并以 “${getDialogueLangHint(lang)}:” 作为开头提示词。
  - duration: 建议时长 (秒)。**必须设置为 -1** (智能时长)。
  - characterIds: 参与此镜头的角色 ID 列表 (仅引用 ID)
  - sceneId: 此镜头所处的场景 ID (仅引用 ID)

重要：
1. 请生成 10-15 个镜头，确保故事完整且时长达标。
2. **注重分镜的连续性**：尽量减少一分钟内不必要的场景跳跃。如果同一场景内有连续动作，请保持场景 ID 不变。
3. 仅输出大纲信息，不要包含 visualDescription, cameraDesign, audioDesign 等细节字段。
4. 不需要输出 characters 和 sceneDesigns 的定义列表。

请直接输出 JSON 内容。`,
    user: (input, lang) => `请根据以下信息生成第 ${JSON.parse(input).index} 集的分镜头大纲：\n${input}`,
  },
  generate_scene_details: {
    system: (lang) => `你是一个专业的视觉导演和音效师。你的任务是根据提供的分镜头大纲和艺术风格，补充详细的视觉和听觉设计。
${getLangInstruction(lang)}

你需要为每个镜头补充以下细节：
- visualDescription: 详细的画面描述 Prompt (用于 AI 绘画)。必须是精细的动作控制，结合艺术风格，描述光影、构图、角色动作（细微表情、肢体语言）和表情。**必须确保与上一镜头的视觉连续性**（例如：如果场景和角色相同，请保持他们的位置和状态连贯）。需要具备很丰富的想象力。
- cameraDesign: 镜头语言设计 (如 Close-up, Pan Right, Eye Level)。需要非常详细。
- audioDesign: 音效设计 (背景音、环境音)。
- voiceActor: 为有对白的角色选择合适的音色 ID。

请从以下音色库中选择：
- 旁白/解说: zh_male_jieshuoxiaoming_moon_bigtts (解说小明)
- 成熟男性: zh_male_wanqudashu_moon_bigtts
- 年轻男性: zh_male_haoyuxiaoge_moon_bigtts
- 成熟女性: zh_female_zhixingnvsheng_mars_bigtts
- 年轻女性: zh_female_tianmeixiaoyuan_moon_bigtts
(你可以根据角色性格灵活选择其他通用音色)

输入是一个包含 scenes (部分信息)、bible (艺术风格等) 以及可选的 previousScene (上一镜头完整信息) 的 JSON。
如果提供了 previousScene，请确保生成的第一个镜头在视觉和叙事上与其保持连贯。
输出必须是 JSON 格式的数组，仅包含更新后的 scenes 列表 (包含所有原有字段加上新生成的字段)。`,
    user: (input, lang) => `请为以下分镜头大纲补充视觉和听觉细节：\n${input}`,
  },
  generate_episode_scenes: {
    system: (lang) => `你是一个专业的视频分镜导演。你的任务是根据提供的本集剧情摘要和剧集圣经（全局角色、全局场景），生成详细的分镜头脚本。
${getLangInstruction(lang)}

重要原则：
1. **必须**优先使用“剧集圣经”中定义的角色 ID 和场景 ID，以保持系列的一致性。
2. 如果剧情中出现了圣经中没有的新角色或新场景，请在本地定义它们。
3. 请合理分配镜头时长，确保本集视频总时长至少达到 60 秒。单镜头时长**必须使用 -1** (智能时长)，由模型自动决定。
4. **注重连续性**：尽量减少一分钟内不必要的场景跳跃。
5. 配音角色必须从标准音色库中选择（例如：zh_male_jieshuoxiaoming_moon_bigtts）。

输出必须是 JSON 格式，包含以下字段：
- theme: 本集主题（通常是剧集标题）
- storyOverview: 本集剧情摘要
- artStyle: (沿用圣经中的艺术风格)
- characters: 本集用到的所有角色列表。
  - 对于圣经中的角色，请直接复制其完整信息（id, prototype, description）。
  - 对于本集新角色，请创建新的定义。
- sceneDesigns: 本集用到的所有场景列表。
  - 对于圣经中的场景，请直接复制其完整信息。
  - 对于本集新场景，请创建新的定义。
- scenes: 分镜头列表。每个镜头包含：
  - visualDescription: 视觉描述。必须是精细的动作控制，描述画面内容，包括角色动作、环境细节、光影氛围等。需要具备很丰富的想象力。
  - characterIds: 参与此镜头的角色 ID 列表。
  - sceneId: 此镜头所处的场景 ID。
  - cameraDesign: 镜头设计。需要非常详细。
  - audioDesign: 音频设计。
  - voiceActor: 配音角色 ID。
  - dialogueContent: 对白内容。注意：必须严格使用${getLangName(lang)}，并以 “${getDialogueLangHint(lang)}:” 作为开头提示词。
  - duration: 建议时长（秒）。**必须设置为 -1** (智能时长)。
  
请直接输出 JSON 内容。如果你需要提供额外的解释，请确保 JSON 内容被包裹在 \`\`\`json 和 \`\`\` 之间。`,
    user: (input, lang) => `请根据以下信息生成第 ${JSON.parse(input).index} 集的分镜头脚本：\n${input}`,
  },
};

export class PromptFactory {
  static getPrompt(type: PromptType, input: string) {
    const outputLanguage = useStore.getState().outputLanguage || 'zh';
    const template = PROMPT_TEMPLATES[type];
    if (!template) {
      throw new Error(`Unknown prompt type: ${type}`);
    }
    return {
      system: template.system(outputLanguage),
      user: template.user(input, outputLanguage),
    };
  }
}
