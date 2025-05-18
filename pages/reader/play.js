const app = getApp();
const audioManager = require('../../utils/audioManager');

// 播放模式常量
const PLAY_MODE = {
  SEQUENCE: 0,  // 顺序播放
  LOOP: 1,      // 单曲循环
  RANDOM: 2     // 随机播放
};

Page({
  data: {
    id: '',
    type: '', // 'audio' or 'video'
    title: '',
    url: '',
    bookId: '',
    bookCover: '', // Added book cover path
    isPlaying: false,
    currentTime: '00:00',
    duration: '00:00',
    progress: 0,
    playMode: PLAY_MODE.SEQUENCE,
    playModeIcons: ['→', '↻', '⤮'],  // 顺序, 单曲循环, 随机 (备用文本图标)
    playModeImages: [
      '/images/audio/sequence.png',  // 顺序播放
      '/images/audio/looping.png',   // 单曲循环
      '/images/audio/random.png'     // 随机播放
    ],
    showPlaylist: false,
    audioList: [],
    currentAudioIndex: 0,
    // 图片加载状态
    prevImageLoaded: true,
    nextImageLoaded: true,
    playPauseImageLoaded: true,
    playModeImageLoaded: true,
    listImageLoaded: true,
    // 进度条拖动状态
    isDragging: false
  },

  onLoad(options) {
    console.log('Play page loading with options:', options);
    const { id, type, title, url, bookId } = options;
    const app = getApp();
    
    // 确保数据有效
    if (!id || !type || !url) {
      console.error('Missing required parameters:', options);
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    
    // 从全局状态获取封面
    const bookCover = app.globalData.currentBookCover || '';
    console.log('Book cover from global state:', bookCover);
    
    this.setData({
      id,
      type,
      title: decodeURIComponent(title || ''),
      url: decodeURIComponent(url || ''),
      bookId,
      bookCover: bookCover || '/images/default-cover.png',
      isPlaying: true // 自动开始播放
    });

    // 调试日志
    console.log('Book cover set in data:', this.data.bookCover);

    // 如果没有封面，尝试从API获取
    if (!this.data.bookCover || this.data.bookCover === '/images/default-cover.png') {
      console.log('No cover provided, fetching from API');
      this.fetchBookCover();
    }

    console.log('Decoded URL:', this.data.url);

    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: this.data.title || '播放'
    });

    // 初始化播放器
    if (type === 'audio') {
      console.log('Initializing audio player');
      
      // 检查全局状态中是否有音频列表，且是当前书籍的
      if (app.globalData.audioList && app.globalData.audioList.length > 0 && 
          app.globalData.currentBookId === this.data.bookId) {
        
        console.log('Using global audio list with', app.globalData.audioList.length, 'items');
        console.log('Global audio list:', JSON.stringify(app.globalData.audioList));
        
        // 找到当前播放的音频在列表中的索引
        const currentIndex = app.globalData.audioList.findIndex(item => String(item.id) === String(this.data.id));
        console.log('Current audio index in global list:', currentIndex, 'for id:', this.data.id);
        
        this.setData({
          audioList: app.globalData.audioList,
          currentAudioIndex: currentIndex >= 0 ? currentIndex : 0
        });
        
        // 如果之前已有播放中的索引，优先使用它
        if (app.globalData.currentAudioIndex !== undefined && 
            app.globalData.currentAudioIndex >= 0 && 
            app.globalData.currentAudioIndex < app.globalData.audioList.length) {
          this.setData({
            currentAudioIndex: app.globalData.currentAudioIndex
          });
        }
        
        // 初始化音频播放器
        this.initAudioPlayer();
      } else {
        // 如果全局状态中没有音频列表，或不是当前书籍的，则重新获取
        console.log('No global audio list for current book, fetching new list');
        this.fetchAudioList();
      }
    } else if (type === 'video') {
      console.log('Initializing video player');
      
      // 在播放视频前暂停所有音频
      this.pauseAllAudio();
      
      // 视频播放器会在页面加载后通过组件自动初始化
      setTimeout(() => {
        this.videoContext = wx.createVideoContext('player-video');
        if (this.videoContext) {
          console.log('Video context created');
          this.videoContext.play();
        } else {
          console.error('Failed to create video context');
        }
      }, 300);
    }
  },

  // 获取音频列表
  fetchAudioList() {
    wx.showLoading({
      title: '加载中...',
    });

    const app = getApp();
    const token = wx.getStorageSync('token');
    console.log('Fetching audio list for bookId:', this.data.bookId);
    
    // Check if bookId exists
    if (!this.data.bookId) {
      console.error('Missing bookId for audio list request');
      wx.showToast({
        title: '缺少必要参数',
        icon: 'none'
      });
      
      // 创建一个只包含当前音频的列表
      if (this.data.id && this.data.title && this.data.url) {
        console.log('Creating fallback audio list with current audio');
        const singleAudioList = [{
          id: this.data.id,
          title: this.data.title,
          url: this.data.url,
          cover: this.data.bookCover || '/images/default-cover.png'
        }];
        
        this.setData({
          audioList: singleAudioList,
          currentAudioIndex: 0
        });
        
        // 保存到全局状态
        app.globalData.audioList = singleAudioList;
        app.globalData.currentBookId = this.data.bookId;
        app.globalData.currentAudioIndex = 0;
      }
      
      this.initAudioPlayer();
      return;
    }
    
    if (!token) {
      console.error('No token available for audio list request');
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      
      // 创建一个只包含当前音频的列表
      if (this.data.id && this.data.title && this.data.url) {
        console.log('Creating fallback audio list with current audio');
        const singleAudioList = [{
          id: this.data.id,
          title: this.data.title,
          url: this.data.url,
          cover: this.data.bookCover || '/images/default-cover.png'
        }];
        
        this.setData({
          audioList: singleAudioList,
          currentAudioIndex: 0
        });
        
        // 保存到全局状态
        app.globalData.audioList = singleAudioList;
        app.globalData.currentBookId = this.data.bookId;
        app.globalData.currentAudioIndex = 0;
      }
      
      this.initAudioPlayer(); 
      return;
    }

    const requestUrl = `${app.globalData.baseUrl}/book/get/${this.data.bookId}`;
    console.log('Book info request URL:', requestUrl);
    
    wx.request({
      url: requestUrl,
      method: 'GET',
      header: {
        'content-type': 'application/json',
        'token': token
      },
      success: (res) => {
        wx.hideLoading();
        console.log('Book info response:', res);
        
        if (res.statusCode === 200 && res.data.code === 200 && res.data.data) {
          const bookData = res.data.data;
          
          // 检查是否存在contents数组并包含音频内容
          if (bookData.contents && Array.isArray(bookData.contents)) {
            // 过滤出所有类型为音频的内容
            const audioList = bookData.contents
              .filter(content => content.type === 2) // 音频类型为2
              .map(content => {
                return {
                  id: content.id || '',
                  title: content.name || '未命名音频',
                  url: content.filePath || '',
                  cover: content.coverPath || (bookData.coverPath || '/images/default-cover.png'),
                  type: 'audio',
                  richText: content.richText || '',
                  playCount: content.playCount || 0
                };
              }).filter(item => item.url); // 只保留有URL的项
          
            console.log('Processed audio list:', audioList.length, 'items');
            
            if (audioList.length === 0) {
              console.warn('Audio list is empty');
              wx.showToast({
                title: '没有可播放的音频',
                icon: 'none'
              });
              
              // 创建一个只包含当前音频的列表
              this.createFallbackAudioList();
              
              this.initAudioPlayer();
              return;
            }
            
            // 保存到全局状态
            app.globalData.audioList = audioList;
            app.globalData.currentBookId = this.data.bookId;
            console.log('Saved audio list to global state:', audioList.length, 'items');
            
            // 找到当前播放的音频在列表中的索引
            const currentIndex = audioList.findIndex(item => String(item.id) === String(this.data.id));
            console.log('Current audio index:', currentIndex, 'for id:', this.data.id);
            
            this.setData({
              audioList: audioList,
              currentAudioIndex: currentIndex >= 0 ? currentIndex : 0
            });
            
            // 保存当前播放索引到全局状态
            app.globalData.currentAudioIndex = this.data.currentAudioIndex;
          } else {
            console.warn('No contents array found in book data or no audio contents found');
            // 创建一个只包含当前音频的列表
            this.createFallbackAudioList();
          }
          
          // 初始化音频播放器
          this.initAudioPlayer();
        } else {
          console.error('Failed to fetch book info:', res);
          wx.showToast({
            title: (res.data && res.data.message) || '获取音频列表失败',
            icon: 'none'
          });
          
          // 创建一个只包含当前音频的列表
          this.createFallbackAudioList();
          
          this.initAudioPlayer();
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('Network error when fetching book info:', err);
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
        
        // 创建一个只包含当前音频的列表
        this.createFallbackAudioList();
        
        this.initAudioPlayer();
      }
    });
  },

  // 新增辅助方法：创建一个只包含当前音频的列表
  createFallbackAudioList() {
    const app = getApp();
    
    if (this.data.id && this.data.title && this.data.url) {
      console.log('Creating fallback audio list with current audio');
      const singleAudioList = [{
        id: this.data.id,
        title: this.data.title,
        url: this.data.url,
        cover: this.data.bookCover || '/images/default-cover.png'
      }];
      
      this.setData({
        audioList: singleAudioList,
        currentAudioIndex: 0
      });
      
      // 保存到全局状态
      app.globalData.audioList = singleAudioList;
      app.globalData.currentBookId = this.data.bookId || 'single';
      app.globalData.currentAudioIndex = 0;
    }
  },

  initAudioPlayer() {
    // 不再需要手动停止和销毁旧的audioContext
    // 由audioManager负责管理
    
    // 确保URL有效
    let audioUrl = this.data.url;
    if (!audioUrl) {
      console.error('No audio URL provided to play');
      wx.showToast({
        title: '无效的音频链接',
        icon: 'none'
      });
      return;
    }
    
    // 确保URL已解码
    try {
      if (audioUrl.includes('%')) {
        audioUrl = decodeURIComponent(audioUrl);
        console.log('Decoded URL:', audioUrl);
      }
    } catch (e) {
      console.error('Error decoding URL:', e);
      // 继续使用原始URL
    }
    
    // 使用音频管理器创建新的audioContext
    const audioContext = audioManager.createAudio(audioUrl, {
      autoplay: true
    });
    
    console.log('Audio context created with URL:', audioUrl);
    
    // 设置音频事件监听
    audioContext.onCanplay(() => {
      console.log('Audio can play now, duration:', audioContext.duration);
    });
    
    audioContext.onPlay(() => {
      console.log('Audio started playing');
      this.setData({ isPlaying: true });
      
      // 同步更新全局状态
      const app = getApp();
      if (app.globalData.currentTrack) {
        app.globalData.currentTrack.isPlaying = true;
        // 确保全局音频上下文是最新的
        app.globalData.currentAudioContext = audioContext;
      }
    });
    
    audioContext.onPause(() => {
      console.log('Audio paused');
      this.setData({ isPlaying: false });
      
      // 同步更新全局状态
      const app = getApp();
      if (app.globalData.currentTrack) {
        app.globalData.currentTrack.isPlaying = false;
      }
    });
    
    audioContext.onTimeUpdate(() => {
      const currentTime = this.formatTime(audioContext.currentTime);
      const duration = this.formatTime(audioContext.duration);
      const progress = audioContext.duration > 0 
        ? (audioContext.currentTime / audioContext.duration) * 100 
        : 0;
      
      // 避免拖动过程中的时间更新
      if (!this.isDragging) {
        this.setData({ 
          currentTime, 
          duration, 
          progress 
        });
      }
    });
    
    audioContext.onSeeking(() => {
      console.log('Audio seeking...');
    });
    
    audioContext.onSeeked(() => {
      console.log('Audio seek completed');
      // 更新时间和进度
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
    
    audioContext.onEnded(() => {
      console.log('Audio playback ended');
      
      // 同步更新全局状态
      const app = getApp();
      if (app.globalData.currentTrack) {
        app.globalData.currentTrack.isPlaying = false;
      }
      
      // 根据播放模式决定下一步操作
      this.handleTrackEnd();
    });
    
    audioContext.onError((err) => {
      console.error('Audio playback error:', err);
      wx.showToast({
        title: '音频播放失败',
        icon: 'none'
      });
      
      // 错误时更新状态
      this.setData({ isPlaying: false });
      
      // 同步更新全局状态
      const app = getApp();
      if (app.globalData.currentTrack) {
        app.globalData.currentTrack.isPlaying = false;
      }
    });
    
    // 保存音频上下文以便后续控制
    this.audioContext = audioContext;
    
    // 保存到全局状态
    const app = getApp();
    app.globalData.currentAudioContext = audioContext;
  },

  togglePlay() {
    console.log('Toggle play called for type:', this.data.type);
    const app = getApp();
    
    if (this.data.type === 'audio') {
      if (this.audioContext) {
        if (this.data.isPlaying) {
          console.log('Pausing audio');
          this.audioContext.pause();
          
          // 更新全局播放状态
          if (app.globalData.currentTrack) {
            app.globalData.currentTrack.isPlaying = false;
            console.log('Updated global playback state to paused');
          }
          
          // 更新当前页面状态
          this.setData({ isPlaying: false });
        } else {
          console.log('Playing audio');
          this.audioContext.play();
          
          // 更新全局播放状态
          if (app.globalData.currentTrack) {
            app.globalData.currentTrack.isPlaying = true;
            console.log('Updated global playback state to playing');
          }
          
          // 更新当前页面状态
          this.setData({ isPlaying: true });
        }
      } else {
        console.error('Audio context not found');
      }
    } else if (this.data.type === 'video') {
      if (this.videoContext) {
        if (this.data.isPlaying) {
          console.log('Pausing video');
          this.videoContext.pause();
          this.setData({ isPlaying: false });
        } else {
          console.log('Playing video');
          this.videoContext.play();
          this.setData({ isPlaying: true });
        }
      } else {
        console.error('Video context not found');
      }
    }
  },

  // 切换播放模式
  togglePlayMode() {
    // 循环切换播放模式
    const nextMode = (this.data.playMode + 1) % 3;
    
    console.log('Switching play mode from', this.data.playMode, 'to', nextMode);
    console.log('New mode icon path:', this.data.playModeImages[nextMode]);
    
    // 确保图片模式在切换后仍然有效
    this.setData({ 
      playMode: nextMode,
      playModeImageLoaded: true // 重置图片加载状态，确保会尝试加载图片
    });
    
    const modeNames = ['顺序播放', '单曲循环', '随机播放'];
    wx.showToast({
      title: modeNames[nextMode],
      icon: 'none'
    });
  },
  
  // 切换播放列表显示状态
  togglePlaylist() {
    console.log('Toggling playlist visibility');
    // 确保列表图标在切换时重置加载状态
    this.setData({ 
      showPlaylist: !this.data.showPlaylist,
      listImageLoaded: true // 重置图片加载状态
    });
  },
  
  // 播放上一曲
  playPrevious() {
    console.log('Playing previous track, audioList length:', this.data.audioList.length, 'currentIndex:', this.data.currentAudioIndex);
    
    // 检查列表是否有效
    if (!this.data.audioList || this.data.audioList.length <= 1) {
      console.log('Cannot play previous: audio list empty or has only one item');
      wx.showToast({
        title: '没有更多音频',
        icon: 'none'
      });
      return;
    }
    
    let prevIndex;
    
    if (this.data.playMode === PLAY_MODE.RANDOM) {
      // 随机模式下随机选择一个不同的曲目
      prevIndex = this.getRandomIndex();
      console.log('Random mode, selected index:', prevIndex);
    } else {
      // 顺序模式和循环模式下都是播放上一曲
      prevIndex = (this.data.currentAudioIndex - 1 + this.data.audioList.length) % this.data.audioList.length;
      console.log('Sequential/loop mode, calculated previous index:', prevIndex);
    }
    
    console.log('Playing track at index:', prevIndex, 'currentAudioIndex:', this.data.currentAudioIndex);
    this.playTrackByIndex(prevIndex);
  },
  
  // 播放下一曲
  playNext() {
    console.log('Playing next track, audioList length:', this.data.audioList.length, 'currentIndex:', this.data.currentAudioIndex);
    
    // 检查列表是否有效
    if (!this.data.audioList || this.data.audioList.length <= 1) {
      console.log('Cannot play next: audio list empty or has only one item');
      wx.showToast({
        title: '没有更多音频',
        icon: 'none'
      });
      return;
    }
    
    let nextIndex;
    
    if (this.data.playMode === PLAY_MODE.RANDOM) {
      // 随机模式下随机选择一个不同的曲目
      nextIndex = this.getRandomIndex();
      console.log('Random mode, selected index:', nextIndex);
    } else {
      // 顺序模式和循环模式下都是播放下一曲
      nextIndex = (this.data.currentAudioIndex + 1) % this.data.audioList.length;
      console.log('Sequential/loop mode, calculated next index:', nextIndex);
    }
    
    console.log('Playing track at index:', nextIndex, 'from currentAudioIndex:', this.data.currentAudioIndex);
    this.playTrackByIndex(nextIndex);
  },
  
  // 生成一个不同于当前索引的随机索引
  getRandomIndex() {
    if (this.data.audioList.length <= 1) return 0;
    
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * this.data.audioList.length);
    } while (randomIndex === this.data.currentAudioIndex);
    
    return randomIndex;
  },
  
  // 处理曲目播放结束
  handleTrackEnd() {
    console.log('Handle track end, current play mode:', this.data.playMode);
    switch (this.data.playMode) {
      case PLAY_MODE.SEQUENCE:
        // 顺序播放模式，播放下一曲
        console.log('Sequence mode: playing next track');
        if (this.data.currentAudioIndex < this.data.audioList.length - 1) {
          // 不是最后一首，播放下一首
          this.playNext();
        } else {
          // 已经是最后一首，停止播放
          console.log('Sequence mode: reached the end of playlist, stopping');
          this.setData({ isPlaying: false });
        }
        break;
      case PLAY_MODE.LOOP:
        // 循环播放模式，重新播放当前曲目
        console.log('Loop mode: replaying current track');
        if (this.audioContext) {
          this.audioContext.seek(0);
          this.audioContext.play();
          // 导航栏标题不变，因为是重复播放当前曲目
        }
        break;
      case PLAY_MODE.RANDOM:
        // 随机播放模式，播放随机曲目
        console.log('Random mode: playing random track');
        this.playNext(); // 这会自动更新导航栏标题
        break;
    }
  },
  
  // 从列表中选择曲目播放
  selectTrack(e) {
    const index = e.currentTarget.dataset.index;
    console.log('User selected track at index:', index);
    
    // 先关闭播放列表，然后播放选中的曲目
    this.setData({ showPlaylist: false });
    
    // 播放选中的曲目（这会自动更新导航栏标题）
    this.playTrackByIndex(index);
  },
  
  // 通过索引播放曲目
  playTrackByIndex(index) {
    console.log('playTrackByIndex called with index:', index, 'audioList length:', this.data.audioList.length);
    
    // 确保索引有效
    if (index < 0 || index >= this.data.audioList.length) {
      console.warn('Invalid index:', index, 'with list length:', this.data.audioList.length);
      return;
    }
    
    const track = this.data.audioList[index];
    console.log('Selected track to play:', track);
    
    if (!track || !track.url) {
      console.error('Invalid track or missing URL at index:', index);
      wx.showToast({
        title: '无效的音频',
        icon: 'none'
      });
      return;
    }
    
    // 停止当前播放
    if (this.audioContext) {
      try {
        console.log('Stopping current audio playback');
        this.audioContext.stop();
      } catch (err) {
        console.error('Error stopping audio context:', err);
      }
    }
    
    // 更新数据
    this.setData({
      id: track.id,
      title: track.title,
      url: track.url,
      currentAudioIndex: index,
      isPlaying: true,
      currentTime: '00:00',
      progress: 0
    });
    
    // 设置封面图片
    if (track.cover) {
      console.log('Setting cover from track:', track.cover);
      this.setData({
        bookCover: track.cover
      });
    }
    
    // 更新导航栏标题
    wx.setNavigationBarTitle({
      title: track.title || '播放'
    });
    console.log('Navigation bar title updated to:', track.title);
    
    // 更新全局状态中的当前播放索引和音频信息
    const app = getApp();
    app.globalData.currentAudioIndex = index;
    app.globalData.isPlayingInBackground = true;
    
    // 更新全局封面
    if (track.cover) {
      app.globalData.currentBookCover = track.cover;
    }
    
    // 确保全局currentTrack包含完整信息
    app.globalData.currentTrack = {
      id: track.id,
      title: track.title,
      url: track.url,
      isPlaying: true,
      currentAudioIndex: index,
      cover: track.cover
    };
    
    // 保存完整的播放列表
    if (this.data.audioList && this.data.audioList.length > 0) {
      app.globalData.audioList = this.data.audioList;
    }
    
    console.log('Updated global audio state with new track:', track.title, 'at index:', index);
    
    try {
      // 重新初始化播放器
      console.log('Initializing audio player with new URL:', track.url);
      this.initAudioPlayer();
    } catch (err) {
      console.error('Error initializing audio player:', err);
      wx.showToast({
        title: '播放失败',
        icon: 'none'
      });
    }
  },

  // 处理进度条拖动过程中的预览
  onProgressChanging(e) {
    const value = e.detail.value;
    console.log('Progress changing to:', value);
    
    // 标记正在拖动，避免onTimeUpdate事件的干扰
    this.isDragging = true;
    
    // 更新进度条位置和时间预览
    this.setData({ 
      progress: value,
      isDragging: true
    });
    
    if (this.data.type === 'audio') {
      if (this.audioContext && this.audioContext.duration) {
        // 计算预览时间点，但不实际seek
        const previewTime = (value / 100) * this.audioContext.duration;
        
        // 更新显示的时间，但不改变实际播放位置
        this.setData({
          currentTime: this.formatTime(previewTime)
        });
      }
    } else if (this.data.type === 'video') {
      if (this.videoContext) {
        const duration = this.videoContext.duration || 0;
        if (duration > 0) {
          // 计算预览时间点，但不实际seek
          const previewTime = (value / 100) * duration;
          
          // 更新显示的时间，但不改变实际播放位置
          this.setData({
            currentTime: this.formatTime(previewTime)
          });
        }
      }
    }
  },

  onProgressChange(e) {
    const value = e.detail.value;
    console.log('Progress changed to:', value);
    
    // 拖动结束，重置标记
    this.isDragging = false;
    
    // 更新进度条位置
    this.setData({ 
      progress: value,
      isDragging: false 
    });
    
    if (this.data.type === 'audio') {
      if (this.audioContext && this.audioContext.duration) {
        // 计算秒数并跳转
        const seekTime = (value / 100) * this.audioContext.duration;
        console.log('Seeking audio to:', seekTime, 'seconds, duration:', this.audioContext.duration);
        
        // 如果音频未在播放，先暂存当前播放状态
        const wasPlaying = this.data.isPlaying;
        
        // 执行跳转
        try {
          this.audioContext.seek(seekTime);
          
          // 如果之前是暂停状态，跳转后保持暂停
          if (!wasPlaying) {
            setTimeout(() => {
              this.audioContext.pause();
            }, 100);
          }
          
          console.log('Seek operation completed');
        } catch (err) {
          console.error('Error during seek operation:', err);
        }
      } else {
        console.warn('Cannot seek - audioContext or duration not available');
      }
    } else if (this.data.type === 'video') {
      if (this.videoContext) {
        // 计算秒数并跳转
        const duration = this.videoContext.duration || 0;
        if (duration > 0) {
          const seekTime = (value / 100) * duration;
          console.log('Seeking video to:', seekTime, 'seconds, duration:', duration);
          
          try {
            this.videoContext.seek(seekTime);
            console.log('Video seek operation completed');
          } catch (err) {
            console.error('Error during video seek operation:', err);
          }
        } else {
          console.warn('Cannot seek video - duration not available');
        }
      } else {
        console.error('Video context not found for seeking');
      }
    }
  },

  onVideoPlay() {
    console.log('Video play event');
    this.setData({ isPlaying: true });
  },

  onVideoPause() {
    console.log('Video pause event');
    this.setData({ isPlaying: false });
  },

  onVideoTimeUpdate(e) {
    const { currentTime, duration } = e.detail;
    if (duration > 0) {
      this.setData({
        currentTime: this.formatTime(currentTime),
        duration: this.formatTime(duration),
        progress: (currentTime / duration) * 100
      });
    }
  },

  formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  },

  // 图片加载错误处理
  onPrevImageError() {
    console.log('Previous button image failed to load');
    this.setData({ prevImageLoaded: false });
  },
  
  onNextImageError() {
    console.log('Next button image failed to load');
    this.setData({ nextImageLoaded: false });
  },
  
  onPlayPauseImageError() {
    console.log('Play/Pause button image failed to load');
    this.setData({ playPauseImageLoaded: false });
  },

  onPlayModeImageError() {
    console.log('Play mode button image failed to load');
    this.setData({ playModeImageLoaded: false });
  },

  onListImageError() {
    console.log('Playlist button image failed to load');
    this.setData({ listImageLoaded: false });
  },

  onCoverImageLoad(e) {
    console.log('Cover image loaded successfully:', this.data.bookCover);
  },

  onCoverImageError(e) {
    console.error('Cover image failed to load:', this.data.bookCover);
    // 记录错误并使用默认图片
    if (this.data.bookCover !== '/images/default-cover.png') {
      wx.showToast({
        title: '封面加载失败',
        icon: 'none'
      });
      this.setData({
        bookCover: '/images/default-cover.png'
      });
    }
  },

  onUnload() {
    console.log('Play page unloading');
    const app = getApp();
    
    // 保存当前播放状态到全局变量，而不是停止播放
    if (this.audioContext && this.data.type === 'audio') {
      console.log('Saving audio state to global state');
      app.globalData.isPlayingInBackground = true;
      app.globalData.currentAudioContext = this.audioContext;
      app.globalData.currentTrack = {
        id: this.data.id,
        title: this.data.title,
        url: this.data.url,
        isPlaying: this.data.isPlaying,
        currentAudioIndex: this.data.currentAudioIndex
      };
      
      // 不再调用stop()和destroy()
      this.audioContext = null; // 防止页面销毁时触发audioContext的销毁
    } else if (this.data.type === 'video') {
      // 视频不支持后台播放，所以当离开页面时停止
      if (this.videoContext) {
        console.log('Stopping video playback');
        this.videoContext.stop();
      }
    }
  },

  onShow() {
    console.log('Play page shown');
    // 更新全局状态
    const app = getApp();
    if (this.data.type === 'audio' && this.audioContext) {
      app.globalData.isPlayingInBackground = true;
      app.globalData.currentAudioContext = this.audioContext;
      app.globalData.currentTrack = {
        id: this.data.id,
        title: this.data.title,
        url: this.data.url,
        isPlaying: this.data.isPlaying,
        currentAudioIndex: this.data.currentAudioIndex
      };
      console.log('Updated global audio state in onShow');
    }
  },

  // 获取书籍封面
  fetchBookCover() {
    const app = getApp();
    const bookId = this.data.bookId;
    
    if (!bookId) {
      console.error('Missing bookId for cover fetch');
      return;
    }
    
    const token = wx.getStorageSync('token');
    if (!token) {
      console.error('No token available for book info request');
      return;
    }
    
    wx.request({
      url: `${app.globalData.baseUrl}/book/info`,
      method: 'GET',
      data: { id: bookId },
      header: {
        'Authorization': token
      },
      success: (res) => {
        if (res.data.code === 0 && res.data.data) {
          const bookData = res.data.data;
          const coverPath = bookData.coverPath || '/images/default-cover.png';
          
          console.log('Fetched book cover path:', coverPath);
          
          // 设置封面URL，确保URL是完整的且未被编码
          this.setData({
            bookCover: coverPath
          });
          
          console.log('Updated book cover in data:', this.data.bookCover);
        }
      },
      fail: (err) => {
        console.error('Failed to fetch book info:', err);
      }
    });
  },

  // 暂停所有音频播放
  pauseAllAudio() {
    console.log('暂停所有音频播放');
    
    // 检查全局背景音频管理器
    const backgroundAudioManager = wx.getBackgroundAudioManager();
    if (backgroundAudioManager && !backgroundAudioManager.paused) {
      console.log('暂停背景音频管理器');
      backgroundAudioManager.pause();
    }
    
    // 检查全局内部音频上下文
    const app = getApp();
    const innerAudioContext = app.globalData.innerAudioContext;
    if (innerAudioContext && !innerAudioContext.paused) {
      console.log('暂停全局内部音频上下文');
      innerAudioContext.pause();
    }
    
    // 如果存在当前音频上下文，暂停它
    if (app.globalData.currentAudioContext) {
      console.log('暂停全局当前音频上下文');
      try {
        app.globalData.currentAudioContext.pause();
      } catch (err) {
        console.error('暂停全局当前音频出错:', err);
      }
    }
    
    // 使用音频管理器暂停
    if (audioManager && typeof audioManager.pauseCurrent === 'function') {
      console.log('使用音频管理器暂停当前音频');
      audioManager.pauseCurrent();
    }
    
    // 更新全局状态
    if (app.globalData.currentTrack) {
      app.globalData.currentTrack.isPlaying = false;
    }
    app.globalData.isPlayingInBackground = false;
  },
}); 