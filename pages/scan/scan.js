const request = require('../../utils/request');

Page({
  data: {
    isScanning: false
  },

  onLoad() {
    this.checkCameraAuth();
  },

  checkCameraAuth() {
    wx.authorize({
      scope: 'scope.camera',
      success: () => {
        // 已授权
      },
      fail: () => {
        wx.showModal({
          title: '提示',
          content: '需要使用相机权限以扫描书籍',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      }
    });
  },

  onScanCode(e) {
    // 防止重复扫描
    if (this.data.isScanning) {
      return;
    }
    
    // 设置扫描标志
    this.setData({ isScanning: true });
    
    const isbn = e.detail.result;
    // 打印扫描结果到控制台
    console.log('扫码识别结果:', isbn);
    console.log('扫码完整数据:', e.detail);
    
    // 处理扫描结果，可以是ISBN或其他二维码
    wx.showLoading({
      title: '识别中...'
    });

    // 调用后端API导入书籍
    const token = wx.getStorageSync('token');
    
    if (!token) {
      wx.hideLoading();
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      this.setData({ isScanning: false });
      return;
    }

    request.post('/user-book/export', {
      isbn: isbn
    }, true, token)
      .then(res => {
        wx.hideLoading();
        wx.showToast({
          title: '导入成功',
          icon: 'success'
        });
        
        // 返回书架页面
        wx.switchTab({
          url: '/pages/bookshelf/bookshelf'
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.log(err,1111111111111111111);
        
        // 处理书籍已存在的情况
        if (err && err.errorCode === "400" && err.message && err.message.includes("该书籍已存在")) {
          wx.showToast({
            title: '书籍已在书架中',
            icon: 'success'
          });
          
          // 仍然返回书架页面，因为操作本质上是成功的
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/bookshelf/bookshelf'
            });
          }, 1500);
        } else {
          // 处理其他错误
          wx.showToast({
            title: err.data.message || '导入失败',
            icon: 'none'
          });
          
          // 重置扫描状态，允许用户再次尝试
          setTimeout(() => {
            this.setData({ isScanning: false });
          }, 2000);
        }
      });
  },
  
  // 页面隐藏时重置扫描状态
  onHide() {
    this.setData({ isScanning: false });
  },
  
  // 页面卸载时重置扫描状态
  onUnload() {
    this.setData({ isScanning: false });
  }
}); 