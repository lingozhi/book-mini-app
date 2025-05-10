const app = getApp();

Page({
  data: {
    userInfo: {},
    readCount: 0,
    readTime: 0
  },

  onLoad() {
    this.checkLoginStatus();
    this.calculateReadingStats();
  },

  onShow() {
    this.checkLoginStatus();
    this.calculateReadingStats();
    
    // 检查token是否已过期，但只有在之前确实登录过的情况下才提示
    const token = wx.getStorageSync('token');
    const hadUserInfo = this.data.userInfo && this.data.userInfo.nickName;
    if (!token && hadUserInfo) {
      // Token不存在但用户信息还在，说明可能是token过期
      this.onTokenExpired(true);
    }
  },

  checkLoginStatus() {
    // 检查token是否存在
    const token = wx.getStorageSync('token');
    
    // 检查全局用户数据
    let userInfo = app.globalData.userInfo;
    
    // 只有当token存在且userInfo存在时才视为已登录
    if (token && userInfo) {
      this.setData({ userInfo });
    } else {
      // 没有token或userInfo为空，清除登录状态
      this.setData({ userInfo: {} });
      app.globalData.userInfo = null;
      app.globalData.isLoggedIn = false;
      
      // 如果本地有缓存但token不存在，则清除缓存
      if (!token && wx.getStorageSync('userInfo')) {
        wx.removeStorageSync('userInfo');
      }
    }
  },

  // 新增监听token过期的方法
  onTokenExpired(showPrompt = false) {
    // 清除用户信息，展示登录按钮
    this.setData({ userInfo: {} });
    // 确保全局状态也被清除
    app.globalData.userInfo = null;
    app.globalData.isLoggedIn = false;
    
    // 清除存储的用户信息和token
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('token');
    
    // 只有在需要显示提示时才显示提示
    if (showPrompt) {
      wx.showToast({
        title: '登录已过期，请重新登录',
        icon: 'none'
      });
    }
  },

  login() {
    // 直接调用微信登录，不再显示选择对话框
    this.wechatLogin();
  },

  // 微信登录
  wechatLogin() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        const userInfo = res.userInfo;
        
        // 打印用户信息到控制台
        console.log('获取到的用户信息:', userInfo);
        
        // 显示加载中
        wx.showLoading({
          title: '登录中...',
        });
        
        // 获取登录凭证
        wx.login({
          success: (loginRes) => {
            // 打印登录凭证到控制台
            console.log('登录凭证 code:', loginRes.code);
            
            if (loginRes.code) {
              // 调用后端登录接口
              wx.request({
                url: 'https://applet.quxiangbook.com/api/we-chat/login', // 替换为你的后端登录接口
                // url: 'http://120.76.156.99:8080/we-chat/login', // 替换为你的后端登录接口
                method: 'POST',
                data: {
                  code: loginRes.code,
                  userInfo: userInfo,
                  signature:''
                },
                success: (result) => {
                  wx.hideLoading();
                  
                  console.log('登录接口返回数据:', result.data);
                  
                  if (result.data.code === 200) {
                    // 登录成功，解析后端返回的数据
                    const responseData = result.data.data;
                    const userProfileData = responseData.userInfo.userProfile;
                    const weChatUserInfo = userProfileData.weChatUserInfo;
                    const token = responseData.userInfo.token;
                    
                    // 构建用户数据对象
                    const userData = {
                      nickName: weChatUserInfo.nickname,
                      avatarUrl: weChatUserInfo.avatarPath,
                      phoneNumber: weChatUserInfo.phoneNumber,
                      userId: weChatUserInfo.id
                    };
                    
                    console.log('处理后的用户数据:', userData);
                    
                    // 确保 userData 中有 nickName
                    if (!userData.nickName) {
                      userData.nickName = '微信用户'; // 如果后端没有返回昵称，使用默认值
                    }
                    
                    // 更新本地状态
                    this.setData({ userInfo: userData });
                    app.globalData.userInfo = userData;
                    
                    // 单独保存 token 到本地存储，方便其他地方使用
                    console.log('Token being saved:', token);
                    wx.setStorage({
                      key: 'token',
                      data: token,
                      success: () => console.log('Token saved successfully'),
                      fail: (err) => console.error('Failed to save token:', err)
                    });
                    
                    // 保存完整用户信息到本地存储
                    wx.setStorage({
                      key: 'userInfo',
                      data: userData
                    });
                    
                    wx.showToast({
                      title: '登录成功',
                      icon: 'success'
                    });
                  } else {
                    // 登录失败
                    wx.showToast({
                      title: result.data.message || '登录失败',
                      icon: 'none'
                    });
                  }
                },
                fail: (err) => {
                  console.log('请求后端登录接口失败:', err);
                  wx.hideLoading();
                  wx.showToast({
                    title: '网络错误，请重试',
                    icon: 'none'
                  });
                }
              });
            } else {
              wx.hideLoading();
              wx.showToast({
                title: '登录失败',
                icon: 'none'
              });
            }
          },
          fail: (err) => {
            console.log('wx.login 失败:', err);
            wx.hideLoading();
            wx.showToast({
              title: '获取登录凭证失败',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        console.log('获取用户信息失败', err);
        wx.showToast({
          title: '已取消授权',
          icon: 'none'
        });
      }
    });
  },

  // 账号密码登录
  accountLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  calculateReadingStats() {
    const progress = app.globalData.readingProgress;
    const books = Object.keys(progress).length;
    
    // 计算总阅读时长（小时）
    let totalTime = 0;
    Object.values(progress).forEach(p => {
      if (p.timestamp) {
        totalTime += p.readTime || 0;
      }
    });

    this.setData({
      readCount: books,
      readTime: Math.round(totalTime / 3600) // 转换为小时
    });
  },

  onMenuTap(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({
      url: `/pages/agreement/agreement?type=${type}`
    });
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除用户信息
          app.globalData.userInfo = null;
          app.globalData.isLoggedIn = false;
          wx.removeStorage({
            key: 'userInfo'
          });
          // 清除 token
          wx.removeStorage({
            key: 'token'
          });
          this.setData({
            userInfo: {}
          });
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  },

  clearCache() {
    wx.showModal({
      title: '提示',
      content: '确定要清除缓存吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorage({
            success: () => {
              wx.showToast({
                title: '清除成功',
                icon: 'success'
              });
              // 重新加载数据
              app.loadUserData();
            }
          });
        }
      }
    });
  },

  // 添加获取手机号码的方法
  getPhoneNumber(e) {
    console.log('获取手机号码返回数据:', e.detail);
    
    // 判断是否成功获取
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      // 获取成功，拿到加密数据
      const encryptedData = e.detail.encryptedData;
      const iv = e.detail.iv;
      const code = ''; // 需要通过 wx.login 获取新的 code
      
      // 先获取新的 code
      wx.login({
        success: (res) => {
          if (res.code) {
            console.log('获取手机号码的 code:', res.code);
            
            // 这里应该将 encryptedData, iv 和 code 发送到后端解密
            // 由于微信不允许在前端解密，必须在后端服务器解密获取手机号
            console.log('需要发送到后端的数据:', {
              encryptedData,
              iv,
              code: res.code
            });
            
            // 模拟获取成功
            wx.showToast({
              title: '手机号获取成功',
              icon: 'success'
            });
            
            // 更新用户信息，添加手机号标记
            // 实际应用中，这里应该使用后端返回的解密后的手机号
            const updatedUserInfo = {
              ...this.data.userInfo,
              phoneNumber: '已绑定'  // 实际应用中应该是真实手机号
            };
            
            this.setData({
              userInfo: updatedUserInfo
            });
            
            app.globalData.userInfo = updatedUserInfo;
            
            wx.setStorage({
              key: 'userInfo',
              data: updatedUserInfo
            });
          }
        }
      });
    } else {
      // 用户拒绝授权
      wx.showToast({
        title: '您拒绝了授权',
        icon: 'none'
      });
    }
  }
});