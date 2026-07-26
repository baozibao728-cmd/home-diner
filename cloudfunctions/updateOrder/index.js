// ============================================================
// 云函数 updateOrder · 订单状态流转
// ------------------------------------------------------------
// 状态机: pending(待接单) → accepted(已接单) → cooking(制作中) → served(已上菜)
//        pending → cancelled(已取消，金币退回)
// 每一步都校验当前状态，防止乱序（比如没接单直接上菜）。
// 取消时"改状态 + 退款 + 记流水"放在同一个事务里。
//
// 入参: { spaceId, orderId, action: 'accept' | 'cook' | 'serve' | 'cancel' }
// 返回: { ok: true, status: 新状态 } 或 { ok: false, msg }
// ============================================================
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 每个操作允许的起始状态和目标状态
const FLOW = {
  accept: { from: 'pending',  to: 'accepted' },
  cook:   { from: 'accepted', to: 'cooking' },
  serve:  { from: 'cooking',  to: 'served' },
  cancel: { from: 'pending',  to: 'cancelled' }
}

exports.main = async (event) => {
  const { spaceId, orderId, action } = event

  if (!spaceId || typeof spaceId !== 'string') {
    return { ok: false, msg: '缺少空间信息' }
  }
  if (!orderId || !FLOW[action]) {
    return { ok: false, msg: '参数不正确' }
  }
  const flow = FLOW[action]

  try {
    // 取消订单需要退款，先在事务外找到钱包 id
    let walletId = null
    if (action === 'cancel') {
      const walletRes = await db.collection('wallets')
        .where({ spaceId, role: 'customer' })
        .get()
      if (walletRes.data.length === 0) {
        return { ok: false, msg: '钱包还没初始化' }
      }
      walletId = walletRes.data[0]._id
    }

    const transaction = await db.startTransaction()
    try {
      // 事务里重新读订单，校验归属空间和当前状态
      const orderDoc = await transaction.collection('orders').doc(orderId).get()
      const order = orderDoc.data
      if (!order || order.spaceId !== spaceId) {
        await transaction.rollback()
        return { ok: false, msg: '订单不存在' }
      }
      if (order.status !== flow.from) {
        await transaction.rollback()
        return { ok: false, msg: '订单状态已经变了，刷新看看' }
      }

      await transaction.collection('orders').doc(orderId).update({
        data: { status: flow.to, updateTime: db.serverDate() }
      })

      // 取消：金币原路退回 + 记退款流水
      if (action === 'cancel') {
        const wallet = await transaction.collection('wallets').doc(walletId).get()
        await transaction.collection('wallets').doc(walletId).update({
          data: { balance: wallet.data.balance + order.total }
        })
        await transaction.collection('coin_records').add({
          data: {
            spaceId,
            type: 'refund',
            amount: order.total,
            memo: '订单取消退款',
            orderId,
            createTime: db.serverDate()
          }
        })
      }

      await transaction.commit()
      return { ok: true, status: flow.to }
    } catch (err) {
      await transaction.rollback().catch(() => {})
      throw err
    }
  } catch (err) {
    console.error('updateOrder 失败', err)
    return { ok: false, msg: '操作失败，请稍后再试' }
  }
}
