
export interface Voice {
  id: string;
  name: string;
  category: string;
  language: 'zh' | 'en' | 'mix' | 'jp' | 'es' | 'multi';
}

export const VOICES: Voice[] = [
  // 趣味方言
  { id: 'zh_female_wanqudashu_moon_bigtts', name: '湾区大叔', category: 'Dialect', language: 'zh' },
  { id: 'zh_female_daimengchuanmei_moon_bigtts', name: '呆萌川妹', category: 'Dialect', language: 'zh' },
  { id: 'zh_male_guozhoudege_moon_bigtts', name: '广州德哥', category: 'Dialect', language: 'zh' },
  { id: 'zh_male_beijingxiaoye_moon_bigtts', name: '北京小爷', category: 'Dialect', language: 'zh' },
  { id: 'zh_male_haoyuxiaoge_moon_bigtts', name: '浩宇小哥', category: 'Dialect', language: 'zh' },
  { id: 'zh_male_guangxiyuanzhou_moon_bigtts', name: '广西远舟', category: 'Dialect', language: 'zh' },
  { id: 'zh_female_meituojieer_moon_bigtts', name: '妹坨洁儿', category: 'Dialect', language: 'zh' },
  { id: 'zh_male_yuzhouzixuan_moon_bigtts', name: '豫州子轩', category: 'Dialect', language: 'zh' },
  { id: 'zh_female_wanwanxiaohe_moon_bigtts', name: '湾湾小何', category: 'Dialect', language: 'zh' },
  { id: 'zh_male_jingqiangkanye_moon_bigtts', name: '京腔侃爷/Harmony', category: 'Dialect', language: 'mix' },

  // 通用场景
  { id: 'zh_male_shaonianzixin_moon_bigtts', name: '少年梓辛/Brayan', category: 'General', language: 'mix' },
  { id: 'zh_female_linjianvhai_moon_bigtts', name: '邻家女孩', category: 'General', language: 'zh' },
  { id: 'zh_male_yuanboxiaoshu_moon_bigtts', name: '渊博小叔', category: 'General', language: 'zh' },
  { id: 'zh_male_yangguangqingnian_moon_bigtts', name: '阳光青年', category: 'General', language: 'zh' },
  { id: 'zh_female_shuangkuaisisi_moon_bigtts', name: '爽快思思/Skye', category: 'General', language: 'mix' },
  { id: 'zh_male_wennuanahu_moon_bigtts', name: '温暖阿虎/Alvin', category: 'General', language: 'mix' },
  { id: 'zh_female_tianmeixiaoyuan_moon_bigtts', name: '甜美小源', category: 'General', language: 'zh' },
  { id: 'zh_female_qingchezizi_moon_bigtts', name: '清澈梓梓', category: 'General', language: 'zh' },
  { id: 'zh_male_jieshuoxiaoming_moon_bigtts', name: '解说小明', category: 'General', language: 'zh' },
  { id: 'zh_female_kailangjiejie_moon_bigtts', name: '开朗姐姐', category: 'General', language: 'zh' },
  { id: 'zh_male_linjiananhai_moon_bigtts', name: '邻家男孩', category: 'General', language: 'zh' },
  { id: 'zh_female_tianmeiyueyue_moon_bigtts', name: '甜美悦悦', category: 'General', language: 'zh' },
  { id: 'zh_female_xinlingjitang_moon_bigtts', name: '心灵鸡汤', category: 'General', language: 'zh' },
  { id: 'zh_female_cancan_mars_bigtts', name: '灿灿', category: 'General', language: 'zh' },
  { id: 'zh_female_zhixingnvsheng_mars_bigtts', name: '知性女声', category: 'General', language: 'zh' },
  { id: 'zh_female_qingxinnvsheng_mars_bigtts', name: '清新女声', category: 'General', language: 'mix' },

  // 角色扮演
  { id: 'zh_female_meilinvyou_moon_bigtts', name: '魅力女友', category: 'Roleplay', language: 'zh' },
  { id: 'zh_male_shenyeboke_moon_bigtts', name: '深夜播客', category: 'Roleplay', language: 'zh' },
  { id: 'zh_female_sajiaonvyou_moon_bigtts', name: '柔美女友', category: 'Roleplay', language: 'zh' },
  { id: 'zh_female_yuanqinvyou_moon_bigtts', name: '撒娇学妹', category: 'Roleplay', language: 'zh' },
  { id: 'zh_female_gaolengyujie_moon_bigtts', name: '高冷御姐', category: 'Roleplay', language: 'zh' },
  { id: 'zh_male_aojiaobazong_moon_bigtts', name: '傲娇霸总', category: 'Roleplay', language: 'zh' },
  { id: 'ICL_zh_female_bingruoshaonv_tob', name: '病弱少女', category: 'Roleplay', language: 'zh' },
  { id: 'ICL_zh_female_huoponvhai_tob', name: '活泼女孩', category: 'Roleplay', language: 'zh' },
  { id: 'ICL_zh_female_heainainai_tob', name: '和蔼奶奶', category: 'Roleplay', language: 'zh' },
  { id: 'ICL_zh_female_linjuayi_tob', name: '邻居阿姨', category: 'Roleplay', language: 'zh' },
  { id: 'zh_female_wenrouxiaoya_moon_bigtts', name: '温柔小雅', category: 'Roleplay', language: 'zh' },
  { id: 'zh_male_dongfanghaoran_moon_bigtts', name: '东方浩然', category: 'Roleplay', language: 'zh' },
  { id: 'zh_male_tiancaitongsheng_mars_bigtts', name: '天才童声', category: 'Roleplay', language: 'zh' },
  { id: 'zh_male_naiqimengwa_mars_bigtts', name: '奶气萌娃', category: 'Roleplay', language: 'zh' },
  { id: 'zh_male_sunwukong_mars_bigtts', name: '猴哥', category: 'Roleplay', language: 'zh' },
  { id: 'zh_male_xionger_mars_bigtts', name: '熊二', category: 'Roleplay', language: 'zh' },
  { id: 'zh_female_peiqi_mars_bigtts', name: '佩奇猪', category: 'Roleplay', language: 'zh' },
  { id: 'zh_female_popo_mars_bigtts', name: '婆婆', category: 'Roleplay', language: 'zh' },

  // 多语种/外语
  { id: 'multi_female_shuangkuaisisi_moon_bigtts', name: 'はるこ/Esmeralda', category: 'Multilingual', language: 'multi' },
  { id: 'multi_male_jingqiangkanye_moon_bigtts', name: 'かずね/Javier or Álvaro', category: 'Multilingual', language: 'multi' },
  { id: 'multi_female_gaolengyujie_moon_bigtts', name: 'あけみ', category: 'Multilingual', language: 'multi' },
  { id: 'multi_male_wanqudashu_moon_bigtts', name: 'ひろし/Roberto', category: 'Multilingual', language: 'multi' },
  { id: 'en_female_anna_mars_bigtts', name: 'Anna', category: 'English', language: 'en' },
  
  // 播报解说
  { id: 'zh_male_changtianyi_mars_bigtts', name: '悬疑解说', category: 'Narration', language: 'zh' },
];

export const getVoiceName = (id: string) => VOICES.find(v => v.id === id)?.name || id;

export const getVoiceId = (nameOrId: string): string | undefined => {
  const voice = VOICES.find(v => v.id === nameOrId || v.name === nameOrId);
  return voice?.id;
};
