// ============================================================
// 结算页（顾客用）：确认购物车 → 写备注 → 金币下单
// 真正的扣款和校验在云函数 placeOrder 里完成（保证数据一致）
// ============================================================
const { getAll, callFn } = require('../../utils/db')
const cart = require('../../utils/cart')

Page({
  data: {
    list: [],
    total: 0,
    balance: null,   // null = 还没加载出来
    remark: '',
    submitting: false
  },

  onLoad() {
    this.setData({ list: cart.getList(), total: cart.getTotal() })
    this.loadBalance()
  },

  async loadBalance() {
    try {
      const wallets = await getAll('wallets', { role: 'customer' })
      this.setData({ balance: wallets.length ? wallets[0].balance : 0 })
    } catch (err) {
      console.error(err)
    }
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  async onSubmit() {
    const { list, total, balance, remark, submitting } = this.data
    if (submitting) return
    if (!list.length) {
      wx.showToast({ title: '购物车是空的', icon: 'none' })
      return
    }
    // 先在本地友好提示一下，最终以云函数校验为准
    if (balance !== null && balance < total) {
      wx.showToast({ title: `金币不够啦（还差 ${total - balance} 个），找主厨充值吧～`, icon: 'none', duration: 2500 })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '下单中…', mask: true })
    try {
      await callFn('placeOrder', {
        items: list.map(it => ({ dishId: it.dishId, count: it.count })),
        remark: remark.trim()
      })
      cart.clear()
      wx.hideLoading()
      wx.showToast({ title: '下单成功，等着开饭吧 🎉', icon: 'none', duration: 1500 })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/orders/orders' })
      }, 1200)
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: err.message || '下单失败', icon: 'none', duration: 2500 })
    }
  }
})
