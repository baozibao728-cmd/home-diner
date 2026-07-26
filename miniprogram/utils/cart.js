// ============================================================
// 购物车（内存版）
// 只在小程序本次运行期间有效，下单成功或退出后清空。
// 结构: { [dishId]: { dish: 菜品对象, count: 数量 } }
// ============================================================

let items = {}

/** 加一份 */
function add(dish) {
  if (!items[dish._id]) {
    items[dish._id] = { dish, count: 0 }
  }
  items[dish._id].count += 1
}

/** 减一份，减到 0 就从购物车移除 */
function minus(dishId) {
  const it = items[dishId]
  if (!it) return
  it.count -= 1
  if (it.count <= 0) delete items[dishId]
}

function clear() {
  items = {}
}

/** 某道菜当前选了几份 */
function getCountOf(dishId) {
  return items[dishId] ? items[dishId].count : 0
}

/** 总份数 */
function getCount() {
  return Object.values(items).reduce((sum, it) => sum + it.count, 0)
}

/** 总金币 */
function getTotal() {
  return Object.values(items).reduce((sum, it) => sum + it.dish.price * it.count, 0)
}

/** 列表形式，给结算页用 */
function getList() {
  return Object.values(items).map(it => ({
    dishId: it.dish._id,
    name: it.dish.name,
    price: it.dish.price,
    image: it.dish.image || '',
    count: it.count,
    subtotal: it.dish.price * it.count
  }))
}

module.exports = { add, minus, clear, getCountOf, getCount, getTotal, getList }
