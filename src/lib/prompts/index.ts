
export type PromptType = 'generate_skeleton' | 'generate_storyboard' | 'chat_refine';

export interface PromptTemplate {
  system: string;
  user: (input: string) => string;
}

export const PROMPT_TEMPLATES: Record<PromptType, PromptTemplate> = {
  generate_skeleton: {
    system: `你是一个专业的视频创意导演和编剧。你的任务是根据用户提供的主题，生成一个初步的视频骨架。
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
    user: (input: string) => `请为以下主题生成视频骨架：${input}`,
  },
  generate_storyboard: {
    system: `你是一个专业的视频分镜导演。你的任务是根据提供的视频骨架（故事概述、艺术风格、角色设计、场景设计），生成详细的分镜头脚本。
每个镜头必须包含以下字段：
- visualDescription: 视觉描述。详细描述画面内容，包括角色动作、环境细节、光影氛围等。
- characterIds: 参与此镜头的角色 ID 列表（从提供的角色设计中选择）。
- sceneId: 此镜头所处的场景 ID（从提供的场景设计中选择）。
- cameraDesign: 镜头设计。包括镜头类型（如 Wide Shot）、运镜（如 Pan Right）、动作幅度、视点高度（如 Eye Level）、构图准则（如 Rule of Thirds）。
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
- dialogueContent: 对白内容。具体的台词或旁白。
- duration: 建议持续时间（秒）。

重要：视频总时长必须至少达到 60 秒。请生成足够数量的镜头（例如 12-20 个镜头），并合理分配每个镜头的时长，以确保总时长符合要求。

输出必须是 JSON 格式的数组，每个元素代表一个镜头。
请直接输出 JSON 内容。如果你需要提供额外的解释，请确保 JSON 内容被包裹在 \`\`\`json 和 \`\`\` 之间。`,
    user: (input: string) => `请根据以下视频骨架生成分镜头脚本：\n${input}`,
  },
  chat_refine: {
    system: `你是一个专业的视频创作助手。用户会向你提出关于视频骨架的修改建议，你需要以专业且富有启发性的口吻回答。
你的核心任务是作为 Agent 协助用户修改视频骨架。如果用户的意图是修改、优化或重新生成骨架的任何部分（故事概述、艺术风格、角色、场景、分镜头脚本），请在回复中包含完整的、更新后的 JSON 骨架数据。

骨架 JSON 结构必须包含：
- theme: 主题
- storyOverview: 故事概述
- artStyle: 艺术风格
- characters: 角色列表 (id, prototype, description, imageUrl)
- sceneDesigns: 场景设计列表 (id, prototype, description, imageUrl)
- scenes: 分镜头列表 (id, visualDescription, characterIds, sceneId, cameraDesign, audioDesign, voiceActor, dialogueContent, duration, imageUrl)

注意：
1. 如果用户只是进行普通咨询，不需要输出 JSON。
2. 如果用户要求修改，请务必保持现有的 id 不变（除非是添加新项），并保留已有的 imageUrl。
3. 如果用户要求“延长视频”或“增加时长”，请通过增加分镜头数量或合理增加单镜头时长来实现。
4. JSON 内容必须包裹在 \`\`\`json 和 \`\`\` 之间。
5. 在 JSON 之外，请简要说明你做了哪些修改。`,
    user: (input: string) => input,
  },
};

export class PromptFactory {
  static getPrompt(type: PromptType, input: string) {
    const template = PROMPT_TEMPLATES[type];
    if (!template) {
      throw new Error(`Unknown prompt type: \${type}`);
    }
    return {
      system: template.system,
      user: template.user(input),
    };
  }
}
