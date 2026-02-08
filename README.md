# 商品上架与购买站点

这是一个轻量的前端应用，用于编辑商品、上架展示，并引导买家使用 BNB 链 USDC 地址完成支付。

## 页面结构

- `index.html`：入口页，选择进入管理后台或公开购买页
- `admin.html`：管理后台（需要密码登录）
- `store.html`：公开购买页（供客户浏览）

## 功能

- 添加商品（名称、价格、库存、图片、描述）
- 编辑已添加商品
- 上架 / 下架商品
- 公开购买页展示已上架商品
- 复制 BNB 链 USDC 收款地址并展示二维码
- 后端 API + SQLite 数据库存储商品信息（支持增删改查）

## 运行

安装依赖：

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

启动服务：

```bash
python server.py
```

然后访问：`http://localhost:8000`

## API 示例

- 获取商品列表：`GET /api/products`
- 新增商品：`POST /api/products`
- 更新商品：`PUT /api/products/<id>`
- 删除商品：`DELETE /api/products/<id>`

> 商品数据保存在 `products.db` 中。管理后台默认密码为 `admin123`，可在 `app.js` 中修改。
