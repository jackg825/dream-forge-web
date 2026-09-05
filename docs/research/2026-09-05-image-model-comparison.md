# 圖片生成模型與四視圖成本比較

查閱日期：**2026-09-05**。情境：一張商品／角色照片，生成同一物件的正、背、左、右四視圖，供後續 3D 生成使用。金額均為 **USD、官方直接 API、標準即時價格**，不含稅、儲存、網路、3D 生成與人工。本文完成官方文件與程式碼查核，**沒有呼叫付費生成 API，也沒有實測畫質、延遲或四視圖一致性**。

**建議先修正模型版本與原生解析度，再決定是否換供應商。** 本 repo 審視基準的四格生成沒有指定輸出尺寸，裁切器卻把任何尺寸強制縮放至 2048×2048；若模型回傳預設 1K，實際每視圖只有 512×512 的生成資訊。此時換「更好的模型」仍可能浪費細節。價格上，可先以 Gemini 3.1 Flash Image 的 2K 四格作現有供應商基準，將 Seedream 5.0 Lite、FLUX.2 Klein 9B／Pro、GPT Image 2 medium 列入受控比較；Pro／high 應由通過率證明額外成本的價值。

## 1. 現行模型、輸入能力與接入方式

以下是截至查閱日文件列出的版本與能力，不代表已驗證本專案帳戶、區域、配額或端點可以成功呼叫。模型名稱中的「Pro」「Max」「Lite」不是跨供應商畫質排名。

| 供應商／直接 API | 現行模型 ID／版本狀態 | 照片輸入、參考圖與編輯 | 原生正方形輸出 | 官方來源（2026-09-05 查閱） |
|---|---|---|---|---|
| Google Gemini Developer API | `gemini-3.1-flash-image`，stable，Nano Banana 2 | 圖文輸入、圖片編輯、多參考圖；可固定長寬比與尺寸 | 512、1K、2K、4K | [模型](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image)、[圖片生成](https://ai.google.dev/gemini-api/docs/image-generation) |
| Google Gemini Developer API | `gemini-3.1-flash-lite-image`，stable，Nano Banana 2 Lite | 圖文輸入、單圖編輯；官方提醒並非針對多參考圖與連續多輪編輯最佳化 | **僅 1K** | [模型](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite-image)、[圖片生成](https://ai.google.dev/gemini-api/docs/image-generation) |
| Google Gemini Developer API | `gemini-3-pro-image`，stable，Nano Banana Pro | 圖文輸入、編輯，最多 14 張參考圖 | 1K、2K、4K | [模型](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image)、[圖片生成](https://ai.google.dev/gemini-api/docs/image-generation) |
| Google Gemini Developer API | `gemini-2.5-flash-image`，既有版本，停用表列 2026-10-02 | 圖文輸入與編輯；不適合新建長期依賴 | 1K | [模型](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image)、[停用表](https://ai.google.dev/gemini-api/docs/deprecations) |
| OpenAI Images API | `gpt-image-2`；可固定 `gpt-image-2-2026-04-21` snapshot | 圖文輸入、生成／編輯，多參考圖；參考圖固定高保真處理；low／medium／high 品質 | 1024、2048；**2048 正方形屬實驗範圍**；4096 正方形不支援 | [模型](https://developers.openai.com/api/docs/models/gpt-image-2)、[尺寸與編輯限制](https://developers.openai.com/api/docs/guides/image-generation) |
| Black Forest Labs API | FLUX.2：`flux-2-klein-4b`、`flux-2-klein-9b`、`flux-2-pro`、`flux-2-max`、`flux-2-flex`；Pro／Klein 9B 另有持續更新的 `-preview` 路徑 | 圖文輸入與編輯；Klein 最多 4 張參考圖；Pro／Max／Flex API 最多 8 張 | 最高 4 MP，即 2048×2048 級；無 4096 正方形 | [版本與能力](https://docs.bfl.ai/flux_2/flux2_overview)、[編輯 API](https://docs.bfl.ai/flux_2/flux2_image_editing)、[尺寸限制](https://docs.bfl.ai/guides/prompting_guide_flux2) |
| ByteDance／BytePlus ModelArk | `dola-seedream-5-0-pro-260628` | 圖文輸入、精細編輯、最多 10 張輸入；單圖生成；圖層拆分另計，不能當成四視圖生成 | 1K、1.5K、2K；無 4K | [API 圖片生成指南](https://docs.byteplus.com/en/docs/ModelArk/1824121) |
| ByteDance／BytePlus ModelArk | `seedream-5-0-lite-260128`；指南亦列 `seedream-5-0-260128` 別名 | 圖文輸入、編輯、序列多圖；最多 14 張參考圖，輸入與輸出合計至多 15 張 | **最低 2K**，另有 3K、4K | [API 圖片生成指南](https://docs.byteplus.com/en/docs/ModelArk/1824121) |
| ByteDance／BytePlus ModelArk | `seedream-4-5-251128`，仍有定價的既有版本 | 圖文輸入、編輯、序列多圖；可作較成熟版本的對照 | 2K、4K；無 1K | [API 圖片生成指南](https://docs.byteplus.com/en/docs/ModelArk/1824121) |

Google 官方停用表將 `gemini-3-pro-image-preview` 與 `gemini-3.1-flash-image-preview` 的停用日期列為 **2026-06-25**，替代為上述 stable ID；不能因舊範例仍可搜尋到而繼續用 preview 作新接入依賴。停用表的日期是官方生命週期資訊，本次未用帳戶實呼叫確認回應。[官方停用表](https://ai.google.dev/gemini-api/docs/deprecations)

本文的 Google 價格是 Gemini Developer API，沒有混用 Vertex AI；BytePlus 是 ByteDance 的直接商用 API；BFL 為官方託管 API，沒有把開放權重自行部署當成零成本。fal、Replicate 等第三方轉售、消費者訂閱點數、試用贈額與議價方案均未納入。若採轉售，需要另外記錄其實際模型版本、輸入／輸出費用、區域與重試計費，再與下表比較。

## 2. 單張圖片成本：統一尺寸，明列參考圖費用

本表的 1K／2K／4K 分別指 **1024×1024／2048×2048／4096×4096**，不將 3840×2160 的「4K 橫圖」混入 4K 正方形。Google／OpenAI 列輸出費用，輸入另加；BFL 列 **含一張 1024×1024 參考圖**的圖片編輯估算；BytePlus 列含一張參考圖的價格。因此不能直接把所有列當成完整請求總價排行榜。

| 模型／品質 | 1K 輸出 | 2K 正方形 | 4K 正方形 | 輸入費用／計算基礎 | 官方價格來源（2026-09-05 查閱） |
|---|---:|---:|---:|---|---|
| Gemini 2.5 Flash Image | $0.039 | — | — | 輸入 $0.30／百萬 token；僅作既有成本對照 | [Gemini 定價](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 3.1 Flash Lite Image | $0.03360 | — | — | 輸入 $0.25／百萬 token；輸出 1120 image token × $30／百萬 | [Gemini 定價](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 3.1 Flash Image | $0.06720 | $0.10080 | $0.15120 | 輸入 $0.50／百萬 token；輸出 1120／1680／2520 image token × $60／百萬 | [Gemini 定價](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 3 Pro Image | $0.13440 | $0.13440 | $0.24000 | 輸入 $2／百萬 token；每張參考圖 560 token ≈ $0.00112，文字另計 | [Gemini 定價](https://ai.google.dev/gemini-api/docs/pricing) |
| GPT Image 2 low | $0.00588 | $0.01191† | — | 圖片輸入 $8／百萬 token；圖片輸出 $30／百萬 token；文字輸入另計 | [OpenAI 定價](https://developers.openai.com/api/docs/pricing)、[官方計算器](https://developers.openai.com/api/docs/guides/image-generation) |
| GPT Image 2 medium | $0.05268 | $0.10704† | — | 同上；quality 是成本設定，尚未測量是否足以重建小配件 | [OpenAI 定價](https://developers.openai.com/api/docs/pricing)、[官方計算器](https://developers.openai.com/api/docs/guides/image-generation) |
| GPT Image 2 high | $0.21072 | $0.42816† | — | 同上 | [OpenAI 定價](https://developers.openai.com/api/docs/pricing)、[官方計算器](https://developers.openai.com/api/docs/guides/image-generation) |
| FLUX.2 Klein 4B | $0.015 | $0.018 | — | 含一張 1 MP 參考圖；輸出首 MP $0.014，其後及輸入每 MP $0.001 | [官方價格計算器](https://bfl.ai/pricing?category=flux.2)、[計費說明](https://docs.bfl.ai/quick_start/pricing) |
| FLUX.2 Klein 9B | $0.017 | $0.023 | — | 含一張 1 MP 參考圖；輸出首 MP $0.015，其後及輸入每 MP $0.002 | [官方價格計算器](https://bfl.ai/pricing?category=flux.2)、[計費說明](https://docs.bfl.ai/quick_start/pricing) |
| FLUX.2 Pro | $0.045 | $0.090 | — | 含一張 1 MP 參考圖；輸出首 MP $0.030，其後及輸入每 MP $0.015 | [官方價格計算器](https://bfl.ai/pricing?category=flux.2)、[計費說明](https://docs.bfl.ai/quick_start/pricing) |
| FLUX.2 Max | $0.100 | $0.190 | — | 含一張 1 MP 參考圖；輸出首 MP $0.070，其後及輸入每 MP $0.030 | [官方價格計算器](https://bfl.ai/pricing?category=flux.2)、[計費說明](https://docs.bfl.ai/quick_start/pricing) |
| FLUX.2 Flex | $0.100 | $0.250 | — | 含一張 1 MP 參考圖；輸入、輸出均按每 MP $0.050 | [官方價格計算器](https://bfl.ai/pricing?category=flux.2)、[計費說明](https://docs.bfl.ai/quick_start/pricing) |
| Seedream 5.0 Pro | $0.045 | $0.090 | — | 首張輸入免費，其後每張 $0.003；單圖輸出 ≤ 2.61 MP $0.045，超過 $0.090 | [BytePlus 定價](https://docs.byteplus.com/en/docs/ModelArk/1544106) |
| Seedream 5.0 Lite | — | $0.035 | $0.035 | 圖片輸入免費；按實際輸出張數計費 | [BytePlus 定價](https://docs.byteplus.com/en/docs/ModelArk/1544106) |
| Seedream 4.5 | — | $0.040 | $0.040 | 圖片輸入免費；按實際輸出張數計費 | [BytePlus 定價](https://docs.byteplus.com/en/docs/ModelArk/1544106) |

† GPT Image 2 的最大邊長為 3840、最大像素 8,294,400；超過 2560×1440 的像素數（3,686,400）屬實驗範圍，**2048×2048 也超過此門檻**。3840×2160 可以請求，low／medium／high 輸出費估算分別 $0.01113／$0.10008／$0.40026，但二分後為 1920×1080，每格並非正方形，不能替代本方案的 4096×4096。[官方尺寸與計算器](https://developers.openai.com/api/docs/guides/image-generation)

價格計算說明：

- Google 表格採 token 數乘標準費率，保留較多位數；例如 Flash 2K 的 $0.10080 對應官網顯示的約 $0.101。文字輸出／thinking 如有產生亦須另加，不能把這些數字當發票總額。[Gemini 定價](https://ai.google.dev/gemini-api/docs/pricing)
- OpenAI 數字由官方指南附帶的公開計算器重算；它計算 **輸出** image token，實際還須加圖片與文字輸入。不要用 ChatGPT 訂閱或 Responses 中其他模型的費用替代 Images API 成本。[計算器程式](https://developers.openai.com/_astro/GptImage2TokenCalculator.react.Bi5Ri9Qv.js)、[定價](https://developers.openai.com/api/docs/pricing)
- BFL 依官方計算器的 `ceil(width × height / 1,048,576)` 向上取整 MP；2048 正方形計 4 MP。若參考圖為 2K，單參考圖的輸入費可能高於本表；須記錄實際尺寸。本文採查閱日網站計算器費率，沒有沿用搜尋快取中過期的 Flex 起價。[BFL 計算器](https://bfl.ai/pricing?category=flux.2)
- BytePlus 頁面以動態內容載入，本次讀取官方頁面內的文件資料；5.0 Pro 單圖分界為 **2.61 MP**。圖層拆分的半價是另一種任務，不適用四格生成。[BytePlus 定價](https://docs.byteplus.com/en/docs/ModelArk/1544106)

Google 與 OpenAI 的 Batch 可另評估離線成本，但不能把批次優惠與即時等待流程混在一起。BFL 批次的多張輸出按張累加，不能假設也有相同折扣。本 repo 的線上方案應以標準價格決策。[Gemini 定價](https://ai.google.dev/gemini-api/docs/pricing)、[OpenAI 定價](https://developers.openai.com/api/docs/pricing)、[BFL 計費](https://docs.bfl.ai/quick_start/pricing)

## 3. 相同「每視圖原生 1024」的四視圖成本

方案 A 是四張獨立生成的 1024 圖；方案 B 是一張 2048 正方形、固定 2×2 排列，再原生裁切四張 1024 圖。兩者都須通過角度與一致性檢查。A 若採「先生成正面，再依正面生成其他三面」，共有四張輸出，但後三次的參考圖數可能不同；以下只算最基本的一張參考圖設定。

| 模型／品質 | A：四張獨立圖 | B：一張 2K 四格 | B 相對 A 的圖片費減少 | 費用口徑／來源 |
|---|---:|---:|---:|---|
| Gemini 3.1 Flash Image | $0.26880 | $0.10080 | 62.5% | 輸出費；[Gemini 定價](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 3 Pro Image | $0.53760 | $0.13440 | 75.0% | 輸出費；[Gemini 定價](https://ai.google.dev/gemini-api/docs/pricing) |
| GPT Image 2 low | $0.02352 | $0.01191 | 約 49.4% | 輸出費，2K 實驗範圍；[官方計算器](https://developers.openai.com/api/docs/guides/image-generation) |
| GPT Image 2 medium | $0.21072 | $0.10704 | 約 49.2% | 輸出費，2K 實驗範圍；[官方計算器](https://developers.openai.com/api/docs/guides/image-generation) |
| GPT Image 2 high | $0.84288 | $0.42816 | 約 49.2% | 輸出費，2K 實驗範圍；[官方計算器](https://developers.openai.com/api/docs/guides/image-generation) |
| FLUX.2 Klein 4B | $0.060 | $0.018 | 70.0% | 每次含一張 1 MP 輸入；[官方計算器](https://bfl.ai/pricing?category=flux.2) |
| FLUX.2 Klein 9B | $0.068 | $0.023 | 約 66.2% | 每次含一張 1 MP 輸入；[官方計算器](https://bfl.ai/pricing?category=flux.2) |
| FLUX.2 Pro | $0.180 | $0.090 | 50.0% | 每次含一張 1 MP 輸入；[官方計算器](https://bfl.ai/pricing?category=flux.2) |
| FLUX.2 Max | $0.400 | $0.190 | 52.5% | 每次含一張 1 MP 輸入；[官方計算器](https://bfl.ai/pricing?category=flux.2) |
| FLUX.2 Flex | $0.400 | $0.250 | 37.5% | 每次含一張 1 MP 輸入；[官方計算器](https://bfl.ai/pricing?category=flux.2) |
| Seedream 5.0 Pro | $0.180 | $0.090 | 50.0% | 首張輸入免費；[BytePlus 定價](https://docs.byteplus.com/en/docs/ModelArk/1544106) |
| Seedream 5.0 Lite | $0.140* | $0.035 | 75.0% | *A 為四張 2K 後縮小至 1K，模型不支援原生 1K；[BytePlus 定價](https://docs.byteplus.com/en/docs/ModelArk/1544106) |
| Seedream 4.5 | $0.160* | $0.040 | 75.0% | *A 為四張 2K 後縮小至 1K；[BytePlus 定價](https://docs.byteplus.com/en/docs/ModelArk/1544106) |

Gemini 2.5 Flash Image 與 3.1 Flash Lite Image 的四張 1K 輸出分別約 $0.156／$0.1344，但**沒有同解析度的 2K 四格方案**。生成一張 1K 四格再放大只能得到四張「檔案尺寸 1024、原生資訊 512」的圖片。[模型能力](https://ai.google.dev/gemini-api/docs/image-generation)、[定價](https://ai.google.dev/gemini-api/docs/pricing)

四格方案可能讓同一次生成共享物件外觀，也減少重複圖片輸入與請求；這是值得測試的假設，**不是四個視角幾何正確的保證**。錯誤可能變成四格一起出現、角度顛倒、跨格部件或背景連接。一格失敗若須整張重生，就會失去部分節省；單視圖局部修正也可能再次破壞其他視圖的一致性。

單次通過率為 `p`、每組費用為 `c`，且每次重試獨立、整組重生時，無限重試的簡化期望成本為 `c / p`。產品應直接量測「含失敗與修正後的每組通過成本」，而不是用此假設當預測。例如 Flash 四格輸出費相對四張獨立圖是 37.5%，但是否真的省錢仍取決於兩方案的通過率與修正策略。

對四格圖：1K → 每格 512；2K → 每格 1024；4K → 每格 2048。格線、留白及物件占比會再降低有效物件像素。Seedream Lite 的 2K／4K 同價，使 4K 四格值得加入實驗，但傳輸、裁切記憶體、下游輸入限制與效果仍需測量；不能只由像素數推論 3D 品質。

## 4. 本 repo 的直接影響

以下以本次審視開始時的 **Git `05209d0f`** 為可重現基準；同工作區的後續修改由其他工作項目處理。本研究只新增此文件，沒有改生成程式，也未把修復中的工作區當成已部署結果。

| 基準程式碼證據 | 影響 | 建議 |
|---|---|---|
| `functions/src/gemini/composite-view-generator.ts:23` 固定 `gemini-3-pro-image-preview` | 官方生命週期已要求轉 stable；程式碼可搜尋到的 ID 不代表現行可用 | 使用 stable ID，持久化實際模型與參數；遷移歷史選項時保留顯示相容性 |
| `functions/src/gemini/composite-view-generator.ts:214` 僅設 `responseModalities`，沒有 API 尺寸／比例 | Prompt 提到 2048 不能替代輸出設定；Gemini 預設 1K，無法保證每視圖原生 1024 | `generateContent` 明設 `imageConfig: { aspectRatio: '1:1', imageSize: '2K' }`，僅用支援此尺寸的模型；[ImageConfig API](https://ai.google.dev/api/generate-content#ImageConfig)、[generateContent 指南](https://ai.google.dev/gemini-api/docs/generate-content/image-generation) |
| `functions/src/gemini/image-cropper.ts:39` 至 `:56` 將非 2048 圖片以 `fit: 'fill'` 縮放，固定每格 1024 | 1K 被放大、非正方形被拉伸、4K 被丟棄細節；「輸出檔 1024」不代表原生細節足夠 | 驗證實際像素與比例，按原生尺寸分格；不達品質門檻明確拒絕或降級，儲存原圖尺寸與每格原生尺寸 |
| `functions/src/gemini/multi-view-generator.ts:38` 將前端 Pro key 映射至 2.5 Flash；`styled-reference-generator.ts:19` 固定 2.5 Flash | 選擇、帳面價格與實際使用模型可能不一致；只改四格常數無法修正所有路徑 | 所有生成路徑共用經驗證的模型能力／計價設定；事件記錄 requestedModel、resolvedModel、size、quality |

新增供應商之前，先量測現有生成鏈的實際請求數：分析、風格基準、四視圖、單視圖修正、3D 重生各自有成本。介面上的「四視圖」不一定等於四次付費生成；免費的原照片也不一定需要重生為正面圖。未改變造型時，可以將「原圖可否直接當正面」作一個明確實驗組，避免預設多付一次生成費。

產品流程宜先確認一組四視圖，再啟動 3D；讓用戶看得見背面是否合理、左右是否反轉、顏色／配件是否一致，並能只修正有問題的視角。UI 可採「標準／高細節」作使用者決策，旁邊說明等待時間與 credits；後端仍須記錄真實供應商與模型，不能以隱藏降級維持一樣的品質承諾。

## 5. 可重現 benchmark：以通過成本決定，不把文件宣稱當實測

**後續首輪小樣已收斂為 GPT Image 2 medium、Gemini 3 Pro Image、Seedream 5.0 Lite。** GPT medium 的 2K 圖片輸出估價低於 Gemini Pro，不應因整合便利或 high 檔的價格被延後測試。以下六模型／24 件設計是擴大評估方案；先執行 [三樣本、九次請求的小樣計畫](2026-09-05-image-generation-pilot.md)，再依結果決定擴大範圍。

**第一階段只比較圖片，執行前另行核准付費額度；本次不執行。** 建議先測 Gemini 3.1 Flash、Gemini 3 Pro、Seedream 5.0 Lite、FLUX.2 Klein 9B、FLUX.2 Pro、GPT Image 2 medium 六個設定。用相同輸入、相同視角要求，各測「四張／基準加三張」與「2K 四格」，再為前兩名加測 4K 或 high。不要一次測所有品質與模型，造成難以解讀的成本擴張。

1. **資料集**：24 件有使用權的實物，分為單色簡單造型、不對稱配件、文字／標誌、細肢或突出部件、毛髮／紋理、透明／反光六類，每類 4 件。每件保留一張前視輸入及四面真實照片。真實背面只供評分，不送入單照片實驗；另外建立多照片輸入組，區分「資料不足」與「模型能力不足」。
2. **固定實驗規格**：相同背景、物件占比、style 與前／背／左／右定義。A 的後三面使用同一張已確認正面參考；B 強制 2K 正方形、固定格位、不加文字或格線。每件每設定先重複 3 次；支援 seed 時記錄 seed，但不能假設不同供應商相同 seed 可比。完整評估為 24 × 6 × 2 × 3 = 864 組；先用每類一件完成可行性小樣，通過後再擴大。
3. **保留請求與結果**：輸入 SHA-256、prompt、model ID／snapshot、API 版本、尺寸、quality、參考圖順序與個數、actual usage、供應商回傳 request ID、原生輸出尺寸、輸出檔、開始／完成時間、錯誤與重試。帳務使用供應商 usage／實際扣款核對；先前表格只作預算。
4. **盲評**：兩位評分者不看模型名稱。逐視角評角度正確、外形／比例、配件數量與位置、顏色／文字、清晰度；逐組評身份一致性、四格可裁切、是否有內容跨格。各項 0–2 分，分開記錄「忠於真實背面」與「合理但想像的背面」。一張照片看不到的細節不能被當成模型已知事實。
5. **門檻先定再看結果**：建議通過組須四個視角正確、無遺失重要配件、無跨格污染，且身份一致性達預定分數。具體分數由產品對可製造品質的要求訂定；本文件不虛構已達成的通過率。報告分物件類型的通過率、評分者一致率與不確定範圍，不只平均總分。
6. **記錄真實使用成本**：每組首次通過費、含重試／單面修正的通過費、p50／p95 完成時間、拒絕率、錯誤率。將用戶等待時離開、重新開始、改 style 也視為漏斗事件；不把失敗成本排除。
7. **第二階段固定 3D 引擎**：只讓圖片階段的前兩名與現有基準進入同一版本、同一設定的 3D 生成，固定材質與面數等參數。評估缺件、背面臆造、幾何一致性、尺寸、網格封閉與可製造檢查；分開記錄圖像問題與 3D 引擎問題。最終決策用「每件通過製造審核的總成本」，含圖片、3D、重試與人工修正。

**近期落地順序**：先修版本／尺寸與計費可觀測性 → 以現有 Google 路徑建立可重現基準 → 小樣挑戰 Seedream 與 BFL／GPT Image → 僅將通過成本與用戶接受率較好的方案擴大。現階段有證據支持修正原生解析度與模型映射；尚無實測證據支持宣稱某供應商生成效果最好或直接全面切換。

## 6. 計算重現筆記

GPT Image 2 官方計算器目前對輸出使用下列等價計算。設品質係數 `q = 16 / 48 / 96` 對應 low／medium／high，`r = round(q × 短邊 / 長邊)`，則 `tokens = ceil(q × r × (2,000,000 + width × height) / 4,000,000)`；標準輸出費為 `tokens × 30 / 1,000,000`。這是查閱日計算器的估算公式，API 實際 usage／帳務為準，未包含輸入。[官方計算器程式](https://developers.openai.com/_astro/GptImage2TokenCalculator.react.Bi5Ri9Qv.js)

BFL 本表的一張 1 MP 參考圖案例，`outputMP = ceil(width × height / 1,048,576)`，費用為 `首 MP 輸出費 + (outputMP - 1) × 後續 MP 費 + 1 × 輸入 MP 費`。正式測試應保存當日計算器頁面與實際帳務，避免供應商日後更新費率使結果無法重現。[官方價格計算器](https://bfl.ai/pricing?category=flux.2)
