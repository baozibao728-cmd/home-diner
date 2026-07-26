# HANDOVER · home-diner 项目移交说明书

> 本文档写给接手本项目的 AI 编程助手（或人类开发者）。
> 项目由 Claude Code 从零搭建，移交时代码已全部完成并推送，云端环境已配置完毕，
> 移交发生在「本地全流程测试」阶段——用户报告"出故障了"，具体故障现象需向用户询问。

---

## 1. 项目是什么

**home-diner（Home Diner 小食堂）**：私人情侣点餐微信小程序。

- 只有两个用户：**主厨**（男方，管理菜单/接单/发金币）和**顾客**（女方，点餐/花金币）
- 通过**体验版**使用，暂不上架；不涉及真实货币，金币是虚拟的
- 技术栈：**原生微信小程序**（WXML/WXSS/JS，无任何第三方框架）+ **微信云开发**（云数据库/云存储/云函数）
- 界面风格：温馨小餐馆，奶油白底 `#FFF8F0` + 暖橙主色 `#FF8A5C` + 暖棕文字 `#5C4A3D`，圆角卡片，emoji 点缀
- 用户要求：关键逻辑要有**中文注释**，代码结构清晰，方便非专业开发者阅读修改

## 2. 核心设计决策（改代码前必读）

这些是与用户明确确认过的决策，不要擅自更改：

1. **情侣空间隔离（最重要的架构约定）**：每条云数据库记录都带 `spaceId` 字段。
   当前写死为 `'default'`，唯一出口是 `miniprogram/utils/space.js` 的 `getSpaceId()`，
   云函数则从入参拿 `spaceId`。这是为未来开放多对情侣使用预留的，
   **任何新增的集合/查询/云函数都必须延续这个约定**。
2. **角色不做注册登录**：进入时选身份（`chef` / `customer`），存在
   `wx.getStorageSync('role')`，可在「我的」页切换。没有账号体系。
3. **资金操作全部走云函数 + 事务**：下单扣款、充值、取消退款都在云函数的
   `db.startTransaction()` 里完成，前端绝不直接改余额。价格以数据库为准，不信任前端传参。
4. **订单存菜品快照**：下单时把菜名/价格/图片复制进订单的 `items`，
   之后改菜、删菜不影响历史订单。
5. **订单状态机**：`pending 待接单 → accepted 已接单 → cooking 制作中 → served 已上菜`；
   仅 `pending` 可被顾客取消（→ `cancelled`，自动全额退款）。**没有拒单功能（用户明确不要）**。
6. **订阅消息推送第一版不做**（用户明确决定，以后再加）。订单"实时"用云数据库
   `watch()` 实现（`pages/orders/orders.js`）。
7. **金币为非负整数**，显示样式 `🪙 12`；顾客初始金币 100（在 `initData` 的 `INIT_COINS`）。
8. **图片上传用微信自带压缩**（`chooseMedia` 的 `sizeType: ['compressed']`），省云存储流量。

## 3. 代码地图

```
project.config.json           # appid 字段是 "touristappid" 占位，用户导入时会被真实 AppID 覆盖
miniprogram/
  app.js                      # wx.cloud.init；顶部 CLOUD_ENV_ID 常量 = 用户的云环境 ID（用户已填）
  app.json                    # 9 个页面注册 + tabBar（菜单/订单/我的）
  app.wxss                    # 全局样式：.card .btn-primary .btn-mini .tag-* .coin .empty 等
  images/                     # tabBar 图标（脚本生成的 PNG：碗/小票/爱心 × 灰/橙）
  utils/
    space.js                  # ★ getSpaceId()，未来配对功能只改这里
    db.js                     # db()/command() 懒加载；getAll() 自动带 spaceId 并翻页
                              #   （小程序端单次查询上限 20 条，所以必须翻页）；
                              #   callFn() 调云函数自动带 spaceId，result.ok=false 时 throw
    cart.js                   # 内存购物车（dishId → {dish, count}），下单成功后 clear()
    format.js                 # formatTime；ORDER_STATUS / CHEF_NEXT_ACTION 常量；decorateOrder()
  pages/
    role-select/              # 入口页（pages 数组第一位）。已有 role 缓存则直接 switchTab 进菜单
    menu/                     # 双身份共用：customer=点餐+购物车栏；chef=管理（增删改/上下架）
    dish-edit/                # 新增/编辑菜品；图片传云存储 dishes/{spaceId}/时间戳.jpg；换图删旧文件
    category-manage/          # 分类增删改名/上移排序；删除前 count 检查分类下是否还有菜
    checkout/                 # 结算：列表+备注+余额校验（客户端友好提示，云函数最终校验）
    orders/                   # watch 实时监听（onShow 开启 onHide 关闭）；watch 失败降级为手动刷新
    order-detail/             # 状态进度条（4 节点）+ 明细；操作后重新拉取
    mine/                     # customer=余额+流水；chef=她的余额+充值入口；双方可切换身份
    recharge/                 # 充值：金额+附言（快捷附言 chips），调 recharge 云函数
cloudfunctions/               # 每个都有 package.json（wx-server-sdk ~2.6.3），云端安装依赖
  initData/                   # 幂等初始化：建 6 集合 + default 空间 + 4 预置分类 + 钱包 100 金币
  placeOrder/                 # 校验在售/重算价格 → 事务：扣款+建订单(快照)+记流水
  recharge/                   # 事务：加余额+记流水（附言）
  updateOrder/                # 状态机流转（FLOW 表）；cancel 时同事务退款+记 refund 流水
```

## 4. 数据库集合（6 个，全部已创建）

| 集合 | 字段 |
|------|------|
| `spaces` | `_id`('default')、`spaceId`、`name`、`createTime` |
| `categories` | `spaceId`、`name`、`sort`(升序展示)、`createTime` |
| `dishes` | `spaceId`、`name`、`desc`、`price`(int)、`categoryId`、`image`(云存储fileID，可空)、`onSale`(bool)、`createTime` |
| `orders` | `spaceId`、`items`[{dishId,name,price,image,count}]、`total`、`remark`、`status`、`createTime`、`updateTime` |
| `wallets` | `spaceId`、`role`('customer')、`balance`、`createTime` |
| `coin_records` | `spaceId`、`type`('recharge'/'spend'/'refund')、`amount`(带符号)、`memo`、`orderId`(可选)、`createTime` |

**权限（已在控制台配置为自定义安全规则）**：
- `dishes`、`categories`：`{"read": true, "write": true}`（主厨在前端直接写；正式开放多情侣前必须收归云函数）
- `orders`、`wallets`、`coin_records`、`spaces`：`{"read": true, "write": false}`（写只走云函数；orders 的 read=true 是 watch 实时监听的前提）

## 5. 云端环境当前状态（截至移交时，全部已完成 ✅）

用户环境：Windows + 微信开发者工具 Stable 2.01.2510xxx（新版 UI，右键菜单没有「云端测试」）。

- ✅ 云环境已开通：**免费开发环境**（微信官方"开发阶段免费体验"活动，每个小程序 AppID 可建 1 个，
  正式发布上线才转付费；只发体验版不触发收费）。环境名 `cloud1`，完整环境 ID 用户已填入
  `miniprogram/app.js` 的 `CLOUD_ENV_ID`
- ✅ 4 个云函数已「上传并部署：云端安装依赖」
- ✅ `initData` 已在云开发控制台（云函数 → initData → 测试云函数）运行成功：
  6 集合已建、default 空间、4 分类、钱包 100 金币（返回 report 确认过）
- ✅ 6 个集合的数据权限已按上表配置完成
- ⚠️ 注意：`initData` 不读入参，控制台测试模板参数（Hello World 那个 JSON）无影响
- ⚠️ 用户本地 npm 有环境问题：`E:\nodejs\node_cache` EPERM（缓存目录无写权限/杀毒软件锁）。
  **云函数部署不需要本地 npm install**（云端装依赖），别引导用户本地装；
  如确需本地 npm，用管理员终端或 `npm config set cache D:\npm-cache`

## 6. 移交时正在做什么 / 故障上下文

移交前的最后指引是让用户做**本地全流程测试**：

1. 编译 → 选「我是主厨」→ 菜单页应显示 4 个分类 → 新增一道菜（传图/定价/选分类）
2. 「我的」→ 切换身份 → 顾客 → 应见余额 🪙100 → 加购 → 结算（写备注）→ 下单
3. 切回主厨 → 订单页实时出现该单 → 接单 → 开始制作 → 上菜啦
4. 跑通后：右上角「上传」发体验版 → mp.weixin.qq.com 版本管理选为体验版 → 成员管理加她为体验成员

**用户随后报告"出故障了"，没有提供具体现象。接手后第一件事：让用户描述/截图故障**
（哪个页面、什么操作、控制台报什么错）。常见排查方向按概率排序：

- 菜单页 toast「加载失败…」：`CLOUD_ENV_ID` 填错（要完整 `cloud1-xxxxxx`，不是名称 `cloud1`）；
  或某集合权限没设成自定义规则（read 不为 true）
- 下单报错：placeOrder 云函数没部署成功，或钱包记录缺失（重跑 initData 可补）
- 订单页不实时刷新：watch 报错会自动降级手动刷新并在页头提示，看 console 的 onError 内容
- 图片上传失败：云存储权限默认即可，检查网络与 AppID 是否真实（touristappid 无法用云能力）
- `-501001` / `permission denied` 类错误：基本都是数据权限配置问题，对照第 4 节的表逐个核对
- 云函数报 `env not found`：函数部署到了别的环境，重新上传时选对环境

## 7. Git 状态

- 仓库：`baozibao728-cmd/home-diner`（GitHub）
- 开发分支：`claude/home-diner-setup-oxfo8p`（全部代码在此，已推送；`main` 还是空的初始提交）
- 用户本地对 `app.js` 的 `CLOUD_ENV_ID` 修改**未提交**（只在他电脑上）。
  接手后如需提交，注意这一行是用户的真实环境 ID，提交无妨（不算敏感密钥），但改动前先 `git pull` 防冲突
- `project.private.config.json` 已被 .gitignore 忽略（开发者工具自动生成）

## 8. 未来路线图（用户已知晓、尚未实施）

开放给其他情侣使用时（当前**不要**做，仅供了解架构意图）：

1. 做「邀请码配对」页：写 `spaces` 集合，把分到的 spaceId 存本地缓存；
   `utils/space.js#getSpaceId()` 改为读缓存
2. 云函数不再信任入参 spaceId，改为用 `cloud.getWXContext().OPENID` 查用户归属空间
3. `dishes`/`categories` 的前端直写收归云函数（权限改为 write:false）
4. 可能需要：订阅消息通知（新订单提醒）、拒单、菜品排序等

## 9. 给接手 AI 的操作建议

- 改前端后让用户在开发者工具点「编译」即可生效；改云函数后必须重新右键
  「上传并部署：云端安装依赖」对应函数才生效——**提醒用户，这步最容易忘**
- 用户是非专业开发者：给操作指引时写清楚点哪里、贴什么，一步一步来；报错先要截图
- 保持现有代码风格：中文注释、`====` 分隔的文件头注释、双身份共用页面用 `role` 字段分支渲染
- 小程序端查询上限 20 条/次——列表查询一律走 `utils/db.js` 的 `getAll()`，不要直接 `.get()`
- 新增页面记得在 `app.json` 的 `pages` 注册；新增集合记得加 `spaceId` 并同步更新权限说明
