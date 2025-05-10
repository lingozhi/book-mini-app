const app = getApp();
const request = require('../../utils/request');

Page({
  data: {
    books: [],
    loading: false,
    pageIndex: 1,
    pageSize: 10,
    hasMore: true
  },

  onLoad() {
    this.fetchBooks();
  },

  onShow() {
    // 每次显示页面时刷新书架数据
    this.fetchBooks(true);
  },

  fetchBooks(refresh = false) {
    if (refresh) {
      this.setData({
        pageIndex: 1,
        hasMore: true
      });
    }
    
    if (!this.data.hasMore || this.data.loading) return;
    
    this.setData({ loading: true });
    
    // 获取token
    const token = wx.getStorageSync('token');
    
    if (!token) {
      console.log('No token available, not sending request');
      this.setData({ 
        loading: false,
        books: [] 
      });
      
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/mine/mine'
        });
      }, 2000);
      
      return;
    }
    
    // 使用 request 工具发送请求
    request.post('/user-book/list', {
      pageIndex: this.data.pageIndex,
      pageSize: this.data.pageSize
    }, true, token)
      .then(res => {
        if (res.data && res.data.list) {
          const newBooks = res.data.list.map(book => ({
            id: book.id,
            title: book.name,
            author: book.author,
            coverUrl: book.coverPath,
            illustrator: book.illustrator,
            isbn: book.isbn
          }));
          
          this.setData({
            books: refresh ? newBooks : [...this.data.books, ...newBooks],
            pageIndex: this.data.pageIndex + 1,
            hasMore: newBooks.length === this.data.pageSize
          });
        } else {
          this.setData({
            hasMore: false
          });
        }
      })
      .catch(err => {
        console.error('获取书籍列表失败', err);
        if (err.errorCode === "401") {
          // Token 过期处理已在 request 工具中完成
        } else {
          wx.showToast({
            title: err.message || '获取书籍列表失败',
            icon: 'none'
          });
        }
      })
      .finally(() => {
        this.setData({ loading: false });
        wx.stopPullDownRefresh();
      });
  },

  onBookTap(e) {
    const bookId = e.currentTarget.dataset.id;
    const progress = app.globalData.readingProgress[bookId] || {};
    
    wx.navigateTo({
      url: `/pages/reader/reader?id=${bookId}&chapter=${progress.chapter || 1}`
    });
  },

  onAddTap() {
    wx.navigateTo({
      url: '/pages/scan/scan'
    });
  },
  
  onPullDownRefresh() {
    this.fetchBooks(true);
  },
  
  onReachBottom() {
    this.fetchBooks();
  }
}); 