// ============================================================
// Home Diner 小食堂 · 全局入口
// ============================================================

// ★★★ 云环境 ID 配置 ★★★
// 打开微信开发者工具 →「云开发」控制台 → 首页「设置」里能看到环境 ID（形如 cloud1-xxxxxx）
// 把它填到下面的引号里。如果留空，则使用账号下的【默认云环境】（只有一个环境时留空也能跑）。
const CLOUD_ENV_ID = ''

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库过低，无法使用云能力，请在开发者工具中把基础库调到 2.2.3 以上')
      return
    }
    const options = { traceUser: true }
    if (CLOUD_ENV_ID) {
      options.env = CLOUD_ENV_ID
    } else {
      console.warn('[home-diner] 未配置云环境 ID，正在使用默认云环境。建议在 app.js 顶部填写 CLOUD_ENV_ID。')
    }
    wx.cloud.init(options)

    // 读取上次选择的身份（chef = 主厨 / customer = 顾客）
    this.globalData.role = wx.getStorageSync('role') || ''
  },

  globalData: {
    role: ''
  }
})
