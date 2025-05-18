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
    collection: [],
    durationDetectorUrl: '',
    durationDetectorVisible: false,
    thumbnailVideoUrl: '',
    thumbnailVideoIndex: undefined,
    thumbnailVideoVisible: false,
    headerStyle: '',
    statusBarHeight: 0
  },

  onLoad(options) {
    const { id, chapter } = options;
    this.setData({
      bookId: id,
      currentChapter: parseInt(chapter) || 1
    });

    // 自定义导航栏样式，让内容延伸到导航栏下方
    wx.getSystemInfo({
      success: (res) => {
        const statusBarHeight = res.statusBarHeight;
        this.setData({
          statusBarHeight: statusBarHeight
        });
      }
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
          console.log('Book cover path from API:', bookData.coverPath);
          
          const coverUrl = bookData.coverPath || '/images/default-cover.png';
          
          // 设置书籍详情
          this.setData({
            bookTitle: bookData.name,
            bookCover: coverUrl,
            bookAgeRange: bookData.ageRange || '',
            bookLanguage: bookData.language || '',
            bookType: bookData.type || '',
            headerStyle: `background-image: url('${coverUrl}')`
          });

          // 打印设置后的封面
          console.log('Book cover set in data:', this.data.bookCover);

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
            // 如果没有内容，显示提示信息
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
    wx.navigateBack({
      delta: 1,
      fail: function() {
        // If navigateBack fails, navigate to the homepage
        wx.switchTab({
          url: '/pages/bookshelf/bookshelf'
        });
      }
    });
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
    
    // 清理视频检测定时器
    if (this._durationDetectorTimeout) {
      clearTimeout(this._durationDetectorTimeout);
      this._durationDetectorTimeout = null;
    }
    
    // 隐藏视频探测器
    this.setData({
      durationDetectorVisible: false
    });
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
    // 获取音频组件
    const audioReader = this.selectComponent('#audio-reader');
    if (!audioReader) return;
    
    // 切换播放状态
    const newState = !this.data.isPlaying;
    
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

  // 新增方法：从缓存获取视频缩略图
  getVideoThumbnailFromCache(videoUrl) {
    if (!videoUrl) return '';
    
    const cachedThumbnails = wx.getStorageSync('video_thumbnails') || {};
    return cachedThumbnails[videoUrl] || '';
  },
  
  // 新增方法：预加载视频缩略图
  preloadVideoThumbnails(videoList) {
    if (!videoList || videoList.length === 0) return;
    
    // 从本地缓存中获取已缓存的缩略图
    const cachedThumbnails = wx.getStorageSync('video_thumbnails') || {};
    
    // 更新有缓存的视频缩略图
    let updatedList = [...videoList];
    let needsUpdate = false;
    
    updatedList.forEach((item, index) => {
      if (cachedThumbnails[item.url] && !item.thumbnail) {
        updatedList[index].thumbnail = cachedThumbnails[item.url];
        needsUpdate = true;
      }
    });
    
    // 如果有更新，刷新列表
    if (needsUpdate) {
      this.setData({
        videoList: updatedList
      });
    }
  },

  // 新增方法：加载单个视频缩略图
  loadVideoThumbnail(index) {
    const videoList = this.data.videoList;
    if (!videoList || !videoList[index]) return;
    
    const video = videoList[index];
    
    // 如果已有缩略图，不需要重新获取
    if (video.thumbnail) return;
    
    // 从缓存中获取
    const cachedThumbnails = wx.getStorageSync('video_thumbnails') || {};
    if (cachedThumbnails[video.url]) {
      const updatedList = [...this.data.videoList];
      updatedList[index].thumbnail = cachedThumbnails[video.url];
      
      this.setData({
        videoList: updatedList
      });
      return;
    }
    
    // 设置一个临时视频元素
    this.setData({
      thumbnailVideoUrl: video.url,
      thumbnailVideoIndex: index,
      thumbnailVideoVisible: true
    });
  },
  
  // 新增方法：视频缩略图加载完成
  onThumbnailVideoLoaded(e) {
    const index = this.data.thumbnailVideoIndex;
    if (index === undefined) return;
    
    const videoList = this.data.videoList;
    if (!videoList || !videoList[index]) return;
    
    const video = videoList[index];
    
    // 获取视频实例
    const videoContext = wx.createVideoContext('thumbnail-video', this);
    videoContext.pause(); // 暂停视频
    videoContext.seek(0.1); // 跳转到0.1秒，避免黑屏
    
    // 延迟一下捕获帧，确保视频已经渲染
    setTimeout(() => {
      // 获取canvas实例
      wx.createSelectorQuery()
        .select('#thumbnail-canvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            console.error('Failed to get canvas node');
            this.setData({
              thumbnailVideoVisible: false,
              thumbnailVideoUrl: '',
              thumbnailVideoIndex: undefined
            });
            return;
          }
          
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          // 设置canvas尺寸
          canvas.width = 200;
          canvas.height = 120;
          
          // 获取视频元素节点
          wx.createSelectorQuery()
            .select('#thumbnail-video')
            .fields({ node: true, size: true, dataset: true })
            .exec((result) => {
              if (!result || !result[0] || !result[0].node) {
                console.error('Failed to get video node');
                this.setData({
                  thumbnailVideoVisible: false,
                  thumbnailVideoUrl: '',
                  thumbnailVideoIndex: undefined
                });
                return;
              }
              
              const videoNode = result[0].node;
              
              try {
                // 绘制视频帧到canvas
                ctx.drawImage(videoNode, 0, 0, canvas.width, canvas.height);
                
                // 将canvas转为图片临时文件
                wx.canvasToTempFilePath({
                  canvas: canvas,
                  success: (res) => {
                    const thumbnailUrl = res.tempFilePath;
                    
                    // 更新列表中的缩略图
                    const updatedList = [...this.data.videoList];
                    updatedList[index].thumbnail = thumbnailUrl;
                    
                    this.setData({
                      videoList: updatedList
                    });
                    
                    // 保存到缓存
                    const cachedThumbnails = wx.getStorageSync('video_thumbnails') || {};
                    cachedThumbnails[video.url] = thumbnailUrl;
                    wx.setStorage({
                      key: 'video_thumbnails',
                      data: cachedThumbnails
                    });
                  },
                  fail: (err) => {
                    console.error('Canvas to temp file failed:', err);
                  },
                  complete: () => {
                    // 隐藏临时视频
                    this.setData({
                      thumbnailVideoVisible: false,
                      thumbnailVideoUrl: '',
                      thumbnailVideoIndex: undefined
                    });
                  }
                });
              } catch (error) {
                console.error('Failed to create thumbnail:', error);
                this.setData({
                  thumbnailVideoVisible: false,
                  thumbnailVideoUrl: '',
                  thumbnailVideoIndex: undefined
                });
              }
            });
        });
    }, 500);
  },
  
  // 处理缩略图视频加载错误
  onThumbnailVideoError(e) {
    console.error('视频缩略图加载错误:', e);
    
    this.setData({
      thumbnailVideoVisible: false,
      thumbnailVideoUrl: '',
      thumbnailVideoIndex: undefined
    });
  },

  // 修改音频时长获取方法
  preloadAudioDurations(audioList) {
    if (!audioList || audioList.length === 0) return;
    
    // 从本地缓存中获取已缓存的时长信息
    const cachedDurations = wx.getStorageSync('audio_durations') || {};
    
    // 仅处理没有时长信息的音频
    const itemsToLoad = audioList.filter((item, index) => {
      // 如果已有时长，则不需要加载
      if (item.duration && item.duration !== "00:00") return false;
      
      // 如果缓存中有该音频的时长信息，则使用缓存
      if (cachedDurations[item.url]) {
        // 更新列表项的时长信息
        const updatedList = [...this.data.audioList];
        updatedList[index].duration = cachedDurations[item.url];
        
        this.setData({
          audioList: updatedList
        });
        return false;
      }
      
      return true;
    });
    
    // 如果所有项目都有时长信息，直接返回
    if (itemsToLoad.length === 0) return;
    
    // 限制同时加载的数量为3个
    const maxConcurrent = 3;
    let currentLoading = 0;
    
    // 按需加载时长
    const loadDuration = (item, index) => {
      if (currentLoading >= maxConcurrent) return;
      
      currentLoading++;
      
      // 创建临时音频上下文
      const tempAudio = wx.createInnerAudioContext();
      tempAudio.src = item.url;
      
      // 先设置音量为0，避免在回调中再次设置
      tempAudio.volume = 0;
      tempAudio.obeyMuteSwitch = false;
      tempAudio.muted = true;
      
      // 设置超时
      let timeoutId = setTimeout(() => {
        if (tempAudio) {
          tempAudio.destroy();
          currentLoading--;
          
          // 失败后继续加载队列中的下一个
          const nextItem = itemsToLoad.shift();
          if (nextItem) {
            const nextIndex = audioList.findIndex(i => i.url === nextItem.url);
            if (nextIndex !== -1) {
              loadDuration(nextItem, nextIndex);
            }
          }
        }
      }, 5000);
      
      tempAudio.onTimeUpdate(() => {
        if (tempAudio && tempAudio.duration && tempAudio.duration > 0) {
          clearTimeout(timeoutId);
          
          // 格式化并更新时长
          const formattedDuration = this.formatTime(tempAudio.duration);
          
          // 更新列表项
          const updatedList = [...this.data.audioList];
          if (updatedList[index]) {
            updatedList[index].duration = formattedDuration;
            
            this.setData({
              audioList: updatedList
            });
            
            // 更新缓存
            cachedDurations[item.url] = formattedDuration;
            wx.setStorage({
              key: 'audio_durations',
              data: cachedDurations
            });
          }
          
          // 停止播放并释放资源
          tempAudio.stop();
          tempAudio.destroy();
          
          currentLoading--;
          
          // 加载队列中的下一个
          const nextItem = itemsToLoad.shift();
          if (nextItem) {
            const nextIndex = audioList.findIndex(i => i.url === nextItem.url);
            if (nextIndex !== -1) {
              loadDuration(nextItem, nextIndex);
            }
          }
        }
      });
      
      // 简化onCanplay回调，避免递归调用
      tempAudio.onCanplay(() => {
        // 直接播放，不再设置音量和seek位置
        tempAudio.play();
        
        setTimeout(() => {
          if (tempAudio) {
            tempAudio.pause();
          }
        }, 300);
      });
      
      tempAudio.onError(() => {
        clearTimeout(timeoutId);
        tempAudio.destroy();
        currentLoading--;
        
        // 失败后继续加载队列中的下一个
        const nextItem = itemsToLoad.shift();
        if (nextItem) {
          const nextIndex = audioList.findIndex(i => i.url === nextItem.url);
          if (nextIndex !== -1) {
            loadDuration(nextItem, nextIndex);
          }
        }
      });
    };
    
    // 开始加载前几个
    const initialItems = itemsToLoad.splice(0, maxConcurrent);
    initialItems.forEach(item => {
      const index = audioList.findIndex(i => i.url === item.url);
      if (index !== -1) {
        loadDuration(item, index);
      }
    });
  },
  
  // 修改视频时长获取方法
  preloadVideoDurations(videoList) {
    if (!videoList || videoList.length === 0) return;
    
    // 从本地缓存中获取已缓存的时长信息
    const cachedDurations = wx.getStorageSync('video_durations') || {};
    
    // 更新有缓存的视频时长信息
    let updatedList = [...videoList];
    let needsUpdate = false;
    
    updatedList.forEach((item, index) => {
      if (cachedDurations[item.url] && (!item.duration || item.duration === "00:00")) {
        updatedList[index].duration = cachedDurations[item.url];
        needsUpdate = true;
      }
    });
    
    // 如果有更新，刷新列表
    if (needsUpdate) {
      this.setData({
        videoList: updatedList
      });
    }
    
    // 视频时长仅在用户播放时或显示在屏幕上时获取
    // 先不做预加载，避免性能问题
  },

  // 新方法：按需获取单个视频时长
  loadSingleVideoDuration(index) {
    const videoList = this.data.videoList;
    if (!videoList || !videoList[index]) return;
    
    const video = videoList[index];
    
    // 如果已有时长，不需要重新获取
    if (video.duration && video.duration !== "00:00") return;
    
    // 从缓存中获取
    const cachedDurations = wx.getStorageSync('video_durations') || {};
    if (cachedDurations[video.url]) {
      const updatedList = [...this.data.videoList];
      updatedList[index].duration = cachedDurations[video.url];
      
      this.setData({
        videoList: updatedList
      });
      return;
    }
    
    // 创建临时video元素获取时长
    this.setData({
      durationDetectorUrl: video.url,
      durationDetectorVisible: true,
      _currentLoadingVideoIndex: index  // 保存当前加载的索引
    });
    
    // 设置超时
    if (this._durationDetectorTimeout) {
      clearTimeout(this._durationDetectorTimeout);
    }
    
    this._durationDetectorTimeout = setTimeout(() => {
      this.setData({
        durationDetectorVisible: false,
        durationDetectorUrl: ''
      });
    }, 3000);
  },

  // 修改视频加载完成获取时长的回调
  onVideoDurationDetected(e) {
    // 清除超时
    if (this._durationDetectorTimeout) {
      clearTimeout(this._durationDetectorTimeout);
    }
    
    const { duration } = e.detail;
    if (duration && duration > 0 && this._currentLoadingVideoIndex !== undefined) {
      // 格式化时长
      const formattedDuration = this.formatTime(duration);
      
      // 更新当前视频的时长
      const updatedList = [...this.data.videoList];
      const index = this._currentLoadingVideoIndex;
      
      if (updatedList[index]) {
        updatedList[index].duration = formattedDuration;
        
        this.setData({
          videoList: updatedList
        });
        
        // 保存到缓存
        const video = updatedList[index];
        if (video && video.url) {
          const cachedDurations = wx.getStorageSync('video_durations') || {};
          cachedDurations[video.url] = formattedDuration;
          wx.setStorage({
            key: 'video_durations',
            data: cachedDurations
          });
        }
      }
    }
    
    // 隐藏探测器
    this.setData({
      durationDetectorVisible: false,
      durationDetectorUrl: '',
      _currentLoadingVideoIndex: undefined
    });
  },

  // 视频项目出现在视图中时触发
  onVideoItemAppear(e) {
    const { index } = e.currentTarget.dataset;
    if (typeof index !== 'undefined') {
      this.loadSingleVideoDuration(index);
      this.loadVideoThumbnail(index);
    }
  },

  // 处理视频检测器错误
  onVideoDetectorError(e) {
    console.error('视频加载错误:', e);
    
    // 清除超时定时器
    if (this._durationDetectorTimeout) {
      clearTimeout(this._durationDetectorTimeout);
    }
    
    // 隐藏探测器
    this.setData({
      durationDetectorVisible: false,
      durationDetectorUrl: '',
      _currentLoadingVideoIndex: undefined
    });
  },

  // 新方法：获取单个音频时长
  loadSingleAudioDuration(index) {
    const audioList = this.data.audioList;
    if (!audioList || !audioList[index]) return;
    
    const audio = audioList[index];
    
    // 如果已有时长，不需要重新获取
    if (audio.duration && audio.duration !== "00:00") return;
    
    // 从缓存中获取
    const cachedDurations = wx.getStorageSync('audio_durations') || {};
    if (cachedDurations[audio.url]) {
      const updatedList = [...this.data.audioList];
      updatedList[index].duration = cachedDurations[audio.url];
      
      this.setData({
        audioList: updatedList
      });
      return;
    }
    
    // 创建临时音频上下文
    const tempAudio = wx.createInnerAudioContext();
    tempAudio.src = audio.url;
    
    // 先设置静音属性，避免在onCanplay中再次设置触发递归
    tempAudio.volume = 0;
    tempAudio.obeyMuteSwitch = false;
    tempAudio.muted = true;
    
    // 设置超时
    let timeoutId = setTimeout(() => {
      if (tempAudio) {
        tempAudio.destroy();
      }
    }, 5000);
    
    tempAudio.onTimeUpdate(() => {
      if (tempAudio && tempAudio.duration && tempAudio.duration > 0) {
        clearTimeout(timeoutId);
        
        // 格式化并更新时长
        const formattedDuration = this.formatTime(tempAudio.duration);
        
        // 更新列表项
        const updatedList = [...this.data.audioList];
        if (updatedList[index]) {
          updatedList[index].duration = formattedDuration;
          
          this.setData({
            audioList: updatedList
          });
          
          // 更新缓存
          cachedDurations[audio.url] = formattedDuration;
          wx.setStorage({
            key: 'audio_durations',
            data: cachedDurations
          });
        }
        
        // 停止播放
        tempAudio.stop();
        
        // 释放资源
        tempAudio.destroy();
      }
    });
    
    // 简化onCanplay回调，避免递归调用
    tempAudio.onCanplay(() => {
      // 不再重复设置音量，避免递归
      // 不使用seek(0)，而是直接播放，避免触发递归
      tempAudio.play();
      
      // 短暂播放后停止
      setTimeout(() => {
        if (tempAudio) {
          tempAudio.pause();
        }
      }, 300);
    });
    
    tempAudio.onError(() => {
      clearTimeout(timeoutId);
      tempAudio.destroy();
    });
  },
  
  // 新增方法：音频项目出现在视图中时触发
  onAudioItemAppear(e) {
    const { index } = e.currentTarget.dataset;
    if (typeof index !== 'undefined') {
      this.loadSingleAudioDuration(index);
    }
  },

  // 修改标签切换方法，加载对应内容
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab || e.target.dataset.tab;
    console.log('Switching to tab:', tab);
    
    if (tab === this.data.activeTab) return;
    
    this.setData({ activeTab: tab }, () => {
      // 切换后，强制重新渲染列表，解决可能的滚动问题
      wx.nextTick(() => {
        if (tab === 'audio' && this.data.audioList.length > 0) {
          // 触发音频列表的更新
          console.log('Refreshing audio list after tab switch');
        } else if (tab === 'video' && this.data.videoList.length > 0) {
          // 触发视频列表的更新
          console.log('Refreshing video list after tab switch');
        }
      });
    });
    
    // 如果有列表但没有加载时长，则加载时长
    if (tab === 'audio' && this.data.audioList.length > 0 && 
        this.data.audioList.every(item => !item.durationLoaded)) {
      this.preloadAudioDurations(this.data.audioList);
    }
    else if (tab === 'video' && this.data.videoList.length > 0 && 
             this.data.videoList.every(item => !item.durationLoaded)) {
      this.preloadVideoDurations(this.data.videoList);
      this.preloadVideoThumbnails(this.data.videoList);
    }
  },

  // 新增方法：播放音频
  playAudio(e) {
    const index = e.currentTarget.dataset.index;
    const audio = this.data.audioList[index];
    
    if (!audio) return;
    
    console.log('Playing audio:', audio);
    console.log('Book cover to use:', audio.cover || this.data.bookCover);
    
    // 将封面信息保存到全局状态
    app.globalData.currentBookCover = audio.cover || this.data.bookCover || '';
    
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
    
    // 暂停当前正在播放的音频
    this.pauseCurrentAudio();
    
    // 将封面信息保存到全局状态
    app.globalData.currentBookCover = video.cover || this.data.bookCover || '';
    
    // 导航到视频播放页面，传递必要参数
    wx.navigateTo({
      url: `/pages/reader/play?id=${video.id}&type=video&title=${encodeURIComponent(video.title)}&url=${encodeURIComponent(video.url)}&bookId=${this.data.bookId}`
    });
  },

  // 新增方法：暂停当前播放的音频
  pauseCurrentAudio() {
    // 检查全局音频上下文
    const backgroundAudioManager = wx.getBackgroundAudioManager();
    if (backgroundAudioManager && !backgroundAudioManager.paused) {
      console.log('暂停正在播放的背景音频');
      backgroundAudioManager.pause();
    }
    
    // 检查全局内部音频上下文
    const innerAudioContext = app.globalData.innerAudioContext;
    if (innerAudioContext && !innerAudioContext.paused) {
      console.log('暂停正在播放的内部音频');
      innerAudioContext.pause();
    }
    
    // 检查音频管理器中的音频
    if (audioManager && typeof audioManager.pauseCurrent === 'function') {
      console.log('暂停音频管理器中的当前音频');
      audioManager.pauseCurrent();
    }
    
    // 更新界面状态
    if (this.data.isPlaying) {
      this.setData({
        isPlaying: false
      });
    }
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
      playCount: content.playCount || 0,
      duration: content.duration || "00:00"
    }));
    
    const videoList = contents.filter(content => content.type === 1).map(content => ({
      id: content.id,
      title: content.name,
      cover: content.coverPath || '/images/default-cover.png',
      type: 'video',
      url: content.filePath,
      richText: content.richText,
      playCount: content.playCount || 0,
      duration: content.duration || "00:00"
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
      
      // 预加载音频和视频时长
      if (audioList.length > 0) {
        this.preloadAudioDurations(audioList);
      }
      
      if (videoList.length > 0) {
        this.preloadVideoDurations(videoList);
      }
    });
  },
}); 