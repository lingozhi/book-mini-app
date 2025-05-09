Page({
  data: {
    title: '',
    content: ''
  },

  onLoad(options) {
    const type = options.type;
    let title = '';
    let content = '';

    if (type === 'service') {
      title = '用户服务协议';
      content = this.getServiceContent();
    } else if (type === 'privacy') {
      title = '隐私协议';
      content = this.getPrivacyContent();
    }

    this.setData({
      title,
      content
    });

    wx.setNavigationBarTitle({
      title: title
    });
  },

  getServiceContent() {
    return `
一、服务协议的范围
1.1 本协议是用户与本应用之间关于用户使用本应用服务所订立的协议。

二、服务内容
2.1 本应用为用户提供以下服务：
- 免费的小说阅读服务
- 书籍收藏功能
- 阅读进度同步

三、用户行为规范
3.1 用户在使用本服务时必须遵守中华人民共和国相关法律法规。
3.2 用户不得利用本服务从事违法违规行为。

四、知识产权
4.1 本应用提供的服务中包含的所有内容均受版权法等法律法规保护。
    `;
  },

  getPrivacyContent() {
    return `
一、信息收集
1.1 我们收集的信息包括：
- 用户注册信息
- 阅读历史记录
- 设备信息

二、信息使用
2.1 我们使用收集的信息用于：
- 提供和改进服务
- 个性化用户体验
- 保障账号安全

三、信息保护
3.1 我们采取严格的数据保护措施，保护用户隐私安全。
3.2 未经用户同意，我们不会向第三方分享用户个人信息。
    `;
  }
});