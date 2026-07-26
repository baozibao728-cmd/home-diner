// 角色选择页：首次进入选择身份，之后记住选择直接进入
const app = getApp()

Page({
  onLoad() {
    // 已经选过身份就直接进菜单页
    const role = wx.getStorageSync('role')
    if (role) {
      app.globalData.role = role
      wx.switchTab({ url: '/pages/menu/menu' })
    }
  },

  onChoose(e) {
    const role = e.currentTarget.dataset.role // chef / customer
    wx.setStorageSync('role', role)
    app.globalData.role = role
    wx.switchTab({ url: '/pages/menu/menu' })
  }
})
