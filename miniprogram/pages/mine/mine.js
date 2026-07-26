// ============================================================
// 我的页（双身份共用）
//  - 顾客：看自己的金币余额和收支明细
//  - 主厨：看她的余额、去充值、看收支明细
//  - 两个身份都可以在这里切换身份
// ============================================================
const { getAll } = require('../../utils/db')
const { formatTime } = require('../../utils/format')

Page({
  data: {
    role: '',
    balance: null,
    records: []
  },

  onShow() {
    const role = wx.getStorageSync('role')
    if (!role) {
      wx.reLaunch({ url: '/pages/role-select/role-select' })
      return
    }
    this.setData({ role })
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh())
  },

  async loadData() {
    try {
      const [wallets, records] = await Promise.all([
        getAll('wallets', { role: 'customer' }),
        getAll('coin_records', {}, { field: 'createTime', dir: 'desc' })
      ])
      this.setData({
        balance: wallets.length ? wallets[0].balance : 0,
        records: records.map(r => Object.assign({}, r, {
          timeText: formatTime(r.createTime),
          amountText: (r.amount > 0 ? '+' : '') + r.amount,
          isIncome: r.amount > 0
        }))
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onRecharge() {
    wx.navigateTo({ url: '/pages/recharge/recharge' })
  },

  async onSwitchRole() {
    const res = await wx.showModal({
      title: '切换身份',
      content: '要换一个身份进入小食堂吗？',
      confirmText: '切换'
    })
    if (!res.confirm) return
    wx.removeStorageSync('role')
    getApp().globalData.role = ''
    wx.reLaunch({ url: '/pages/role-select/role-select' })
  }
})
