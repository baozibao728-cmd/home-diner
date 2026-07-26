// ============================================================
// 充值页（主厨用）：给她的金币账户充值并附言
// 实际入账走 recharge 云函数（写余额 + 记流水）
// ============================================================
const { callFn } = require('../../utils/db')

// 常用附言，点一下快速填入
const QUICK_MEMOS = ['洗碗奖励 🧽', '做家务辛苦啦 🧹', '就是想宠你 ❤️', '生日快乐 🎂']

Page({
  data: {
    amount: '',
    memo: '',
    quickMemos: QUICK_MEMOS,
    submitting: false
  },

  onAmountInput(e) { this.setData({ amount: e.detail.value }) },
  onMemoInput(e) { this.setData({ memo: e.detail.value }) },

  onQuickMemo(e) {
    this.setData({ memo: e.currentTarget.dataset.memo })
  },

  async onSubmit() {
    if (this.data.submitting) return
    const amount = parseInt(this.data.amount, 10)
    if (isNaN(amount) || amount <= 0) {
      wx.showToast({ title: '充值数量要是正整数哦', icon: 'none' })
      return
    }
    const memo = this.data.memo.trim() || '主厨充值'

    this.setData({ submitting: true })
    wx.showLoading({ title: '充值中…', mask: true })
    try {
      await callFn('recharge', { amount, memo })
      wx.hideLoading()
      wx.showToast({ title: `已到账 +${amount} 🪙`, icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: err.message || '充值失败', icon: 'none' })
    }
  }
})
