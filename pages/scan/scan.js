const request = require('../../utils/request');

Page({
  data: {
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
    const isbn = e.detail.result;
    // 打印扫描结果到控制台
    console.log('扫码识别结果:', isbn);
    console.log('扫码完整数据:', e.detail);
    
    // 处理扫描结果，可以是ISBN或其他二维码
    wx.showLoading({
      title: '识别中...'
    });

    // 这里应该调用后端API处理扫描结果
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '导入成功',
        icon: 'success'
      });
      
      // 返回书架页面
      wx.switchTab({
        url: '/pages/bookshelf/bookshelf'
      });
    }, 1500);
  }
}); 