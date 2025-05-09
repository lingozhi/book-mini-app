/**
 * 网络请求工具类
 */
const app = getApp();

const request = {
  /**
   * 发送GET请求
   * @param {string} url - 请求地址
   * @param {Object} data - 请求参数
   * @param {boolean} showLoading - 是否显示加载提示
   * @param {string} token - 认证令牌
   * @param {boolean} requiresAuth - 是否需要认证
   * @returns {Promise} - 返回Promise对象
   */
  get(url, data = {}, showLoading = true, token, requiresAuth = true) {
    return this.request('GET', url, data, showLoading, token, null, requiresAuth);
  },

  /**
   * 发送POST请求
   * @param {string} url - 请求地址
   * @param {Object} data - 请求参数
   * @param {boolean} showLoading - 是否显示加载提示
   * @param {string} token - 认证令牌
   * @param {Object} customHeader - 自定义请求头
   * @param {boolean} requiresAuth - 是否需要认证
   * @returns {Promise} - 返回Promise对象
   */
  post(url, data = {}, showLoading = true, token, customHeader, requiresAuth = true) {
    return this.request('POST', url, data, showLoading, token, customHeader, requiresAuth);
  },

  /**
   * 发送请求
   * @param {string} method - 请求方法
   * @param {string} url - 请求地址
   * @param {Object} data - 请求参数
   * @param {boolean} showLoading - 是否显示加载提示
   * @param {string} token - 认证令牌
   * @param {Object} customHeader - 自定义请求头
   * @param {boolean} requiresAuth - 是否需要认证
   * @returns {Promise} - 返回Promise对象
   */
  request(method, url, data, showLoading, token, customHeader, requiresAuth = true) {
    // 检查是否需要认证，以及是否有 token
    const storedToken = token || wx.getStorageSync('token');
    if (requiresAuth && !storedToken) {
      // 如果需要认证但没有token，直接拒绝请求
      return Promise.reject({
        message: '请先登录'
      });
    }

    // 显示加载提示
    if (showLoading) {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });
    }

    // 完整URL
    const fullUrl = url.startsWith('http') ? url : app.globalData.baseUrl + url;

    // 准备请求头
    let header = {
      'content-type': 'application/json'
    };

    // 如果提供了token，添加到请求头，但只添加一次
    if (storedToken) {
      // 只使用一种请求头格式，避免重复
      header['token'] = storedToken;
    }

    // Merge with custom headers if provided
    if (customHeader) {
      header = {...header, ...customHeader};
    }

    // 返回Promise对象
    return new Promise((resolve, reject) => {
      wx.request({
        url: fullUrl,
        method: method,
        data: data,
        header: header,
        success: (res) => {
          console.log('Response status:', res.statusCode);
          console.log('Response data:', res.data);
          
          // 请求成功
          if (res.statusCode === 200) {
            // 业务逻辑成功
            if (res.data.code === 200) {
              resolve(res.data);
            } else {
              // 业务逻辑失败
              reject(res.data);
              // 显示错误信息
              wx.showToast({
                title: res.data.message || '请求失败',
                icon: 'none'
              });
              
              // 如果是401错误，可能是token过期
              if (res.data.errorCode === "401") {
                handleTokenExpired();
              }
            }
          } else if (res.statusCode === 401) {
            // 未授权，可能是token无效或过期
            console.error('未授权访问，可能是token无效:', res);
            handleTokenExpired();
            reject(res.data);
          } else {
            // HTTP请求失败
            reject(res);
            // 显示错误信息
            wx.showToast({
              title: `请求失败(${res.statusCode})`,
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          // 请求失败
          console.error('请求失败:', err);
          reject(err);
          // 显示错误信息
          wx.showToast({
            title: '网络错误',
            icon: 'none'
          });
        },
        complete: () => {
          // 隐藏加载提示
          if (showLoading) {
            wx.hideLoading();
          }
        }
      });
    });
  }
};

// 处理 token 过期
const handleTokenExpired = () => {
  // 清除本地存储的 token
  wx.removeStorageSync('token');
  
  // 更新全局状态
  app.globalData.isLoggedIn = false;
  app.globalData.userInfo = null;
  
  // 提示用户
  wx.showToast({
    title: '登录已过期，请重新登录',
    icon: 'none',
    duration: 2000
  });
  
  // 延迟跳转到登录页面
  setTimeout(() => {
    wx.navigateTo({
      url: '/pages/mine/mine'
    });
  }, 2000);
};

module.exports = request; 