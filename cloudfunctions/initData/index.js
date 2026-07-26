// ============================================================
// 云函数 initData · 一次性初始化（可重复运行，已存在的数据不会重建）
// ------------------------------------------------------------
// 做四件事：
//   1. 创建 6 个数据库集合（已存在则跳过）
//   2. 创建默认情侣空间 spaces/default
//   3. 预置 4 个菜品分类：主食 / 汤 / 甜品 / 夜宵
//   4. 给顾客创建钱包，送 100 初始金币并记一条流水
//
// 部署后在开发者工具里右键 →「云端测试」直接运行一次即可。
// 想改初始金币数量，改下面的 INIT_COINS。
// ============================================================
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const SPACE_ID = 'default'          // 默认情侣空间（和小程序端 utils/space.js 保持一致）
const INIT_COINS = 100              // 顾客初始金币
const COLLECTIONS = ['spaces', 'categories', 'dishes', 'orders', 'wallets', 'coin_records']
const PRESET_CATEGORIES = ['主食', '汤', '甜品', '夜宵']

exports.main = async () => {
  const report = [] // 记录做了什么，方便在控制台查看结果

  // ---------- 1. 创建集合 ----------
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      report.push(`集合 ${name}: 已创建`)
    } catch (err) {
      // -501001 等错误码表示集合已存在，属于正常情况
      report.push(`集合 ${name}: 已存在，跳过`)
    }
  }

  // ---------- 2. 默认空间 ----------
  const spaceRes = await db.collection('spaces').where({ _id: SPACE_ID }).get()
  if (spaceRes.data.length === 0) {
    await db.collection('spaces').add({
      data: {
        _id: SPACE_ID,
        spaceId: SPACE_ID,
        name: '我们的小食堂',
        createTime: db.serverDate()
      }
    })
    report.push('默认空间: 已创建')
  } else {
    report.push('默认空间: 已存在，跳过')
  }

  // ---------- 3. 预置分类 ----------
  const catCount = await db.collection('categories').where({ spaceId: SPACE_ID }).count()
  if (catCount.total === 0) {
    for (let i = 0; i < PRESET_CATEGORIES.length; i++) {
      await db.collection('categories').add({
        data: {
          spaceId: SPACE_ID,
          name: PRESET_CATEGORIES[i],
          sort: i + 1,
          createTime: db.serverDate()
        }
      })
    }
    report.push(`预置分类: 已创建（${PRESET_CATEGORIES.join(' / ')}）`)
  } else {
    report.push('预置分类: 已有分类，跳过')
  }

  // ---------- 4. 顾客钱包 + 初始金币 ----------
  const walletRes = await db.collection('wallets')
    .where({ spaceId: SPACE_ID, role: 'customer' })
    .get()
  if (walletRes.data.length === 0) {
    await db.collection('wallets').add({
      data: {
        spaceId: SPACE_ID,
        role: 'customer',
        balance: INIT_COINS,
        createTime: db.serverDate()
      }
    })
    await db.collection('coin_records').add({
      data: {
        spaceId: SPACE_ID,
        type: 'recharge',
        amount: INIT_COINS,
        memo: '开业大礼包 🎁',
        createTime: db.serverDate()
      }
    })
    report.push(`顾客钱包: 已创建，初始金币 ${INIT_COINS}`)
  } else {
    report.push('顾客钱包: 已存在，跳过')
  }

  console.log(report.join('\n'))
  return { ok: true, report }
}
