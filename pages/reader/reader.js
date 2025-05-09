const app = getApp();

Page({
  data: {
    bookId: '',
    bookTitle: '',
    contentType: 'text', // 'text', 'audio', 'video', 'collection'
    chapter: {
      title: '',
      content: ''
    },
    chapters: [],
    currentChapter: 1,
    totalChapters: 1,
    fontSize: 36,
    theme: 'light',
    showControls: false,
    showFontPanel: false,
    showCatalog: false,
    progress: 0,
    isPlaying: false,
    currentTime: '00:00',
    duration: '00:00',
    collection: []
  },

  onLoad(options) {
    const { id, chapter } = options;
    this.setData({
      bookId: id,
      currentChapter: parseInt(chapter) || 1
    });

    // 获取图书信息
    this.fetchBookInfo(id);
  },

  fetchBookInfo(bookId) {
    wx.showLoading({
      title: '加载中...',
    });

    // 获取token
    const token = wx.getStorageSync('token');

    if (!token) {
      wx.hideLoading();
      console.log('No token available, not sending request');
      
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

    wx.request({
      url: `${app.globalData.baseUrl}/book/get/${bookId}`,
      method: 'GET',
      header: {
        'content-type': 'application/json',
        'token': token
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.statusCode === 200 && res.data.code === 200) {
          const bookData = res.data.data;
          
          // 设置书籍标题
          this.setData({
            bookTitle: bookData.name
          });

          // 判断内容类型
          if (bookData.series === true) {
            // 这是一个图书集合
            if (bookData.sonBooks && bookData.sonBooks.length > 0) {
              // 处理子书籍集合
              this.handleCollectionBook(bookData);
            } else if (bookData.contents && bookData.contents.length > 0) {
              // 处理内容集合（当series为true但sonBooks为空时）
              this.handleSeriesContents(bookData.contents);
            } else {
              wx.showToast({
                title: '该书暂无内容',
                icon: 'none'
              });
            }
          } else if (bookData.contents && bookData.contents.length > 0) {
            // 处理图书内容
            this.handleBookContents(bookData.contents);
          } else {
            wx.showToast({
              title: '该书暂无内容',
              icon: 'none'
            });
          }
        } else {
          console.error('API返回错误:', res.data);
          wx.showToast({
            title: res.data.message || '获取图书信息失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
        console.error('获取图书信息失败:', err);
      }
    });
  },

  handleCollectionBook(bookData) {
    // 处理图书集合
    const collection = bookData.sonBooks.map(book => ({
      id: book.id,
      title: book.name,
      cover: book.coverPath || '/images/default-cover.png'
    }));

    this.setData({
      contentType: 'collection',
      collection: collection
    });
  },

  handleSeriesContents(contents) {
    // 当series=true但sonBooks为空时，将contents内容作为集合展示
    const collection = contents.map(content => ({
      id: content.id,
      title: content.name,
      cover: content.coverPath || '/images/default-cover.png',
      type: content.type,
      url: content.filePath,
      richText: content.richText
    }));

    this.setData({
      contentType: 'collection',
      collection: collection
    });
  },

  handleBookContents(contents) {
    // 所有类型的内容都先以列表形式展示
    const collection = contents.map(content => ({
      id: content.id,
      title: content.name,
      cover: content.coverPath || '/images/default-cover.png',
      type: content.type,
      url: content.filePath,
      richText: content.richText
    }));

    this.setData({
      contentType: 'collection',
      collection: collection,
      // 保存章节信息以供后续使用
      chapters: contents.map((content, index) => ({
        id: content.id,
        title: content.name,
        url: content.filePath,
        type: content.type,
        content: content.richText
      })),
      totalChapters: contents.length
    });
  },

  loadTextChapter(chapterIndex) {
    if (chapterIndex < 1 || chapterIndex > this.data.chapters.length) {
      wx.showToast({
        title: '没有更多章节了',
        icon: 'none'
      });
      return;
    }

    const chapter = this.data.chapters[chapterIndex - 1];
    this.setData({
      currentChapter: chapterIndex,
      chapter: {
        title: chapter.title,
        content: chapter.content,
        richText: chapter.richText
      },
      progress: (chapterIndex / this.data.totalChapters) * 100
    });

    // 设置导航栏标题为章节标题
    wx.setNavigationBarTitle({
      title: chapter.title || '阅读'
    });

    // 保存阅读进度
    this.saveReadingProgress();
  },

  loadAudioChapter(chapterIndex) {
    if (chapterIndex < 1 || chapterIndex > this.data.chapters.length) {
      wx.showToast({
        title: '没有更多章节了',
        icon: 'none'
      });
      return;
    }

    const chapter = this.data.chapters[chapterIndex - 1];
    
    // 停止当前播放的音频
    if (this.audioContext) {
      this.audioContext.stop();
      this.audioContext = null;
    }

    console.log('Setting audio chapter:', chapter);
    
    // 更新章节信息，直接传递URL给audio-reader组件
    this.setData({
      currentChapter: chapterIndex,
      chapter: {
        title: chapter.title,
        filePath: chapter.url  // 确保将URL设置为filePath
      },
      isPlaying: true  // 自动开始播放
    });

    // 设置导航栏标题为章节标题
    wx.setNavigationBarTitle({
      title: chapter.title || '阅读'
    });

    // 获取audio-reader组件实例
    setTimeout(() => {
      const audioReader = this.selectComponent('audio-reader') || this.selectComponent('#audio-reader');
      if (audioReader) {
        console.log('Audio reader component found, trying to play');
        // 使用组件的方法设置URL并播放
        audioReader.setUrl(chapter.url, chapter.title);
      } else {
        console.log('Audio reader component not found, trying with ID selector');
        const audioReaderById = this.selectComponent('#audio-reader');
        if (audioReaderById) {
          console.log('Audio reader found by ID, trying to play');
          audioReaderById.setUrl(chapter.url, chapter.title);
        } else {
          console.error('Audio reader component not found with any selector');
        }
      }
    }, 300);

    // 保存阅读进度
    this.saveReadingProgress();
  },

  loadVideoChapter(chapterIndex) {
    if (chapterIndex < 1 || chapterIndex > this.data.chapters.length) {
      wx.showToast({
        title: '没有更多章节了',
        icon: 'none'
      });
      return;
    }

    const chapter = this.data.chapters[chapterIndex - 1];
    
    // 获取视频上下文
    this.videoContext = wx.createVideoContext('reader-video');
    
    this.setData({
      currentChapter: chapterIndex,
      chapter: {
        title: chapter.title
      },
      videoUrl: chapter.url
    });

    // 设置导航栏标题为章节标题
    wx.setNavigationBarTitle({
      title: chapter.title || '阅读'
    });

    // 保存阅读进度
    this.saveReadingProgress();
  },

  onVideoReady() {
    // 视频准备就绪
    this.videoContext.play();
    this.setData({ isPlaying: true });
  },

  onVideoLoaded() {
    // 视频加载完成，确保隐藏全局加载提示
    wx.hideLoading();
  },
  
  onVideoRotateChange(e) {
    // 视频旋转状态变化
    console.log('视频旋转状态:', e.detail.isRotated ? '已旋转' : '正常');
  },

  formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  },

  toggleControls() {
    this.setData({
      showControls: !this.data.showControls,
      showFontPanel: false
    });
  },

  togglePlay() {
    if (this.data.contentType === 'audio') {
      console.log('触发播放/暂停切换，当前状态:', this.data.isPlaying ? '播放中' : '已暂停');
      
      // 获取audio-reader组件实例
      const audioReader = this.selectComponent('#audio-reader');
      if (audioReader) {
        console.log('找到音频组件，切换播放状态');
        
        // 反转播放状态
        const newPlayState = !this.data.isPlaying;
        
        // 直接调用组件的onPlayTap方法模拟按钮点击
        audioReader.onPlayTap();
        
        // 我们依赖组件通过statusUpdate事件来更新isPlaying状态
        console.log('播放状态切换请求已发送');
      } else {
        console.error('未找到音频组件，无法控制播放');
        wx.showToast({
          title: '播放器加载中...',
          icon: 'none'
        });
      }
    } else if (this.data.contentType === 'video') {
      if (this.data.isPlaying) {
        this.videoContext.pause();
        this.setData({ isPlaying: false });
      } else {
        this.videoContext.play();
        this.setData({ isPlaying: true });
      }
    }
  },

  prevChapter() {
    const prevChapter = this.data.currentChapter - 1;
    
    if (this.data.contentType === 'text') {
      this.loadTextChapter(prevChapter);
    } else if (this.data.contentType === 'audio') {
      this.loadAudioChapter(prevChapter);
    } else if (this.data.contentType === 'video') {
      this.loadVideoChapter(prevChapter);
    }
  },

  nextChapter() {
    const nextChapter = this.data.currentChapter + 1;
    
    if (this.data.contentType === 'text') {
      this.loadTextChapter(nextChapter);
    } else if (this.data.contentType === 'audio') {
      this.loadAudioChapter(nextChapter);
    } else if (this.data.contentType === 'video') {
      this.loadVideoChapter(nextChapter);
    }
  },

  toggleTheme() {
    this.setData({
      theme: this.data.theme === 'light' ? 'night' : 'light'
    });
  },

  toggleFontPanel() {
    this.setData({
      showFontPanel: !this.data.showFontPanel
    });
  },

  increaseFontSize() {
    if (this.data.fontSize < 48) {
      this.setData({
        fontSize: this.data.fontSize + 2
      });
    }
  },

  decreaseFontSize() {
    if (this.data.fontSize > 28) {
      this.setData({
        fontSize: this.data.fontSize - 2
      });
    }
  },

  showMenu() {
    this.setData({
      showCatalog: true
    });
  },

  hideCatalog() {
    this.setData({
      showCatalog: false
    });
  },

  jumpToChapter(e) {
    const chapter = e.currentTarget.dataset.chapter;
    
    if (this.data.contentType === 'text') {
      this.loadTextChapter(chapter);
    } else if (this.data.contentType === 'audio') {
      this.loadAudioChapter(chapter);
    } else if (this.data.contentType === 'video') {
      this.loadVideoChapter(chapter);
    }
    
    this.setData({
      showCatalog: false
    });
  },

  onProgressChange(e) {
    const value = e.detail.value;
    
    if (this.data.contentType === 'text') {
      // 文本内容的进度条表示章节
      const chapter = Math.ceil((value / 100) * this.data.totalChapters);
      this.loadTextChapter(chapter);
    } else if (this.data.contentType === 'audio') {
      // 音频内容的进度条表示播放进度
      // 获取audio-reader组件实例
      const audioReader = this.selectComponent('#audio-reader');
      if (audioReader) {
        console.log('Progress change handled by audio-reader component');
        // 组件内部会处理进度条变化事件
      } else {
        console.error('Audio reader component not found for progress change');
      }
    } else if (this.data.contentType === 'video') {
      // 视频内容的进度条表示播放进度
      const seekTime = (value / 100) * this.videoContext.duration;
      this.videoContext.seek(seekTime);
    }
  },

  onScroll(e) {
    // 滚动时隐藏控制面板
    if (this.data.showControls) {
      this.setData({
        showControls: false,
        showFontPanel: false
      });
    }
  },

  saveReadingProgress() {
    // 保存阅读进度到全局数据
    if (!app.globalData.readingProgress) {
      app.globalData.readingProgress = {};
    }
    
    app.globalData.readingProgress[this.data.bookId] = {
      chapter: this.data.currentChapter,
      timestamp: new Date().getTime()
    };
    
    // 也可以保存到本地存储
    wx.setStorage({
      key: `reading_progress_${this.data.bookId}`,
      data: {
        chapter: this.data.currentChapter,
        timestamp: new Date().getTime()
      }
    });
  },

  openBook(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/reader/reader?id=${bookId}&chapter=1`
    });
  },

  onBookTap(e) {
    const itemId = e.detail.id;
    
    // 找到对应的内容项
    const contentItem = this.data.collection.find(item => item.id === itemId);
    
    if (contentItem) {
      if (contentItem.type === 1) { // 视频
        // 设置为视频模式
        this.setData({
          contentType: 'video',
          videoUrl: contentItem.url,
          chapter: {
            title: contentItem.title
          }
        });
      } else if (contentItem.type === 2) { // 音频
        // 设置为音频模式，并通过chapter属性传递音频URL和标题
        this.setData({
          contentType: 'audio',
          chapter: {
            title: contentItem.title,
            filePath: contentItem.url  // 重要：将URL设置为filePath
          },
          isPlaying: true  // 设置为播放状态
        });
        
        // 通过setTimeout确保组件已挂载
        setTimeout(() => {
          // 获取audio-reader组件实例
          const audioReader = this.selectComponent('audio-reader') || this.selectComponent('#audio-reader');
          if (audioReader) {
            console.log('Audio reader component found, trying to play');
            // 使用组件的方法设置URL并播放
            audioReader.setUrl(contentItem.url, contentItem.title);
          } else {
            console.error('Audio reader component not found with any selector');
          }
        }, 300);
      } else if (contentItem.type === 3) { // 富文本
        // 设置为文本模式
        this.setData({
          contentType: 'text',
          chapter: {
            title: contentItem.title,
            content: contentItem.richText,
            richText: contentItem.richText
          }
        });
      } else {
        // 如果是普通图书，导航到该图书
        wx.navigateTo({
          url: `/pages/reader/reader?id=${itemId}&chapter=1`
        });
      }
      
      // 设置导航栏标题
      wx.setNavigationBarTitle({
        title: contentItem.title || '阅读'
      });
    }
  },

  goBack() {
    wx.navigateBack();
  },

  onUnload() {
    // 页面卸载时释放资源
    console.log('Reader page unloading, cleaning up resources');
    
    // 获取音频组件并停止播放
    if (this.data.contentType === 'audio') {
      const audioReader = this.selectComponent('audio-reader') || this.selectComponent('#audio-reader');
      if (audioReader) {
        console.log('Stopping audio reader component');
        // 调用组件的pause方法
        this.setData({ isPlaying: false });
      }
    }
    
    // 释放可能存在的直接音频资源
    if (this.audioContext) {
      console.log('Cleaning up direct audio context');
      this.audioContext.stop();
      this.audioContext.destroy();
      this.audioContext = null;
    }
    
    if (this.videoContext) {
      console.log('Cleaning up video context');
      this.videoContext = null;
    }
  },
  
  // 处理音频时间更新事件
  onAudioTimeUpdate(e) {
    // 更新页面上的时间和进度数据
    this.setData({
      currentTime: e.detail.currentTime,
      duration: e.detail.duration,
      progress: e.detail.progress
    });
  },
  
  // 处理音频状态更新事件
  onAudioStatusUpdate(e) {
    console.log('收到音频状态更新:', e.detail);
    
    // 使用 wx.nextTick 确保状态更新完成
    wx.nextTick(() => {
      // 更新播放状态
      this.setData({
        isPlaying: e.detail.isPlaying
      });
      console.log('页面播放状态已更新为:', e.detail.isPlaying ? '播放' : '暂停');
    });
  },
  
  // 处理音频错误事件
  onAudioError(e) {
    console.error('Audio error:', e.detail);
    wx.showToast({
      title: '音频播放失败: ' + (e.detail.errMsg || '未知错误'),
      icon: 'none'
    });
  },

  // 直接控制音频播放/暂停
  directAudioControl() {
    console.log('执行直接音频控制');
    
    // 获取音频组件
    const audioReader = this.selectComponent('#audio-reader');
    if (!audioReader) {
      console.error('无法获取音频组件');
      wx.showToast({
        title: '无法控制音频',
        icon: 'none'
      });
      return;
    }
    
    // 切换播放状态
    const newState = !this.data.isPlaying;
    console.log('尝试直接将音频状态切换为:', newState ? '播放' : '暂停');
    
    if (newState) {
      // 播放
      audioReader.play();
    } else {
      // 暂停
      audioReader.pause();
    }
    
    // 状态会通过事件更新，不需要在这里设置
    console.log('已发送音频控制命令:', newState ? '播放' : '暂停');
  },
}); 