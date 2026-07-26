// ============================================================
// 格式化工具 & 常量
// ============================================================

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

/**
 * 时间显示：今天的显示「今天 HH:mm」，其他显示「M月D日 HH:mm」
 * 兼容 Date 对象 / 时间戳 / 云数据库返回的时间
 */
function formatTime(t) {
  if (!t) return ''
  const d = t instanceof Date ? t : new Date(t)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const hm = pad(d.getHours()) + ':' + pad(d.getMinutes())
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return '今天 ' + hm
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm
}

// 订单状态：pending 待接单 → accepted 已接单 → cooking 制作中 → served 已上菜
//          cancelled 已取消（只有待接单的订单能取消）
const ORDER_STATUS = {
  pending:   { text: '待接单', emoji: '🕐' },
  accepted:  { text: '已接单', emoji: '👌' },
  cooking:   { text: '制作中', emoji: '🍳' },
  served:    { text: '已上菜', emoji: '🍽️' },
  cancelled: { text: '已取消', emoji: '💨' }
}

// 主厨在订单上的「下一步」操作
const CHEF_NEXT_ACTION = {
  pending:  { action: 'accept', label: '接单 👌' },
  accepted: { action: 'cook',   label: '开始制作 🍳' },
  cooking:  { action: 'serve',  label: '上菜啦 🍽️' }
}

/** 给订单对象附上展示用的字段（状态文案、标签样式、格式化时间） */
function decorateOrder(o) {
  const st = ORDER_STATUS[o.status] || { text: o.status, emoji: '' }
  return Object.assign({}, o, {
    statusText: st.text,
    statusEmoji: st.emoji,
    tagClass: 'tag-' + o.status,
    timeText: formatTime(o.createTime)
  })
}

module.exports = { formatTime, ORDER_STATUS, CHEF_NEXT_ACTION, decorateOrder }
