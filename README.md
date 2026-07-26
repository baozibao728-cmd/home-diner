# 🏠 Home Diner 小食堂

私人情侣点餐微信小程序：她点餐，我做饭 ❤️

- **主厨**：管理菜单和分类、接单做饭、给她充金币
- **顾客**：浏览菜单、金币点餐、写备注、实时看订单状态
- 原生小程序（WXML/WXSS/JS）+ 微信云开发（云数据库 / 云存储 / 云函数），无第三方框架

## 项目结构

```
home-diner/
├── project.config.json          # 开发者工具项目配置
├── miniprogram/                 # 小程序前端
│   ├── app.js                   # 入口：云开发初始化（★云环境 ID 在这里填）
│   ├── app.json                 # 页面注册、tabBar
│   ├── app.wxss                 # 全局样式（温馨小餐馆主题）
│   ├── images/                  # tabBar 图标
│   ├── utils/
│   │   ├── space.js             # ★ spaceId 唯一出口（现在写死 default）
│   │   ├── db.js                # 数据库封装（查询自动带 spaceId）
│   │   ├── cart.js              # 购物车（内存版）
│   │   └── format.js            # 时间格式化、订单状态常量
│   └── pages/
│       ├── role-select/         # 身份选择（主厨/顾客，记住选择）
│       ├── menu/                # 菜单页（顾客点餐 / 主厨管理，双身份共用）
│       ├── dish-edit/           # 新增/编辑菜品（主厨）
│       ├── category-manage/     # 分类管理（主厨）
│       ├── checkout/            # 结算页（备注 + 金币下单）
│       ├── orders/              # 订单列表（实时监听，双身份共用）
│       ├── order-detail/        # 订单详情（状态进度条）
│       ├── mine/                # 我的（顾客看余额明细 / 主厨充值入口）
│       └── recharge/            # 充值页（主厨）
└── cloudfunctions/
    ├── initData/                # 一次性初始化（建集合、默认空间、预置分类、初始金币）
    ├── placeOrder/              # 下单（事务：扣金币+写订单+记流水）
    ├── recharge/                # 充值（事务：加余额+记流水）
    └── updateOrder/             # 订单状态流转（取消自动退款）
```

## 数据库设计（6 个集合）

每条数据都带 `spaceId` 字段，按「情侣空间」隔离。现在写死 `spaceId = 'default'`，
未来开放给其他情侣时只需做配对页面 + 改 `miniprogram/utils/space.js`，业务代码不用动。

| 集合 | 内容 | 关键字段 |
|------|------|----------|
| `spaces` | 情侣空间 | `_id`、`name` |
| `categories` | 菜品分类 | `spaceId`、`name`、`sort` |
| `dishes` | 菜品 | `spaceId`、`name`、`image`(云存储fileID)、`desc`、`price`、`categoryId`、`onSale` |
| `orders` | 订单 | `spaceId`、`items`(下单时的菜品快照)、`total`、`remark`、`status`、`createTime` |
| `wallets` | 金币账户 | `spaceId`、`role`、`balance` |
| `coin_records` | 金币流水 | `spaceId`、`type`(recharge/spend/refund)、`amount`(带正负号)、`memo`、`orderId` |

订单状态机：`pending 待接单 → accepted 已接单 → cooking 制作中 → served 已上菜`，
待接单的订单顾客可取消（`cancelled`，金币自动退回）。

## 🚀 从零跑起来（按顺序做）

### 第一步：导入项目

1. 打开**微信开发者工具** → 「导入项目」→ 目录选这个仓库的根目录
2. AppID 填你自己的小程序 AppID（导入时填了会自动写进 `project.config.json`；
   也可以手动改该文件里的 `"appid"` 字段）。**云开发必须用真实 AppID，不能用测试号**

### 第二步：开通/关联云环境

3. 工具栏点「云开发」按钮 → 没有环境就创建一个（基础版免费额度够用），记下**环境 ID**（形如 `cloud1-xxxxxx`）
4. 打开 `miniprogram/app.js`，把顶部 `CLOUD_ENV_ID` 填成你的环境 ID
   （只有一个环境的话留空也能跑，但建议填上）

### 第三步：部署云函数 + 初始化数据

5. 在开发者工具的资源管理器里，依次右键 `cloudfunctions` 下的 4 个文件夹
   （`initData`、`placeOrder`、`recharge`、`updateOrder`）→
   **「上传并部署：云端安装依赖」**
6. 右键 `initData` → 「云端测试」→ 直接点「运行」。它会自动：
   - 创建全部 6 个数据库集合
   - 建默认情侣空间
   - 预置分类：主食 / 汤 / 甜品 / 夜宵
   - 给顾客钱包充 100 初始金币
   - 运行结果里的 `report` 会列出每一项做了什么（重复运行也安全，不会重复建）

### 第四步：设置数据库权限（重要，否则前端读不到数据）

7. 「云开发」控制台 → 数据库 → 依次点每个集合 → 「权限设置」→ 选**自定义安全规则**，粘贴：

   | 集合 | 安全规则 | 说明 |
   |------|----------|------|
   | `dishes` | `{"read": true, "write": true}` | 主厨在小程序端直接增删改菜品 |
   | `categories` | `{"read": true, "write": true}` | 同上 |
   | `orders` | `{"read": true, "write": false}` | 只读（写入走云函数），实时监听需要读权限 |
   | `wallets` | `{"read": true, "write": false}` | 只读（写入走云函数） |
   | `coin_records` | `{"read": true, "write": false}` | 只读（写入走云函数） |
   | `spaces` | `{"read": true, "write": false}` | 只读 |

   > ⚠️ 现在 `dishes`/`categories` 是"任何使用者可写"，体验版只有你们两个人用没问题。
   > 将来正式开放给其他情侣前，要把这两个集合的写入也改成走云函数并校验身份。

### 第五步：本地试跑

8. 点「编译」，模拟器里应出现身份选择页 → 选「主厨」→ 新增几道菜试试（传图、定价、选分类）
9. 「我的」页 → 切换身份 → 选「顾客」→ 点餐下单 → 再切回主厨接单，跑通整个流程

### 第六步：发体验版给她

10. 开发者工具右上角「上传」→ 填版本号（如 `0.1.0`）和备注
11. 登录[小程序后台](https://mp.weixin.qq.com) → 「管理 → 版本管理」→ 开发版本 → 找到刚上传的 → **「选为体验版」**
12. 「管理 → 成员管理 → 体验成员」→ 添加她的微信号
13. 把体验版二维码发给她，扫码进入选「顾客」，开吃 🎉

## 日常使用小抄

- **改菜单**：主厨 → 菜单页 → 新增/编辑/上下架/删除；「分类管理」可自定义分类
- **充金币**：主厨 → 我的 → 「给她充值」→ 填数量和附言（如"洗碗奖励 +10"）
- **接单**：订单页会实时刷出新订单，按「接单 → 开始制作 → 上菜啦」推进
- **改初始金币**：`cloudfunctions/initData/index.js` 里的 `INIT_COINS`（只影响首次初始化）
- **换身份**：我的 → 底部「切换身份」

## 未来开放多对情侣的预留

- 所有数据都带 `spaceId`，前端统一从 `utils/space.js` 取值，云函数统一从入参拿
- 到时候要做的事：邀请码配对页面（写 `spaces` 集合 + 把 spaceId 存本地缓存）、
  云函数里把 `spaceId` 改为根据用户 openid 查询归属空间（而不是信任前端入参）、
  `dishes`/`categories` 的写入收归云函数
