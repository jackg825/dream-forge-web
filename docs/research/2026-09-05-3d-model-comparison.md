# 照片／四視圖生成 3D：模型、API 成本與評測方案

查閱日期：**2026-09-05**。範圍：Meshy、Tripo、Hyper3D Rodin、Tencent Hunyuan、HiTem3D／Hi3D 的官方公開文件，以及本 repository 的實際請求參數。未呼叫生成 API、未購買額度、未建立供應商帳戶，也未執行品質 benchmark。

**建議先固定現行基準並補齊每次任務的模型版本、輸入與實際扣點紀錄，再比較 Meshy 7／6、Tripo H3 3.1 與 Hi3D 2.1 fast。Rodin Gen-2.5 與 Hi3D 3.0 作為高細節候選；不要直接把「最新」設為所有用戶預設。** 目前無同樣本品質、可列印率、延遲或可用成果成本數據，無法宣布哪一家最好。

專案的多視圖 Meshy 實際仍是 Meshy 5；單圖的 `latest` 已會指向 Meshy 7。Tripo 固定 3.0，Hunyuan 未指定 `Model`，HiTem3D 固定 1.5，Rodin 是 Gen-2。這些差異比單純的供應商品牌比較更需要先處理。

## 1. 能力比較：以可呼叫 API 為準

下表是文件描述的介面能力，不是本專案測出的品質。`Raw`、高面數、PBR、STL／3MF 輸出皆不等於保證可製造；須另外驗證最小壁厚、斷件、封閉性、比例及切片結果。

| 供應商／當前版本 | 單圖與真正多視角輸入 | 幾何、紋理與控制 | 可用輸出與製造注意事項 | 官方來源 |
| --- | --- | --- | --- | --- |
| **Meshy 7**；另有 6、5；單圖 Smart Topology T2 | 單圖 API；多圖 API **1–4 張**，7 的第一張為正面，其餘順序不拘。不是把四格拼圖當成四個已標記視角。 | 7 可選 Ultra；可關閉 texture。2K／4K／8K 紋理，可選 PBR。Standard remesh 目標 100–300,000 面；T2 單圖原生目標 100–15,000 面。固定 `ai_model`，不要使用會漂移的 `latest`。 | GLB、OBJ、FBX、STL、USDZ；3MF 須明確請求。原始高面數與減面版本宜分別保存。另有免費 printability analysis 與付費 repair，仍需打樣驗證。 | [單圖 API](https://docs.meshy.ai/en/api/image-to-3d)、[多圖 API](https://docs.meshy.ai/en/api/multi-image-to-3d)、[列印分析](https://docs.meshy.ai/en/api/analyze-printability) |
| **Tripo H3**：`v3.1-20260211`／`v3.0-20250812`；另有 **P1-20260311** | 單圖 API；H3/P1 多視圖要求固定 **4 個槽位 [front, left, back, right]**，至少 2 張，正面不可缺。缺圖須保留對應槽位。 | H3 3.1 Standard 最多 150 萬三角面、Ultra 最多 200 萬；3.0 是 100／150 萬。可控紋理、PBR、種子、面數、quad、低面數、分件。P1 是另一條低面數路線，目標 48–20,000 面，不能當 H3 的高細節升級。 | 常見 GLB；quad 強制 FBX。OBJ、STL、USDZ 等走 conversion，另計費；3MF conversion 只匯出幾何，不能視為多色列印完成品。 | [H3 單圖](https://docs.tripo3d.ai/model-generation/image-to-model-v3-0-v3-1.html)、[H3 多視圖](https://docs.tripo3d.ai/model-generation/multiview-to-model-v3-0-v3-1.html)、[P1 單圖](https://docs.tripo3d.ai/model-generation/image-to-model-p1-20260311.html)、[P1 多視圖](https://docs.tripo3d.ai/model-generation/multiview-to-model-p1-20260311.html)、[格式轉換](https://docs.tripo3d.ai/export/conversion.html)、[API 定價](https://docs.tripo3d.ai/get-started/pricing.html) |
| **Rodin Gen-2.5**；另保留 Gen-2／1.x | 1–5 張圖片；第一張用於材質，可送位置對應的 `image_label`。須明確送 Gen-2.5 tier；省略 tier 會回到舊 `Regular` 家族。 | Raw／Quad、material=None／PBR 等、種子、bbox、faithful／creative。一般 tier 上限 100 萬面；High／Extreme-High 可 200 萬，Quad 上限 20 萬。Extreme-High 另返最多 1,000 萬面模型。紋理依配置 2K–12K。 | GLB、USDZ、FBX、OBJ、STL。7 月已把 `geometry_instruct_mode` 預設改為 creative；照片還原評測應明確固定 faithful，不能默默跟預設變動。 | [Gen-2.5 API](https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5)、[Changelog](https://docs.hyper3d.ai/en/get-started/changelog) |
| **Hunyuan 3D Pro 3.1／3.0**；Rapid 是另一 API | 主圖＋具 `ViewType` 的多視圖。3.0 可 left/right/back；3.1 另可 top/bottom/left_front/right_front，每種方向一張。四視圖是正式支援，不是單圖降級。 | 預設 Model=3.0，可選 3.1；3.1 不支援 LowPoly（國際文件另列 Sketch 限制，需按實際區域驗證）。可選 Normal／Geometry、PBR、3,000–1,500,000 面。 | 中國站預設 OBJ＋GLB；Geometry 預設 GLB；可指定 STL、USDZ、FBX，但 ResultFormat 加費。不要將開源 Hunyuan3D 權重版本、網頁產品與雲端 Pro API 視為同一模型。 | [中國站 Pro 請求](https://cloud.tencent.com/document/product/1804/123447)、[國際站 Pro 請求](https://www.tencentcloud.com/document/product/1284/75540)、[中國站更新紀錄](https://cloud.tencent.com/document/product/1804/120839) |
| **HiTem3D 現品牌 Hi3D**：`hi3dv3.0`（2026-08-19 新增）；另有 `hitem3dv2.1`、portrait 2.1 等 | 單圖；真正多圖 2–4 張，正面必填；順序 **[front, back, left, right]**，缺視角用 `multi_images_bit`。與 Tripo 的槽位順序不同。 | 3.0：2048quality／2048master；2.1：1536fast／1536pro。幾何、紋理、PBR 分項；3.0 目標最多 500 萬面。注意 v2.0／v2.1 文件明列不支援 `request_type=2` texture-only，不能通用套入「先白模再補貼圖」。 | OBJ、GLB、STL、FBX、USDZ、3MF（一次一種格式）。文件舊 error 描述仍寫面數上限 200 萬，但 request／FAQ 已寫 500 萬；3.0 master 的上限需在沙盒／小額測試確認。 | [最新異動](https://docs.hi3d.ai/en/api/getting-started/changelog)、[Create Task](https://docs.hi3d.ai/en/api/api-reference/list/create-task)、[FAQ](https://docs.hi3d.ai/en/api/getting-started/faq) |

本輪不另加第六家供應商：現有五家已包含可實際整合的多視圖與高細節候選。Meshy T2、Tripo P1 可作為網頁預覽效能的另一條測試路線，但低面數拓樸優勢不能直接換算為小尺寸列印品質優勢。

## 2. 成本：API 點數與網頁方案分開計算

### 2.1 每次成功任務的 API 成本

不含稅、匯差、輸入圖生成、儲存、傳輸、重試、修模、打樣或固定月費。人民幣保留原幣，不用臆測匯率換算。紋理最高解析度與後處理需另外列項。

| 配置 | 幾何／基本紋理成本 | 會額外收費的主要項目 | 換算依據與限制 |
| --- | --- | --- | --- |
| **Meshy 7／6 單圖或多圖** | 白模 **20 credits**；2K／4K 貼圖完成品 **30**；8K **35**。Meshy 7 Ultra 再＋5。Meshy 5 是 5／15。 | Retexture 10（2K／4K）或 15（8K）；remesh 5；convert／resize 各 1；repair 10；多色列印 10；分析免費。 | [API 定價](https://docs.meshy.ai/en/api/pricing)。官方公開頁沒有單一通用 API 美元／credit 常數。僅作月費攤提示例：Pro US$20／1,000 credits **全部使用**時是 US$0.02／credit，故 7 白模／一般完成品約 **US$0.40／0.60**；不是額外充值或企業合約的報價。[方案與額度](https://www.meshy.ai/pricing/) |
| **Tripo H3 3.1／3.0** | 單圖／多視圖白模 **20 credits＝US$0.20**；基本貼圖 **30＝US$0.30**。 | detailed texture＋10；detailed geometry（Ultra）＋20；quad＋5；smart_low_poly＋10；generate_parts＋20；conversion 5，某些匯出加工再＋5。現專案多圖 detailed texture 約 **40 credits＝US$0.40**，未含 conversion。 | **US$1＝100 credits**。幾何 Ultra 加價來自 endpoint 文件，不能只看簡表漏算。[定價](https://docs.tripo3d.ai/get-started/pricing.html)、[H3 參數](https://docs.tripo3d.ai/model-generation/multiview-to-model-v3-0-v3-1.html) |
| **Tripo P1** | 單圖／多視圖白模 **40＝US$0.40**；貼圖 **50＝US$0.50**。 | 定價頁明列 P1 為 all-in、H2/H3 附加費不適用；部分 P1 endpoint 文字仍沿用 detailed texture 加價描述，須提交前確認帳單契約。 | 以專用 pricing table 為估算依據；不可將低面數＝最低成本。[定價](https://docs.tripo3d.ai/get-started/pricing.html)、[P1 參數](https://docs.tripo3d.ai/model-generation/image-to-model-p1-20260311.html) |
| **Rodin Gen-2.5** | 一般 tier **0.5 credit**；Extreme-High tier 再＋0.5。 | `texture_mode=extreme-high` 再＋2；其餘未列參數按該 API 文件不另加價。例：Extreme-High tier＋Extreme-High texture 合計 **3 credits**。 | [Gen-2.5 定價段](https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5#pricing)。公開方案列 API access 在 Business（US$120／月起），Free 的 direct credit US$1.50；未證實該單價等同現有 Business API 帳戶成本，因此主表只報 credits。**若**套 US$1.50，0.5 credit＝US$0.75，僅為條件式試算，不能當正式 API 報價。[方案](https://hyper3d.ai/pricing) |
| **Hunyuan Pro，中國站** | Geometry 15 credits；Normal 20；LowPoly／Sketch 25。後付費 **CNY 0.12／credit**：Normal 單圖 **CNY 2.40**；Normal＋四視圖 **30＝CNY 3.60**。 | MultiViewImages＋10、PBR＋10、FaceCount＋10、ResultFormat＋5。現專案 Normal＋四視圖＋自訂面數＝**40 credits／CNY 4.80**；若加 PBR 則 50／CNY 6.00。 | 中國站 1,000 點預付包 CNY 100（CNY 0.10／點），有效期 1 年，未用完成本會提高。以上後付費例子不可混用國際站美元資源包。[中國站定價](https://cloud.tencent.com/document/product/1804/123461) |
| **Hi3D 2.1 fast／pro** | fast：幾何 10＋紋理 10＋PBR 5＝**25 credits／US$0.50**；白模 **US$0.20**。pro：30＋10＋5＝**45／US$0.90**。 | 切割或多色處理各 20／US$0.40。不要把幾何解析度與紋理解析度當同一概念。 | **US$0.02／credit**，單圖和多視圖列同價。[API 定價](https://docs.hi3d.ai/en/api/getting-started/pricing) |
| **Hi3D 3.0 quality／master** | quality：90＋10＋5＝**105／US$2.10**，白模 US$1.80；master：440＋10＋5＝**455／US$9.10**，白模 US$8.80。 | 高面數也會提高下載、前端解碼、修模和切片成本；这些成本尚未實測。 | master 完成品的 API 列表價是 2.1 fast 的 **18.2 倍**；這是價格比，不是品質比。[API 定價](https://docs.hi3d.ai/en/api/getting-started/pricing) |

**國際站 Hunyuan 需獨立估算。** [國際站定價](https://intl.cloud.tencent.com/zh/document/product/1284/75281)列後付費 US$0.02／credit、1,000 點包 US$15，但頁面敘述寫 Normal 20、表格寫 25，附加參數也與中國站不同步。當前程式使用 `ai3d.tencentcloudapi.com`／ap-guangzhou，因此上述主要試算採中國站 20 點；未用國際頁的矛盾數字報單一精確成本。

### 2.2 額度、免費試用與商用邊界

這裡只整理官方方案／文件已明示的權利；「有免費 credit」不代表一定能下載當前模型、去除署名或用於付費客戶交付。

| 供應商 | 網頁會員與 API 額度的關係 | 免費與商用可確認範圍 | 失敗／重試政策 |
| --- | --- | --- | --- |
| Meshy | API 需 Pro 或以上；API 官網描述 credits 隨方案取得。API 與 Workspace 每操作扣點不同，不能以網頁操作表代替 API 表。Pro 1,000 點／月，未用額度不累積；買到的永久點不過期。[API 入口](https://www.meshy.ai/api)、[點數規則](https://help.meshy.ai/en/articles/9991981-how-do-meshy-credits-work) | Free 每月 100 點，CC BY 4.0 可商用但需署名；當前 Free 下載僅 Meshy 6 Lite 每月 10 次，6／7 模型需付費方案；Free 不含 API。[Free FAQ](https://help.meshy.ai/en/articles/15696428-what-is-included-on-the-free-plan) | API failed 自動退點，`consumed_credits=0`。官方未把 API 成功但不滿意的重生列為免費；不能套用網頁免費 retry 福利。[API 費率與退點](https://help.meshy.ai/en/articles/16815622-how-many-credits-does-each-meshy-api-task-cost) |
| Tripo | Studio 與 API 是**獨立帳單，點數不共享**。API 列 US$0.01／點、試用 300 點／2 週；以當日定價頁為準，不能引用舊公告的 2,000 免費點。[API FAQ](https://docs.tripo3d.ai/other/support-faq.html)、[定價](https://docs.tripo3d.ai/get-started/pricing.html) | 當日 Studio 定價頁 Free 是 200 monthly credits、public／non-commercial；付費方案列 private／commercial。API 試用點可否商業交付未在所讀 API 定價明示，不以 Studio 付費權利替代。[Studio 定價](https://www.tripo3d.ai/pricing) | v2 FAQ：failed 不扣或退回；v3 billing：failed／cancelled 釋放凍結點數。成功但品質不符後重生，保守按新任務計費。[v2 FAQ](https://docs.tripo3d.ai/other/support-faq.html)、[v3 Billing](https://developers.tripo3d.ai/en/docs/billing) |
| Rodin | 網頁為確認成果前可探索、確認後付費；Business 才列 full API access。網頁 geometry/material redo 次數不能推定也適用於 API。[方案](https://hyper3d.ai/pricing) | Free 預覽與 legacy export 不等於免費取得 Gen-2.5 可商用交付檔。免費預覽的商用／下載權及現有 API 帳戶授權需核對實際合約，公開 pricing 未足以證明。 | API 回傳 `consumed`，可供帳務紀錄；未找到足以涵蓋各類失敗的官方 API 自動退款承諾，不假設免費 retry。[API 功能與計費](https://docs.hyper3d.ai/en/get-started/features)、[Errors](https://docs.hyper3d.ai/en/api-specification/errors) |
| Hunyuan | 中國雲 API 免費包 100 點，需手動領、有效 1 年；國際站不同。網頁試用、開源權重授權與雲 API 資源包不混用。[中國站定價](https://cloud.tencent.com/document/product/1804/123461) | 所讀 API 計費／快速入門只說測試體驗，未明示免費包輸出的商業交付權利；上商用前核對帳戶所接受的服務協議。 | 中國站明示任何原因生成失敗都不扣，含內容審核失敗；成功但不滿意的重生仍應預算為新任務。[計費](https://cloud.tencent.com/document/product/1804/123461) |
| Hi3D | API 需啟用試用資源包或生產資源包，另有 API US$0.02／點費率；不可拿網頁 Pro US$19.90／1,000 點直接替代 API 包。[API FAQ](https://docs.hi3d.ai/en/api/getting-started/faq)、[網頁方案](https://www.hitem3d.ai/pricing) | 網頁 Free 一次 100 點，資產 CC BY 4.0，可依署名條件商用。API 試用／生產包權利需按實際方案；[使用條款 4.3](https://static.hitem3d.ai/website/docs/Terms-of-Use.html)另有署名文字，不因付費就自行假設可免署名。 | API FAQ 確認伺服器錯誤／timeout／參數驗證失敗不扣或退點，timeout 門檻 60 分鐘。網頁每任務免費 retry 次數不視為 API 承諾。[API FAQ](https://docs.hi3d.ai/en/api/getting-started/faq) |

官方文件有不同步現象：Meshy 網頁多圖教學寫 2–8 張，但 API 明列 1–4；Tripo 舊行銷文寫 Free 300 點，而當日 pricing 是 200；Hi3D 網頁方案仍主推 2.1，但 API 已有 3.0。**整合採 endpoint schema；扣費採專用 API pricing＋實際任務 usage；權利採實際帳戶方案與條款。**

## 3. Repository 現況與版本差距

以下以審視基準 commit `05209d0f` 的 source 行為為準；本 PR 的模型映射／舊成本註解修正另見迭代計畫，3D 供應商參數仍是更新候選。

| 整合 | 實際請求與差距 | 對評測／下一次實作的要求 |
| --- | --- | --- |
| Meshy | `functions/src/providers/meshy/client.ts:312` 多图是 `ai_model: meshy-5`，單圖 `:324` 是 `latest`；兩條皆 `should_texture:false`。`pipeline.ts:1527` 的正式流程使用此 URL 路徑。註解「多圖只支援 5」已過時。 | 對 baseline 固定 Meshy 5；新增受控的 6／7 候選並記錄實际版號、`should_remesh`、texture 與 consumed credits。7 基礎白模 20 點是 5 的 4 倍，需驗證是否降低重生／修模次數。 |
| Tripo | `functions/src/providers/tripo/client.ts:165`、`:228` 多圖固定 `v3.0-20250812`；送 detailed texture、PBR、standard geometry、100,000 面；單圖 `:87-98` 沒傳 model_version。 | 保留正確的 [front,left,back,right] 映射；固定單圖版本，增加 H3 3.1 比較。API v3 和模型 3.1 是不同維度，不能把模型升版等同整個 API 遷移。 |
| Hunyuan | `functions/src/providers/hunyuan/client.ts:27` 使用 ai3d API 2025-05-13；`:198-204` 未傳 Model、Normal、必送 FaceCount、多圖帶三個命名視角。故 Model 預設 3.0，並涉及自訂面數＋多圖加費。 | 不把 SDK API date 當模型版號；先固定 Model 與紀錄 `ResultCreditConsumed/ResultCreditDetails`（官方 2026-03 已新增）。評測多圖的改善是否值額外 10 點，及固定低面數是否必要。 |
| HiTem3D | `functions/src/providers/hitem3d/types.ts:110`預設 `hitem3dv1.5`；`client.ts:84-107` 一次產生 geometry＋texture，多圖使用 bitmap；只支援舊解析度型別。 | 先將 2.1 fast 作同價位候選；3.0 單獨預算、逐步驗證 2048 字串和 500 萬面。不要只改 model 字串沿用 512／1024，亦不要為 2.1 假造不支援的 texture-only 流程。 |
| Rodin | `functions/src/rodin/types.ts:76` 等型別限定 Gen-2；`rodin/client.ts:138-159` 傳 Gen-2 tier、Raw、quality_override，並使用 `condition_mode:concat`。 | Gen-2.5 需獨立能力映射、明確 image_label 與 faithful／creative。不要把 `condition_mode` 舊家族語意直接當新家族 contract。 |
| 共通成本 | `functions/src/handlers/pipeline.ts:59-63` 仍標 Meshy US$0.10、Hunyuan CNY 2.40、Tripo 約 US$0.16、HiTem TBD。這些數字不能代表所有目前參數。 | 產品 credits 是售價機制，不是供應商 credit。記錄二者各自來源與幣別，避免把 5 個產品點寫成供應商實收費用。 |

保留 `provider` 還不夠。每次任務至少應存：`providerModel`、API family、明確參數、來源圖片 hash／視角標籤、seed（若支援）、請求 ID、供應商 task ID、API consumed credits、計價單位／幣別、成功／失敗與退款狀態、模型與貼圖檔 hash、檔案位元組、耗時。先檢查 repository 現有欄位再做最小補足，不必先抽象成新的多供應商框架。

## 4. 固定樣本 benchmark：衡量可接受成果，不只看 demo

### 樣本與輸入對照

選 **12 個合法可測樣本**，每類 2 個：人物／公仔、寵物、有細薄附件的角色、硬表面產品、含孔洞／文字物件、非對稱多部件物件。至少一半有真實物體或可信 3D 原型可比對。所有檔案先固定 hash、裁切、背景、解析度與視角，不為個別供應商偷偷挑最好看的輸入。

每個樣本保留三個 input arms，分開報告：

1. 原始單張照片：驗證最低前處理成本的成效。
2. 同一物件的實拍四視圖：驗證供應商多視角本身的增益。
3. 本產品由單張照片生成的四視圖：驗證完整 pipeline；AI 補出的背面是推測，不能視為物體真值。保留相同的四張圖給各家，供應商自己的 image autofix 另列參數。

第一輪候選：現行 Meshy 5 基準、Meshy 7 Standard、Tripo H3 3.1 Standard、Hi3D 2.1 fast、Hunyuan 3.1 Normal。Rodin Gen-2.5 Medium 與 Hi3D 3.0 quality 可做第二輪高細節挑戰；先不要批量跑 master。若要比較 Meshy 6，加入可接受預算後獨立 arm。

### 分兩輪控制成本

- **能力／預算冒煙測試：** 每家先 1 個已授權樣本，確認模型版、圖序、geometry-only、texture、輸出和實扣金額。文件衝突只在此驗證，不在 production 猜測。通過後才設定正式執行總上限。
- **第一輪篩選：** 12 個樣本 × 單圖／产品四視圖 × 候選，每格 1 次；同時計錄所有失敗。先篩掉不能滿足尺寸／結構／瀏覽器效能的配置。
- **第二輪穩定性：** 前 2–3 名，納入實拍四視圖，每格 3 個種子／重複；在同樣時間窗口交錯提交，降低供應商負載時段偏差。保留全部結果，不只 best-of-N。
- **先填價格上限再執行：** `Σ(各候選預估任務數 × 明確參數單價) + 已批准的 retry／後處理預算`。沒有 Rodin 帳戶實際 credit 單價的情況，先以 credit cap 管理，不能用 US$120／416 的行銷模型數回推出 API 單價。

### 驗收與盲評

| 評估項目 | 記錄方式 | 如何影響決策 |
| --- | --- | --- |
| 輸入還原 | 統一八角度 turntable；灰模與貼圖各一套。兩位盲評者對比例、辨識度、背面／附件一致性評分；有原型者另外量測輪廓或距離。 | 不讓好看的貼圖遮掩錯誤幾何；正面像但背面破損列為失敗。 |
| 小物列印可行性 | 固定 5／10／15 cm 的實體高度測試；封閉性、non-manifold 邊、薄壁、孤立零件、底面、切片成功率；門檻按實際印表機與材質設定。 | 生成完成只算技術成功；通過指定尺寸的檢核才算可製造候選。 |
| 配色交付 | 指定同一可用色盤與最大色數；檢查區域分配、細節遺失、3MF 導入結果；不把 PBR 貼圖當成可直接換料列印。 | 多色方案另計轉換與人工處理，不混入單色白模得分。 |
| 效能 | queue／生成／下載分開計時；p50／p95、原始 bytes、面數、貼圖尺寸；固定低階手機／桌面測首屏、載入與旋轉。 | 原始制造檔可高面數，網頁預覽可用減面派生檔；不得用劣化原檔解決預覽卡頓。 |
| 可靠性與帳務 | task success rate、下載成功、超時、重複提交、退點到账、`consumed` 與估算差異。 | 重試必須連回原請求，避免網路超時後不確定地再下付費任務。 |
| 人工與實物 | 修模分鐘、切片準備分鐘；入圍者在最小預計販售尺寸各做一個實物樣本，記錄材料、機時、支撐與報廢。 | 以可交付成果成本排名，而非生成單價或面數排名。 |

主指標是：

`每個可接受成果成本 =（全部生成實付 + 輸入圖成本 + 後處理 + 儲存傳輸 + 人工修模 + 打樣／報廢）÷ 通過驗收的成果數`

若目前只能用假設，明確列出 `C_attempt / p_accept` 的情境分析，不把 `p_accept` 當已知。例如單次 US$0.20、接受率 25% 是 US$0.80／可用件；單次 US$0.50、接受率 80% 是 US$0.625／可用件，尚未計人工。這只是說明為何便宜 API 不一定便宜，不是本研究的實測結果。

## 5. 建議迭代順序與切換門檻

1. **先讓版本與成本可重現。** 固定模型 ID；保留現行結果與參數；加入供應商實際扣點，不以舊註解收斂成統一美元價。修正前端「模型名稱」與實際模型的落差。
2. **優先比較同一路徑的 Meshy 5 → 6／7。** 接入差異小且正式支援多圖；但白模 API 點數提高，只有在接受率、必要細節或修模時間顯著改善時才切預設。
3. **比較單圖直出與產品四視圖。** 先估量四視圖額外成本是否換來更高接受率；若只補出互相矛盾的背面，應改善 input／提示與審核，不能只換更貴的 3D 模型。
4. **保留 Tripo H3 3.1、Hi3D 2.1 fast 的候選資格。** 網頁快預覽可另測 T2/P1；高細節單獨測 Rodin 2.5／Hi3D 3.0。這些是測試優先序，不是品質排名。
5. **以預先約定的門檻切換。** 新方案需通過同樣本接受率、修模時間、指定尺寸切片與前端 p95 上限；同時維持可接受的每可用件成本。以小流量受控切換保留舊版本結果，不重新生成既有用戶作品。

研究限制：官方動態價格與文件於查閱日仍有矛盾；未讀取現有商業帳戶訂單／合約，未核實議價折扣與 API 試用資產交付權；未衡量各家生成品質或列印成功率。上述明确數字是公開列表價或標示假設，不能作未經對帳的實際毛利。
