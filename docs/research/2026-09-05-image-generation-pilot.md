# 圖片生成小樣測試

狀態：測試器與三組原始樣本已備妥；10 個離線測試、語法檢查與真實樣本 dry run 通過。尚未呼叫生成 API，沒有品質排名或實際費用結果；執行仍待三家的 API 金鑰與付費預算確認。

第一輪比較 **GPT Image 2 medium、Gemini 3 Pro Image、Seedream 5.0 Lite**。每個模型處理相同三張參考圖與同一份 prompt，各產生一張 2048×2048 四視圖圖板，共 9 次請求，成功時得到 9 張圖板及 36 張原生裁切視圖。這輪針對輔助視角的一致性，不足以判斷真人風格轉換或 3D 成品品質，也尚未比較「四次分開生成」策略。

## 樣本與固定條件

| 樣本 | 輸入來源 | 原生尺寸 | 檢查重點 |
|---|---|---:|---|
| 牛仔公仔 | Git `63149102:app/public/styles/chibi/preview-1.jpg` | 1024×1024 PNG | 帽沿、金色捲髮、腰帶、流蘇、頭身比例 |
| 手提包公仔 | Git `63149102:app/public/styles/bobblehead/preview-3.jpg` | 1024×1024 PNG | 包包固定同一隻手、眼鏡、細頸彈簧、底座及 BOSS LADY 字樣 |
| 賽車 | `app/public/showcase/race_car_origin.jpg` | 5945×3505 JPEG | 四輪、胎紋、前後翼、細懸吊桿、車號 12、黑金配色 |

前兩張是專案既有的 Gemini 2.5 Flash Image 合成素材，從 Git 恢復原始 bytes；當時副檔名為 `.jpg`，檔案內容實為 PNG。現行公開 WebP 已縮成 400px，不用它們測原生細節。賽車是現有公開展示照片，Git 未附拍攝者資訊。三張均沒有真實背面參考，評分只能衡量一致性、可見細節與背面合理性，不能將臆造背面視為已還原真實物件。兩張合成公仔也可能帶來來源模型偏差。

固定格位：左上正面、右上背面、左下物件自身左側、右下自身右側。保留既有造型、不另做風格轉換，所有供應商收到相同輸入 bytes 與 prompt。保留原始輸出，按實際尺寸裁切，不先放大成 2K；非 2048×2048 輸出須標記偏差。每家只跑一次，不以不同供應商的 seed 數值假設等價。

## 預算與存證

| 設定 | 每張 2K 圖板的圖片輸出估價 | 3 張 |
|---|---:|---:|
| GPT Image 2 medium | $0.10704 | $0.32112 |
| Gemini 3 Pro Image | $0.13440 | $0.40320 |
| Seedream 5.0 Lite | $0.03500 | $0.10500 |
| 合計 | | **$0.82932** |

以上為查閱日的圖片輸出估價，另有 OpenAI／Google 的圖片、文字輸入及 Google thinking 費用；不是帳單或費用上限。來源：[OpenAI 定價](https://developers.openai.com/api/docs/pricing)、[GPT Image 2 計算器](https://developers.openai.com/_astro/GptImage2TokenCalculator.react.Bi5Ri9Qv.js)、[Gemini 定價](https://ai.google.dev/gemini-api/docs/pricing)、[BytePlus 定價](https://docs.byteplus.com/en/docs/ModelArk/1544106)。

建議首輪核准預算 **US$3**。執行器每次請求先預留 $0.30，最多 9 次、共 $2.70 預留，無自動重試，任何硬失敗即停止；這是本機請求控制，不是供應商帳戶的硬性扣款上限。Gemini 限制輸出 token 數，並限制輸入檔案／prompt 大小。回應失敗或逾時仍可能計費，不視為免費。

每次呼叫前記錄開始狀態；回應後記錄輸入 SHA-256、完整 prompt、要求的模型與 API 回傳版本（若有）、參數、耗時、request ID、usage、原始圖片、真實尺寸、原生裁切及錯誤類型。不記錄金鑰或完整錯誤 body。usage 缺少欄位代表未知，不以 0 代替。實際費用須再以供應商帳務核對。所有輸入副本、輸出與私密設定保存在被 Git 忽略的 `.image-benchmark/`。

## 執行

從 repo 根目錄執行；沿用已安裝的 `functions` Sharp，不新增依賴。

```sh
mkdir -p .image-benchmark/inputs
git show 63149102:app/public/styles/chibi/preview-1.jpg > .image-benchmark/inputs/cowboy.png
git show 63149102:app/public/styles/bobblehead/preview-3.jpg > .image-benchmark/inputs/handbag.png
node scripts/benchmark-images.mjs --config scripts/image-benchmark.config.json
```

Dry run 不連網、不生成。將 `OPENAI_API_KEY`、`GEMINI_API_KEY`、`BYTEPLUS_API_KEY` 放入本機 `.image-benchmark/credentials.env`，不要貼進聊天或提交 Git。取得付費預算確認後才執行：

```sh
node --env-file=.image-benchmark/credentials.env scripts/benchmark-images.mjs --config scripts/image-benchmark.config.json --execute --budget-usd 3
```

每次執行須使用全新 outputDir；已有執行記錄時拒絕覆寫，以免重跑重複扣款。檔案存在不代表前一次已成功，逾時也不要直接重試。先核對 manifest 與供應商狀態，再決定是否另開一輪。

離線驗證：`node --test scripts/benchmark-images.test.mjs`（10/10）。涵蓋零網路 dry run、輸入與預算限制、缺任一金鑰時禁止部分執行、三家請求的相同輸入、呼叫前寫入紀錄、拒絕重跑、失敗停止、金鑰與錯誤 body 不落檔、usage 留存及原生裁切像素。這些 mock 不證明帳戶已開通模型、真實 API 可用或生成品質。

## 看圖標準

每張圖板各項 0–2 分：0 = 明顯失敗；1 = 有瑕疵需修；2 = 可接受。

| 項目 | 2 分條件 |
|---|---|
| 視角 | 四個指定角度皆正確，左右不是錯誤鏡像 |
| 外形與身份 | 四面維持同一物件、比例與姿態 |
| 配件 | 數量、形狀、物理左右位置一致 |
| 配色與可見文字 | 保留來源的顏色與可辨識字樣，不把文字複製到不合理表面 |
| 細節 | 帽沿／捲髮／流蘇、眼鏡／彈簧，或胎紋／懸吊等仍清楚 |
| 可裁切性 | 完整物件不跨格，無格線／標籤，四張裁切可獨立使用 |

預先設定初篩通過條件：視角、配件、可裁切性各 2 分，總分至少 10/12。背面合理性另外附文字觀察，不當作真實準確率。先看匿名輸出再揭示供應商；記錄評分者與判斷理由。只有三張／每設定一次，只報逐樣本結果與本輪通過數，不宣稱統計上勝出，不估 p95。觀察結果後，才決定是否補高品質、4K、分開生成或真實多面照片測試。
