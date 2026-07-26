// ============================================================
// 云函数 placeOrder · 下单
// ------------------------------------------------------------
// 为什么放云函数：扣金币、写订单、记流水必须"要么都成功要么都失败"，
// 放在数据库事务里执行，防止出现"钱扣了单没下"或"余额不够也能下单"。
// 价格以数据库里的为准，不相信前端传来的金额。
//
// 入参: { spaceId, items: [{ dishId, count }], remark }
// 返回: { ok: true, orderId } 或 { ok: false, msg }
// ============================================================
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { spaceId, items, remark = '' } = event

  // ---------- 参数校验 ----------
  if (!spaceId || typeof spaceId !== 'string') {
    return { ok: false, msg: '缺少空间信息' }
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, msg: '购物车是空的' }
  }
  for (const it of items) {
    if (!it.dishId || !Number.isInteger(it.count) || it.count <= 0 || it.count > 99) {
      return { ok: false, msg: '订单数据不正确' }
    }
  }

  try {
    // ---------- 1. 用数据库里的菜品信息生成快照并计算总价 ----------
    const dishIds = items.map(it => it.dishId)
    const dishRes = await db.collection('dishes')
      .where({ spaceId, _id: _.in(dishIds) })
      .get()
    const dishMap = {}
    dishRes.data.forEach(d => { dishMap[d._id] = d })

    let total = 0
    const snapshot = [] // 菜品快照：以后改菜名/价格不影响历史订单
    for (const it of items) {
      const dish = dishMap[it.dishId]
      if (!dish) return { ok: false, msg: '有菜品不存在了，刷新菜单再试试' }
      if (!dish.onSale) return { ok: false, msg: `「${dish.name}」已经下架啦` }
      total += dish.price * it.count
      snapshot.push({
        dishId: dish._id,
        name: dish.name,
        price: dish.price,
        image: dish.image || '',
        count: it.count
      })
    }

    // ---------- 2. 找到顾客的钱包 ----------
    const walletRes = await db.collection('wallets')
      .where({ spaceId, role: 'customer' })
      .get()
    if (walletRes.data.length === 0) {
      return { ok: false, msg: '钱包还没初始化，请先运行 initData 云函数' }
    }
    const walletId = walletRes.data[0]._id

    // ---------- 3. 事务：扣款 + 建订单 + 记流水 ----------
    const transaction = await db.startTransaction()
    try {
      // 事务里重新读余额，避免并发下超扣
      const wallet = await transaction.collection('wallets').doc(walletId).get()
      const balance = wallet.data.balance
      if (balance < total) {
        await transaction.rollback()
        return { ok: false, msg: `金币不够啦，还差 ${total - balance} 个` }
      }

      await transaction.collection('wallets').doc(walletId).update({
        data: { balance: balance - total }
      })

      const orderAdd = await transaction.collection('orders').add({
        data: {
          spaceId,
          items: snapshot,
          total,
          remark: String(remark).slice(0, 100),
          status: 'pending', // 待接单
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })

      await transaction.collection('coin_records').add({
        data: {
          spaceId,
          type: 'spend',
          amount: -total,
          memo: '点餐消费',
          orderId: orderAdd._id,
          createTime: db.serverDate()
        }
      })

      await transaction.commit()
      return { ok: true, orderId: orderAdd._id }
    } catch (err) {
      await transaction.rollback().catch(() => {})
      throw err
    }
  } catch (err) {
    console.error('placeOrder 失败', err)
    return { ok: false, msg: '下单失败，请稍后再试' }
  }
}
