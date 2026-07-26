// ============================================================
// 订单页（双身份共用）
//  - 用云数据库 watch 实时监听：她下单主厨马上看到，
//    主厨更新状态她这边也马上刷新，不用手动下拉
//  - 主厨：接单 → 开始制作 → 上菜
//  - 顾客：待接单的订单可以取消（自动退金币）
// ============================================================
const { db, getAll, callFn } = require('../../utils/db')
const { getSpaceId } = require('../../utils/space')
const { CHEF_NEXT_ACTION, decorateOrder } = require('../../utils/format')

// 进行中的状态
const ACTIVE_STATUS = ['pending', 'accepted', 'cooking']

Page({
  data: {
    role: '',
    loading: true,
    active: [],    // 进行中订单
    history: [],   // 已完成 / 已取消
    watchFailed: false
  },

  onShow() {
    const role = wx.getStorageSync('role')
    if (!role) {
      wx.reLaunch({ url: '/pages/role-select/role-select' })
      return
    }
    this.setData({ role })
    this.startWatch()
  },

  // 离开页面时关掉监听，省资源
  onHide() { this.stopWatch() },
  onUnload() { this.stopWatch() },

  startWatch() {
    this.stopWatch()
    this.watcher = db().collection('orders')
      .where({ spaceId: getSpaceId() })
      .watch({
        onChange: snapshot => {
          // snapshot.docs 每次都是当前的完整结果集
          this.renderDocs(snapshot.docs)
        },
        onError: err => {
          console.error('订单实时监听失败，退回手动刷新模式', err)
          this.setData({ watchFailed: true })
          this.loadOnce()
        }
      })
  },

  stopWatch() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  },

  /** 监听不可用时的兜底：普通查询一次 */
  async loadOnce() {
    try {
      const docs = await getAll('orders')
      this.renderDocs(docs)
    } catch (err) {
      console.error(err)
      this.setData({ loading: false })
    }
  },

  onPullDownRefresh() {
    this.loadOnce().finally(() => wx.stopPullDownRefresh())
  },

  renderDocs(docs) {
    const list = docs
      .slice()
      .sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
      .map(o => {
        const d = decorateOrder(o)
        // 主厨的下一步操作按钮
        d.chefAction = CHEF_NEXT_ACTION[o.status] || null
        // 顾客只能取消「待接单」的订单
        d.canCancel = o.status === 'pending'
        return d
      })
    this.setData({
      active: list.filter(o => ACTIVE_STATUS.includes(o.status)),
      history: list.filter(o => !ACTIVE_STATUS.includes(o.status)),
      loading: false
    })
  },

  onTapOrder(e) {
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + e.currentTarget.dataset.id })
  },

  /** 主厨推进状态 / 顾客取消订单，统一走 updateOrder 云函数 */
  async onAction(e) {
    const { id, action } = e.currentTarget.dataset

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
      await callFn('updateOrder', { orderId: id, action })
      wx.hideLoading()
      // watch 会自动推送最新数据；监听挂了就手动刷一次
      if (this.data.watchFailed) this.loadOnce()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  }
})
