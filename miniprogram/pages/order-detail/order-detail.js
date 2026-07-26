// ============================================================
// 订单详情页：状态进度、菜品明细、备注；可执行和列表页相同的操作
// ============================================================
const { db, callFn } = require('../../utils/db')
const { CHEF_NEXT_ACTION, decorateOrder } = require('../../utils/format')

// 正常流程的四个节点（用于进度条）
const STEPS = [
  { status: 'pending',  label: '待接单', emoji: '🕐' },
  { status: 'accepted', label: '已接单', emoji: '👌' },
  { status: 'cooking',  label: '制作中', emoji: '🍳' },
  { status: 'served',   label: '已上菜', emoji: '🍽️' }
]

Page({
  data: {
    id: '',
    role: '',
    order: null,
    steps: []
  },

  onLoad(options) {
    this.setData({ id: options.id, role: wx.getStorageSync('role') })
  },

  onShow() {
    this.loadOrder()
  },

  async loadOrder() {
    try {
      const res = await db().collection('orders').doc(this.data.id).get()
      const o = decorateOrder(res.data)
      o._id = this.data.id
      o.chefAction = CHEF_NEXT_ACTION[o.status] || null
      o.canCancel = o.status === 'pending'

      // 进度条：当前状态之前（含当前）的节点点亮
      const curIdx = STEPS.findIndex(s => s.status === o.status)
      const steps = STEPS.map((s, i) => Object.assign({}, s, {
        reached: curIdx >= 0 && i <= curIdx,
        current: i === curIdx
      }))

      this.setData({ order: o, steps })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async onAction(e) {
    const action = e.currentTarget.dataset.action

    if (action === 'cancel') {
      const res = await wx.showModal({
        title: '取消订单',
        content: '取消后金币会原路退回，确定不吃了吗？',
        confirmText: '取消订单',
        cancelText: '再想想',
        confirmColor: '#E05A5A'
      })
      if (!res.confirm) return
    }

    wx.showLoading({ mask: true })
    try {
      await callFn('updateOrder', { orderId: this.data.id, action })
      wx.hideLoading()
      this.loadOrder()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  }
})
