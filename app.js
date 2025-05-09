// app.js
App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    // baseUrl: 'https://applet.quxiangbook.com/api', // 替换为你的实际接口地址
     baseUrl: 'http://120.76.156.99:8080', // 替换为你的实际接口地址
    books: [
      {
        id: '1',
        title: '软浅',
        coverUrl: 'https://img.xibook.info/upload/book/20230812/1691827726_64d73c1e42fbe.jpg',
        author: '墨上筠'
      },
      {
        id: '2',
        title: '北派盗墓笔记',
        coverUrl: 'https://img.xibook.info/upload/book/20230812/1691827726_64d73c1e42fbe.jpg',
        author: '黑色火种'
      },
      {
        id: '3',
        title: '诡舍',
        coverUrl: 'https://img.xibook.info/upload/book/20230812/1691827726_64d73c1e42fbe.jpg',
        author: '零下九度'
      },
      {
        id: '4',
        title: '天渊',
        coverUrl: 'https://img.xibook.info/upload/book/20230812/1691827726_64d73c1e42fbe.jpg',
        author: '默默猴'
      },
      {
        id: '5',
        title: '她引神明坠落',
        coverUrl: 'https://img.xibook.info/upload/book/20230812/1691827726_64d73c1e42fbe.jpg',
        author: '九月的茉莉'
      },
      {
        id: '6',
        title: '绝香情',
        coverUrl: 'https://img.xibook.info/upload/book/20230812/1691827726_64d73c1e42fbe.jpg',
        author: '沐清雨'
      },
      {
        id: '7',
        title: '青山似玉',
        coverUrl: 'https://img.xibook.info/upload/book/20230812/1691827726_64d73c1e42fbe.jpg',
        author: '风青阳'
      },
      {
        id: '8',
        title: '千朵桃花一处开',
        coverUrl: 'https://img.xibook.info/upload/book/20230812/1691827726_64d73c1e42fbe.jpg',
        author: '叶笑'
      },
      {
        id: '9',
        title: '十日终焉',
        coverUrl: 'https://img.xibook.info/upload/book/20230812/1691827726_64d73c1e42fbe.jpg',
        author: '青丘白玉'
      },
      {
        id: '10',
        title: '全球冰封',
        coverUrl: 'https://img.xibook.info/upload/book/20230812/1691827726_64d73c1e42fbe.jpg',
        author: '末日游戏'
      }
    ],
    readingProgress: {}
  },

  onLaunch() {
    // 设置请求拦截器
    this.setupRequestInterceptor();
    
    // 加载用户数据
    this.loadUserData();

    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 检查登录状态
    this.checkLoginStatus();

    // 在控制台输出当前使用的API基础URL
    console.log('当前API基础URL:', this.globalData.baseUrl);
  },

  // 设置请求拦截器
  setupRequestInterceptor() {
    // 保存原始的 wx.request 方法
    const originalRequest = wx.request;
    const app = this;
    
    // 重写 wx.request 方法
    Object.defineProperty(wx, 'request', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: (options) => {
        // 获取本地存储的 token
        const token = wx.getStorageSync('token');
        const hasUserInfo = wx.getStorageSync('userInfo');
        
        // 如果有 token，添加到请求头（确保只添加一次）
        if (token) {
          // 确保 header 对象存在
          options.header = options.header || {};
          
          // 检查请求头中是否已经包含了 token，仅在没有时添加
          if (!options.header['token']) {
            options.header['token'] = token;
          }
        }
        
        // 保存原始的 success 回调
        const originalSuccess = options.success;
        
        // 重写 success 回调函数，添加 token 过期检测
        options.success = function(res) {
          // 检查HTTP状态码是否为401或响应内容是否表明token过期
          if (res.statusCode === 401 || 
              (res.data && (res.data.code === 401 || 
              res.data.message === 'token已过期' || 
              res.data.message === 'token验证失败' || 
              res.data.message === '未登录'))) {
            
            // 只有当之前有token和用户信息，才认为是"登录已过期"
            if (token && hasUserInfo) {
              console.log('Token 已过期，正在清除登录状态...', res);
              
              // 调用应用的退出登录方法
              app.handleTokenExpired();
              
              // 提示用户
              wx.showToast({
                title: '登录已过期，请重新登录',
                icon: 'none',
                duration: 2000
              });
            } else if (options.requiresAuth !== false) {
              // 未登录，但尝试访问需要授权的接口
              console.log('未登录，请求被拒绝', res);
            }
          }
          
          // 调用原始的 success 回调
          if (originalSuccess) {
            originalSuccess(res);
          }
        };
        
        // 调用原始的 request 方法
        return originalRequest(options);
      }
    });
  },
  
  // 加载用户数据
  loadUserData() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.globalData.userInfo = userInfo;
      }
    } catch (e) {
      console.error('加载用户数据失败', e);
    }
  },

  saveBooks() {
    wx.setStorageSync('books', this.globalData.books);
  },

  // 登录方法
  login(code) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.baseUrl + '/user/login',
        method: 'POST',
        data: {
          code: code
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.code === 0) {
            // 保存 token
            wx.setStorageSync('token', res.data.data.token);
            
            // 更新全局状态
            this.globalData.isLoggedIn = true;
            this.globalData.userInfo = res.data.data.userInfo;
            
            // 保存用户信息
            wx.setStorageSync('userInfo', res.data.data.userInfo);
            
            resolve(res.data.data);
          } else {
            wx.showToast({
              title: res.data.message || '登录失败',
              icon: 'none'
            });
            reject(res.data);
          }
        },
        fail: (err) => {
          wx.showToast({
            title: '网络错误',
            icon: 'none'
          });
          reject(err);
        }
      });
    });
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.isLoggedIn = true;
      return true;
    } else {
      this.globalData.isLoggedIn = false;
      return false;
    }
  },

  // 退出登录
  logout() {
    // 清除本地存储的 token 和用户信息
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    
    // 更新全局状态
    this.globalData.isLoggedIn = false;
    this.globalData.userInfo = null;
  },

  handleTokenExpired() {
    // 实现退出登录的逻辑
    this.logout();
    
    // 获取当前页面
    const pages = getCurrentPages();
    if (pages.length > 0) {
      // 检查并调用每个页面的 onTokenExpired 方法（如果存在）
      pages.forEach(page => {
        if (page && typeof page.onTokenExpired === 'function') {
          page.onTokenExpired();
        }
      });
      
      // 如果当前不在"我的"页面，可以考虑跳转到登录页面
      const currentPage = pages[pages.length - 1];
      if (currentPage.route !== 'pages/mine/mine') {
        // 根据实际需求决定是否跳转
        wx.switchTab({
          url: '/pages/mine/mine'
        });
      }
    }
  }
})
