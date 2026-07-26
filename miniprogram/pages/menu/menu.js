// ============================================================
// 菜单页（双身份共用）
//  - 顾客：浏览在售菜品，加购物车，去结算
//  - 主厨：管理全部菜品（新增/编辑/上下架/删除）、管理分类
// ============================================================
const { db, getAll } = require('../../utils/db')
const cart = require('../../utils/cart')

Page({
  data: {
    role: '',
    loading: true,
    categories: [],
    dishes: [],       // 全部菜品（顾客只含在售的）
    shownDishes: [],  // 当前分类下展示的菜品
    activeCat: 'all',
    cartCount: 0,
    cartTotal: 0
  },

  onShow() {
    const role = wx.getStorageSync('role')
    if (!role) {
      // 还没选身份，回到角色选择页
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
      // 顾客只看在售菜品；主厨看全部（包括已下架的）
      const dishWhere = this.data.role === 'customer' ? { onSale: true } : {}
      const [categories, dishes] = await Promise.all([
        getAll('categories', {}, { field: 'sort', dir: 'asc' }),
        getAll('dishes', dishWhere, { field: 'createTime', dir: 'desc' })
      ])
      this.setData({ categories, dishes, loading: false })
      this.applyFilter()
      this.refreshCartBar()
    } catch (err) {
      console.error('加载菜单失败', err)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败，请检查云环境配置和数据库集合是否已创建',
        icon: 'none',
        duration: 3000
      })
    }
  },

  /** 按当前选中的分类过滤，并附上购物车数量 */
  applyFilter() {
    const { dishes, activeCat } = this.data
    const list = (activeCat === 'all' ? dishes : dishes.filter(d => d.categoryId === activeCat))
      .map(d => Object.assign({}, d, { cartCount: cart.getCountOf(d._id) }))
    this.setData({ shownDishes: list })
  },

  refreshCartBar() {
    this.setData({ cartCount: cart.getCount(), cartTotal: cart.getTotal() })
  },

  onCatTap(e) {
    this.setData({ activeCat: e.currentTarget.dataset.id })
    this.applyFilter()
  },

  // ---------------- 顾客：购物车 ----------------

  onAdd(e) {
    const id = e.currentTarget.dataset.id
    const dish = this.data.dishes.find(d => d._id === id)
    if (!dish) return
    cart.add(dish)
    this.applyFilter()
    this.refreshCartBar()
  },

  onMinus(e) {
    cart.minus(e.currentTarget.dataset.id)
    this.applyFilter()
    this.refreshCartBar()
  },

  onCheckout() {
    if (cart.getCount() === 0) {
      wx.showToast({ title: '先选点想吃的吧～', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/checkout/checkout' })
  },

  // ---------------- 主厨：菜品管理 ----------------

  onAddDish() {
    wx.navigateTo({ url: '/pages/dish-edit/dish-edit' })
  },

  onEditDish(e) {
    wx.navigateTo({ url: '/pages/dish-edit/dish-edit?id=' + e.currentTarget.dataset.id })
  },

  onManageCats() {
    wx.navigateTo({ url: '/pages/category-manage/category-manage' })
  },

  /** 上架 / 下架 切换 */
  async onToggleSale(e) {
    const id = e.currentTarget.dataset.id
    const dish = this.data.dishes.find(d => d._id === id)
    if (!dish) return
    const next = !dish.onSale
    try {
      await db().collection('dishes').doc(id).update({ data: { onSale: next } })
      dish.onSale = next
      this.applyFilter()
      wx.showToast({ title: next ? '已上架 🎉' : '已下架', icon: 'none' })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  async onDeleteDish(e) {
    const id = e.currentTarget.dataset.id
    const dish = this.data.dishes.find(d => d._id === id)
    if (!dish) return
    const res = await wx.showModal({
      title: '删除菜品',
      content: `确定把「${dish.name}」从菜单里删掉吗？`,
      confirmText: '删除',
      confirmColor: '#E05A5A'
    })
    if (!res.confirm) return
    try {
      await db().collection('dishes').doc(id).remove()
      // 顺手删掉云存储里的图片（失败也不影响）
      if (dish.image) {
        wx.cloud.deleteFile({ fileList: [dish.image] }).catch(() => {})
      }
      this.setData({ dishes: this.data.dishes.filter(d => d._id !== id) })
      this.applyFilter()
      wx.showToast({ title: '已删除', icon: 'none' })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  }
})
