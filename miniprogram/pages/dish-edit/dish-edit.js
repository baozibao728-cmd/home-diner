// ============================================================
// 新增 / 编辑菜品（主厨用）
// 图片从手机相册或拍照选择，上传到云存储后保存 fileID
// ============================================================
const { db, getAll } = require('../../utils/db')
const { getSpaceId } = require('../../utils/space')

Page({
  data: {
    id: '',          // 有值 = 编辑模式
    name: '',
    desc: '',
    price: '',       // 输入框里是字符串，保存时转成整数
    onSale: true,
    image: '',       // 已保存的云存储 fileID
    tempImage: '',   // 本次新选的本地临时图片路径
    categories: [],
    catNames: [],
    catIndex: -1
  },

  async onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id })
      wx.setNavigationBarTitle({ title: '编辑菜品' })
    }

    try {
      const categories = await getAll('categories', {}, { field: 'sort', dir: 'asc' })
      this.setData({ categories, catNames: categories.map(c => c.name) })

      if (options.id) {
        const res = await db().collection('dishes').doc(options.id).get()
        const d = res.data
        this.setData({
          name: d.name,
          desc: d.desc || '',
          price: String(d.price),
          onSale: d.onSale,
          image: d.image || '',
          catIndex: categories.findIndex(c => c._id === d.categoryId)
        })
      }
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onDescInput(e) { this.setData({ desc: e.detail.value }) },
  onPriceInput(e) { this.setData({ price: e.detail.value }) },
  onCatChange(e) { this.setData({ catIndex: Number(e.detail.value) }) },
  onSaleChange(e) { this.setData({ onSale: e.detail.value }) },

  /** 选图：微信自带压缩，省云存储流量 */
  onChooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        this.setData({ tempImage: res.tempFiles[0].tempFilePath })
      }
    })
  },

  async onSave() {
    const { id, name, desc, price, onSale, image, tempImage, categories, catIndex } = this.data

    // ------ 校验 ------
    if (!name.trim()) {
      wx.showToast({ title: '给这道菜起个名字吧', icon: 'none' })
      return
    }
    const priceNum = parseInt(price, 10)
    if (isNaN(priceNum) || priceNum < 0) {
      wx.showToast({ title: '金币价格要是 0 或正整数哦', icon: 'none' })
      return
    }
    if (!categories.length) {
      const res = await wx.showModal({
        title: '还没有分类',
        content: '需要先创建至少一个菜品分类，去创建吗？',
        confirmText: '去创建'
      })
      if (res.confirm) wx.navigateTo({ url: '/pages/category-manage/category-manage' })
      return
    }
    if (catIndex < 0) {
      wx.showToast({ title: '选一个分类吧', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中…', mask: true })
    try {
      // ------ 如果选了新图片，先上传到云存储 ------
      let fileID = image
      if (tempImage) {
        const cloudPath = `dishes/${getSpaceId()}/${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: tempImage })
        fileID = up.fileID
        // 替换掉旧图片，顺手删除旧文件（失败不影响保存）
        if (image) {
          wx.cloud.deleteFile({ fileList: [image] }).catch(() => {})
        }
      }

      const data = {
        name: name.trim(),
        desc: desc.trim(),
        price: priceNum,
        categoryId: categories[catIndex]._id,
        image: fileID,
        onSale
      }

      if (id) {
        await db().collection('dishes').doc(id).update({ data })
      } else {
        await db().collection('dishes').add({
          data: Object.assign({ spaceId: getSpaceId(), createTime: db().serverDate() }, data)
        })
      }

      wx.hideLoading()
      wx.showToast({ title: '保存成功 🎉' })
      setTimeout(() => wx.navigateBack(), 800)
    } catch (err) {
      console.error(err)
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  }
})
