# 3D 列印配送功能 - 開發計劃

> 本文件記錄 3D 列印配送服務的完整實作規劃

## 功能概述

- **付款方式**：Stripe 信用卡結帳
- **列印處理**：自有設備 + 接單管理後台（前期人工）
- **配送範圍**：全球配送
- **列印規格**：固定 S/M/L 尺寸 + PLA/樹脂材質
- **管理後台**：基礎訂單列表 + 狀態更新 + 追蹤號碼

---

## TODO 待實作項目

### Phase 1: 基礎設置
- [ ] 新增 `printOrders` 類型定義
  - `/functions/src/orders/types.ts`
  - `/app/src/types/orders.ts`
- [ ] 更新 Firestore Rules (`/firestore.rules`)
- [ ] 安裝 Stripe 套件 (`npm install stripe @stripe/stripe-js`)

### Phase 2: Cloud Functions
- [ ] 實作 `createPrintOrder` - 建立訂單 + Stripe Checkout Session
- [ ] 實作 `stripeWebhook` - 處理付款成功事件
- [ ] 實作 `getOrders` / `getOrderById` - 查詢訂單
- [ ] 實作 `updateOrderStatus` / `addTrackingNumber` - Admin 功能

### Phase 3: 前端訂購流程
- [ ] `/print/[jobId]` - 訂購表單頁面
- [ ] `/print/success` - 付款成功頁面
- [ ] `PrintSpecSelector` 元件
- [ ] `ShippingAddressForm` 元件
- [ ] Viewer 頁面新增「訂購列印」按鈕

### Phase 4: 用戶訂單頁面
- [ ] `/orders` - 訂單列表頁面
- [ ] `/orders/[orderId]` - 訂單詳情頁面
- [ ] `OrderCard` / `OrderStatusBadge` 元件
- [ ] Header 新增「我的訂單」連結

### Phase 5: 管理後台
- [ ] `/admin/orders` - 訂單管理頁面
- [ ] `AdminOrderRow` / `AdminOrderModal` 元件
- [ ] Admin 導航新增訂單管理

### Phase 6: i18n 翻譯
- [ ] 新增 `print.*`, `orders.*`, `shipping.*`, `adminOrders.*` 翻譯

---

## 資料庫架構

### Collection: `printOrders`

```typescript
interface PrintOrderDocument {
  // 識別
  id: string;
  userId: string;
  orderNumber: string;           // DF-20241130-001

  // 來源模型
  sourceJobId: string;
  modelStoragePath: string;
  modelThumbnail: string;

  // 列印規格
  printSpec: {
    size: 'small' | 'medium' | 'large';  // ~5cm / ~10cm / ~15cm
    material: 'pla' | 'resin';
    color: string;
  };

  // 訂單狀態
  status: PrintOrderStatus;
  statusHistory: Array<{
    status: string;
    timestamp: Timestamp;
    changedBy: string;
    reason?: string;
  }>;

  // 價格（TWD 分為單位）
  pricing: {
    printCost: number;
    shippingCost: number;
    total: number;
  };

  // Stripe 付款
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: Timestamp | null;

  // 配送資訊
  shipping: {
    recipientName: string;
    phone: string;
    email: string;
    country: string;
    postalCode: string;
    city: string;
    addressLine1: string;
    addressLine2?: string;
  };
  trackingNumber: string | null;
  shippingCarrier: string | null;

  // 管理備註
  adminNotes: string | null;

  // 時間戳
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type PrintOrderStatus =
  | 'pending'      // 待付款
  | 'paid'         // 已付款
  | 'preparing'    // 準備中
  | 'printing'     // 列印中
  | 'shipped'      // 已出貨
  | 'delivered'    // 已送達
  | 'cancelled'    // 已取消
  | 'refunded';    // 已退款
```

---

## 價格表

```typescript
const PRINT_PRICES = {
  small:  { pla: 50000, resin: 80000 },   // TWD 500 / 800
  medium: { pla: 80000, resin: 120000 },  // TWD 800 / 1200
  large:  { pla: 120000, resin: 180000 }, // TWD 1200 / 1800
};

const SHIPPING_PRICES = {
  TW: 10000,           // TWD 100
  international: 50000, // TWD 500
};
```

---

## Cloud Functions

| 函數名稱 | 類型 | 說明 |
|---------|------|------|
| `createPrintOrder` | onCall | 建立訂單 + 產生 Stripe Checkout Session |
| `stripeWebhook` | onRequest | 處理 Stripe 付款成功事件 |
| `getOrders` | onCall | 取得用戶訂單列表 |
| `getOrderById` | onCall | 取得單一訂單詳情 |
| `updateOrderStatus` | onCall | [Admin] 更新訂單狀態 |
| `addTrackingNumber` | onCall | [Admin] 新增追蹤號碼 |

---

## 前端頁面

| 路由 | 用途 |
|------|------|
| `/print/[jobId]` | 訂購表單（選規格、填地址） |
| `/print/success` | 付款成功確認頁 |
| `/orders` | 用戶訂單列表 |
| `/orders/[orderId]` | 訂單詳情 |
| `/admin/orders` | 管理後台訂單列表 |

---

## 前端元件

| 元件 | 路徑 | 用途 |
|------|------|------|
| `PrintSpecSelector` | `components/print/` | 尺寸/材質選擇器 |
| `ShippingAddressForm` | `components/print/` | 收件地址表單 |
| `OrderSummary` | `components/print/` | 價格摘要 |
| `OrderCard` | `components/orders/` | 訂單卡片 |
| `OrderStatusBadge` | `components/orders/` | 狀態標籤 |
| `AdminOrderRow` | `components/admin/` | 管理列表行 |
| `AdminOrderModal` | `components/admin/` | 狀態更新彈窗 |

---

## Stripe 整合流程

```
用戶選規格 → 填地址 → createPrintOrder
                           ↓
                    建立 Firestore 訂單 (status: pending)
                           ↓
                    建立 Stripe Checkout Session
                           ↓
                    回傳 checkoutUrl
                           ↓
             用戶重定向到 Stripe 付款頁面
                           ↓
                    付款成功
                           ↓
              Stripe 發送 webhook
                           ↓
          stripeWebhook 更新訂單 (status: paid)
                           ↓
           用戶重定向到 /print/success
```

---

## 環境變數

```bash
# Frontend (.env.local)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Functions (Firebase Secret Manager)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Stripe Dashboard 設置

1. 建立 Webhook endpoint: `https://asia-east1-{project}.cloudfunctions.net/stripeWebhook`
2. 啟用事件: `checkout.session.completed`, `payment_intent.payment_failed`

---

## 關鍵檔案清單

### 需修改
- `/app/src/messages/zh-TW.json` - 新增翻譯
- `/app/src/messages/en.json` - 新增翻譯
- `/firestore.rules` - 新增 printOrders 權限
- `/functions/src/index.ts` - 匯出新函數
- `/app/src/types/index.ts` - 新增訂單類型
- `/app/src/components/layout/Header.tsx` - 新增訂單連結
- `/app/src/app/[locale]/viewer/page.tsx` - 新增訂購按鈕

### 需新建
- `/functions/src/handlers/orders.ts`
- `/functions/src/webhooks/stripe.ts`
- `/app/src/types/orders.ts`
- `/app/src/hooks/useOrders.ts`
- `/app/src/hooks/usePrintOrder.ts`
- `/app/src/components/print/PrintSpecSelector.tsx`
- `/app/src/components/print/ShippingAddressForm.tsx`
- `/app/src/components/print/OrderSummary.tsx`
- `/app/src/components/orders/OrderCard.tsx`
- `/app/src/components/orders/OrderStatusBadge.tsx`
- `/app/src/components/admin/AdminOrderRow.tsx`
- `/app/src/components/admin/AdminOrderModal.tsx`
- `/app/src/app/[locale]/print/[jobId]/page.tsx`
- `/app/src/app/[locale]/print/success/page.tsx`
- `/app/src/app/[locale]/orders/page.tsx`
- `/app/src/app/[locale]/orders/[orderId]/page.tsx`
- `/app/src/app/[locale]/admin/orders/page.tsx`
