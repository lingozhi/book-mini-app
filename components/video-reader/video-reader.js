Component({
  properties: {
    chapter: {
      type: Object,
      value: { title: '', filePath: '' }
    },
    videoUrl: {
      type: String,
      value: ''
    }
  },

  data: {
    isFullScreen: false,
    isLoading: true,
    hasError: false,
    errorMsg: '',
    isPlaying: false,
    isRotated: false,
    showControls: true,  // 控制自定义控制按钮的显示
    controlsTimer: null  // 用于控制延时隐藏控制按钮
  },

  methods: {
    onVideoReady() {
      this.videoContext = wx.createVideoContext('reader-video', this);
      this.triggerEvent('videoReady', { videoContext: this.videoContext });
      
      // 自动播放视频
      setTimeout(() => {
        this.videoContext.play();
        
        // 强制更新加载状态，但不显示UI
        setTimeout(() => {
          if (this.data.isLoading) {
            console.log('视频加载完成');
            this.setData({
              isLoading: false
            });
            // 通知父组件视频加载完成
            this.triggerEvent('videoLoaded');
            
            // 设置3秒后自动隐藏控制按钮
            this.autoHideControls();
          }
        }, 2000);
      }, 500);
      
      // 添加加载超时处理
      this.loadingTimeout = setTimeout(() => {
        // 如果5秒后仍然显示加载中，尝试重新加载
        if (this.data.isLoading) {
          console.log('视频加载超时，尝试重新加载');
          this.retryVideo();
        }
      }, 5000);
    },
    
    // 添加自动隐藏控制按钮的逻辑
    autoHideControls() {
      // 清除之前的定时器
      if (this.data.controlsTimer) {
        clearTimeout(this.data.controlsTimer);
      }
      
      // 设置新的定时器，3秒后隐藏控制按钮
      const timer = setTimeout(() => {
        if (this.data.isPlaying) {
          this.setData({
            showControls: false
          });
        }
      }, 3000);
      
      this.setData({
        controlsTimer: timer,
        showControls: true
      });
    },
    
    // 显示控制按钮
    showControlsUI() {
      this.autoHideControls();
    },
    
    play() {
      if (this.videoContext) {
        this.videoContext.play();
      }
    },
    
    pause() {
      if (this.videoContext) {
        this.videoContext.pause();
      }
    },
    
    onFullScreenChange(e) {
      this.setData({
        isFullScreen: e.detail.fullScreen
      });
      
      // 通知父组件全屏状态变化
      this.triggerEvent('fullscreenchange', { 
        fullScreen: e.detail.fullScreen 
      });
      
      // 在切换全屏时，重置控制按钮的显示状态
      this.autoHideControls();
    },
    
    onVideoLoad() {
      this.setData({
        isLoading: false,
        hasError: false
      });
      
      // 更新导航栏标题为章节标题
      if (this.properties.chapter && this.properties.chapter.title) {
        wx.setNavigationBarTitle({
          title: this.properties.chapter.title
        });
      }
      
      // 加载完成后显示控制按钮一小段时间
      this.autoHideControls();
    },
    
    onVideoError(e) {
      console.error('视频加载错误:', e);
      this.setData({
        isLoading: false,
        hasError: true,
        errorMsg: '视频加载失败，请检查网络连接'
      });
      
      // 通知父组件视频加载错误
      this.triggerEvent('videoerror', e.detail);
    },
    
    // 重试加载视频
    retryVideo() {
      this.setData({
        isLoading: true,
        hasError: false
      });
      
      setTimeout(() => {
        if (this.videoContext) {
          this.videoContext.play();
        }
      }, 1000);
    },

    onVideoPlay() {
      console.log('视频开始播放');
      this.setData({
        isLoading: false,
        hasError: false,
        isPlaying: true
      });
      
      // 视频开始播放时，设置一个短暂的时间后隐藏控制按钮
      this.autoHideControls();
      
      // 通知父组件
      this.triggerEvent('statechange', { isPlaying: true });
    },

    onVideoPause() {
      console.log('视频暂停');
      this.setData({
        isPlaying: false,
        showControls: true  // 视频暂停时始终显示控制按钮
      });
      
      // 通知父组件
      this.triggerEvent('statechange', { isPlaying: false });
    },

    onVideoEnd() {
      console.log('视频播放结束');
      this.setData({
        isPlaying: false,
        showControls: true  // 视频结束时显示控制按钮
      });
      
      // 通知父组件视频结束，可以自动播放下一个
      this.triggerEvent('ended');
    },

    // 改进的togglePlay方法
    togglePlay() {
      if (this.videoContext) {
        if (this.data.isPlaying) {
          this.videoContext.pause();
        } else {
          this.videoContext.play();
        }
      }
      
      // 无论如何，每次点击都重置控制按钮的显示
      this.autoHideControls();
    },

    // 添加上一个和下一个视频方法
    prevVideo() {
      this.triggerEvent('prev');
    },

    nextVideo() {
      this.triggerEvent('next');
    },

    // 改进的视频旋转切换方法
    toggleRotate() {
      // 在全屏模式下不应该旋转，因为它会导致UI问题
      if (this.data.isFullScreen) {
        wx.showToast({
          title: '请退出全屏后再旋转视频',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      this.setData({
        isRotated: !this.data.isRotated
      });
      
      // 旋转视频时重置控制按钮显示
      this.autoHideControls();
      
      // 通知父组件视频已旋转
      this.triggerEvent('rotatechange', { 
        isRotated: this.data.isRotated 
      });
    },

    // 在组件生命周期函数中清除超时计时器
    detached() {
      if (this.loadingTimeout) {
        clearTimeout(this.loadingTimeout);
      }
      
      if (this.data.controlsTimer) {
        clearTimeout(this.data.controlsTimer);
      }
    }
  }
}); 