// ============================================================
// 云函数 recharge · 充值
// 主厨给顾客的金币账户加钱，并写一条带附言的流水
//
// 入参: { spaceId, amount(正整数), memo }
// 返回: { ok: true, balance: 充值后的余额 } 或 { ok: false, msg }
// ============================================================
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { spaceId, amount, memo = '主厨充值' } = event

  if (!spaceId || typeof spaceId !== 'string') {
    return { ok: false, msg: '缺少空间信息' }
  }
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1000000) {
    return { ok: false, msg: '充值数量要是正整数' }
  }

  try {
    const walletRes = await db.collection('wallets')
      .where({ spaceId, role: 'customer' })
      .get()
    if (walletRes.data.length === 0) {
      return { ok: false, msg: '钱包还没初始化，请先运行 initData 云函数' }
    }
    const walletId = walletRes.data[0]._id

    // 事务：加余额 + 记流水，保证两边一致
    const transaction = await db.startTransaction()
    try {
      const wallet = await transaction.collection('wallets').doc(walletId).get()
      const newBalance = wallet.data.balance + amount

      await transaction.collection('wallets').doc(walletId).update({
        data: { balance: newBalance }
      })
      await transaction.collection('coin_records').add({
        data: {
          spaceId,
          type: 'recharge',
          amount: amount,
          memo: String(memo).slice(0, 30) || '主厨充值',
          createTime: db.serverDate()
        }
      })

      await transaction.commit()
      return { ok: true, balance: newBalance }
    } catch (err) {
      await transaction.rollback().catch(() => {})
      throw err
    }
  } catch (err) {
    console.error('recharge 失败', err)
    return { ok: false, msg: '充值失败，请稍后再试' }
  }
}
