const app = getApp();

// 导入音频管理器
const audioManager = require('../../utils/audioManager');

Page({
  data: {
    bookId: '',
    bookTitle: '',
    bookCover: '',
    bookAgeRange: '',
    bookLanguage: '',
    bookType: '',
    contentType: 'list', // 'text', 'audio', 'video', 'collection', 'list'
    activeTab: 'audio', // Default tab
    audioList: [],
    videoList: [],
    audioLoading: false,
    videoLoading: false,
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
          console.log('Book data received:', bookData);
          
          // 设置书籍详情
          this.setData({
            bookTitle: bookData.name,
            bookCover: bookData.coverPath || '/images/default-cover.png',
            bookAgeRange: bookData.ageRange || '',
            bookLanguage: bookData.language || '',
            bookType: bookData.type || ''
          });

          // 判断内容类型
          if (bookData.series === true) {
            // 这是一个图书集合
            if (bookData.sonBooks && bookData.sonBooks.length > 0) {
              // 处理子书籍集合
              this.handleCollectionBook(bookData);
            } else if (bookData.contents && bookData.contents.length > 0) {
              // 处理内容集合（当series为true但sonBooks为空时）
              this.processContents(bookData.contents);
            } else {
              wx.showToast({
                title: '该书暂无内容',
                icon: 'none'
              });
            }
          } else if (bookData.contents && bookData.contents.length > 0) {
            // 处理图书内容
            this.processContents(bookData.contents);
          } else {
            // 如果没有直接返回内容，则请求单独的内容API
            this.fetchAudioList();
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
      if (this.audioContext) {
        if (this.data.isPlaying) {
          this.audioContext.pause();
        } else {
          this.audioContext.play();
        }
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
    // 不再需要手动销毁音频上下文
    // 由audioManager负责管理
    this.audioContext = null;
    
    // 保存阅读进度
    this.saveReadingProgress();
    
    // 停止背景音频播放器
    const innerAudioContext = getApp().globalData.innerAudioContext;
    if (innerAudioContext) {
      innerAudioContext.stop();
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

  // 新增方法：获取音频列表
  fetchAudioList() {
    wx.showLoading({
      title: '加载中...',
    });

    const token = wx.getStorageSync('token');
    if (!token) {
      wx.hideLoading();
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    wx.request({
      url: `${app.globalData.baseUrl}/book/content/list`,
      method: 'GET',
      data: {
        bookId: this.data.bookId,
        type: 'audio'
      },
      header: {
        'content-type': 'application/json',
        'token': token
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.statusCode === 200 && res.data.code === 200) {
          const audioList = res.data.data.map(content => ({
            id: content.id,
            title: content.name,
            cover: content.coverPath || '/images/default-cover.png',
            type: 'audio',
            url: content.filePath,
            richText: content.richText,
            playCount: content.playCount || 0
          }));
          
          console.log('Fetched audio list:', audioList.length, 'items');
          
          // 保存到全局状态
          app.globalData.audioList = audioList;
          app.globalData.currentBookId = this.data.bookId;
          console.log('Saved audio list to global state:', audioList.length, 'items for book', this.data.bookId);
          
          // 更新本地数据状态
          this.setData({
            audioList,
            activeTab: 'audio',
            contentType: audioList.length > 0 ? 'list' : 'text'
          });
        } else {
          console.error('Failed to fetch audio list:', res);
          wx.showToast({
            title: '获取音频列表失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('Network error when fetching audio list:', err);
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      }
    });
  },

  // 新增方法：获取视频列表
  fetchVideoList() {
    const token = wx.getStorageSync('token');
    if (!token) return;

    this.setData({ videoLoading: true });
    
    wx.request({
      url: `${app.globalData.baseUrl}/book/content/list`,
      method: 'GET',
      data: {
        bookId: this.data.bookId,
        type: 'video'  // 指定获取视频类型内容
      },
      header: {
        'content-type': 'application/json',
        'token': token
      },
      success: (res) => {
        this.setData({ videoLoading: false });
        
        if (res.statusCode === 200 && res.data.code === 200) {
          const videoList = res.data.data.map(item => ({
            id: item.id,
            title: item.name,
            cover: item.coverPath || '/images/default-cover.png',
            type: 'video',
            url: item.filePath,
            richText: item.richText,
            playCount: item.playCount || 0
          }));
          
          this.setData({ videoList });
        } else {
          wx.showToast({
            title: res.data.message || '获取视频列表失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        this.setData({ videoLoading: false });
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      }
    });
  },

  // 修改标签切换方法，加载对应内容
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ 
      activeTab: tab,
      contentType: 'list'  // 确保切换标签时内容类型为列表模式
    });
    
    // 根据标签类型获取对应内容
    if (tab === 'audio' && this.data.audioList.length === 0) {
      this.fetchAudioList();
    } else if (tab === 'video' && this.data.videoList.length === 0) {
      this.fetchVideoList();
    }
  },

  // 新增方法：播放音频
  playAudio(e) {
    const index = e.currentTarget.dataset.index;
    const audio = this.data.audioList[index];
    
    if (!audio) return;
    
    // 导航到音频播放页面，传递必要参数
    wx.navigateTo({
      url: `/pages/reader/play?id=${audio.id}&type=audio&title=${encodeURIComponent(audio.title)}&url=${encodeURIComponent(audio.url)}&bookId=${this.data.bookId}`
    });
  },

  // 新增方法：播放视频
  playVideo(e) {
    const index = e.currentTarget.dataset.index;
    const video = this.data.videoList[index];
    
    if (!video) return;
    
    // 导航到视频播放页面，传递必要参数
    wx.navigateTo({
      url: `/pages/reader/play?id=${video.id}&type=video&title=${encodeURIComponent(video.title)}&url=${encodeURIComponent(video.url)}&bookId=${this.data.bookId}`
    });
  },

  // 辅助方法：加载音频播放器
  loadAudioPlayer(audioUrl) {
    // 使用音频管理器创建音频上下文
    const audioContext = audioManager.createAudio(audioUrl, {
      autoplay: true
    });
    
    // 设置音频事件监听
    audioContext.onPlay(() => {
      this.setData({ isPlaying: true });
    });
    
    audioContext.onPause(() => {
      this.setData({ isPlaying: false });
    });
    
    audioContext.onTimeUpdate(() => {
      const currentTime = this.formatTime(audioContext.currentTime);
      const duration = this.formatTime(audioContext.duration);
      const progress = audioContext.duration > 0 
        ? (audioContext.currentTime / audioContext.duration) * 100 
        : 0;
        
      this.setData({ 
        currentTime, 
        duration, 
        progress 
      });
    });
    
    audioContext.onError((err) => {
      console.error('音频播放错误:', err);
      wx.showToast({
        title: '音频播放失败',
        icon: 'none'
      });
    });
    
    // 保存音频上下文以便后续控制
    this.audioContext = audioContext;
  },

  // 新增方法：处理内容数据
  processContents(contents) {
    if (!contents || contents.length === 0) return;
    
    console.log('Processing contents:', contents);
    
    // 按类型分类内容
    const audioList = contents.filter(content => content.type === 2).map(content => ({
      id: content.id,
      title: content.name,
      cover: content.coverPath || '/images/default-cover.png',
      type: 'audio',
      url: content.filePath,
      richText: content.richText,
      playCount: content.playCount || 0
    }));
    
    const videoList = contents.filter(content => content.type === 1).map(content => ({
      id: content.id,
      title: content.name,
      cover: content.coverPath || '/images/default-cover.png',
      type: 'video',
      url: content.filePath,
      richText: content.richText,
      playCount: content.playCount || 0
    }));
    
    console.log('Processed audio list:', audioList.length, 'items');
    console.log('Processed video list:', videoList.length, 'items');

    // 保存到全局状态
    const app = getApp();
    app.globalData.audioList = audioList;
    app.globalData.currentBookId = this.data.bookId;
    console.log('Saved audio list to global state:', audioList.length, 'items for book', this.data.bookId);

    // 默认使用的内容类型
    let defaultContentType = 'text';
    let defaultActiveTab = 'audio';
    
    // 如果有音频内容，默认选中音频标签
    if (audioList.length > 0) {
      defaultContentType = 'list'; // 使用新的内容类型表示列表模式
      defaultActiveTab = 'audio';
    } 
    // 否则，如果有视频内容，选中视频标签
    else if (videoList.length > 0) {
      defaultContentType = 'list'; // 使用新的内容类型表示列表模式
      defaultActiveTab = 'video';
    }

    // 更新数据
    this.setData({
      audioList,
      videoList,
      // 保存章节信息以供后续使用
      chapters: contents.map((content, index) => ({
        id: content.id,
        title: content.name,
        url: content.filePath,
        type: content.type,
        content: content.richText
      })),
      totalChapters: contents.length,
      activeTab: defaultActiveTab,
      contentType: defaultContentType
    }, () => {
      console.log('Data updated, audio list has', this.data.audioList.length, 'items');
      console.log('Data updated, video list has', this.data.videoList.length, 'items');
      console.log('Current activeTab:', this.data.activeTab);
      console.log('Current contentType:', this.data.contentType);
    });
  },
}); 