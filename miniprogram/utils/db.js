// ============================================================
// 云数据库访问封装
// 所有查询自动带上当前空间的 spaceId，保证数据按情侣空间隔离
// ============================================================
const { getSpaceId } = require('./space')

let _db = null

// 懒加载：确保 wx.cloud.init 已经在 app.js 里执行过
function db() {
  if (!_db) _db = wx.cloud.database()
  return _db
}

function command() {
  return db().command
}

/**
 * 取本空间某个集合的全部数据。
 * 小程序端单次查询最多返回 20 条，这里自动翻页取完。
 * @param {string} name    集合名
 * @param {object} where   额外查询条件（会与 spaceId 合并）
 * @param {object} orderBy 排序，如 { field: 'createTime', dir: 'desc' }
 */
async function getAll(name, where = {}, orderBy = null) {
  const PAGE = 20
  let all = []
  for (let skip = 0; skip < 1000; skip += PAGE) {
    let query = db().collection(name).where(Object.assign({ spaceId: getSpaceId() }, where))
    if (orderBy) query = query.orderBy(orderBy.field, orderBy.dir || 'asc')
    const res = await query.skip(skip).limit(PAGE).get()
    all = all.concat(res.data)
    if (res.data.length < PAGE) break
  }
  return all
}

/** 调用云函数的小封装：自动带 spaceId，统一错误提示 */
async function callFn(name, data = {}) {
  const res = await wx.cloud.callFunction({
    name,
    data: Object.assign({ spaceId: getSpaceId() }, data)
  })
  const result = res.result || {}
  if (!result.ok) {
    throw new Error(result.msg || '操作失败，请稍后再试')
  }
  return result
}

module.exports = { db, command, getAll, callFn }
