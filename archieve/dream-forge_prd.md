# Product Requirement Document (PRD): DreamForge (暫定名稱)

| 項目 | 內容 |
| :--- | :--- |
| **專案名稱** | DreamForge (AI-to-Manufacturing Platform) |
| **版本** | v1.0 (MVP Phase) |
| **狀態** | 規劃中 (Draft) |
| **最後更新日期** | 2025-11-19 |
| **核心技術** | Google Gemini (Vision/LLM), Image-to-3D Generation, WebGL, 3D Printing |
| **文件擁有者** | Product Manager |

---

## 1. 執行摘要 (Executive Summary)

### 1.1 產品願景
打造一個「從畫素到塑膠 (From Pixel to Plastic)」的一站式平台。利用生成式 AI 技術降低 3D 建模門檻，讓沒有設計背景的用戶也能通過一張 2D 照片，生成並獲得實體的 3D 模型產品，實現創意的實體化閉環。

### 1.2 核心價值主張
* **零門檻創作：** 用戶無需學習 CAD 或 Blender，只需上傳圖片。
* **所見即所得：** 網頁端即時 3D 預覽，確認模型細節滿意後再付費。
* **閉環服務：** 從 AI 生成、自動修模、切片列印到物流配送，平台全包辦。

### 1.3 目標客群 (Target Audience)
* **情感寄託者：** 寵物飼主（製作寵物公仔）、父母（將孩子塗鴉實體化）。
* **ACG 愛好者：** 想要將遊戲截圖、動漫二創或原創角色實體化的玩家。
* **一般消費者：** 尋找獨特客製化禮物、紀念品的用戶。

---

## 2. 功能需求 (Functional Requirements)

### 2.1 用戶端 (Frontend/Web)

| ID | 功能模組 | 優先級 | 功能描述 | 驗收標準 (Acceptance Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **FE-01** | **圖片上傳** | P0 | 支持拖曳上傳 JPG/PNG 格式圖片。 | 1. 支持最大 10MB 檔案。<br>2. 具備前端基本檢核（解析度提示）。 |
| **FE-02** | **AI 輔助描述** | P1 | 使用 Gemini Vision API 分析圖片，自動生成 Prompt。 | 1. 上傳圖片後，文字框自動填入 AI 對圖片的結構描述。<br>2. 允許用戶手動修改 Prompt 以修正細節。 |
| **FE-03** | **3D 模型生成** | P0 | 呼叫後端 AI 引擎，生成 3D 預覽檔案 (.glb/.obj)。 | 1. 顯示生成進度條或趣味 Loading 動畫。<br>2. 生成失敗需有明確錯誤提示與重試機制。 |
| **FE-04** | **3D 互動預覽** | P0 | 使用 WebGL (Three.js) 展示生成的模型。 | 1. 支援 360 度旋轉、縮放、平移。<br>2. 支援切換「紋理模式(彩色)」與「素模模式(灰階)」。 |
| **FE-05** | **規格與報價** | P0 | 用戶選擇材質、尺寸，系統即時計算價格。 | 1. 尺寸/材質變更時價格需即時連動。<br>2. 顯示預計製作天數與發貨時間。 |
| **FE-06** | **購物車與支付** | P0 | 結帳流程與金流串接。 | 1. 支援信用卡/第三方支付。<br>2. 支付成功後生成訂單號並鎖定模型檔案。 |

### 2.2 管理後台 (Admin/Ops)

| ID | 功能模組 | 優先級 | 功能描述 | 驗收標準 |
| :--- | :--- | :--- | :--- | :--- |
| **BE-01** | **訂單管理** | P0 | 查看訂單狀態、下載模型檔。 | 1. 可下載原始圖與生成的 .STL/.OBJ 檔案。<br>2. 訂單狀態流轉 (待處理 -> 列印中 -> 後處理 -> 已發貨)。 |
| **BE-02** | **模型處理工具** | P1 | (MVP期可半人工) 模型修復與切片。 | 1. 整合 Mesh Repair 腳本，確保模型水密 (Watertight)。<br>2. 若模型結構有問題，可標記訂單需人工介入。 |
| **BE-03** | **定價配置** | P2 | 設定基礎費率、材料費率。 | 1. 修改參數後，前端報價即時更新。 |

---

## 3. 技術架構與 AI 流程 (Technical Architecture)

### 3.1 AI 生成流程 (The Pipeline)
1.  **Input:** 用戶上傳圖片 ($Image_{user}$).
2.  **Understanding (Gemini):**
    * 調用 Gemini 1.5 Flash/Pro Vision API。
    * Prompt 策略: *"Analyze this image. Describe the subject's 3D features, pose, texture, and hidden back view details for 3D generation keywords."*
3.  **Generation (Image-to-3D):**
    * 將圖片與 Prompt 傳入 3D 生成模型 (如 TripoSR, CRM, Meshy API)。
    * Output: 初步 Mesh/GLB 檔案。
4.  **Post-Processing:**
    * 網格簡化 (Decimation) 以優化網頁預覽效能。
    * 實體化修復 (Solidification) 以準備列印。

### 3.2 系統堆疊 (Tech Stack)
* **Frontend:** React.js / Vue.js + **Three.js** (Rendering)
* **Backend:** Python (FastAPI) - 適合 AI 任務調度。
* **Database:** PostgreSQL (關聯資料), AWS S3 / GCS (Blob 儲存)。
* **AI Services:** Google Vertex AI (Gemini), 3rd Party 3D Gen API.

---

## 4. 非功能需求 (Non-Functional Requirements)

### 4.1 性能 (Performance)
* **生成時效：** 3D 模型生成等待時間建議控制在 **60秒** 內，或提供非同步通知。
* **渲染效能：** 手機瀏覽器預覽需維持 30 FPS 以上流暢度。

### 4.2 可製造性 (Manufacturability)
* **結構強度：** 系統需具備基本的壁厚檢查 (Wall Thickness check)，建議最小壁厚 > 1.5mm。
* **列印成功率：** 目標列印一次成功率 > 80%。

### 4.3 安全性 (Security)
* **內容審查：** 利用 Gemini 進行圖片內容過濾 (NSFW filter)。
* **資料隱私：** 用戶上傳的圖片與模型檔案，於訂單完成後保留 30-60 天供下載，隨後歸檔或刪除。

---

## 5. 用戶體驗流程 (UX Flow)

1.  **Landing:** 首頁展示「原圖 vs. 實體模型」對比案例，強調還原度。
2.  **Upload & Describe:** 上傳圖片 -> AI 自動填寫描述 -> 用戶確認/微調。
3.  **Waiting:** 展示生成進度與趣味提示（降低等待焦慮）。
4.  **Preview & Customize:** 3D 旋轉檢視 -> 選擇尺寸 (S/M/L) -> 選擇材質 (樹脂/PLA)。
5.  **Checkout:** 填寫收件資訊 -> 付款。
6.  **Fulfillment:** 收到確認信 -> (後台生產) -> 收到實體包裹。

---

## 6. 專案路線圖 (Roadmap)

### Phase 1: MVP (Month 1-2)
* **重點：** 驗證市場需求。
* 限制：僅支援單一類別（如 Q版公仔）、單一材質（灰模）。
* 流程：前端自動化生成預覽，後端人工處理列印切片。

### Phase 2: Automation (Month 3-5)
* **重點：** 提高效率與毛利。
* 功能：導入自動修模演算法、自動化報價系統优化。
* 輸入：支援「三視圖」上傳以提高模型精準度。

### Phase 3: Scale (Month 6+)
* **重點：** 規模化與生態系。
* 功能：開放 API 供外部 App 串接、建立創作者模型分享市集。

---

## 7. 關鍵指標 (Key Metrics)

* **生成轉化率 (Generation-to-Order):** 用戶生成後下單的比例。
* **模型滿意度:** 用戶收到實品後的評分與回購率。
* **列印損耗率:** 生產過程中的失敗成本佔比。
