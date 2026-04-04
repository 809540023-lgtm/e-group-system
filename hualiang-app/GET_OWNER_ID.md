# 🔑 快速獲取 Render Owner ID (30 秒)

## 方法 1️⃣ - 從 URL 獲取 (最快)

1. 訪問: https://dashboard.render.com/account
2. 複製瀏覽器 URL 中的 ID

URL 格式:
```
https://dashboard.render.com/account?accountId=YOUR_OWNER_ID
```

你的 Owner ID 就是那個 ID

---

## 方法 2️⃣ - 使用 API 查詢

運行這個命令：

```bash
curl -H "Authorization: Bearer rnd_gq4BtbXa54L83rVow891A3ilQ3XA" \
  https://api.render.com/v1/owners
```

你會得到類似的 JSON 輸出，其中包含你的 ID

---

## 格式

你的 Owner ID 看起來像：
```
uXXXXXXXXXXXXXXXXXXXXXXX
```

---

**獲得了嗎？回到聊天框告訴我！**

例如：
```
Owner ID: uXXXXXXXXXXXXXXXXXXXXXXX
```

然後我會立即為你部署所有三個服務！
