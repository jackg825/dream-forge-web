# 圖片生成小樣測試

狀態：使用者已授權開始首輪付費生成，沿用 US$3 預算、最多 9 次請求。改由 OpenRouter 呼叫三個模型，採用人物、背包犬、燈具三張真實照片。目前本機尚未提供 `OPENROUTER_API_KEY`，尚未送出生成請求；沒有品質排名或實際費用結果。

第一輪比較 **GPT Image 2 medium、Gemini 3 Pro Image、Seedream 5.0 Lite**。同一樣本的輸入 bytes 與 prompt 在三個模型間完全相同，各產生一張 2048×2048 四視圖圖板，共 9 次請求，成功時得到 9 張圖板及 36 張原生裁切視圖。每個請求只有一張參考圖。這輪針對輔助視角的一致性，不足以判斷真人風格轉換或 3D 成品品質，也尚未比較「四次分開生成」策略。

## 樣本與固定條件

| 樣本 | 輸入來源 | 原生尺寸 | 檢查重點 |
|---|---|---:|---|
| 全身人物 | [Peter T／Wikimedia Commons](https://commons.wikimedia.org/wiki/File:New_York_Fashion_Week_September_2016_(29595075045).jpg)，CC BY 2.0 | 2076×3288 JPEG | 黑包在人物右手、黃手機在左手；肩帶、條紋、牛仔褲結構、鞋款；排除路人與車輛 |
| 長毛背包犬 | [Dion Hinchcliffe／Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Champ_with_his_doggie_backpack.jpg)，CC BY-SA 2.0 | 4592×3056 JPEG | 紅黑背包、反光帶、扣具與吊牌；不混入人的肢體；統一移除鬆散牽繩 |
| 工業風扇造型燈 | [Amazon Berkeley Objects](https://amazon-berkeley-objects.s3.amazonaws.com/index.html)，Amazon.com，CC BY 4.0 | 2560×2560 JPEG | 網籠、三燈泡、側邊雙旋鈕、木紋外環、雙腳；不可變成有扇葉的風扇 |

本輪取代先前的合成公仔與賽車樣本。完整來源、授權、下載網址、SHA-256 及原圖保存在 `.image-benchmark/candidates-2026-09-05/sources.json` 與 `assets/`，沒有縮圖或預先清除背景。人物與狗沒有真實背面，評分只能衡量一致性、可見細節與背面合理性，不能將臆造背面視為已還原真實物件。

燈具為 ABO 商品 `B07B51946F`、catalog image `91iNP6GHHlL`，輸入原圖為 `images/original/d2/d2474d2e.jpg`；保留 spin `d6cc48ad` 的 00／18／36／54 四張轉台照片供事後結構核對，不送入生成。它們是相隔 90 度的相對角度，不能假設 00 就是正面；轉台圖有點燈、輸入未點燈，不將亮度差當作結構錯誤。對照與來源證據存於 `evidence/abo-industrial-fan-provenance.json`。[資料集 README](https://amazon-berkeley-objects.s3.amazonaws.com/README.md)、[當前授權](https://amazon-berkeley-objects.s3.amazonaws.com/LICENSE-CC-BY-4.0.txt)

固定格位：左上正面、右上背面、左下物件自身左側、右下自身右側。保留既有外觀、不另做風格轉換；每張樣本有固定的主體選擇指示，接上共用四視圖要求，完整內容存於 `scripts/image-benchmark.config.json`。狗的鬆散牽繩統一移除，穿戴配件保留。保留原始輸出，按實際尺寸裁切，不先放大成 2K；OpenRouter 回傳非 2048×2048 時保存結果並停止後續請求。每家每樣本只跑一次，不以不同供應商的 seed 數值假設等價。

## OpenRouter 呼叫設定

查閱日三模型均列於 OpenRouter Images catalog，端點為 `POST https://openrouter.ai/api/v1/images`。使用 `input_references` 傳送單張原圖 data URI、`n: 1`、`stream: false`，固定 provider 並停用 fallback，避免一次比較混入未知路由。公開 catalog 可用不代表本帳戶已取得模型權限或成功生成。[Images API 文件](https://openrouter.ai/docs/guides/overview/multimodal/image-generation)

| 模型 ID | 固定 provider tag | 圖片參數 |
|---|---|---|
| `openai/gpt-image-2` | `openai` | `size: 2048x2048`、`quality: medium` |
| `google/gemini-3-pro-image` | `google-ai-studio/global` | `resolution: 2K`、`aspect_ratio: 1:1` |
| `bytedance-seed/seedream-5-0-lite` | `seed` | `resolution: 2K`、`aspect_ratio: 1:1` |

第一個請求固定 GPT Image 2／人物。GPT 的端點能力表未列 `resolution`，通用文件允許明確 `size`；必須先檢查真實輸出是否 2048×2048，符合才進行其餘模型。模型回傳版本或 provider 若缺少，不把 requested ID 當成已驗證的後端版本。[GPT 端點](https://openrouter.ai/api/v1/images/models/openai/gpt-image-2/endpoints)、[Gemini 端點](https://openrouter.ai/api/v1/images/models/google/gemini-3-pro-image/endpoints)、[Seedream 端點](https://openrouter.ai/api/v1/images/models/bytedance-seed/seedream-5-0-lite/endpoints)

## 預算與存證

| 設定 | 每張 2K 圖板的圖片輸出估價 | 3 張 |
|---|---:|---:|
| GPT Image 2 medium | $0.10704 | $0.32112 |
| Gemini 3 Pro Image | $0.13440 | $0.40320 |
| Seedream 5.0 Lite | $0.03500 | $0.10500 |
| 合計 | | **$0.82932** |

以上為查閱日的圖片輸出估價，另有 OpenAI／Google 的圖片、文字輸入及 Google thinking 費用；不是帳單或費用上限。來源：[OpenAI 定價](https://developers.openai.com/api/docs/pricing)、[GPT Image 2 計算器](https://developers.openai.com/_astro/GptImage2TokenCalculator.react.Bi5Ri9Qv.js)、[Gemini 定價](https://ai.google.dev/gemini-api/docs/pricing)、[BytePlus 定價](https://docs.byteplus.com/en/docs/ModelArk/1544106)。

首輪已獲授權，採 **US$3** 預算。執行器每次請求先預留 $0.30，最多 9 次、共 $2.70 預留，無自動重試，任何硬失敗即停止；這是本機請求控制，不是供應商帳戶的硬性扣款上限。OpenRouter 的 Gemini 端點未列出 `maxOutputTokens` passthrough，因此不沿用直連 Google 的輸出 token 上限。圖片、文字與 thinking 的實際費用以 OpenRouter `usage.cost` 核對；未回傳有效費用時保存圖片並停止，待對帳後再繼續，不當成零。遇到回傳費用高於預留金額，後續須按較高值計入預算；不足以預留下一次請求時停止。客戶端逾時不能證明服務端未完成或沒有計費，不直接重試。

每次呼叫前記錄開始狀態；回應後記錄輸入 SHA-256、實際 sample prompt、要求的模型與 API 回傳版本（若有）、路由參數、耗時、request ID、usage、原始圖片、真實尺寸、原生裁切及錯誤類型。不記錄金鑰或完整錯誤 body。usage 缺少欄位代表未知，不以 0 代替。實際費用須再以 OpenRouter 帳務核對；此處不包含充值費用。所有輸入副本、輸出與私密設定保存在被 Git 忽略的 `.image-benchmark/`。

## 執行

從 repo 根目錄執行；沿用已安裝的 `functions` Sharp，不新增依賴。

```sh
node scripts/benchmark-images.mjs --config scripts/image-benchmark.config.json
```

Dry run 不連網、不生成。三張樣本已下載到本機候選目錄；全新 checkout 須先從上述來源取得同一批原始檔。將 `OPENROUTER_API_KEY` 放入本機 `.image-benchmark/credentials.env`，不要貼進聊天或提交 Git。這輪付費生成已獲授權，金鑰就緒後執行：

```sh
node --env-file=.image-benchmark/credentials.env scripts/benchmark-images.mjs --config scripts/image-benchmark.config.json --execute --budget-usd 3
```

每次執行須使用全新 outputDir；已有執行記錄時拒絕覆寫，以免重跑重複扣款。檔案存在不代表前一次已成功，逾時也不要直接重試。先核對 manifest 與供應商狀態，再決定是否另開一輪。

離線驗證：`node --test scripts/benchmark-images.test.mjs`（17/17 通過）；語法檢查、diff 檢查與三張真實樣本 dry run 通過。帶 `--execute --budget-usd 3` 的前置檢查因缺少 OpenRouter 金鑰而停止，沒有建立執行目錄或送出付費請求。涵蓋零網路 dry run、輸入與預算限制、缺少必要金鑰時禁止部分執行、三家請求的相同輸入、呼叫前寫入紀錄、拒絕重跑、失敗停止、金鑰與錯誤 body 不落檔、usage 留存及原生裁切像素。這些 mock 不證明帳戶已開通模型、真實 API 可用或生成品質。

## 看圖標準

每張圖板各項 0–2 分：0 = 明顯失敗；1 = 有瑕疵需修；2 = 可接受。

| 項目 | 2 分條件 |
|---|---|
| 視角 | 四個指定角度皆正確，左右不是錯誤鏡像 |
| 外形與身份 | 四面維持同一物件、比例與姿態，沒有混入背景人物／肢體 |
| 配件 | 數量、形狀、物理左右位置一致 |
| 配色與可見文字 | 保留來源的顏色與可辨識字樣，不把文字複製到不合理表面 |
| 細節 | 人物肩帶／條紋／褲裝、狗的長毛／背包扣具，或燈具網籠／燈座／旋鈕等仍清楚 |
| 可裁切性 | 完整物件不跨格，無格線／標籤，四張裁切可獨立使用 |

預先設定初篩通過條件：視角、配件、可裁切性各 2 分，總分至少 10/12。背面合理性另外附文字觀察，不當作真實準確率。先看匿名輸出再揭示供應商；記錄評分者與判斷理由。只有三張／每設定一次，只報逐樣本結果與本輪通過數，不宣稱統計上勝出，不估 p95。觀察結果後，才決定是否補高品質、4K、分開生成或真實多面照片測試。

燈具另以保留轉台照片記錄網籠深度、旋鈕所在側、後方接線及燈座連接的「正確／錯誤／不可判定」，不併入人物與狗沒有真實背面可查的共同總分。明確區分 AI 看圖評估與使用者實際評分。
