Component({
  properties: {
    chapter: {
      type: Object,
      value: { title: '', filePath: '' }
    },
    isPlaying: {
      type: Boolean,
      value: false,
      observer: function(newVal) {
        console.log('isPlaying 属性变化:', newVal);
        // 当外部isPlaying属性改变时，同步音频播放状态
        if (newVal !== this.data.localIsPlaying) {
          console.log('外部请求同步播放状态:', newVal ? '播放' : '暂停');
          
          if (newVal) {
            // 如果请求播放
            if (this.data.useBackgroundAudio && this.data.bgAudioManager) {
              console.log('通过观察器播放背景音频');
              this.data.bgAudioManager.play();
            } else if (this.data.audioContext) {
              console.log('通过观察器播放内部音频');
              this.data.audioContext.play();
            }
            this.setData({ localIsPlaying: true });
          } else {
            // 如果请求暂停
            if (this.data.useBackgroundAudio && this.data.bgAudioManager) {
              console.log('通过观察器暂停背景音频');
              this.data.bgAudioManager.pause();
            } else if (this.data.audioContext) {
              console.log('通过观察器暂停内部音频');
              this.data.audioContext.pause();
            }
            this.setData({ localIsPlaying: false });
          }
        }
      }
    },
    currentTime: {
      type: String,
      value: '00:00'
    },
    duration: {
      type: String,
      value: '--:--'
    },
    progress: {
      type: Number,
      value: 0
    },
    audioSrc: {
      type: String,
      value: ''
    }
  },

  data: {
    audioContext: null,
    bgAudioManager: null,
    useBackgroundAudio: false,
    localIsPlaying: false,
    localCurrentTime: '00:00',
    localDuration: '--:--',
    localProgress: 0,
    error: '',
    lastClickTime: 0
  },

  lifetimes: {
    attached() {
      // 当组件实例进入页面节点树时执行
      this.initAudioContext();
    },
    detached() {
      // 当组件实例被从页面节点树移除时执行
      this.releaseAudioResources();
    }
  },

  methods: {
    // 添加setUrl方法，用于设置音频URL并播放
    setUrl(url, title) {
      console.log('Setting audio URL:', url, 'Title:', title);
      
      if (!url) {
        this.setData({ 
          error: '无法播放音频：未设置音频URL'
        });
        return;
      }
      
      // 设置音频源和标题
      this.setData({
        audioSrc: url,
        'chapter.title': title || '音频播放',
        'chapter.filePath': url
      });
      
      // 释放之前的资源
      this.releaseAudioResources();
      
      // 重新初始化音频上下文
      this.initAudioContext();
      
      // 短暂延迟后播放
      setTimeout(() => {
        this.play();
      }, 300);
    },
    
    releaseAudioResources() {
      try {
        // 安全地尝试停止和销毁音频上下文
        if (this.data.audioContext) {
          // 确保stop方法存在并且是一个函数
          if (this.data.audioContext.stop && typeof this.data.audioContext.stop === 'function') {
            try {
              this.data.audioContext.stop();
            } catch (e) {
              console.error('停止音频上下文失败:', e);
            }
          }
          
          // 不再使用setData来设置为null，而是直接修改变量
          this.data.audioContext = null;
        }
        
        // 安全地尝试停止背景音频
        if (this.data.bgAudioManager) {
          if (this.data.bgAudioManager.stop && typeof this.data.bgAudioManager.stop === 'function') {
            try {
              this.data.bgAudioManager.stop();
            } catch (e) {
              console.error('停止背景音频失败:', e);
            }
          }
          
          // 不再使用setData来设置为null，而是直接修改变量
          this.data.bgAudioManager = null;
        }
      } catch (e) {
        console.error('释放音频资源时发生错误:', e);
      }
    },
    
    initAudioContext() {
      this.releaseAudioResources();
      
      // 尝试两种音频播放方式
      if (this.data.useBackgroundAudio) {
        this.initBackgroundAudio();
      } else {
        this.initInnerAudio();
      }
    },
    
    initInnerAudio() {
      // 创建新的音频上下文
      const audioContext = wx.createInnerAudioContext({
        useWebAudioImplement: false // 使用原生音频实现，可能更稳定
      });
      
      // 使用父组件传入的音频源，如果没有则尝试使用chapter中的filePath
      const src = this.properties.audioSrc || (this.properties.chapter && this.properties.chapter.filePath);
      
      console.log('初始化内部音频，源:', src);
      
      if (src) {
        // 设置音频属性
        audioContext.src = src;
        audioContext.obeyMuteSwitch = false; // 忽略手机静音开关
        audioContext.autoplay = false;
        
        this.setData({ error: '' });
        
        // 注册音频事件处理器
        audioContext.onCanplay(() => {
          console.log('音频可以播放');
        });
        
        audioContext.onPlay(() => {
          console.log('音频开始播放');
          this.setData({ 
            localIsPlaying: true
          });
          this.triggerEvent('statusUpdate', { isPlaying: true });
        });
        
        audioContext.onPause(() => {
          console.log('音频已暂停');
          this.setData({ 
            localIsPlaying: false
          });
          this.triggerEvent('statusUpdate', { isPlaying: false });
        });
        
        audioContext.onStop(() => {
          console.log('音频已停止');
          this.setData({ 
            localIsPlaying: false
          });
          this.triggerEvent('statusUpdate', { isPlaying: false });
        });
        
        audioContext.onEnded(() => {
          console.log('音频播放完毕');
          this.setData({ 
            localIsPlaying: false
          });
          this.triggerEvent('statusUpdate', { isPlaying: false });
          this.triggerEvent('ended');
        });
        
        audioContext.onTimeUpdate(() => {
          const currentTime = this.formatTime(audioContext.currentTime);
          const duration = this.formatTime(audioContext.duration);
          const progress = audioContext.duration > 0 
            ? (audioContext.currentTime / audioContext.duration) * 100 
            : 0;
          
          this.setData({
            localCurrentTime: currentTime,
            localDuration: duration,
            localProgress: progress
          });
          
          this.triggerEvent('timeUpdate', {
            currentTime,
            duration,
            progress
          });
        });
        
        audioContext.onError((err) => {
          console.error('音频播放错误:', err);
          this.setData({ 
            error: `音频播放错误: ${err.errMsg || '未知错误'} (错误码: ${err.errCode})`,
            localIsPlaying: false
          });
          
          // 如果内部音频上下文失败，尝试切换到背景音频播放
          this.setData({ 
            useBackgroundAudio: true
          });
          this.initAudioContext();
          
          this.triggerEvent('error', err);
        });
        
        // 直接保存到this.data，这样其他方法可以立即访问
        this.data.audioContext = audioContext;
        
        // 验证音频对象是否有效
        if (!this.data.audioContext) {
          console.error('音频上下文创建后仍为空');
          this.setData({
            error: '创建音频上下文失败'
          });
        } else {
          console.log('音频上下文创建成功');
        }
      } else {
        this.setData({ 
          error: '无法播放音频：未设置音频源'
        });
      }
    },
    
    initBackgroundAudio() {
      const bgAudioManager = wx.getBackgroundAudioManager();
      const src = this.properties.audioSrc || (this.properties.chapter && this.properties.chapter.filePath);
      
      console.log('初始化背景音频，源:', src);
      
      if (src) {
        // 必须设置的属性
        bgAudioManager.title = this.properties.chapter.title || '音频播放';
        bgAudioManager.epname = '有声读物';
        bgAudioManager.singer = '阅读器';
        bgAudioManager.coverImgUrl = 'https://p1.music.126.net/LKkiAMqJ4z_mLdGl_sYb_w==/109951163335260008.jpg'; // 默认封面
        bgAudioManager.src = src;
        
        // 默认不自动播放
        bgAudioManager.startTime = 0;
        bgAudioManager.autoplay = false;
        
        bgAudioManager.onPlay(() => {
          console.log('背景音频开始播放');
          this.setData({ 
            localIsPlaying: true
          });
          this.triggerEvent('statusUpdate', { isPlaying: true });
        });
        
        bgAudioManager.onPause(() => {
          console.log('背景音频已暂停');
          this.setData({ 
            localIsPlaying: false
          });
          this.triggerEvent('statusUpdate', { isPlaying: false });
        });
        
        bgAudioManager.onStop(() => {
          console.log('背景音频已停止');
          this.setData({ 
            localIsPlaying: false
          });
          this.triggerEvent('statusUpdate', { isPlaying: false });
        });
        
        bgAudioManager.onEnded(() => {
          console.log('背景音频播放完毕');
          this.setData({ 
            localIsPlaying: false
          });
          this.triggerEvent('statusUpdate', { isPlaying: false });
          this.triggerEvent('ended');
        });
        
        bgAudioManager.onTimeUpdate(() => {
          const currentTime = this.formatTime(bgAudioManager.currentTime);
          const duration = this.formatTime(bgAudioManager.duration);
          const progress = bgAudioManager.duration > 0 
            ? (bgAudioManager.currentTime / bgAudioManager.duration) * 100 
            : 0;
          
          this.setData({
            localCurrentTime: currentTime,
            localDuration: duration,
            localProgress: progress
          });
          
          this.triggerEvent('timeUpdate', {
            currentTime,
            duration,
            progress
          });
        });
        
        bgAudioManager.onWaiting(() => {
          console.log('背景音频加载中');
        });
        
        bgAudioManager.onError((err) => {
          console.error('背景音频播放错误:', err);
          this.setData({ 
            error: `背景音频播放错误: ${err.errMsg || '未知错误'}`,
            localIsPlaying: false
          });
          
          // 如果背景音频失败，尝试切换回内部音频
          this.setData({ 
            useBackgroundAudio: false
          });
          this.initAudioContext();
          
          this.triggerEvent('error', err);
        });
        
        // 直接保存到this.data，不使用setData
        this.data.bgAudioManager = bgAudioManager;
        
        // 验证音频对象是否有效
        if (!this.data.bgAudioManager) {
          console.error('背景音频管理器创建后仍为空');
          this.setData({
            error: '创建背景音频管理器失败'
          });
        } else {
          console.log('背景音频管理器创建成功');
        }
      } else {
        this.setData({ 
          error: '无法播放背景音频：未设置音频源'
        });
      }
    },
    
    formatTime(seconds) {
      if (!seconds || isNaN(seconds)) return '--:--';
      
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    },

    // 播放音频
    play() {
      try {
        if (this.data.useBackgroundAudio && this.data.bgAudioManager) {
          console.log('尝试播放背景音频');
          this.data.bgAudioManager.play();
          // 立即更新本地播放状态
          this.setData({ 
            localIsPlaying: true
          });
        } else if (this.data.audioContext) {
          console.log('尝试播放内部音频');
          this.data.audioContext.play();
          // 立即更新本地播放状态
          this.setData({ 
            localIsPlaying: true
          });
        } else {
          console.error('无法找到有效的音频播放器');
          this.setData({ 
            error: '无法播放：音频播放器未初始化'
          });
        }
        
        // 通知父组件状态变化
        this.triggerEvent('statusUpdate', { isPlaying: true });
      } catch (e) {
        console.error('播放音频时发生错误:', e);
        this.setData({
          error: `播放音频时发生错误: ${e.message || '未知错误'}`
        });
      }
    },
    
    // 暂停音频
    pause() {
      try {
        if (this.data.useBackgroundAudio && this.data.bgAudioManager) {
          console.log('尝试暂停背景音频');
          this.data.bgAudioManager.pause();
          // 立即更新本地播放状态
          this.setData({
            localIsPlaying: false
          });
        } else if (this.data.audioContext) {
          console.log('尝试暂停内部音频');
          this.data.audioContext.pause();
          // 立即更新本地播放状态
          this.setData({
            localIsPlaying: false
          });
        } else {
          console.error('无法找到有效的音频播放器来暂停');
        }
        
        // 通知父组件状态变化
        this.triggerEvent('statusUpdate', { isPlaying: false });
      } catch (e) {
        console.error('暂停音频时发生错误:', e);
      }
    },
    
    // 按钮点击事件处理
    onPlayTap(e) {
      console.log('PLAY TAP EVENT TRIGGERED', e);
      
      // 防止短时间内多次点击
      const now = Date.now();
      if (now - this.data.lastClickTime < 300) {
        console.log('点击过快，忽略');
        return;
      }
      this.setData({ lastClickTime: now });
      
      if (this.data.localIsPlaying) {
        console.log('PAUSE 请求');
        this.pause();
      } else {
        console.log('PLAY 请求');
        this.play();
      }
    },
    
    onPrevTap() {
      console.log('PREV TAP EVENT TRIGGERED');
      this.triggerEvent('prev');
    },
    
    onNextTap() {
      console.log('NEXT TAP EVENT TRIGGERED');
      this.triggerEvent('next');
    },
    
    onProgressChange(e) {
      const value = e.detail.value;
      
      // 根据播放模式调整进度
      if (this.data.useBackgroundAudio && this.data.bgAudioManager) {
        if (this.data.bgAudioManager.duration) {
          const seekTime = (value / 100) * this.data.bgAudioManager.duration;
          this.data.bgAudioManager.seek(seekTime);
        }
      } else if (this.data.audioContext && this.data.audioContext.duration) {
        const seekTime = (value / 100) * this.data.audioContext.duration;
        this.data.audioContext.seek(seekTime);
      }
      
      // 通知父页面调整播放进度
      this.triggerEvent('progressChange', { value });
    }
  }
}); 