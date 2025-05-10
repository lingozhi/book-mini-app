// 导入音频管理器
const audioManager = require('../../utils/audioManager');

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
            if (this.data.audioContext) {
              console.log('通过观察器播放内部音频');
              this.data.audioContext.play();
            }
            this.setData({ localIsPlaying: true });
          } else {
            // 如果请求暂停
            if (this.data.audioContext) {
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
      
      // 重新初始化音频上下文
      this.initAudioContext();
      
      // 短暂延迟后播放
      setTimeout(() => {
        this.play();
      }, 300);
    },
    
    releaseAudioResources() {
      // 不再需要手动释放资源，由音频管理器统一管理
      this.data.audioContext = null;
    },
    
    initAudioContext() {
      // 使用音频管理器初始化音频上下文
      this.initInnerAudio();
    },
    
    initInnerAudio() {
      // 使用父组件传入的音频源，如果没有则尝试使用chapter中的filePath
      const src = this.properties.audioSrc || (this.properties.chapter && this.properties.chapter.filePath);
      
      console.log('初始化内部音频，源:', src);
      
      if (src) {
        // 使用音频管理器创建音频上下文
        const audioContext = audioManager.createAudio(src, {
          autoplay: false
        });
        
        this.data.audioContext = audioContext;
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
          
          this.triggerEvent('error', err);
        });
      } else {
        this.setData({ 
          error: '未提供音频源URL',
          localIsPlaying: false
        });
      }
    },
    
    formatTime(seconds) {
      if (!seconds || isNaN(seconds)) return '--:--';
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    },
    
    play() {
      if (this.data.audioContext) {
        // 防止连续点击
        const now = Date.now();
        if (now - this.data.lastClickTime < 300) {
          console.log('点击过于频繁，忽略');
          return;
        }
        this.setData({ lastClickTime: now });
        
        console.log('播放音频');
        try {
          this.data.audioContext.play();
          this.setData({ localIsPlaying: true });
          this.triggerEvent('statusUpdate', { isPlaying: true });
        } catch (e) {
          console.error('播放音频失败:', e);
          this.setData({ 
            error: `播放失败: ${e.message || '未知错误'}`,
            localIsPlaying: false
          });
        }
      }
    },
    
    pause() {
      if (this.data.audioContext) {
        console.log('暂停音频');
        try {
          this.data.audioContext.pause();
          this.setData({ localIsPlaying: false });
          this.triggerEvent('statusUpdate', { isPlaying: false });
        } catch (e) {
          console.error('暂停音频失败:', e);
        }
      }
    },
    
    onPlayTap(e) {
      console.log('点击播放按钮');
      // 防止事件冒泡
      e.stopPropagation && e.stopPropagation();
      
      if (this.data.localIsPlaying) {
        this.pause();
      } else {
        this.play();
      }
    },
    
    onPrevTap() {
      this.triggerEvent('prev');
    },
    
    onNextTap() {
      this.triggerEvent('next');
    },
    
    onProgressChange(e) {
      if (this.data.audioContext) {
        const value = e.detail.value;
        const duration = this.data.audioContext.duration;
        const seekTime = (value * duration) / 100;
        
        console.log('跳转播放进度:', seekTime, '秒');
        
        try {
          this.data.audioContext.seek(seekTime);
        } catch (e) {
          console.error('进度调整失败:', e);
        }
      }
    }
  }
}); 