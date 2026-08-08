// ============================================================
// 无中生 - 参数化导演路由引擎 (Parameterized Director Router)
// 核心设计：骨架不动，变量注入。四个规则仓库+路由引擎。
// 最后更新：2026-07-09
// ============================================================

// ---- 通用类型定义 -----------------------------------------

export interface LightingEntry {
  key: string;
  label: string;
  prompt: string;
  description: string;
  category: "key" | "fill" | "motivated" | "special_style";
}

export interface TempoProfile {
  key: string;
  label: string;
  durationRange: [number, number];
  cutStyle: string;
  cutDescription: string;
  cameraSpeedPrompt: string;
  cameraSpeedDescription: string;
  visualDensityDescription: string;
}

export interface CameraMovement {
  key: string;
  label: string;
  prompt: string;
  description: string;
  category: "static" | "displacement" | "height" | "in_lens" | "aerial" | "special_handheld" | "special_pov" | "special_compound";
  compatibleTempos: string[];
}

export interface TransitionType {
  key: string;
  label: string;
  prompt: string;
  whenToUse: string;
  whenForbidden: string;
  tempoMapping: Record<string, number>;
}

export interface ShotSize {
  key: string;
  label: string;
  prompt: string;
  densityContribution: number;
}

export interface GenrePreset {
  key: string;
  label: string;
  aliases: string[];
  identity: string;
  emotion: string;
  lightingSuggestions: { keyLight: string[]; fillLight: string[]; motivatedLight: string[]; specialStyle: string[]; contrastRatio: string; note: string };
  tempoSuggestions: { recommended: string; ceiling: string; floor: string; note: string };
  cameraSuggestions: { recommended: string[]; avoidUnless: string[]; note: string };
  shotSizeSuggestions: { recommendation: string; composition: string; density: string };
  colorPalette: { primary: string; accent: string; note: string };
  signatureTechniques: string;
  genreRules: string;
  llmInjection: string;
}

export interface MutationType {
  key: string;
  label: string;
  prompt: string;
  description: string;
  usageRole: "Cutaway" | "Insert" | "Reaction Shot" | "Establishing";
  contextFit: string;
  contextForbidden: string;
  compatibleGenres: string[];
  incompatibleGenres: string[];
}

export interface DirectorContext {
  genre: string;
  genreLabel: string;
  tempo: string;
  tempoLabel: string;
  keyLight: LightingEntry | null;
  fillLight: LightingEntry | null;
  motivatedLight: LightingEntry | null;
  specialStyle: LightingEntry | null;
  tempoProfile: TempoProfile | null;
  cameraPreference: string;
  visualTone: string;
  lightingPrompt: string;
  cameraPrompt: string;
  mutation: { triggered: boolean; mutationType?: MutationType; safetyNote?: string };
  llmContextBlock: string;
}

export const MUTATION_SAFETY_RULES = {
  triggerProbability: 0.1,
  maxRetries: 3,
  minNormalShotsBetween: 3,
  maxMutationRatio: 0.15,
  axisLock: true,
  transitionOnly: true,
  allowedIdentities: ["Cutaway", "Insert", "Reaction Shot"] as string[],
} as const;

// 辅助查找函数
function findByKey<T extends { key: string }>(arr: T[], key: string): T | undefined {
  return arr.find(item => item.key === key);
}

// ============================================================
// 仓库 1：影视级布光字典 - 38 种
// ============================================================

export const KEY_LIGHT: LightingEntry[] = [
  { key: "rembrandt", label: "伦勃朗光 Rembrandt", category: "key", prompt: "Rembrandt lighting, key light at 45 degrees above and to the side, signature triangle patch of light under the eye on shadow side, dramatic chiaroscuro, deep shadows with luminous highlights", description: "主光从人物侧上方约45deg照射，在暗侧脸颊下方形成标志性的倒三角光斑。光源位置：人物正面偏侧45deg，仰角45deg-60deg。光比通常4:1至8:1。情绪：深沉、庄重、神秘、戏剧化。适用：古装权谋、人物独白、历史正剧。" },
  { key: "butterfly", label: "蝴蝶光 Butterfly/Paramount", category: "key", prompt: "Butterfly lighting, key light directly above and in front of subject, centered at high angle, small butterfly-shaped shadow directly under nose, symmetrical illumination, glamorous soft polished look", description: "主光从人物正面上方居中照射，在鼻下形成蝴蝶形对称小阴影。好莱坞黄金时代最经典的女性美化布光方式。光源位置：人物正面前方，仰角45deg-70deg。情绪：魅惑、优雅、完美、偶像感。适用：甜宠言情女主、偶像剧、时尚广告。" },
  { key: "split", label: "分割光 Split", category: "key", prompt: "Split lighting, key light positioned at exactly 90 degrees to the side, face divided precisely in half, one side fully illuminated the other in deep shadow, stark chiaroscuro contrast, film noir aesthetic", description: "主光从人物正侧方90deg照射，面部被精确地一分为二，半明半暗。是最极端的单灯人像布光方式。光源位置：人物正侧面90deg，高度与眼部平齐。情绪：内心分裂、善恶双重人格、隐藏、危险。适用：悬疑惊悚、反派登场、内心挣扎。" },
  { key: "side", label: "侧光 Side/Profile", category: "key", prompt: "Side lighting from 75-85 degrees, strong volumetric modeling, pronounced cheekbone highlight, deep shadow on far side of face, dimensional sculptural quality, strong texture definition", description: "主光从人物侧面(约75deg-85deg)照射，强调面部立体感和表面纹理。与分割光不同，侧光仍保留暗侧少量细节。情绪：力量感、坚毅、粗粝、阳刚。适用：热血动作、男性角色特写、战争题材。" },
  { key: "bottom", label: "底光 Bottom/Horror", category: "key", prompt: "Bottom lighting from below face level, light source positioned beneath the chin, unnatural upward shadows, inverted facial shadow pattern, eerie unsettling horror aesthetic, underlighting", description: "主光从人物下方向上照射，彻底反转面部自然阴影方向。是恐怖/神秘场景的经典布光语言。情绪：恐怖、阴森、邪恶、超自然、诡异。适用：中式恐怖/民俗、鬼怪登场、悬疑反转。" },
  { key: "rim_key", label: "轮廓主光 Rim as Key", category: "key", prompt: "Rim lighting as primary key, light source positioned behind and above subject, luminous halo edge glow outlining figure, face mostly in shadow with bright edge definition, mysterious silhouette with dimensional rim", description: "将轮廓光作为主光源使用，光线从人物后上方射出，勾勒人物边缘轮廓，面部落入大部分阴影中但边缘有明亮的发光线。情绪：神秘、孤独、反思、悲壮、神圣。适用：人物内心独白、灵魂出窍、关键转折时刻。" },
  { key: "soft_key", label: "柔和主光 Soft Key", category: "key", prompt: "Soft diffused key light, large silk or softbox source close to subject, gentle wraparound illumination, subtle shadow falloff, natural window light quality, flattering minimal shadows", description: "通过大面积柔光布/柔光箱散射的主光，光线包裹人物面部，阴影过渡极为柔和。模仿北向窗户的自然光质感。情绪：温柔、亲切、自然、真实、治愈。适用：甜宠言情、日系治愈、自然光模仿。" },
  { key: "hard_key", label: "硬主光 Hard Key", category: "key", prompt: "Hard key light, small intense source, crisp razor-sharp shadows, high contrast ratio 8:1 or greater, dramatic film noir look, bare bulb or fresnel without diffusion, stark definition", description: "使用小面积强光源(裸灯/聚光灯不加柔光)，产生锐利、高反差的阴影。是黑色电影和新黑色电影的标志性布光。情绪：残酷、压迫、真相、审问、城市孤独。适用：悬疑惊悚审讯场景、城市黑色电影、动作硬汉。" },
  { key: "top", label: "顶光 Top Light", category: "key", prompt: "Top lighting from directly overhead, eye sockets cast in deep shadow, pronounced brow and cheekbone shadows, dramatic harsh overhead source, interrogative or divine quality depending on diffusion", description: "主光从人物头顶正上方垂直而下，眼窝陷入深邃阴影，眉骨和颧骨形成强烈投影。可以是硬光(审讯感)也可以是柔光(神圣感)。情绪(硬)：审问、压迫、绝望。情绪(柔)：神圣、净化、救赎。适用：审讯室、监狱、教堂、仪式场景。" },
  { key: "flat", label: "平光 Flat/Frontal", category: "key", prompt: "Flat frontal lighting, key light positioned directly at camera axis, minimal to no visible shadows on face, even uniform illumination, beauty or documentary style, shadowless aesthetic", description: "主光与摄影机同轴(紧贴镜头正上方或环形灯)，面部几乎完全没有阴影。常用于美妆、时尚和纪录片直面镜头诉说。情绪：坦白、直面、真实、无修饰。适用：纪录片人物自述、直面镜头独白、时尚大片。" },
];

export const FILL_MODIFIER: LightingEntry[] = [
  { key: "soft_fill", label: "柔和辅光 Soft Fill", category: "fill", prompt: "Soft fill light, large diffused source opposite key light, subtle shadow lift maintaining 2:1 to 3:1 ratio, natural eye light, preserves mood while revealing shadow detail", description: "放置在主光对面的柔和大面积光源，降低主光产生的阴影浓度但不消除阴影。三点布光中控制反差的关键。核心原则：辅光照亮但不消灭阴影。" },
  { key: "hard_fill", label: "硬辅光 Hard Fill", category: "fill", prompt: "Hard fill light maintaining deeper contrast, secondary shadow definition, preserves dramatic mood, controlled secondary highlights, higher contrast ratio 4:1 to 6:1", description: "使用较硬的光源作为辅光，刻意保持较高光比，不追求柔和过渡。光比通常维持4:1以上。适合黑色电影、动作、悬疑等需要暗部仍有内容但绝不柔和的场景。" },
  { key: "hair_light", label: "发丝光 Hair Light/Rim", category: "fill", prompt: "Strong hair light from behind and above, luminous halo effect on hair, bright edge separation from background, dimensional rim definition, shot on backlight, ethereal hair glow", description: "三点布光中的背光。从人物后上方打下强光，发丝和肩部边缘产生明亮的白色/金色轮廓光晕，将人物从暗色背景中抠出来。" },
  { key: "kicker", label: "侧逆光 Kicker/Edge", category: "fill", prompt: "Kicker light from rear 45 degrees, sharp edge highlight on cheekbone and jawline, dimensional facial contouring, subtle rim defining one side of face, sculptural quality, low angle back edge", description: "从侧后方(约135deg，即后侧方)打入的修饰光，在人物一侧的颧骨和下颌线产生一道鲜明的刀锋般的高光边缘。适用：男性角色力量感、动作硬汉、音乐MV。" },
  { key: "eye_light", label: "眼神光 Eye Light", category: "fill", prompt: "Eye light catchlight, small reflected highlight in subject eyes, tiny spark of life in pupils, subtle catchlight reflection, alive engaged expression, critical for emotional connection", description: "极小的专用灯具(或反光板反射)，专门在人物瞳孔中制造微小的白色反光点。是人物有生命感的最后一道防线。光源位置：紧贴摄影机镜头旁边或略上方。" },
  { key: "bg_light", label: "背景光 Background Light", category: "fill", prompt: "Background separation light, illuminated backdrop behind subject, dimensional depth between character and environment, selective background pools of light, atmospheric depth", description: "单独照亮人物后方背景的灯光，制造空间深度感。可以是均匀铺亮，也可以是有选择的光斑(如通过Cucoloris投出树影)。背景光强度通常比主光低1-2档。" },
  { key: "negative_fill", label: "负补光/吸光 Negative Fill", category: "fill", prompt: "Negative fill, black flag removing ambient bounce, deeper richer shadows, increased contrast without adding more light, subtractive lighting technique, true black shadow depth", description: "不添加光源，而是用黑旗/黑布/黑泡沫板放置在人物暗侧，吸收环境漫反射光，使阴影更深更纯。是做减法的高级布光技术。罗杰-迪金斯的标志性技巧。" },
  { key: "book_light", label: "书页光 Book Light/Bounce", category: "fill", prompt: "Book light technique, light bounced off reflective surface then through diffusion silk, ultra-soft wraparound illumination, double-diffused quality, natural ethereal glow, softest possible directional light", description: "光线先打到反光板上(反弹一次)，再穿过大面积柔光布(再散射一次)，得到双倍柔和、几乎没有方向感的极致柔光。维托里奥-斯托拉罗的标志性柔光手法。" },
];

export const MOTIVATED_LIGHT: LightingEntry[] = [
  { key: "neon", label: "霓虹灯光 Neon", category: "motivated", prompt: "Neon light source, vibrant colored ambient glow, urban night atmosphere, colored light spilling across face and environment, multi-colored neon tubes, cyberpunk aesthetic, saturated cyan magenta red glow", description: "霓虹灯管/招牌作为画面中的实用光源，彩色光溢射到人物面部和环境。赛博朋克和都市夜景的核心视觉元素。色温：多变(品红、青蓝、橙红为主)。氛围：都市夜生活、孤独、科技感、反乌托邦。" },
  { key: "desk_lamp", label: "台灯/桌面光 Desk Lamp", category: "motivated", prompt: "Motivated desk lamp, warm tungsten practical light, intimate pool of warm illumination, small localized light source, cozy reading nook, focused circle of warm 3200K light, surrounding falloff to darkness", description: "台灯作为画面中的实用光源，形成一个温暖的局部光圈，周围自然衰减至暗部。小空间亲密感的经典动机光。色温：暖色2700K-3200K。氛围：深夜工作、孤独思考、亲密对话、怀旧。" },
  { key: "window", label: "窗户光 Window Light", category: "motivated", prompt: "Window light, natural daylight streaming through window, soft directional illumination, gentle shadow falloff, overcast diffused quality or direct sunbeam, realistic environmental light source", description: "窗户作为光源，是电影中最常用的动机光之一。可分为阴天柔和窗光和晴天直射窗光(含百叶窗投影)。色温：日光5500K-6500K。氛围：日常、自然、通透、希望。" },
  { key: "candle", label: "烛光 Candle Light", category: "motivated", prompt: "Candle light, warm flickering flame illumination, intimate atmospheric glow, dancing amber light and shadow, single or multiple candle sources, warm 1850K low-intensity practical, romantic or eerie mood", description: "烛火作为唯一或辅助光源，产生极暖色温(约1850K)和微弱闪烁的照明效果。是原始、古老、仪式感最强的光源。氛围：浪漫烛光晚餐、古装宫廷、恐怖仪式、洞穴探险。" },
  { key: "fire_light", label: "火光/篝火 Fire/Campfire", category: "motivated", prompt: "Fire light, dynamic flickering amber and orange glow, campfire or bonfire illumination, dancing irregular flames casting moving shadows, warm intense light source, dramatic underlighting from ground level fire", description: "篝火/壁炉作为光源，产生大面积不规则闪烁的暖色光照耀人物面部和环境。火光是动态光源，光照强度和色温在持续不规则变化。色温：暖橙色1700K-2200K。氛围：野外生存、围炉夜话、战争废墟、祭祀仪式。" },
  { key: "screen_light", label: "屏幕光 Screen/Device Light", category: "motivated", prompt: "Screen light from TV computer or phone, cool blue-white glow on face, modern device ambient illumination, flat and slightly upward angle, solitary digital age aesthetic, blue light on skin in dark room", description: "电视、电脑显示器或手机屏幕作为光源，典型的冷蓝色/白色光从下到上打在人物面部。色温：冷白6000K-7000K。氛围：数字时代孤独、深夜不眠、信息焦虑、科技疏离。" },
  { key: "street_light", label: "路灯 Street Light", category: "motivated", prompt: "Street light, sodium vapor orange glow from above, urban night atmosphere, pool of warm light on wet pavement, solitary figure under streetlamp, top-down motivated practical, noir urban isolation", description: "路灯作为顶光动机光源，产生锥形光束从上方打下，在城市夜晚街道上形成一个个光岛。色温：钠灯橙黄2000K-2200K。氛围：都市孤独、深夜归途、浪漫邂逅、悬疑跟踪。" },
  { key: "car_headlight", label: "车灯 Car Headlight", category: "motivated", prompt: "Car headlight, blinding intense beam cutting through darkness, high contrast directional light, dramatic backlight or side light, volumetric light beam visible in fog or dust, road thriller aesthetic", description: "车头灯强光刺破黑暗，形成高反差、方向性极强的光束。在雾气或尘埃中光束会显现体积感。色温：白/蓝白5000K-6000K。氛围：追逐、逃亡、意外闯入、公路电影。" },
  { key: "flashlight", label: "手电筒 Flashlight", category: "motivated", prompt: "Flashlight beam, focused cone of hard light cutting through darkness, handheld dynamic light source, suspense thriller investigation, narrow beam revealing fragments of environment, high contrast", description: "手电筒形成狭窄集中的锥形光束，在完全黑暗的环境中割出一个明亮的圆形区域。手持的不稳定性让光束始终在微动。氛围：侦探调查、恐怖探索、密室逃亡、军事行动。" },
  { key: "ambient_bounce", label: "环境漫反射 Ambient Bounce", category: "motivated", prompt: "Ambient bounce light, soft environmental fill from walls and ceiling, natural room tone illumination, indirect reflected light, gentle wrap-around, no visible source but present subtle fill", description: "不直接照射任何灯具到人物身上，而是将所有灯打到白色墙壁/天花板上，利用反射后的漫射光间接照亮人物。效果：极柔和、无阴影、无方向感。氛围：现代简约空间、美术馆、白色房间。" },
  { key: "lantern", label: "灯笼/纸灯 Lantern/China Ball", category: "motivated", prompt: "Chinese lantern or paper lantern practical, soft omnidirectional warm glow, spherical diffusion in all directions, traditional or festive atmosphere, warm ambient light source hanging in scene, 360-degree soft illumination", description: "灯笼/纸灯作为画面中的实用光源，产生360度全方位漫射的柔和暖光。是中国古装、东方美学、节日庆典的标志性光源。色温：暖色2800K-3200K。氛围：中式古装、元宵节、日式居酒屋、夜市、温馨家庭。" },
  { key: "lightning", label: "闪电 Lightning/Strobe", category: "motivated", prompt: "Lightning flash illumination, sudden brief intense burst of light, strobe effect cutting through darkness, momentary full illumination followed by deep darkness, dramatic weather, horror thriller", description: "闪电/频闪产生瞬间的极强白色闪光，在极短的0.1-0.5秒内将整个画面完全照亮，然后迅速退回黑暗。是不可预测的间歇性光源。色温：冷白/蓝白6000K-10000K。氛围：暴风雨夜、恐怖片经典、工业场景。" },
];

export const SPECIAL_STYLE: LightingEntry[] = [
  { key: "high_key", label: "高调光 High-Key", category: "special_style", prompt: "High-key lighting, bright overall illumination, low contrast ratio 1:1 to 2:1, minimal shadows, cheerful airy aesthetic, even shadowless lighting, bright white background, upbeat mood", description: "极低的整体反差(光比1:1到2:1)，画面以白色和浅色为主调，几乎没有可见阴影。氛围：喜剧、轻松、明快、健康、积极。经典参考：老友记室内、苹果产品广告。" },
  { key: "low_key", label: "低调光 Low-Key", category: "special_style", prompt: "Low-key lighting, predominantly dark scene with selective illumination, high contrast ratio 8:1 or greater, deep rich blacks, dramatic pools of light in darkness, film noir signature, chiaroscuro", description: "画面以暗部为主(黑色占主导)，只在关键区域有选择性照明。光比极高(8:1以上)。氛围：黑色电影、悬疑、恐怖、悲剧、神秘。经典参考：七宗罪、银翼杀手。" },
  { key: "chiaroscuro", label: "明暗对照法 Chiaroscuro", category: "special_style", prompt: "Chiaroscuro lighting, extreme contrast between light and dark, renaissance painting quality, dramatic shaft of light in darkness, strong directional illumination with deep velvet blacks, Caravaggio inspired lighting", description: "源自古希腊/文艺复兴绘画的极端明暗对照手法。一束强光(神光)斜穿画面，部分区域极度明亮，其余沉入天鹅绒般深沉的黑色。光比：极端可达16:1。氛围：神圣、史诗、悲剧、救赎。经典参考：巴里-林登烛光场景。" },
  { key: "silhouette", label: "剪影光 Silhouette", category: "special_style", prompt: "Silhouette lighting, subject completely in shadow against bright background, strong backlight creating pure black figure outline, no facial detail visible, dramatic shape and form only, sunset or bright window behind subject", description: "人物完全以纯黑色剪影出现在明亮的背景(日落/强窗光/爆燃)前。不展示任何面部细节，只呈现人物轮廓。技术：完全背光，无任何前侧补光。氛围：神秘、离别、对峙、西部片经典、浪漫告别。" },
  { key: "golden_hour", label: "黄金时刻 Golden Hour", category: "special_style", prompt: "Golden hour lighting, warm low-angle sunlight during magic hour, long dramatic shadows, golden amber hue across scene, soft directional sunlight, ethereal atmospheric haze, lens flare, backlit rim glow", description: "太阳在日出后或日落前约一小时的魔法时刻。太阳角度极低(低于10deg)，色温极暖(金色/琥珀色，约3000K-3500K)。特征：长阴影、空气透视、柔和逆光。氛围：希望、怀旧、浪漫、史诗、归属。" },
  { key: "blue_hour", label: "蓝调时刻 Blue Hour", category: "special_style", prompt: "Blue hour twilight lighting, deep cobalt blue sky after sunset, soft ambient skylight, no direct sun, cool serene atmosphere, city lights beginning to glow against blue, melancholic beauty", description: "日落后/日出前约20-40分钟的蓝调时刻。天空呈现深邃的钴蓝色，无直射阳光，只有天空漫射的冷色环境光。色温：极高9000K-15000K(深蓝色)。氛围：孤独、沉思、过渡、末日感、科幻。" },
  { key: "cyberpunk", label: "赛博朋克光 Cyberpunk", category: "special_style", prompt: "Cyberpunk lighting, neon pink and cyan dual color scheme, volumetric colored fog, wet reflective surfaces, urban night neon glow, Blade Runner aesthetic, synthetic artificial light only, no natural light source, rain-slicked streets reflecting neon", description: "完全依赖人造光源，自然光被彻底排除。标志性的粉色+青色互补配色方案。配色核心：品红(Magenta) + 青蓝(Cyan)互补。氛围：反乌托邦、高科技低生活、疏离、堕落与超越。经典参考：银翼杀手、攻壳机动队。" },
  { key: "naturalistic", label: "现实主义自然光 Naturalistic", category: "special_style", prompt: "Naturalistic available light, only practical and natural sources, no apparent artificial film lighting, documentary realism, ambient existing light only, unpolished raw aesthetic, window light and practical lamps only, Dogme 95 style", description: "完全使用场景中现有的光源，不额外添加任何电影灯具。追求摄影机只记录已存在的光的真实感。技术：零增灯。氛围：真实、纪录感、亲密、粗粝、不修饰。经典参考：家宴(Dogme #1)、月光男孩。" },
];

// 合并所有灯光字典
export const ALL_LIGHTS: LightingEntry[] = [...KEY_LIGHT, ...FILL_MODIFIER, ...MOTIVATED_LIGHT, ...SPECIAL_STYLE];
export function findLight(key: string): LightingEntry | undefined { return ALL_LIGHTS.find(l => l.key === key); }
export function findLights(keys: string[]): LightingEntry[] { return keys.map(k => findLight(k)).filter(Boolean) as LightingEntry[]; }

// ============================================================
// 仓库 2：多维度节奏轴与运镜字典
// ============================================================

export const TEMPO_PROFILES: TempoProfile[] = [
  {
    key: "ultra_fast", label: "极快 Ultra Fast",
    durationRange: [1, 3],
    cutStyle: "hard_cut_dominant",
    cutDescription: "硬切(Hard Cut)占90%以上。禁止叠化、淡入淡出、长镜头。动作接动作，不设任何过渡缓冲区。对白处理：直接跳切，不同机位间不做平滑过渡。允许Whip Pan转场作为节奏加速器。",
    cameraSpeedPrompt: "Rapid whip pan, crash zoom, aggressive handheld shake, snap camera movement, fast dolly zoom, kinetic energy, dynamic sudden camera shifts",
    cameraSpeedDescription: "主运镜：急速甩镜(Whip Pan)、急速推拉(Crash Zoom)、手持剧烈晃动。运动风格：不稳定的、冲撞感的、能量爆发的。禁止任何缓慢平滑运镜、固定长镜头。",
    visualDensityDescription: "以特写和大特写为主，画面信息极度聚焦。仅在建立空间关系或情绪缓冲时偶尔使用中近景。单点信息，背景虚化最大化。每个画面元素必须快速被观众识别。",
  },
  {
    key: "fast", label: "偏快 Fast",
    durationRange: [3, 5],
    cutStyle: "hard_cut_with_match",
    cutDescription: "硬切(70%)+动作匹配(30%)。关键情绪转折处可使用一次短暂叠化。禁止淡入淡出、长镜头超过8秒。保持呼吸感但不停滞。",
    cameraSpeedPrompt: "Brisk dolly movement, shoulder mount tracking, subtle handheld micro-movements, quick pan, energetic Steadicam follow, dynamic focus pulls",
    cameraSpeedDescription: "主运镜：轻快轨道推移、肩扛跟拍、手持微晃、快速横摇。运动风格：有控制的能量感，流畅但不飘。",
    visualDensityDescription: "以紧凑景别(近景/特写/中近景)为主，信息聚焦于人物动作和表情。很少使用全景，环境信息通过中近景的背景间接展示。每镜1-2个视觉信息点。",
  },
  {
    key: "normal", label: "正常 Normal",
    durationRange: [5, 8],
    cutStyle: "balanced",
    cutDescription: "动作匹配(50%)+硬切(40%)+叠化(10%)。关键情绪转折处用缓慢叠化；结尾处可用淡出。保持呼吸感和情绪流动。",
    cameraSpeedPrompt: "Steady dolly, controlled pan, smooth gimbal movement, slow push-in, measured tracking shot, fluid motion",
    cameraSpeedDescription: "主运镜：平稳轨道推移、受控横摇、平滑稳定器运动、缓慢推进。运动风格：受控的、有目的的、平滑的。",
    visualDensityDescription: "远近交替，根据叙事需要自由切换景别。特写用于情感点，中景用于互动，全景用于建立空间。每镜2-3个视觉信息点。允许建立全景作为场景定调。",
  },
  {
    key: "slow", label: "舒缓 Slow/Poetic",
    durationRange: [8, 15],
    cutStyle: "long_take_dominant",
    cutDescription: "长镜头(60%)+叠化(30%)+淡入淡出(10%)。禁止硬切(除非特殊剧情需求)。镜头如呼吸，缓慢流动，让画面自己说话。",
    cameraSpeedPrompt: "Creeping zoom, ultra-slow pan, meditative dolly drift, imperceptible forward motion, static tripod long takes, gentle crane descent, atmospheric float",
    cameraSpeedDescription: "主运镜：极缓慢游移推拉(Creeping Zoom)、沉静横摇、冥想式滑轨漂移。运动风格：几乎不可察觉的、冥想的、空中漂浮的。鼓励固定长镜头。",
    visualDensityDescription: "偏向开阔景别(全景/远景)，铺开环境细节。特写仅用于关键情绪揭示。鼓励人物融入环境，环境自己就是叙事者。每镜4-5个视觉信息点，但节奏放缓让观众有充裕时间接收。",
  },
];

export function findTempo(key: string): TempoProfile | undefined {
  return TEMPO_PROFILES.find(t => t.key === key);
}

export const CAMERA_MOVEMENTS: CameraMovement[] = [
  // 静止系
  { key: "static", label: "固定镜头 Static/Tripod", category: "static", compatibleTempos: ["ultra_fast","fast","normal","slow"], prompt: "Static tripod shot, locked-off camera, no movement, fixed frame, composed stillness, deliberate framing", description: "摄影机完全固定在三脚架上，画面无任何运动。不动本身就传递态度。情绪：观察、客观、冷静、庄重。" },
  { key: "pan", label: "横摇 Pan", category: "static", compatibleTempos: ["ultra_fast","fast","normal","slow"], prompt: "Horizontal pan shot, camera rotating left to right on fixed axis, smooth horizontal reveal, surveying camera movement", description: "摄影机在固定轴心水平旋转。速度变体：缓慢横摇(Slow Pan)用于环境展示，快速甩镜(Whip Pan)用作转场。情绪：揭示、发现、连接、审视。" },
  { key: "tilt", label: "纵摇 Tilt", category: "static", compatibleTempos: ["fast","normal","slow"], prompt: "Vertical tilt shot, camera tilting up or down on fixed axis, vertical reveal, dramatic upward or downward scan", description: "摄影机固定轴心垂直摇动。仰摇(Tilt Up)：揭示规模/权力；俯摇(Tilt Down)：揭示细节/落差。情绪：敬畏(仰)、俯视(俯)、揭示。" },
  // 位移系
  { key: "dolly_push", label: "轨道推进 Dolly Push-In", category: "displacement", compatibleTempos: ["fast","normal","slow"], prompt: "Smooth dolly push-in, camera physically moving forward toward subject, gradual approach, increasing emotional proximity, dolly track in", description: "摄影机在轨道上物理向前推进，靠近被摄主体。空间压缩感逐渐增强，观众离人物越来越近。情绪：逼近真相、情感升温、顿悟、压迫感。" },
  { key: "dolly_pull", label: "轨道拉远 Dolly Pull-Out", category: "displacement", compatibleTempos: ["normal","slow"], prompt: "Smooth dolly pull-out, camera physically moving backward from subject, revealing wider environment, gradual emotional distancing", description: "摄影机物理向后拉远，从近景扩展到更广画面。人物被环境吞没。情绪：告别、疏离、孤独、大局观。" },
  { key: "trucking", label: "横移 Trucking/Crab", category: "displacement", compatibleTempos: ["fast","normal","slow"], prompt: "Trucking shot, camera moving laterally parallel to subject, side-tracking movement, lateral dolly, crab movement", description: "摄影机在轨道上横向移动，与被摄主体保持等距平行。用于跟随人物行走、展示街道立面。情绪：陪伴、旁听、跟踪、平行叙事。" },
  { key: "tracking", label: "跟拍 Tracking/Follow", category: "displacement", compatibleTempos: ["fast","normal","slow"], prompt: "Tracking shot following subject from behind or in front, continuous camera movement matching subject speed, Steadicam or gimbal follow shot, immersive perspective", description: "摄影机跟随人物移动，保持与被摄主体的空间关系不变。后方跟拍代入感极强，前方跟拍展示面部表情。" },
  // 高度系
  { key: "pedestal", label: "升降 Pedestal/Boom", category: "height", compatibleTempos: ["normal","slow"], prompt: "Pedestal up or down shot, camera rising or lowering vertically, smooth vertical elevation change, boom arm movement", description: "摄影机在垂直轴上物理上升或下降。上升：人物站起的力量感；下降：人物坐下/倒下，视角下滑。" },
  { key: "crane", label: "摇臂 Crane/Jib", category: "height", compatibleTempos: ["normal","slow"], prompt: "Crane shot, camera mounted on crane arm sweeping through space, dramatic elevated movement, jib arm reveal, grand sweeping aerial-like motion", description: "摄影机安装在大型摇臂末端，从高空全景缓缓下降至人物特写(God Shot to Close-up)。情绪：宏伟、史诗、大全景、上帝视角。" },
  // 镜头内系
  { key: "zoom", label: "变焦 Zoom", category: "in_lens", compatibleTempos: ["ultra_fast","fast","normal","slow"], prompt: "Zoom shot, focal length change without camera movement, optical push-in or pull-out, telephoto compression or wide expansion, smooth zoom transition", description: "摄影机不动，仅改变镜头焦距。Zoom In：视场变窄空间变平；Zoom Out：视场变宽更多环境入画。情绪：观察、分析(Zoom In)；揭示环境(Zoom Out)。" },
  { key: "dolly_zoom", label: "希区柯克变焦 Dolly Zoom/Vertigo", category: "in_lens", compatibleTempos: ["normal","slow"], prompt: "Dolly zoom shot, Vertigo effect, camera dolly movement combined with opposite zoom, background compression or expansion while subject stays same size, disorienting perspective shift", description: "摄影机轨道推拉+镜头反方向变焦同时进行。推进+变焦拉远：背景剧烈扩展(眩晕)。拉远+变焦推进：背景剧烈压缩(挤压/孤立)。情绪：眩晕、认知颠覆、危机降临、心理崩溃。" },
  // 空中系
  { key: "drone", label: "航拍 Drone/Aerial", category: "aerial", compatibleTempos: ["normal","slow"], prompt: "Drone aerial shot, sweeping birds-eye view, high altitude establishing shot, smooth aerial movement, top-down perspective, epic scale", description: "无人机航拍，从空中俯瞰大地。运动类型：静态悬停/平移掠过/上升揭示/俯冲下降。情绪：史诗、自由、宏观、渺小。" },
  { key: "arc", label: "环绕 Arc/Orbit", category: "aerial", compatibleTempos: ["fast","normal","slow"], prompt: "Arc shot, camera orbiting around subject in circular path, 360-degree rotational movement, dynamic perspective shift, revolving orbital camera movement", description: "摄影机围绕被摄主体做圆周运动。半环绕(180deg)从一侧绕至另一侧；全环绕(360deg)完整绕行一圈。情绪：审视、对峙、眩晕、神圣时刻。" },
  // 手持体系
  { key: "handheld", label: "手持晃动 Handheld/Shaky", category: "special_handheld", compatibleTempos: ["ultra_fast","fast","normal"], prompt: "Handheld camera, natural camera shake, documentary realism, slight unstable movement, immediate raw presence, operator-held shoulder rig, organic movement", description: "摄影师肩扛或手持摄影机产生自然的微晃动。强度变体：轻度(微晃增加生命力)、中度(紧张/真实感)、激烈(Shaky-cam动作混乱感)。情绪：真实、紧迫、紧张、混乱、亲密。" },
  { key: "breathing", label: "呼吸感手持 Breathing Camera", category: "special_handheld", compatibleTempos: ["normal","slow"], prompt: "Breathing camera movement, subtle in-out camera drift, gentle organic handheld float, human presence behind lens, slight swaying motion like breathing", description: "极轻的手持微动，模拟有人在呼吸的有机感。不是抖动，而是缓慢的、像潮汐一样的前后左右轻微晃动。情绪：亲密、静谧、主观、人在场。" },
  // 主观体系
  { key: "pov", label: "POV主观视角 Point of View", category: "special_pov", compatibleTempos: ["ultra_fast","fast","normal","slow"], prompt: "POV shot, first-person perspective, camera as character eyes, subjective viewpoint, seeing through character vision, direct gaze perspective", description: "摄影机完全模拟人物的眼睛，观众看到的正是角色所看到的。观众直接成为角色的视线。情绪：代入、紧张、窥视、体验。" },
  { key: "snorricam", label: "胸挂主观 SnorriCam", category: "special_pov", compatibleTempos: ["ultra_fast","fast"], prompt: "SnorriCam shot, camera rigidly mounted to actor body, face fixed in center frame while background moves wildly, disorienting body-mounted perspective, claustrophobic effect", description: "摄影机固定在演员胸前/身上，人物面部始终在画面同一位置，但背景随着人物动作剧烈摇摆。情绪：眩晕、失控、恐慌、精神崩溃。" },
  // 复合体系
  { key: "rack_focus", label: "焦点转换 Rack Focus", category: "special_compound", compatibleTempos: ["ultra_fast","fast","normal","slow"], prompt: "Rack focus shot, focus shift from foreground to background during shot, selective focus transition, one element blurs as another sharpens, attention redirect within continuous frame", description: "在同一镜头内，焦点从前景平滑/骤然切换到背景。不移动摄影机，只改变焦点平面。情绪：关系揭示、秘密暴露、注意力转移、内心切换。" },
  { key: "whip_pan", label: "快速甩镜 Whip Pan/Swish", category: "special_compound", compatibleTempos: ["ultra_fast","fast"], prompt: "Whip pan shot, extremely fast horizontal camera rotation creating motion blur streak, energetic transition, rapid swish movement, blurred horizontal sweep", description: "摄影机极速水平旋转，画面变成模糊的彩色拖影，然后停在新构图上。是一种拍摄内转场。情绪：能量爆发、时间跳跃、空间切换。不要连续两个甩镜。" },
  { key: "crash_zoom", label: "快速变焦 Crash Zoom", category: "special_compound", compatibleTempos: ["ultra_fast","fast"], prompt: "Crash zoom, sudden extreme zoom in or out, abrupt focal length change, jarring visual punctuation, dramatic emphasis through optical snap", description: "摄影机镜头突然、极其快速地变焦推进或拉远。是一种视觉感叹号。情绪：震惊、发现、强调、喜剧节奏。不超过总镜头数的5%。" },
  { key: "slow_motion", label: "慢动作/升格 Slow Motion", category: "special_compound", compatibleTempos: ["fast","normal","slow"], prompt: "Slow motion effect, time stretched, fluid decelerated movement, dramatic emphasis on micro-expressions and movement details, dreamlike temporal distortion, hyper-real detail capture", description: "通过高帧率拍摄后以正常帧率播放实现的慢动作效果。用法：动作升格(打斗/爆炸关键瞬间)、情绪升格(转身/回眸/落泪)。情绪：浪漫、史诗、悲伤、唯美。" },
];

export const TRANSITION_TYPES: TransitionType[] = [
  { key: "hard_cut", label: "硬切 Hard Cut", prompt: "", whenToUse: "最常见的剪辑方式。上一个画面直接跳至下一个画面无过渡。适用于：动作连续、对话反应、节奏推进、视觉对比。", whenForbidden: "慢节奏情感转折处不应直接硬切(应用叠化/淡出)。两个大全景之间不建议硬切(视觉跳跃太大)。", tempoMapping: { ultra_fast: 90, fast: 70, normal: 40, slow: 0 } },
  { key: "action_match", label: "动作匹配 Action Match", prompt: "", whenToUse: "两个镜子通过相似的形状、动作或构图连接。形状匹配：圆形到圆形、门到门。动作匹配：人物在镜1中转身到镜2中已转身完成跨空间。", whenForbidden: "极快节奏中不要为了优雅而牺牲速度。", tempoMapping: { fast: 30, normal: 50, slow: 20 } },
  { key: "dissolve", label: "叠化 Dissolve", prompt: "", whenToUse: "画面A逐渐淡出同时画面B逐渐淡入。暗示时间流逝或空间转换。适用：时间跳跃、回忆进入、梦境过渡、情感转换。", whenForbidden: "极快节奏完全禁止叠化。动作场景禁止叠化。同一个空间/时间线内禁止叠化。", tempoMapping: { normal: 10, slow: 30 } },
  { key: "fade", label: "淡入淡出 Fade", prompt: "", whenToUse: "画面从全黑逐渐显现(Fade In)，或逐渐变黑(Fade Out)。是电影中最明确的章节标记。Fade to Black + Fade In：时间大幅跳跃。", whenForbidden: "同一场景内禁用。极快/偏快节奏禁止。", tempoMapping: { slow: 10 } },
  { key: "jump_cut", label: "跳切 Jump Cut", prompt: "", whenToUse: "在同一机位/角度内突然跳过一段时间，人物跳到新位置。打破流畅性制造不安定感或压缩时间。适用：时间压缩、焦躁感。", whenForbidden: "舒缓节奏中禁止(破坏沉浸感)。非刻意情况下不要无意跳切。", tempoMapping: { ultra_fast: 10, fast: 5 } },
  { key: "graphic_match", label: "图形匹配 Graphic Match", prompt: "", whenToUse: "通过完全不同的物体共享相同的视觉轮廓/姿势在镜间过渡。经典：2001太空漫游骨头到太空船。", whenForbidden: "不要为了炫技而牺牲叙事流畅度。极快节奏不适合。", tempoMapping: { normal: 5, slow: 10 } },
];

export const SHOT_SIZES: ShotSize[] = [
  { key: "extreme_close_up", label: "极特写 Extreme Close-Up", prompt: "Extreme close-up shot, macro detail, single facial feature or small object, abstract scale, intimate texture", densityContribution: 0.3 },
  { key: "close_up", label: "特写 Close-Up", prompt: "Close-up shot, face filling frame, intimate character focus, emotional proximity, shallow depth of field", densityContribution: 0.5 },
  { key: "medium_close_up", label: "中近景 Medium Close-Up", prompt: "Medium close-up shot, head and shoulders framing, character-focused with some environment", densityContribution: 0.7 },
  { key: "medium", label: "中景 Medium Shot", prompt: "Medium shot, waist-up framing, balanced character and environment, natural perspective", densityContribution: 1.0 },
  { key: "wide", label: "全景 Wide/Long Shot", prompt: "Wide shot, full body in environment, establishing spatial context, character small in frame, environmental storytelling", densityContribution: 2.0 },
  { key: "extreme_wide", label: "远景 Extreme Wide", prompt: "Extreme wide shot, character tiny or absent in vast landscape, epic scale, environmental dominance, establishing shot", densityContribution: 3.0 },
];

export function findCamera(key: string): CameraMovement | undefined { return CAMERA_MOVEMENTS.find(c => c.key === key); }
export function findShotSize(key: string): ShotSize | undefined { return SHOT_SIZES.find(s => s.key === key); }

// ============================================================
// 仓库 3：题材情绪权重包 - 18 个题材（全建议，不锁死）
// ============================================================

export const GENRE_PRESETS: GenrePreset[] = [
  {
    key: "default", label: "通用/默认 Default", aliases: ["neutral", "general"],
    identity: "未指定特定题材时的默认美学方案。追求均衡、自然、不偏不倚的视觉表达。",
    emotion: "中性的、客观的、自然的。不刻意引导情绪，让剧本内容本身说话。",
    lightingSuggestions: { keyLight: ["soft_key","rembrandt"], fillLight: ["soft_fill"], motivatedLight: ["ambient_bounce","window"], specialStyle: [], contrastRatio: "3:1", note: "追求自然均衡的光比(约3:1)。辅光默认柔和，除非剧本情绪要求增加反差。" },
    tempoSuggestions: { recommended: "normal", ceiling: "ultra_fast", floor: "slow", note: "默认建议正常节奏(5-8s/镜)，但根据剧本张力可自由升速或降速。" },
    cameraSuggestions: { recommended: ["static","dolly_push","tracking","pan"], avoidUnless: [], note: "平实、服务叙事的运镜，不炫技。轨道跟拍和固定镜头为主。" },
    shotSizeSuggestions: { recommendation: "均衡分配：中景为主体，近景和特写用于情绪点，全景用于场景定调。", composition: "三分法构图为主，不强制对称或破坏规则。", density: "每镜2-3个视觉信息点。" },
    colorPalette: { primary: "自然色还原。不施加风格化LUT。肤色准确，环境色写实。", accent: "", note: "日光5500K中性平衡" },
    signatureTechniques: "无特定风格标签。以看不见摄影机为最高追求，让技术消失在故事后面。",
    genreRules: "不做任何风格化干预。当用户从默认切换到特定题材时，所有建议应立即更新。",
    llmInjection: "【导演审美引导 - 通用/默认风格】本作品未指定特定题材风格，请以自然、均衡、不偏不倚的视觉语言进行创作。光影建议：柔和主光+柔和辅光，光比约3:1，以自然方式照亮人物。节奏建议：正常节奏(5-8s/镜)，但可根据剧本张力灵活调整。运镜建议：以服务叙事为首要原则，避免过度风格化的运镜。调色建议：自然色还原，不施加风格化色调。以上均为导演审美建议，非强制约束。如有充分的叙事理由，可自由偏离。",
  },
  {
    key: "thriller", label: "悬疑/惊悚 Thriller/Suspense", aliases: ["mystery", "psychological_thriller"],
    identity: "悬疑的核心是信息不对称，观众知道的比角色多(或反过来比角色少)。光影和运镜服务于隐藏与揭示的张力。",
    emotion: "紧张、不安、被窥视、毛骨悚然、极度的好奇心。",
    lightingSuggestions: { keyLight: ["split","hard_key","bottom"], fillLight: ["hard_fill","negative_fill"], motivatedLight: ["flashlight","street_light","desk_lamp","screen_light"], specialStyle: ["low_key","chiaroscuro"], contrastRatio: "6:1至8:1+", note: "强阴影是你的朋友。让黑暗成为画面中的角色，黑暗本身就在传递信息。" },
    tempoSuggestions: { recommended: "fast", ceiling: "ultra_fast", floor: "normal", note: "偏快节奏为主(3-5s/镜)，揭示关键信息点时可短暂降速至正常。疑点堆积阶段可加速至极快。" },
    cameraSuggestions: { recommended: ["handheld","tracking","pov","static","dolly_push"], avoidUnless: ["crane","drone"], note: "主观视角(POV)和偷窥式运镜是悬疑类型的标志。手持晃动传递不安。缓慢推进传递逼近真相的压迫感。" },
    shotSizeSuggestions: { recommendation: "偏紧凑：40%特写/大特写+35%近景+20%中景+5%全景。", composition: "遮挡式构图：通过门框/窗户/栅栏拍摄，制造你正在偷看的错觉。视线引导：让观众看向画面外某个未知的方向。", density: "每镜1-2个视觉信息点，但其中1个可以是故意模糊/未完成的线索。" },
    colorPalette: { primary: "去饱和冷色调(青蓝色调为主)。", accent: "深红色用于危险/血腥元素的点缀。", note: "低饱和度+冷色调是悬疑的默认色彩方案。" },
    signatureTechniques: "偷窥视角(Voyeuristic POV)：让摄影机躲在窗帘后、门缝中、车窗外。缓慢推进(Slow Push-In)：逼近的摄影机=逼近的真相/危险。信息延迟：先拍反应再拍反应的对象。反打镜头缺失：故意不给期待中的反打。",
    genreRules: "黑暗优先：宁愿观众看不清，也不要灯火通明。信息经济：每个镜头要么给一个新线索，要么加深一个已存在的疑问。不给冗余信息。空间不确定性：不急于建立空间全貌。",
    llmInjection: "【导演审美引导 - 悬疑/惊悚风格】本作品定位悬疑/惊悚题材。光影建议：强烈推荐低调用光(Low-Key)，分割光/硬主光+硬辅光(或负补光)，光比6:1以上。让阴影成为画面中的重要视觉元素。环境光可选用手电筒、路灯、台灯等实用光源。节奏建议：偏快为主(3-5s/镜)。运镜建议：推荐手持晃动(传递紧张)、主观视角POV(传递被窥视/窥视感)、缓慢推进(传递逼近感)。偷窥式遮挡构图是悬疑类型标志。色彩建议：去饱和冷色调(青蓝)为主调，深红作为危险点缀色。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "chinese_horror", label: "中式恐怖/民俗 Chinese Horror/Folk", aliases: ["folk_horror", "eastern_horror", "supernatural"],
    identity: "中式恐怖与西式恐怖有根本不同，恐惧不是来自怪物突然出现(Jump Scare)，而是来自心理压迫、民俗禁忌、轮回因果、以及最熟悉的事物变得陌生。",
    emotion: "压抑、敬畏、毛骨悚然的熟悉感、绝望中的凄美、因果轮回的无力。",
    lightingSuggestions: { keyLight: ["bottom","top","side","rembrandt"], fillLight: ["kicker","negative_fill"], motivatedLight: ["candle","lantern","fire_light","lightning"], specialStyle: ["low_key","chiaroscuro","silhouette"], contrastRatio: "8:1+", note: "冷暖光冲突是中式恐怖的核心视觉语言。一盏红灯笼在黑暗中的孤光、青色月光与暗红烛光的对抗、纸钱燃烧的暖光与阴冷环境光的对峙。" },
    tempoSuggestions: { recommended: "slow", ceiling: "normal", floor: "slow", note: "慢是中式恐怖的核心。恐怖不是冲过来的，是渗过来的。极缓慢的推进运动(Creeping Push-In)是此类型的标志性节奏。" },
    cameraSuggestions: { recommended: ["static","dolly_push","pan","slow_motion"], avoidUnless: ["whip_pan","crash_zoom","snorricam","handheld"], note: "缓慢推拉(Creeping Zoom/Dolly)是中式恐怖的运镜灵魂。固定长镜头让观众无处可逃。" },
    shotSizeSuggestions: { recommendation: "中式恐怖善用画框内画框(Frame within Frame)。中景和全景为主(60%)，让观众看到人物与阴森空间的关系，特写用于展示微表情恐惧(40%)。", composition: "负空间构图，让黑暗/空白占据画面大部分。非对称构图，打破视觉平衡本身就是不安感的来源。", density: "每镜1-3个视觉信息点，但黑暗本身算一个信息点。" },
    colorPalette: { primary: "低饱和青蓝(月光感)+暗红(血/灯笼/对联)冷暖对撞。", accent: "纸钱白、金箔黄、墨黑。", note: "核心是褪色感，所有颜色都应该像是在旧照片里浸泡了百年。" },
    signatureTechniques: "冷暖光冲突：蓝月光vs红灯笼/烛火，两种色温在同一画面中对抗。旧质感：褪色、破损、灰尘、蛛网。仪式感画面：纸钱飘飞、香火缭绕、符纸封印、红绳缠绕。慢动作升格：雨滴、烟、纸钱飘落。倒影与镜像：水面、铜镜、瓷器反光中出现不该出现的东西。",
    genreRules: "恐惧来自心理压迫而非视觉冲击。不要急于展示鬼怪。民俗元素：婚丧嫁娶、祭祀仪式、戏曲、纸扎，这些是中式恐怖不可替代的视觉资产。中式空间(庭院、厢房、祠堂、天井)自带恐怖感来源。",
    llmInjection: "【导演审美引导 - 中式恐怖/民俗风格】本作品定位中式恐怖/民俗题材。光影建议：推荐底光/顶光/侧光塑造面部怪异阴影，冷暖光冲突(青蓝冷月光vs暗红烛光/灯笼光)是此类型的视觉核心。高反差(8:1+)。环境光选用蜡烛、纸灯笼、火光。节奏建议：舒缓为主(8-15s/镜)。让恐惧渗入，而非冲击。运镜建议：极缓慢推拉(Creeping Zoom)是灵魂运镜。固定长镜头让观众无处可逃。避免快速甩镜/快速变焦/胸挂主观。色彩建议：低饱和青蓝与暗红冷暖对撞。所有颜色应有褪色百年的旧质感。民俗元素：婚丧嫁娶/祭祀仪式/纸扎/符纸/红绳/铜镜皆可调用。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "romance", label: "甜宠/言情 Romance/Idol", aliases: ["love_story", "romcom", "idol_drama"],
    identity: "甜宠/言情的美学核心是美化现实，一切视觉元素服务于让观众感受到甜蜜、温暖、心动。画面应该像精心制作的甜点：柔和、精致、让人想靠近。",
    emotion: "甜蜜、心动、温暖、幸福、治愈、希望、美好的向往。",
    lightingSuggestions: { keyLight: ["butterfly","soft_key","rim_key"], fillLight: ["soft_fill","hair_light","eye_light","book_light"], motivatedLight: ["window","candle","desk_lamp","lantern"], specialStyle: ["high_key","golden_hour"], contrastRatio: "2:1至3:1", note: "蝴蝶光(Paramount)是女主容颜的最高美化方案。发丝光让女主的头发边缘发光，营造天使光晕。黄金时刻(Golden Hour)的暖光=浪漫的代名词。" },
    tempoSuggestions: { recommended: "normal", ceiling: "fast", floor: "slow", note: "正常节奏为主。心动瞬间必须升格慢动作。争吵/误会可加速至偏快。告白/和好必须舒缓，让情绪充分展开。" },
    cameraSuggestions: { recommended: ["dolly_push","static","arc","tracking","slow_motion"], avoidUnless: ["handheld","whip_pan","crash_zoom","snorricam"], note: "长焦浅景深是言情美学的基础，背景虚化(Bokeh)到极致，世界只剩两个人。越肩镜头(OTS)制造亲密的空间关系。" },
    shotSizeSuggestions: { recommendation: "特写和大特写为情感核心(50%)。近景(30%)用于双人对话。中景(15%)用于空间建立。全景/远景仅用于浪漫定场(5%)。", composition: "暖调浅景深(Bokeh)。双人构图偏爱一前一后，越肩视角。柔焦滤镜/柔光镜(Pro-Mist)是该题材的几乎标配。", density: "每镜1-2个视觉信息点。人物情感优先于环境信息。" },
    colorPalette: { primary: "暖调粉彩色(Pastel)：柔粉、淡橙、奶油白、蜜桃金。", accent: "樱花粉、薄荷绿、薰衣草紫。", note: "整体色调偏暖。高调(High-Key)曝光，白色和高光区域占据主导。" },
    signatureTechniques: "升格慢动作：回眸、牵手、拥抱、落泪，这是言情片的货币单位。浅景深+大量Bokeh：背景化为光斑的海洋。柔光镜/Pro-Mist滤镜：给整个画面裹上一层柔和的薄纱。发丝光+眼神光。身体局部特写：手指触碰、唇边微笑、睫毛微颤。",
    genreRules: "高调光铁律：画面以亮色和白色为主调。阴影极少、极浅。女主美化优先：光影和运镜应以女主为视觉中心。心动瞬间必须给升格：牵手、回头、眼神交汇，这些瞬间不加速叙事而是拉长时间。",
    llmInjection: "【导演审美引导 - 甜宠/言情风格】本作品定位甜宠/言情题材。以下为导演的审美偏好建议。光影建议：强烈推荐高调用光(High-Key)，蝴蝶光+柔和辅光+发丝光+眼神光，光比2:1至3:1。蝴蝶光是女主容颜的最高美化方案。黄金时刻暖光=浪漫代言词。节奏建议：正常为主(5-8s/镜)。心动瞬间强烈建议升格慢动作。告白/和好场景降至舒缓。运镜建议：长焦浅景深(Bokeh最大化)+越肩拍摄(OTS)是基础。环绕运镜(Arc)在告白/接吻场景推荐使用。避免手持晃动、甩镜、急速变焦。色彩建议：暖调粉彩色，柔粉、淡橙、奶油白、蜜桃金。整体高调曝光。画面应该像精心制作的甜点：柔和、精致、让人想靠近。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "action", label: "热血/动作 Action/Combat", aliases: ["combat", "martial_arts", "wuxia", "heroic_bloodshed"],
    identity: "动作题材的美学核心是能量的可视化，每一个光影、运镜、剪辑决定都要服务于让观众感受到冲击力、速度感和肌肉紧张。",
    emotion: "热血、兴奋、紧张、激烈、力量感、肾上腺素飙升。",
    lightingSuggestions: { keyLight: ["hard_key","side","split"], fillLight: ["hard_fill","kicker"], motivatedLight: ["fire_light","car_headlight","neon"], specialStyle: ["low_key"], contrastRatio: "6:1至8:1", note: "硬光！硬光！硬光！肌肉纹理需要硬光来雕刻。侧逆光(Kicker)勾勒肌肉线条和汗水。火光和爆炸闪光作为动态动机光源使用。" },
    tempoSuggestions: { recommended: "ultra_fast", ceiling: "ultra_fast", floor: "fast", note: "极快节奏(1-3s/镜)是动作片的核心。重要技巧：连续5-8个极快镜头后，插入一个短暂的正常节奏镜头(如喘息/确认伤势)，这是观众的心理呼吸点。" },
    cameraSuggestions: { recommended: ["handheld","whip_pan","crash_zoom","tracking","dolly_push","arc"], avoidUnless: ["static"], note: "手持晃动(Handheld/Shaky-Cam)是动作片的基础运镜。低角度仰拍让角色显得更大、更有力量。急速甩镜跟随动作方向，制造速度感。晃动需要有节奏，不是一直晃，而是在出拳/撞击的瞬间同步晃动，然后短暂稳定。" },
    shotSizeSuggestions: { recommendation: "极快部分：80%大特写/特写。观众不需要看清整个空间，只需要感受冲击力。对峙/喘息部分：切换至中景让观众重新建立空间坐标。", composition: "低角度仰拍(Low Angle)让角色更有力量。倾斜构图(Dutch Angle)在失衡/危机时使用，不要滥用。", density: "极快部分每镜1个信息点(拳、脸、落地)。对峙部分可容纳2-3个信息点。" },
    colorPalette: { primary: "高饱和、高对比。暖色调主导(橙/红/金)，冷色调作为邪恶/反派标志色。", accent: "爆炸橙、鲜血红、金属银、暗夜蓝。", note: "不要柔和的色彩，动作片需要喊出来的配色。" },
    signatureTechniques: "快切+动作匹配：剪辑点落在动作的中点(如出拳到一半切到反打)，利用视觉暂留让观众脑补完整动作。低角度仰拍：从地面仰视英雄。撞击瞬间短暂升格：让那一下特别重。环绕运镜围绕静止/慢动作的主体。粒子视觉动态：汗水飞溅、衣摆撕裂状飞舞、碎片四散。",
    genreRules: "能量守恒：观众肾上腺素是有限资源。连续3分钟以上的极快节奏会导致疲劳，必须在激烈段落之间插入喘息点。空间锚定：打斗开始前必须用一个全景/中景建立几何关系。手持晃动的节律：晃动方向应暗示动作方向。",
    llmInjection: "【导演审美引导 - 热血/动作风格】本作品定位热血/动作题材。光影建议：推荐硬主光+硬辅光+侧逆光(Kicker)，高反差(6:1-8:1)。硬光雕刻肌肉纹理和汗水。火光/爆炸闪光/车灯作为动机光源。节奏建议：极快为主(1-3s/镜)，硬切主导(90%+)。重要技巧：连续5-8个极快镜头后，插入一个正常节奏的喘息点镜头。运镜建议：手持晃动是基础运镜。低角度仰拍制造英雄感。急速甩镜跟随动作方向。注意晃动需要有节奏。色彩建议：高饱和、高对比、暖色调主导。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "historical", label: "古装/权谋 Historical/Political", aliases: ["period_drama", "palace_intrigue", "costume_drama"],
    identity: "古装权谋的视觉内核是秩序与暗涌。空间必须展现权力结构，对称构图代表朝堂秩序，光影的巨大反差代表人物内心的深渊。",
    emotion: "庄重、压抑、深不可测、暗流涌动、运筹帷幄、宿命的悲凉。",
    lightingSuggestions: { keyLight: ["rembrandt","soft_key","rim_key","top"], fillLight: ["soft_fill"], motivatedLight: ["candle","lantern","window","ambient_bounce"], specialStyle: ["chiaroscuro"], contrastRatio: "4:1至6:1", note: "伦勃朗光(Rembrandt)是古装权谋的标准主光，深沉、庄严、有油画质感。顶光(柔)用于朝堂/仪式场景，传达天威或神性。烛光和灯笼是主要的动机光源。" },
    tempoSuggestions: { recommended: "normal", ceiling: "fast", floor: "slow", note: "正常节奏为主(5-8s/镜)，让权谋的潜台词有时间发酵。朝堂对峙可加速至偏快。人物内心独白或重大决策时刻降至舒缓。" },
    cameraSuggestions: { recommended: ["static","dolly_push","pan","crane"], avoidUnless: ["handheld","whip_pan","crash_zoom","snorricam"], note: "对称构图+缓慢横摇是古装权谋的视觉节奏锚点。摇臂(Crane)从全景降至人物特写，展现权力下移或命运降临。" },
    shotSizeSuggestions: { recommendation: "中景和全景为主(60%)，展示人物与环境的关系、人物之间的地位差距。特写(30%)用于揭示人物内心。远景(10%)用于建立宫廷/城池的宏大规模。", composition: "对称构图=秩序=朝堂。非对称构图=暗流=后宫/密室。纵深感构图：利用柱子、长走廊、屏风制造层层叠叠的空间关系，暗示权力结构的等级。", density: "每镜2-4个视觉信息点，但信息都服务于权力叙事。" },
    colorPalette: { primary: "低饱和暖土色调。赭石、暗金、墨黑、深褐、朱红(权力标志色)。", accent: "青铜绿、玉白、宫廷黄(仅用于皇家)。", note: "饱和度压低，电影级的褪色历史画卷质感，非电视剧古装的高饱和度美学。" },
    signatureTechniques: "油画质感布光：伦勃朗光+明暗对照法(Chiaroscuro)，每一帧都像一幅古典油画。纵深空间构图：柱子、长廊、屏风反复切分画面。权力视觉化：通过景别差、高度差、光影差来展示人物的权力地位。缓慢横摇/摇臂下降：时间的厚重感。",
    genreRules: "对称的隐喻：对称构图只在秩序仍在时使用，当阴谋浮出水面时构图应逐渐打破对称。人物不在画面中心：权力结构中的一枚棋子。眼部特写是核武器：全片2-3次足矣。",
    llmInjection: "【导演审美引导 - 古装/权谋风格】本作品定位古装/权谋题材。光影建议：推荐伦勃朗光+柔和辅光，明暗对照法(Chiaroscuro)油画质感，光比4:1至6:1。烛光与灯笼是主要动机光源。朝堂场景可用柔顶光传达天威。节奏建议：正常为主(5-8s/镜)。权谋的潜台词需要时间发酵。运镜建议：对称构图+缓慢横摇是节奏锚点。摇臂从全景降至极特写制造命运降临感。避免手持晃动，古装权的稳本身就是权力叙事的一部分。色彩建议：低饱和暖土色调，赭石、暗金、墨黑、朱红(权力标志色)。电影级的褪色历史画卷质感。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "urban", label: "都市/职场 Urban/Workplace", aliases: ["modern_life", "office_drama", "slice_of_life"],
    identity: "都市题材的美学核心是真实的当代感，干净的现代空间、自然但有品位的灯光、克制的镜头语言。不美化也不丑化，追求引人共鸣的真实质感。",
    emotion: "真实、亲切、现代、压力、疏离中的温暖、都市生活的节奏感。",
    lightingSuggestions: { keyLight: ["soft_key","rembrandt","flat"], fillLight: ["soft_fill","bg_light"], motivatedLight: ["desk_lamp","screen_light","street_light","neon","window"], specialStyle: ["naturalistic"], contrastRatio: "3:1至4:1", note: "干净、实用、不过度戏剧化。有品位的室内设计+自然窗光是核心光感。" },
    tempoSuggestions: { recommended: "fast", ceiling: "ultra_fast", floor: "normal", note: "偏快为主(3-5s/镜)模拟都市生活的节拍。职场对话可保持偏快节奏。" },
    cameraSuggestions: { recommended: ["static","tracking","dolly_push","pan"], avoidUnless: ["whip_pan","crane","snorricam"], note: "平视固定+轨道跟拍是都市职场的基本运镜语言。干净、利落、不玩弄景深。" },
    shotSizeSuggestions: { recommendation: "中景和中近景为主(60%)，职场是人物之间的互动。近景和特写(30%)用于情感显露时刻。全景(10%)用于办公空间或城市定调。", composition: "干净的几何构图。利用办公空间中的直线条构建整洁有序的画面。", density: "每镜2-3个视觉信息点。" },
    colorPalette: { primary: "干净的冷现代色调。白、灰、蓝灰、米色为主。", accent: "绿植的墨绿、咖啡的暖棕、城市霓虹的品红/青蓝(夜景)。", note: "白天：冷白日光+干净中性色。夜晚：城市霓虹+暖白室内灯。" },
    signatureTechniques: "轨道跟拍(Dolly Tracking)跟随人物在开放式办公室中穿行。玻璃/窗户反光中的城市倒影。平视高度固定，不仰视也不俯视任何人。",
    genreRules: "真实感优先：不过度戏剧化光影。如果办公室的灯光就是惨白的日光灯管，那就接受它。城市作为第三主角：窗户外的城市天际线、地铁车厢里的陌生人、深夜便利店的灯光，这些不是背景而是都市叙事的一部分。",
    llmInjection: "【导演审美引导 - 都市/职场风格】本作品定位都市/职场题材。光影建议：推荐柔和主光+柔和辅光，整洁实用光源(台灯/窗光/屏幕光/路灯)，光比3:1至4:1。追求有品位的室内设计+自然窗光的现代质感。节奏建议：偏快为主(3-5s/镜)，模拟都市生活节拍。运镜建议：平视固定+轨道跟拍为主。干净利落的运镜语言。色彩建议：干净的冷现代色调，白、灰、蓝灰、米色。夜景可引入城市霓虹色彩。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "scifi", label: "科幻/未来 Sci-Fi/Futuristic", aliases: ["science_fiction", "futuristic", "dystopian"],
    identity: "科幻的视觉核心是陌生化的人类处境，通过未来或异世界的美学反思当下的人类命题。",
    emotion: "敬畏、渺小、疏离、科技冷漠中的温暖人性、对未知的好奇与恐惧。",
    lightingSuggestions: { keyLight: ["hard_key","rim_key","side","top"], fillLight: ["kicker","bg_light","negative_fill"], motivatedLight: ["neon","screen_light","ambient_bounce"], specialStyle: ["cyberpunk","blue_hour","low_key"], contrastRatio: "4:1至8:1(根据科幻子类型变化)", note: "科幻光线来自不存在的光源，全息投影的蓝光、飞船控制台的冷白光、未知星球的双太阳暖光。光影方案取决于你创造的世界的物理规则。" },
    tempoSuggestions: { recommended: "normal", ceiling: "ultra_fast", floor: "slow", note: "正常节奏为主(5-8s/镜)用于叙事推进。太空战斗加速至极快。展现宇宙/未来城市规模的广角镜头降至舒缓。" },
    cameraSuggestions: { recommended: ["drone","crane","dolly_push","static","dolly_zoom"], avoidUnless: ["handheld"], note: "平滑机械运镜(Gimbal)是科幻的基础。大远景定场(Drone aerial)是建立科幻世界规模的第一手段。希区柯克变焦用于展现认知/现实被颠覆的瞬间。" },
    shotSizeSuggestions: { recommendation: "大远景和全景(35%)，科幻需要建置世界。中景和近景(40%)，让人物在这个世界中活着。特写(25%)，人类情感在科技世界中的温度。", composition: "广阔的空间，大空间中的小人物。中心构图+对称构图适合秩序感强烈的科幻场景(飞船内部、实验室)。", density: "每镜2-4个视觉信息点，但必须建立世界规则。" },
    colorPalette: { primary: "赛博朋克：品红+青蓝互补。太空科幻：深黑+冷白+点状光源暖色。近未来：去饱和金属色系。", accent: "全息蓝、霓虹粉、警示红。", note: "色板取决于你创造的世界的物理规则。冷机械环境+人物面部微暖光=科幻恒久的人性温度。" },
    signatureTechniques: "大远景建立世界：长时间停留在极远景上。冷机械vs暖人性：冷色调环境光+人物面部微暖光。全息/HUD界面反射光打在脸上。Dolly Zoom：当角色的现实认知被颠覆时。",
    genreRules: "世界建立优先：科幻片的前几个镜头必须让观众理解这是一个什么样的世界。科技光源的逻辑性：如果有蓝光在画面中，观众会下意识寻找来源，给他们一个合理的来源。",
    llmInjection: "【导演审美引导 - 科幻/未来风格】本作品定位科幻/未来题材。光影建议：光影方案取决于你创造的世界的物理规则。推荐硬主光/轮廓主光+侧逆光+霓虹/屏幕光，高反差(4:1-8:1)。赛博朋克：霓虹品红+青蓝双色。太空科幻：深黑+冷白+点状暖光。节奏建议：正常为主(5-8s/镜)。广角大远景降至舒缓让观众进入世界。太空战斗/追逐加速至极快。运镜建议：大远景定场(Drone)+平滑机械运镜(Gimbal)是基础。希区柯克变焦在认知颠覆时刻使用。色彩建议：取决于科幻子类型。冷机械环境+人物面部微暖光=科幻恒久的人性温度。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "crime", label: "犯罪/黑帮 Crime/Gangster", aliases: ["gangster", "mafia", "heist"],
    identity: "犯罪题材的美学内核是城市暗面的视觉化。琥珀色街灯+青蓝月光+湿漉漉的街道反光。",
    emotion: "紧张、冷峻、道德的灰度、忠诚与背叛的拉锯。",
    lightingSuggestions: { keyLight: ["split","hard_key","bottom"], fillLight: ["hard_fill","negative_fill"], motivatedLight: ["street_light","neon","car_headlight","flashlight"], specialStyle: ["low_key"], contrastRatio: "6:1至8:1", note: "低调用光(Low-Key)为主。湿漉漉的街道反光是关键视觉元素。" },
    tempoSuggestions: { recommended: "fast", ceiling: "ultra_fast", floor: "normal", note: "偏快为主(3-5s/镜)。暴力爆发瞬间加速至极快。对话密谋降至正常。" },
    cameraSuggestions: { recommended: ["handheld","tracking","pov","dolly_push"], avoidUnless: ["crane","drone"], note: "手持跟拍追随人物穿行后巷。汽车追逐=航拍+跟拍。低角度仰拍黑帮头目制造压迫感。" },
    shotSizeSuggestions: { recommendation: "紧凑+夜景特写为主(50%)。近景(30%)。中景和全景(20%)。", composition: "夜景构图。利用街灯和霓虹灯作为构图天然引导线。", density: "每镜1-2个核心信息点。黑暗本身就是叙事的一部分。" },
    colorPalette: { primary: "琥珀色+青蓝+彩色霓虹。", accent: "枪口闪光白、鲜血暗红。", note: "湿漉漉的街道反光是此类型标志。新黑色电影保留高反差+去饱和冷色调。" },
    signatureTechniques: "枪口闪光在暗巷中瞬间照亮人脸。汽车追逐的航拍+跟拍切换。后巷霓虹中的人物剪影。审讯/对峙的缓慢推进+低角度压迫感。",
    genreRules: "城市的暗面自己成为角色。烟雾中透出的光线是此类型的标志性视觉。暴力突然爆发然后迅速归寂。",
    llmInjection: "【导演审美引导 - 犯罪/黑帮风格】光影建议：低调用光(Low-Key)为主。琥珀色街灯+青蓝月光+彩色霓虹。高反差(6:1-8:1)。让城市的暗面自己成为角色。节奏建议：偏快为主(3-5s/镜)。运镜建议：手持跟拍追随人物穿行后巷。低角度仰拍黑帮头目制造压迫感。色彩建议：琥珀暖色+青蓝冷色对抗。湿漉漉的街道反光是关键视觉元素。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "war", label: "战争/军事 War/Military", aliases: ["military", "combat_zone"],
    identity: "战争题材的视觉核心是冲突中的人性。硬光+去饱和+沙尘雾光+爆炸闪光。",
    emotion: "恐惧、勇气、牺牲、兄弟情、战争的无意义感。",
    lightingSuggestions: { keyLight: ["hard_key","side"], fillLight: ["hard_fill","kicker"], motivatedLight: ["fire_light","flashlight","lightning"], specialStyle: ["low_key"], contrastRatio: "6:1至8:1", note: "硬光+去饱和。爆炸闪光作为间歇性光源。战壕中的烛光/手电筒作为动机光源。沙尘/烟雾散射光线制造体积光。" },
    tempoSuggestions: { recommended: "ultra_fast", ceiling: "ultra_fast", floor: "normal", note: "极快战斗(1-3s/镜)+正常喘息点交替。硬切主导。战斗后的寂静降至舒缓。" },
    cameraSuggestions: { recommended: ["handheld","drone","dolly_push","static"], avoidUnless: ["whip_pan","snorricam"], note: "航拍战场全貌+手持战斗晃动+低角度仰拍军人。战斗手持晃动要比动作片更沉重，枪的后坐力感需要体现在镜头上。" },
    shotSizeSuggestions: { recommendation: "极快战斗：极紧凑+特写。喘息/对峙：中景+远景。", composition: "空间锚定优先：战斗前必须建立空间坐标。爆炸升格+碎片+泥土飞溅。", density: "极快部分每镜1个信息点。静态部分可容纳3-4个信息点。" },
    colorPalette: { primary: "去饱和军绿+土褐+血色红。", accent: "爆炸闪光橙、军服绿、战地灰。", note: "阴天色温偏冷。去饱和度是战争的视觉标签。" },
    signatureTechniques: "航拍战场+手持战斗。爆炸瞬间升格慢动作。低角度仰拍军人。战后的寂静长镜头。弹壳落地的特写慢动。",
    genreRules: "战斗手持晃动的重量感：需要比动作片更沉重。空间锚定：战斗前必须用全景建立空间关系。战后寂静是战争片最重要的情感时刻。",
    llmInjection: "【导演审美引导 - 战争/军事风格】光影建议：硬光+高反差(6:1-8:1)。去饱和。爆炸闪光作为间歇性光源。沙尘/烟雾散射光线制造体积光。节奏建议：极快战斗(1-3s/镜)+正常喘息点交替。硬切主导。运镜建议：航拍战场全貌+手持战斗晃动+低角度仰拍军人。战斗手持晃动要比动作片更沉重。色彩建议：去饱和军绿+土褐+血色红。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "comedy", label: "喜剧 Comedy", aliases: ["humor", "sitcom"],
    identity: "喜剧的视觉核心是明亮、清晰、让观众不费力地接收每一个笑点。高调用光+广角+明亮的饱和色。",
    emotion: "欢乐、轻松、幽默、温暖。",
    lightingSuggestions: { keyLight: ["soft_key","flat"], fillLight: ["soft_fill"], motivatedLight: ["window","ambient_bounce"], specialStyle: ["high_key"], contrastRatio: "2:1至3:1", note: "高调用光(High-Key)，明亮均匀的照明。阴影极少，喜剧需要看清每一个表情。" },
    tempoSuggestions: { recommended: "fast", ceiling: "fast", floor: "normal", note: "偏快为主(3-5s/镜)。喜剧的节奏=笑点的节拍器，笑点之间不留过多空白。" },
    cameraSuggestions: { recommended: ["static","pan","dolly_push","tracking"], avoidUnless: ["handheld","whip_pan"], note: "固定镜头+广角+平视。给演员充分的表演空间。快速变焦(Crash Zoom)可用于喜剧标点。" },
    shotSizeSuggestions: { recommendation: "中景+中近景为主(60%)。近景+特写用于表情反应(40%)。", composition: "广角镜头靠近人物制造夸张的喜剧空间感。清晰的构图，不遮挡不模糊。", density: "每镜1-2个信息点。笑点的视觉不复杂化。" },
    colorPalette: { primary: "鲜艳饱和暖色。明亮、欢快、高调曝光。", accent: "", note: "天空更蓝、草地更绿。世界是明亮的。" },
    signatureTechniques: "广角夸张：靠近人物制造喜剧空间变形。反应镜头：这是喜剧的节奏引擎。快速变焦(Crash Zoom)用于喜剧标点。物理喜剧的完整空间展示。",
    genreRules: "笑点节奏：剪辑服务于笑点的节拍。表演空间：摄影机后退让演员表演。不能为了风格化牺牲清晰度。",
    llmInjection: "【导演审美引导 - 喜剧风格】光影建议：高调用光(High-Key)，光比2:1-3:1，明亮均匀的照明。喜剧需要看清每一个表情。广角镜头靠近人物制造夸张的喜剧空间感。节奏建议：偏快为主(3-5s/镜)。笑点之间不留过多空白。运镜建议：固定镜头+广角+平视。给演员充分的表演空间。快速变焦可用于喜剧标点。色彩建议：鲜艳饱和暖色。明亮、欢快、高调曝光。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "arthouse", label: "文艺/艺术电影 Arthouse", aliases: ["art_film", "festival", "independent"],
    identity: "文艺电影的美学内核是创作自由。沉默和留白是创作资产。长镜头是呼吸。",
    emotion: "沉思、内省、诗意、疏离、存在主义。",
    lightingSuggestions: { keyLight: ["soft_key","rembrandt","rim_key"], fillLight: ["soft_fill","negative_fill"], motivatedLight: ["window","ambient_bounce"], specialStyle: ["naturalistic"], contrastRatio: "可变", note: "极大创作自由。自然可用光优先。光影服务于情绪和隐喻而非叙事效率。" },
    tempoSuggestions: { recommended: "slow", ceiling: "normal", floor: "slow", note: "舒缓为主(8-15s/镜)。长镜头是此类型的标志。允许超过15秒的极长镜头。" },
    cameraSuggestions: { recommended: ["static","dolly_push","pan"], avoidUnless: ["whip_pan","crash_zoom"], note: "固定长镜头是核心。沉思式的极缓慢推拉/横摇。允许不完美的构图。" },
    shotSizeSuggestions: { recommendation: "可变+多长镜头。不限制景别。", composition: "创作自由。不完美的构图可能是刻意的美学宣言。", density: "可变。信息密度由导演意图决定。" },
    colorPalette: { primary: "创作自由。自然色调或高度风格化均可。", accent: "", note: "去饱和是常见的文艺片选择。" },
    signatureTechniques: "长镜头固定机位。自然可用光优先。打破第四面墙。沉默的留白。沉思式极缓慢运动。",
    genreRules: "最大创作自由度。允许打破所有常规商业规则，但打破本身应该是刻意的美学选择。沉默和留白是你的创作资产。",
    llmInjection: "【导演审美引导 - 文艺/艺术电影风格】光影建议：极大创作自由。自然可用光优先。长镜头固定机位。光影服务于情绪和隐喻而非叙事效率。节奏建议：舒缓为主(8-15s/镜)。长镜头是此类型的标志。允许超过15秒的跳脱常规的极长镜头。运镜建议：固定长镜头是核心。沉思式的极缓慢推拉/横摇。允许不完美的构图。色彩建议：创作自由。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "fantasy", label: "奇幻/魔幻 Fantasy/Magical", aliases: ["magic", "epic_fantasy"],
    identity: "奇幻的视觉核心是让不可能的世界看起来真实。宏大+戏剧化+魔法光源。",
    emotion: "惊叹、向往、冒险、神秘、史诗感。",
    lightingSuggestions: { keyLight: ["soft_key","rembrandt","rim_key"], fillLight: ["soft_fill","hair_light","kicker"], motivatedLight: ["fire_light","candle","lantern"], specialStyle: ["golden_hour","chiaroscuro"], contrastRatio: "4:1至6:1", note: "宏大、戏剧化。高调+金色高光(正面/神圣场景)，低调+神秘蓝紫(黑暗/禁忌场景)。魔法光源(光球、魔法阵、发光符文)作为画面中的动机光源。" },
    tempoSuggestions: { recommended: "normal", ceiling: "fast", floor: "slow", note: "正常为主(5-8s/镜)。宏大场景(城堡/龙/战场)降至舒缓让观众惊叹。魔法战斗加速至偏快。" },
    cameraSuggestions: { recommended: ["drone","crane","arc","dolly_push","dolly_zoom"], avoidUnless: ["handheld","snorricam"], note: "航拍+摇臂建立魔幻世界的规模。环绕运镜围绕魔法施展中的角色。缓慢摇臂下降进入魔幻世界。" },
    shotSizeSuggestions: { recommendation: "远景+特写交替(远景35%+特写25%+中近景40%)。", composition: "宏大的对称或黄金比例。每个领域/王国应有自己独特的视觉标记。", density: "每镜2-4个信息点。建立世界规则优先。" },
    colorPalette: { primary: "宏大的饱和色彩。金色高光。魔法蓝紫。", accent: "森林翠绿、火焰橙红、冰霜白蓝。", note: "每个领域/王国应有自己独特的色彩标志。" },
    signatureTechniques: "航拍建立世界。摇臂从天空降至地面。环绕运镜围绕魔法施展。魔法光源(光球/符文/魔法阵)。领域/王国的色彩标志系统。",
    genreRules: "世界建立优先：每个新场景/新领域需要1-2个定场镜头。魔法光源的逻辑性：每个魔法效果需要视觉上的光源合理性。",
    llmInjection: "【导演审美引导 - 奇幻/魔幻风格】光影建议：宏大、戏剧化。高调+金色高光(神圣场景)，低调+神秘蓝紫(黑暗场景)。魔法光源作为画面中的动机光源。节奏建议：正常为主(5-8s/镜)。宏大场景降至舒缓。运镜建议：航拍+摇臂建立世界规模。环绕运镜围绕魔法施展角色。色彩建议：宏大的饱和色彩。每个领域/王国应有自己独特的色彩标志。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "film_noir", label: "黑色电影 Film Noir", aliases: ["noir", "neo_noir"],
    identity: "黑色电影的美学核心是极端的低调用光+硬光单灯+百叶窗投影+湿街道。宿命感与道德灰度的视觉化。",
    emotion: "宿命、绝望、欲望、背叛、道德的深邃黑暗。",
    lightingSuggestions: { keyLight: ["hard_key","split","bottom"], fillLight: ["negative_fill"], motivatedLight: ["street_light","neon","desk_lamp","flashlight"], specialStyle: ["low_key","chiaroscuro","silhouette"], contrastRatio: "8:1+", note: "极端的低调用光(Extreme Low-Key)。硬光单灯+负补光(黑旗吸光)。百叶窗投影(Venetian Blind Shadows)是黑色电影的视觉签名。" },
    tempoSuggestions: { recommended: "normal", ceiling: "fast", floor: "slow", note: "正常为主(5-8s/镜)。侦探独白时的沉静节奏。暴力爆发时的突然加速。" },
    cameraSuggestions: { recommended: ["static","dolly_push","pan"], avoidUnless: ["handheld","whip_pan"], note: "固定+极缓慢推拉。低角度仰拍制造宿命般的压迫感。倾斜构图(Dutch Angle)在认知/道德模糊时使用。" },
    shotSizeSuggestions: { recommendation: "紧凑+夜景为主。70%夜景+30%日景(日景也比正常电影更暗)。", composition: "硬光单灯，只照亮该照亮的部分。百叶窗投影在人物面部。湿漉漉的街道反光中映出孤立剪影。", density: "每镜1-2个信息点。黑暗本身就是信息。" },
    colorPalette: { primary: "经典为黑白。彩色新黑色电影保留高反差+去饱和冷色调+选择性暖色点缀。", accent: "", note: "彩色黑色电影：去饱和冷青蓝+选择的琥珀/红暖色点缀。" },
    signatureTechniques: "百叶窗投影(Venetian Blind Shadows)是黑色电影的视觉签名。硬光单灯。湿漉漉的街道反光。极缓慢推拉+固定。低角度仰拍制造宿命压迫感。烟雾中的光线。",
    genreRules: "黑暗优先：极端的低调用光。硬光单灯：只有一盏灯，只照亮该照亮的部分。百叶窗投影是该类型最具辨识度的视觉元素。",
    llmInjection: "【导演审美引导 - 黑色电影风格】光影建议：极端的低调用光(Extreme Low-Key)。硬主光+负补光。百叶窗投影是视觉签名。硬光单灯，只照亮该照亮的部分。光比8:1+。节奏建议：正常为主(5-8s/镜)。暴力爆发时突然加速。运镜建议：固定+极缓慢推拉。低角度仰拍制造宿命压迫感。倾斜构图在道德模糊时使用。色彩建议：经典黑白。彩色新黑色电影保留高反差+去饱和冷色调。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "documentary", label: "纪录片 Documentary", aliases: ["doc", "non_fiction"],
    identity: "纪录片的视觉灵魂是零额外布光，摄影机只记录真相，不创造真实。",
    emotion: "真实、临场、见证、不修饰的亲密。",
    lightingSuggestions: { keyLight: [], fillLight: [], motivatedLight: [], specialStyle: ["naturalistic"], contrastRatio: "可变", note: "零额外布光，只用场景中已经存在的光源(Available Light Only)。这是纪录片的灵魂。" },
    tempoSuggestions: { recommended: "variable", ceiling: "ultra_fast", floor: "slow", note: "节奏由内容决定。采访片段=舒缓。事件记录=跟随真实时间流速。不强制施加节拍。" },
    cameraSuggestions: { recommended: ["handheld","static","tracking","pan","zoom"], avoidUnless: ["crane","dolly_zoom"], note: "手持为主要运镜，我在这里，我在见证。固定三脚架用于采访。跟拍用于记录人物行动。变焦在纪录片中是可接受的。" },
    shotSizeSuggestions: { recommendation: "可变+手持为主。无固定景别分配。", composition: "零风格化构图。记录真实的构图就是最好的构图。", density: "可变。不强制控制视觉信息密度。" },
    colorPalette: { primary: "零风格化。自然色还原。不加LUT。不加滤镜。", accent: "", note: "真实颜色优先于美学颜色。" },
    signatureTechniques: "手持见证式运镜。采访构图(三脚架固定+正面平视)。自然可用光。变焦在现场。长镜头不停机。",
    genreRules: "零额外布光：只用场景中已经存在的光。真实颜色优先。手持是第一人称的在场声明。不要美化，不要丑化。" ,
    llmInjection: "【导演审美引导 - 纪录片风格】光影建议：零额外布光，只用场景中已经存在的光源(Available Light Only)。这是纪录片的灵魂。节奏建议：节奏由内容决定。采访片段=舒缓。事件记录=跟随真实时间流速。运镜建议：手持为主要运镜。固定三脚架用于采访。跟拍用于记录人物行动。色彩建议：零风格化。自然色还原。不加LUT。不加滤镜。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "youth", label: "青春/校园 Youth/School", aliases: ["school_life", "teen", "coming_of_age"],
    identity: "青春题材的视觉核心是明亮的、充满阳光的、充满生命力的。春夏的明亮感，不是秋冬的晦暗。",
    emotion: "活力、憧憬、成长、友情、暗恋、青春的无畏与迷茫。",
    lightingSuggestions: { keyLight: ["soft_key","butterfly"], fillLight: ["soft_fill","hair_light","eye_light"], motivatedLight: ["window","screen_light","street_light"], specialStyle: ["high_key","golden_hour"], contrastRatio: "2:1至3:1", note: "高调用光(High-Key)+柔光。自然窗光和教室日光灯。黄金时刻(放学后)=青春的特殊魔力时刻。" },
    tempoSuggestions: { recommended: "fast", ceiling: "fast", floor: "normal", note: "偏快(3-5s/镜)。青春的节奏。心动/告别瞬间=升格慢动作。群像场景=正常节奏。" },
    cameraSuggestions: { recommended: ["handheld","static","tracking","arc","slow_motion"], avoidUnless: ["whip_pan","crash_zoom","snorricam"], note: "手持跟拍，跟朋友走在一起的亲密感。越肩拍摄(OTS)=偷看暗恋对象。阳光明媚的固定镜头。" },
    shotSizeSuggestions: { recommendation: "中景+近景为主(60%)。特写用于情感时刻(30%)。全景用于校园环境(10%)。", composition: "阳光镜头光晕(Rays/Lens Flare)是青春片的标志性视觉。明亮、开放、不封闭的构图。", density: "每镜1-3个信息点。保持青春的通透感。" },
    colorPalette: { primary: "明亮饱和暖色。蓝天+绿草+白衬衫。整体曝光偏高。", accent: "阳光金、校服蓝/白、樱花粉。", note: "春夏的明亮感。" },
    signatureTechniques: "阳光镜头光晕(Rays/Flare)。手持跟拍的亲密感。黄金时刻=青春的魔法时刻。升格慢动作=心动的瞬间。越肩偷看=暗恋的镜头语言。",
    genreRules: "明亮感优先：不要阴天的晦暗。阳光=青春的生命力。手持跟拍的亲密感：观众应该感觉自己是群体中的一员。心动瞬间必须升格。",
    llmInjection: "【导演审美引导 - 青春/校园风格】光影建议：高调用光(High-Key)+柔光。自然窗光和教室日光灯为主要光源。黄金时刻(放学后)=青春的特殊魔力时刻。节奏建议：偏快(3-5s/镜)。心动/告别瞬间=升格慢动作。运镜建议：手持跟拍，跟朋友走在一起的亲密感。越肩拍摄=偷看暗恋对象。色彩建议：明亮饱和暖色。蓝天+绿草+白衬衫。整体曝光偏高。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "road_movie", label: "公路/旅途 Road Movie/Journey", aliases: ["journey", "travel"],
    identity: "公路电影的美学核心是在路上。自然光驱动。黄金时刻和蓝调时刻是魔力时间窗口。",
    emotion: "自由、孤独、寻找、蜕变、旅途中的相遇与告别。",
    lightingSuggestions: { keyLight: ["soft_key","rim_key"], fillLight: ["soft_fill"], motivatedLight: ["window","car_headlight","street_light","neon"], specialStyle: ["naturalistic","golden_hour","blue_hour"], contrastRatio: "3:1至4:1", note: "自然光驱动。黄金时刻和蓝调时刻是公路片的两个魔力时间窗口。车内光线=通过挡风玻璃的自然日光。光线随地理位置的真实变化而改变。" },
    tempoSuggestions: { recommended: "normal", ceiling: "fast", floor: "slow", note: "正常为主(5-8s/镜)。广角公路/荒漠风景降至舒缓。车内对话偏快。关键相遇/告别降至舒缓。" },
    cameraSuggestions: { recommended: ["drone","tracking","pov","pan","dolly_push"], avoidUnless: ["whip_pan","snorricam"], note: "航拍公路横穿大地(Drone)。车内POV，观众坐在副驾驶。跟拍人物下车。横摇展示地平线。" },
    shotSizeSuggestions: { recommendation: "远景+中景为主。远景(40%)展示路和风景。中景(30%)车内对话。特写(30%)情感时刻。", composition: "地平线是公路片的构图灵魂。道路=视觉引导线。车窗外掠过的风景。", density: "每镜2-4个信息点。远景中可以容纳更多环境细节。" },
    colorPalette: { primary: "以经过的地区真实色彩为准。", accent: "", note: "尊重地方感的色彩。美国西部=暖棕+金+蓝天。亚洲公路=翠绿+湿灰+霓虹。" },
    signatureTechniques: "航拍公路横穿大地。车内POV。黄金时刻+蓝调时刻。跟拍人物下车。横摇展示地平线。道路作为视觉引导线。",
    genreRules: "尊重地方感：色彩随地理位置的真实变化而改变。道路=叙事线：道路本身是主角之一。车内空间是重要的叙事空间。",
    llmInjection: "【导演审美引导 - 公路/旅途风格】光影建议：自然光驱动。黄金时刻和蓝调时刻是公路片的两个魔力时间窗口。车内光线=通过挡风玻璃的自然日光。节奏建议：正常为主(5-8s/镜)。广角公路/荒漠风景降至舒缓让观众在路上。运镜建议：航拍公路横穿大地。车内POV观众坐在副驾驶。横摇展示地平线。色彩建议：以经过的地区真实色彩为准。尊重地方感的色彩。以上均为导演审美建议，非强制约束。",
  },
  {
    key: "musical", label: "音乐/歌舞 Musical", aliases: ["dance", "song_and_dance"],
    identity: "音乐剧/歌舞片的视觉核心是情感的外化。音乐段落的光影可以脱离现实物理规则。非音乐段落回归题材基础风格。",
    emotion: "激情、欢乐、浪漫、梦想、生命的律动。",
    lightingSuggestions: { keyLight: ["soft_key","butterfly","flat"], fillLight: ["soft_fill","hair_light"], motivatedLight: ["neon","ambient_bounce"], specialStyle: ["high_key"], contrastRatio: "可变", note: "戏剧化+聚光灯效果。音乐段落的光影可以脱离现实物理规则，追光灯(Spotlight)、彩色舞台灯、人物自发光。非音乐段落回归题材基础风格。" },
    tempoSuggestions: { recommended: "fast", ceiling: "fast", floor: "normal", note: "非音乐段落遵循题材基础节奏。音乐段落的节奏由音乐本身的节拍驱动。剪辑通常与音乐节拍/旋律短语对齐。" },
    cameraSuggestions: { recommended: ["arc","crane","tracking","dolly_push","static"], avoidUnless: ["handheld"], note: "环绕运镜(Arc)跟踪舞者。摇臂从高到低展现群舞全貌。高角度俯拍展现舞蹈队形。" },
    shotSizeSuggestions: { recommendation: "全景+特写交替。全景用于群舞和队形展示。特写用于独舞者的情感表达。", composition: "高度戏剧化。音乐段落的构图可以比现实更大胆。", density: "可变。非音乐段落遵循题材规则，音乐段落由编舞驱动。" },
    colorPalette: { primary: "高度戏剧化的饱和色彩。", accent: "", note: "音乐段落的色彩可以比现实更鲜艳/更大胆，这是情感的外化。" },
    signatureTechniques: "环绕运镜跟踪舞者。摇臂展现群舞全貌。高角度俯拍舞蹈队形。追光灯/聚光灯效果。剪辑与音乐节拍对齐。",
    genreRules: "音乐段落和非音乐段落可以有不同的视觉规则。音乐段落的节奏由音乐节拍驱动。色彩和光影在音乐段落可以脱离现实。",
    llmInjection: "【导演审美引导 - 音乐/歌舞风格】光影建议：戏剧化+聚光灯效果。音乐段落的光影可以脱离现实物理规则，追光灯(Spotlight)、彩色舞台灯。非音乐段落回归题材基础风格。节奏建议：音乐段落的节奏由音乐本身的节拍驱动。剪辑通常与音乐节拍/旋律短语对齐。运镜建议：环绕运镜跟踪舞者。摇臂从高到低展现群舞全貌。色彩建议：高度戏剧化的饱和色彩。音乐段落的色彩可以比现实更鲜艳更大胆，这是情感的外化。以上均为导演审美建议，非强制约束。",
  },
];

export function findGenre(key: string): GenrePreset | undefined {
  return GENRE_PRESETS.find(g => g.key === key || g.aliases.includes(key));
}

// ============================================================
// 仓库 4：安全突变因子 (Controlled Mutation) - 10 种
// ============================================================

export const MUTATION_TYPES: MutationType[] = [
  {
    key: "gods_eye", label: "上帝俯视 God's Eye",
    prompt: "Overhead top-down shot, god's eye perspective, looking straight down from directly above, abstract spatial geometry, miniature-like scale, top-down bird's eye view",
    description: "摄影机从人物/场景正上方垂直向下俯拍。人物和物体在地面上形成抽象的几何图案，失去常规透视参照。是抽离的极致，人在此时变成平面的符号。",
    usageRole: "Cutaway",
    contextFit: "激烈对话后的情绪缓冲，让观众从情感中抽离片刻。场景/空间转换的过渡，从一处到另一处的空中过场。多人混乱场景后重新建立空间关系。",
    contextForbidden: "动作高潮中不可插入(打断连贯性)。人物表情/微表情关键时刻不可覆盖。连续两个上帝俯视不可相邻。",
    compatibleGenres: ["default","historical","scifi","arthouse","crime","war","fantasy"],
    incompatibleGenres: ["romance","comedy"],
  },
  {
    key: "worms_eye", label: "贴地仰视 Worm's Eye",
    prompt: "Worm's eye view, extreme low angle from ground level, camera placed on ground looking up, towering perspective, dramatic scale distortion, subjects appear monumental and imposing",
    description: "摄影机紧贴地面，从极低角度向上仰拍。人物和建筑被极度放大，产生巨人感或压迫感。",
    usageRole: "Insert",
    contextFit: "人物初次登场的压迫感建立。对峙场景中从弱势方视角仰望强势方。场景规模展示的非常规角度。",
    contextForbidden: "甜宠/温情场景(破坏亲密感)。二人平等对话的中间镜头(会造成错误的力量关系暗示)。",
    compatibleGenres: ["action","crime","thriller","war","scifi"],
    incompatibleGenres: ["romance","comedy"],
  },
  {
    key: "obscured_pov", label: "遮挡窥视 Obscured POV",
    prompt: "Obscured voyeuristic POV shot, peeking through foreground objects, door frame or curtain edge partially blocking view, hidden observer perspective, layered depth with obscured foreground element, spying through gaps",
    description: "摄影机躲在前景物体后面拍摄，门缝、窗帘边缘、书架的间隙、栅栏。前景物体占据画面的20-40%，观众通过缝隙窥视主体。",
    usageRole: "Cutaway",
    contextFit: "悬疑/惊悚场景的核心技法，有人在暗中看着。偷听/秘密被发现的关键时刻。人物不知情的情绪流露，观众是偷窥者。",
    contextForbidden: "人物直面镜头/打破第四面墙的场景(矛盾)。需要观众完全共情人物时(遮挡会制造距离感)。",
    compatibleGenres: ["thriller","chinese_horror","crime","film_noir"],
    incompatibleGenres: ["comedy","musical","romance"],
  },
  {
    key: "dutch_angle", label: "倾斜构图 Dutch Angle",
    prompt: "Dutch angle shot, tilted horizon, canted camera 20-25 degrees, skewed perspective, off-kilter composition, psychological unease, world literally tilted, diagonal framing",
    description: "摄影机向左或向右倾斜20-25deg，使地平线不再水平。画面中的一切歪了，观众的下意识反应是有什么不对劲。",
    usageRole: "Reaction Shot",
    contextFit: "人物发现令人不安的真相时，心理失衡=画面倾斜。角色被下药/醉酒/眩晕的主观视角。秩序开始崩溃的裂缝时刻。",
    contextForbidden: "喜剧场景中的无目的倾斜(会变成无意的搞笑)。倾斜角度不要超过25deg。同一场景中连续使用。",
    compatibleGenres: ["thriller","action","film_noir","chinese_horror","scifi"],
    incompatibleGenres: ["romance","musical","comedy"],
  },
  {
    key: "extreme_macro", label: "超微距特写 Extreme Macro",
    prompt: "Extreme macro close-up, abstract texture detail, unrecognizable scale, microscopic perspective, surface and material abstraction, hyper-detailed texture, abstract organic or mechanical pattern",
    description: "摄影机推到极近，近到观众在最初1秒内无法分辨这拍的是什么。物体在超微距下失去尺度参照，变成抽象的纹理和形状。",
    usageRole: "Insert",
    contextFit: "重要道具的关键细节揭示。情绪积累后的视觉休止符，让观众盯着一个抽象纹理呼吸。从极微回到正常景别的揭示，先拍超微距再拉远揭示全貌。",
    contextForbidden: "快节奏动作中不可插入(观众来不及辨认画面内容)。如果观众需要始终知道空间位置则不可用。",
    compatibleGenres: ["default","historical","arthouse","romance","urban","youth"],
    incompatibleGenres: ["action","war"],
  },
  {
    key: "reflection", label: "反光面视角 Reflection",
    prompt: "Reflection shot, subject seen through mirror water or puddle reflection, indirect perspective through reflective surface, distorted or perfectly mirrored secondary view, seeing the scene through a reflection",
    description: "不直接拍摄主体，而是通过镜面/水面/金属反光/玻璃幕墙的反射来间接呈现。本质是不直视主体，这种间接性本身就带有情绪色彩。",
    usageRole: "Cutaway",
    contextFit: "人物自我审视/自我怀疑的时刻，镜子中的自己。倒影中出现人物没有意识到的东西，悬疑利器。离别/回忆场景，水面倒影渐散。",
    contextForbidden: "反光中出现摄影机/灯光设备(穿帮)。镜面反光不要代替所有正常镜头(偶尔使用才有效果)。",
    compatibleGenres: ["default","arthouse","romance","urban","youth","thriller"],
    incompatibleGenres: ["action","war"],
  },
  {
    key: "shadow_only", label: "影子叙事 Shadow Only",
    prompt: "Shadow projection only, subject revealed exclusively through silhouette and shadow cast on wall or ground, no direct view of subject, dramatic elongated shadow, mystery through absence",
    description: "完全不拍人物，只拍人物的影子投在墙面/地面/窗帘上。影子讲述一个正在发生什么的故事，但观众看不见本体。",
    usageRole: "Cutaway",
    contextFit: "暴力/亲密场景的间接呈现，影子比真实画面更有冲击力。权力不对称，我们只看到强势者的影子笼罩弱势者。人物已经被物化/去人性化的隐喻。",
    contextForbidden: "影子中不能泄露比直接拍摄更多的信息。连续两个影子镜头会失去冲击力。",
    compatibleGenres: ["thriller","film_noir","chinese_horror","crime"],
    incompatibleGenres: ["comedy","musical","romance"],
  },
  {
    key: "frame_in_frame", label: "帧内帧 Frame in Frame",
    prompt: "Frame within frame composition, subject viewed through doorway window arch or natural frame, nested visual layers, depth through architectural framing, portal-style composition",
    description: "利用场景中天然存在的框，门框、窗户、拱形走廊、桥梁，将主体框在一个画内画的结构中。画面中有两个或更多层次的视觉嵌套。",
    usageRole: "Cutaway",
    contextFit: "人物被困/被限制的视觉隐喻。场景转换，从框外进入框内。多人场景中区分不同空间层次。",
    contextForbidden: "如果场景中不存在自然的框而硬造，会显得做作。不要在动作高潮中使用。",
    compatibleGenres: ["historical","urban","arthouse","scifi","fantasy"],
    incompatibleGenres: ["action","war"],
  },
  {
    key: "fisheye", label: "鱼眼畸变 Fisheye",
    prompt: "Fisheye lens distortion, extreme wide-angle curved perspective, warped horizon and spatial distortion, immersive spherical view, surreal bending of straight lines, convex visual field",
    description: "使用极短焦距鱼眼镜头(通常16mm以下)，导致画面边缘严重弯曲变形。世界变成球形，这是极度不正常的视觉信号。",
    usageRole: "Reaction Shot",
    contextFit: "人物精神状态异常，醉酒/吸毒/精神崩溃。世界正在扭曲的隐喻，真相被歪曲/记忆被篡改。派对/夜店/狂欢场景。",
    contextForbidden: "仅能在明确的心理/情绪驱动下使用。不可用于角色建立或常规叙事。",
    compatibleGenres: ["scifi","film_noir","chinese_horror","comedy"],
    incompatibleGenres: ["romance","historical","documentary"],
  },
  {
    key: "motion_blur", label: "模糊拖影 Motion Blur",
    prompt: "Motion blur effect, subject sharp with streaking blurred elements, long exposure aesthetic, dynamic energy trails, smeared light streaks, temporal distortion, dreamlike drag effect",
    description: "使用慢速快门拍摄，运动中的元素产生拖影和条纹。静止的主体清晰，运动的环境/元素模糊。时间似乎在拉伸。",
    usageRole: "Reaction Shot",
    contextFit: "人物在极度震惊中时间慢下来了。人群快速涌动但主角静止，孤独感的视觉化。记忆/梦境/幻觉段落。",
    contextForbidden: "需要清晰展示大量信息时不可用(模糊=信息损失)。",
    compatibleGenres: ["default","arthouse","scifi","thriller","youth","urban"],
    incompatibleGenres: [],
  },
];

// ============================================================
// 导演路由引擎 (DirectorRouter)
// ============================================================

export class DirectorRouter {
  /**
   * 核心路由：题材 -> 布光方案 + 节奏方案 + 运镜偏好 + 安全变异
   * 所有输出均为建议，不锁死任何参数
   */
  static resolve(genreKey: string, tempoOverride?: string): DirectorContext {
    const genre = findGenre(genreKey) || findGenre("default")!;
    const tempo = findTempo(tempoOverride || genre.tempoSuggestions.recommended) || findTempo("normal")!;
    
    // 从字典中取具体灯光条目
    const keyLight = findLight(genre.lightingSuggestions.keyLight[0]) || null;
    const fillLight = findLight(genre.lightingSuggestions.fillLight[0]) || null;
    const motivatedLight = findLight(genre.lightingSuggestions.motivatedLight[0]) || null;
    const specialStyle = genre.lightingSuggestions.specialStyle.length > 0
      ? (findLight(genre.lightingSuggestions.specialStyle[0]) || null) : null;

    // 组装注入到 buildImagePayload 的英文 Prompt 片段
    const lightingParts = [
      keyLight?.prompt,
      fillLight?.prompt,
      motivatedLight?.prompt,
      specialStyle?.prompt,
      genre.colorPalette.primary,
    ].filter(Boolean);
    const lightingPrompt = lightingParts.join(", ");

    // 运镜 Prompt 片段
    const recommendedCameras = genre.cameraSuggestions.recommended.map(k => findCamera(k)).filter(Boolean) as CameraMovement[];
    const cameraPrompt = recommendedCameras.map(c => c.prompt).join(" | ");

    // 10% 黄金法则：安全突变投骰子
    const mutation = DirectorRouter.rollMutation(genreKey);

    // LLM 注入文本块
    const llmContextBlock = DirectorRouter.buildLLMContext(
      genre, 
      tempo, 
      keyLight, 
      fillLight, 
      motivatedLight, 
      specialStyle, 
      mutation, 
      lightingPrompt, // ✨ 新增传参
      cameraPrompt    // ✨ 新增传参
    );

    return {
      genre: genreKey,
      genreLabel: genre.label,
      tempo: tempo.key,
      tempoLabel: tempo.label,
      keyLight,
      fillLight,
      motivatedLight,
      specialStyle,
      tempoProfile: tempo,
      cameraPreference: cameraPrompt,
      visualTone: genre.colorPalette.primary,
      lightingPrompt,
      cameraPrompt,
      mutation,
      llmContextBlock,
    };
  }

  /**
   * 10% 黄金法则：随机触发突变镜头
   * 返回触发结果和(如果触发)选中的突变类型
   */
  private static rollMutation(genreKey: string): DirectorContext["mutation"] {
    if (Math.random() > MUTATION_SAFETY_RULES.triggerProbability) {
      return { triggered: false };
    }

    // 筛选适合当前题材的突变类型
    const compatible = MUTATION_TYPES.filter(m =>
      m.compatibleGenres.includes(genreKey) &&
      !m.incompatibleGenres.includes(genreKey)
    );

    if (compatible.length === 0) {
      return { triggered: false };
    }

    const mutationType = compatible[Math.floor(Math.random() * compatible.length)];

    // 安全约束注释
    const safetyNote = [
      `【安全约束】180deg轴线全程锁死。`,
      `身份约束：本突变镜头必须以${mutationType.usageRole}的身份出现，不可替代正常叙事镜头。`,
      `相邻约束：本突变镜头的前后相邻镜头必须都是正常叙事镜头。`,
      `打断禁止：如果前一个镜头是连贯主体动作(奔跑/出拳/跳跃等)，则取消本次突变。`,
    ].join(" ");

    return { triggered: true, mutationType, safetyNote };
  }

  /**
   * 构建注入 LLM System Prompt 的结构化上下文块
   */
  private static buildLLMContext(
    genre: GenrePreset,
    tempo: TempoProfile,
    keyLight: LightingEntry | null,
    fillLight: LightingEntry | null,
    motivatedLight: LightingEntry | null,
    specialStyle: LightingEntry | null,
    mutation: DirectorContext["mutation"],
    lightingPrompt: string, // ✨ 新增接收参数
    cameraPrompt: string    // ✨ 新增接收参数
  ): string {
    const lines = [
      `【导演路由引擎 - 审美引导】
本作品题材定位：【${genre.label}】
情绪基调：${genre.emotion}

【光影基调建议（非具体参数）】
以下为场景级光影基调建议。你需要根据每个分镜的具体剧情内容，
为该分镜设计适合的光线方向、灯具位置和光比细节——
光影服务于剧情，不由类型模板锁死。

● 主光类型倾向：${genre.lightingSuggestions.keyLight.map(k => findLight(k)?.label || k).join(" / ")}
● 辅光类型倾向：${genre.lightingSuggestions.fillLight.map(k => findLight(k)?.label || k).join(" / ")}
● 环境光来源建议：${genre.lightingSuggestions.motivatedLight.map(k => findLight(k)?.label || k).join(" / ")}
● 光影风格倾向：${genre.lightingSuggestions.specialStyle.length > 0 ? genre.lightingSuggestions.specialStyle.map(k => findLight(k)?.label || k).join(" / ") : "无特定风格倾向"}
● 建议光比：${genre.lightingSuggestions.contrastRatio}
● 强力建议的英文光影咒语底座（English Lighting Prompts）：【${lightingPrompt}】
（💡 提示：在推断生成每个分镜的 shotLighting 时，请务必优先调用或重组上方括号内的原生英文词汇！确保光影质感的极致还原。）
● 基调备注：${genre.lightingSuggestions.note}

【重要】同一场景内光影基调应保持一致，但每个分镜的光线方向
（光从左侧/右侧/上方/下方来、是否逆光、是否侧逆光）应根据
当前镜头的景别、人物站位、情绪做动态调整。不要所有镜头都用同一角度打光。

【节奏方案（导演审美建议）】
建议节奏：${tempo.label}
每镜时长建议：${tempo.durationRange[0]}-${tempo.durationRange[1]}秒（区间建议，非强制）
剪辑策略：${tempo.cutDescription}
运镜速率：${tempo.cameraSpeedDescription}
动态与速率英文咒语（Speed Prompts）：【${tempo.cameraSpeedPrompt}】
画面密度：${tempo.visualDensityDescription}
节奏备注：${genre.tempoSuggestions.note}

【运镜建议】
推荐运镜：${genre.cameraSuggestions.recommended.map(k => findCamera(k)?.label || k).join(" / ")}
强力建议的英文运镜咒语底座（Camera Prompts）：【${cameraPrompt}】
（💡 提示：在输出分镜 JSON 的 timeSegments 动作描述和 cameraRules 时，请务必优先调用或融合上述的运镜速率和运镜词汇！）
运镜备注：${genre.cameraSuggestions.note}

【色彩调色板建议】
色调：${genre.colorPalette.primary}
点缀色：${genre.colorPalette.accent}
调色备注：${genre.colorPalette.note}

【构图与景别建议】
${genre.shotSizeSuggestions.recommendation}
构图：${genre.shotSizeSuggestions.composition}

【标志性视觉技法】
${genre.signatureTechniques}

【题材特定规则】
${genre.genreRules}
`,
    ];

    if (mutation.triggered && mutation.mutationType) {
      lines.push(`【安全突变触发】
类型：【${mutation.mutationType.label}】${mutation.mutationType.description}
身份约束：仅以【${mutation.mutationType.usageRole}】身份出现
${mutation.safetyNote || ""}
突变Prompt参考：${mutation.mutationType.prompt}
适用场景：${mutation.mutationType.contextFit}
`);
    }

    lines.push(`---
🔴【核心约束 — 光影服务于剧情】
以上所有光影、节奏、运镜、色彩的建议均为导演的审美偏好引导。
但光影不是由题材模板锁死的——
你需要根据每个分镜的具体剧情内容、人物情绪、空间位置，
为该分镜设计适合的光线方向和光比。
同一个场景内光影基调应保持一致，但不同分镜间光线方向可以也应该有所不同。

节奏、运镜、色彩的建议同理——它们是引导，不是牢笼。
当你有充分叙事理由时，可以自由偏离以上建议。
但请在偏离时在分镜的备注中简略说明偏离的叙事理由。
`);

    return lines.join("\n");
  }
}
