// ============================================================
// 分类管理（主厨用）：添加 / 改名 / 上移排序 / 删除
// 删除前会检查分类下是否还有菜品，避免菜品变成"孤儿"
// ============================================================
const { db, getAll } = require('../../utils/db')
const { getSpaceId } = require('../../utils/space')

Page({
  data: {
    categories: [],
    newName: ''
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    try {
      const categories = await getAll('categories', {}, { field: 'sort', dir: 'asc' })
      this.setData({ categories })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onNameInput(e) {
    this.setData({ newName: e.detail.value })
  },

  async onAdd() {
    const name = this.data.newName.trim()
    if (!name) {
      wx.showToast({ title: '输入分类名称', icon: 'none' })
      return
    }
    if (this.data.categories.some(c => c.name === name)) {
      wx.showToast({ title: '这个分类已经有了', icon: 'none' })
      return
    }
    try {
      // 新分类排在最后：sort = 当前最大 sort + 1
      const maxSort = this.data.categories.reduce((m, c) => Math.max(m, c.sort || 0), 0)
      await db().collection('categories').add({
        data: { spaceId: getSpaceId(), name, sort: maxSort + 1, createTime: db().serverDate() }
      })
      this.setData({ newName: '' })
      this.loadData()
      wx.showToast({ title: '已添加 🎉' })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  /** 改名：用带输入框的弹窗 */
  async onRename(e) {
    const id = e.currentTarget.dataset.id
    const cat = this.data.categories.find(c => c._id === id)
    if (!cat) return
    const res = await wx.showModal({
      title: '修改分类名',
      editable: true,
      placeholderText: cat.name
    })
    if (!res.confirm) return
    const name = (res.content || '').trim()
    if (!name || name === cat.name) return
    try {
      await db().collection('categories').doc(id).update({ data: { name } })
      this.loadData()
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '修改失败', icon: 'none' })
    }
  },

  /** 上移：和上一个分类交换 sort 值 */
  async onMoveUp(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.categories
    const idx = list.findIndex(c => c._id === id)
    if (idx <= 0) return
    const cur = list[idx]
    const prev = list[idx - 1]
    try {
      await Promise.all([
        db().collection('categories').doc(cur._id).update({ data: { sort: prev.sort } }),
        db().collection('categories').doc(prev._id).update({ data: { sort: cur.sort } })
      ])
      this.loadData()
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id
    const cat = this.data.categories.find(c => c._id === id)
    if (!cat) return

    // 分类下还有菜品就不让删
    try {
      const cnt = await db().collection('dishes')
        .where({ spaceId: getSpaceId(), categoryId: id }).count()
      if (cnt.total > 0) {
        wx.showToast({ title: `「${cat.name}」下还有 ${cnt.total} 道菜，先移走或删掉它们`, icon: 'none', duration: 2500 })
        return
      }
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '检查失败，请重试', icon: 'none' })
      return
    }

    const res = await wx.showModal({
      title: '删除分类',
      content: `确定删除「${cat.name}」吗？`,
      confirmText: '删除',
      confirmColor: '#E05A5A'
    })
    if (!res.confirm) return
    try {
      await db().collection('categories').doc(id).remove()
      this.loadData()
      wx.showToast({ title: '已删除', icon: 'none' })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  }
})
