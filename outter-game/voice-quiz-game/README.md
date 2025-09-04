# 语音应答游戏（设计文档）

简洁版设计，聚焦可实施性与复用现有能力（STT/TTS/LLM、QTZ 踏板、设备管理器）。

## 1. 概述
- 场景：主人要求奴隶在限定时间内回答问题。
- 玩法：
  1) 若为“问题”，先用TTS播报并在屏幕显示“问题”和“标准答案”；
  2) 开始录音；
  3) 满足任一停止条件（连续静音5秒、超过最长时长、收到 QTZ 踏板信号）即结束录音；
  4) 语音→文字（STT）；
  5) 将识别结果与预定义答案送入 LLM 判定（考虑识别误差、同义表述）；
  6) 判对则成功，否则执行电击惩罚；
  7) 休息预设时间后进入下一条或结束。

## 2. 依赖与接口
- STT：语音转文本
  - 游戏侧可复用统一封装接口：game-speech-to-text（主进程已暴露）
  - 参考：<mcfile name="ipcHandlers.js" path="e:\develop\electron-client\services\ipcHandlers.js"></mcfile> 中的 game-speech-to-text 处理器
- TTS：文本播报
  - 渠道：tts-speak / tts-stop
  - 参考：<mcfile name="ipcHandlers.js" path="e:\develop\electron-client\services\ipcHandlers.js"></mcfile>、<mcfile name="ttsService.js" path="e:\develop\electron-client\services\ttsService.js"></mcfile>
- LLM：答案判定
  - 渠道：llm-chat（模型可配）
  - 参考：<mcfile name="ipcHandlers.js" path="e:\develop\electron-client\services\ipcHandlers.js"></mcfile>、<mcfile name="llmService.js" path="e:\develop\electron-client\services\llmService.js"></mcfile>
- 设备：
  - QTZ 踏板/按钮信号：用于“提交/结束录音”。已有示例监听按键属性变化（button0/button1）。
  - 参考示例：<mcfile name="qa-game.js" path="e:\develop\electron-client\outter-game\QA-game\qa-game.js"></mcfile>、<mcfile name="maid-punishment-game.js" path="e:\develop\electron-client\outter-game\maid-punishment-game\maid-punishment-game.js"></mcfile>
  - 电击设备（可选）：类型 DIANJI，失败时触发一定时长与强度。

## 3. 核心流程（状态机）
- Idle → Prompting(TTS+UI渲染) → Listening(录音中) → Transcribing(STT) → Judging(LLM判定) → Feedback(成功/惩罚) → Next/End
- 停止录音触发：
  - 连续静音≥silentWindow（默认5s）
  - 录音总时长≥maxDuration（默认30s）
  - 收到 QTZ 踏板/按钮事件（如 button1 按下）

## 4. 判定策略（LLM 提示词思路）
- 目标：在ASR可能有误差情况下做“语义近似匹配”。
- 建议向 LLM 提供：
  - 指令：判断“用户回答”与“标准答案/同义答案集合”的匹配程度；
  - 约束：输出 JSON {correct:boolean, similarity:[0,1], reason:string}；
  - 容错：允许小范围错字、读音近似、语序变动；
- 阈值：similarity ≥ 0.75 视为正确（可配置）。

示例提示词片段：
- 系统：你是评卷官，请考虑语音识别误差，判断回答是否基本等同于标准答案。
- 用户：
  - 标准答案（若有多个，列出所有同义答案）
  - 识别文本（ASR输出）
  - 要求：仅返回JSON：{correct, similarity, reason}

## 5. 数据结构（题库）
- 每条目字段建议：
  - id: string
  - prompt: string            // 要说的话或问题
  - answer: string | string[] // 标准答案或同义答案集合

注意：本设计不创建题库文件，仅定义结构；落地时可放置为 items.json。

## 6. UI 最小要素
- 顶部：题目；
- 中部：标准答案可见文本（可开关显示）；
- 状态条：
  - 录音计时与静音计时
  - 当前题号/总题数
- 底部：系统反馈（识别文本、判定结果、惩罚提示）；

可参考现有游戏 UI 容器与日志区渲染方式，风格与 <mcfile name="qa-game.js" path="e:\develop\electron-client\outter-game\QA-game\qa-game.js"></mcfile> 保持一致性。

## 7. 设备与录音控制
- 录音开始：TTS 播报完成后进入 Listening；
- 录音结束：
  - 静音5s（需在录音时统计音量阈值下的连续时长）；
  - 超时（maxDuration）；
  - QTZ 踏板/按钮按下（优先立即结束并判定）；
- 失败惩罚：
  - 触发 DIANJI 设备：强度、时长从配置读取（如强度 30%、时长 800ms），并记录日志；

## 8. 配置项（建议可在游戏开头读取）
- 全局：
  - maxDuration: 30（秒）
  - silentWindow: 5（秒）
  - similarityThreshold: 0.75
  - 电击强度
  - 电击持续时间
  - 题目结束后休息时长
  - 总训练时间
- 题目来源：内置数组或外部 JSON 路径（可选），默认选择内置题库，参考QA-game的选择方式。

## 9. 主要交互调用（示意）
- TTS 播报：调用 tts-speak，文本为题目或 ttsText。
- STT 转写：录音完成后，通过 game-speech-to-text（或 stt-transcribe）得到文本。
- LLM 判定：调用 llm-chat，传入判题提示词与结构化输出要求。
- QTZ 事件：监听 qtz_sensor 的 button0/button1 属性变化，用于“结束录音/确认”。

参考：
- <mcfile name="ipcHandlers.js" path="e:\develop\electron-client\services\ipcHandlers.js"></mcfile>
- <mcfile name="ttsService.js" path="e:\develop\electron-client\services\ttsService.js"></mcfile>
- <mcfile name="llmService.js" path="e:\develop\electron-client\services\llmService.js"></mcfile>
- <mcfile name="qa-game.js" path="e:\develop\electron-client\outter-game\QA-game\qa-game.js"></mcfile>
- <mcfile name="maid-punishment-game.js" path="e:\develop\electron-client\outter-game\maid-punishment-game\maid-punishment-game.js"></mcfile>

## 10. 时序（单题）
1) Render题目与答案 → 2) TTS播报 → 3) 开始录音并显示计时 → 4) 触发结束条件 → 5) STT转写 → 6) LLM判定 → 7) 成功or惩罚 → 8) 下一题或结束。

## 11. 目录与落地
- 目录：outter-game/voice-quiz-game/
  - README.md（本设计文档）
  - voice-quiz-game.js（后续实现时新增）
  - items.json（可选，题库）

备注：本次仅交付设计文档；实现脚本与题库文件在后续迭代添加。