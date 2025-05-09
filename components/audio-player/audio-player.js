Component({
  properties: {
    audioSrc: {
      type: String,
      value: '',
      observer: function(newVal) {
        if (newVal) {
          this.initializeAudio(newVal);
        }
      }
    },
    autoplay: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: '音频播放'
    }
  },

  data: {
    isPlaying: false,
    currentTime: '0:00',
    duration: '0:00',
    sliderValue: 0,
    sliderMax: 100,
    doubleSpeed: 1.0,
    audioList: [],
    currentAudioIndex: 0,
    showVoiceOptions: false,
    currentVoice: 'men', // 默认男声
  },

  lifetimes: {
    attached() {
      // 组件实例进入页面节点树时执行
      if (this.properties.audioSrc) {
        this.initializeAudio(this.properties.audioSrc);
        if (this.properties.autoplay) {
          setTimeout(() => this.playAudio(), 300);
        }
      }
    },
    detached() {
      // 组件实例从页面节点树移除时执行
      this.releaseAudioContext();
    }
  },

  methods: {
    // 初始化音频上下文
    initializeAudio(url) {
      // 释放之前的音频上下文
      this.releaseAudioContext();
      
      // 创建新的音频上下文
      this.audioContext = wx.createInnerAudioContext();
      this.audioContext.src = url;
      
      // 设置事件监听
      this.audioContext.onCanplay(() => {
        let durationTime = this.audioContext.duration || 0;
        this.setData({ 
          duration: this.formatTime(durationTime),
          sliderMax: durationTime
        });
      });
      
      // 监听音频播放进度更新
      this.audioContext.onTimeUpdate(() => {
        const currentTime = this.audioContext.currentTime || 0;
        const duration = this.audioContext.duration || 0;
        
        if (!this.data.isDragging) {
          this.setData({
            currentTime: this.formatTime(currentTime),
            sliderValue: currentTime,
            sliderMax: duration
          });
        }
      });
      
      // 监听音频播放结束
      this.audioContext.onEnded(() => {
        this.setData({ 
          isPlaying: false, 
          sliderValue: 0,
          currentTime: '0:00'
        });
        
        // 触发音频播放结束事件
        this.triggerEvent('ended');
        
        // 判断是否自动播放下一首
        if (this.data.audioList.length > 0 && this.data.currentAudioIndex < this.data.audioList.length - 1) {
          this.nextAudio();
        }
      });
      
      // 监听音频播放错误
      this.audioContext.onError((err) => {
        console.error('音频播放错误:', err);
        wx.showToast({
          title: `播放失败 (错误码: ${err.errCode})`,
          icon: 'none'
        });
        this.setData({ isPlaying: false });
        
        // 触发错误事件
        this.triggerEvent('error', err);
      });
      
      // 应用当前的播放速率
      if (this.data.doubleSpeed !== 1.0) {
        this.audioContext.playbackRate = this.data.doubleSpeed;
      }
    },
    
    // 释放音频上下文资源
    releaseAudioContext() {
      if (this.audioContext) {
        this.audioContext.stop();
        this.audioContext.destroy();
        this.audioContext = null;
      }
    },
    
    // 播放音频
    playAudio() {
      if (!this.audioContext || !this.audioContext.src) {
        wx.showToast({
          title: '无可播放的音频',
          icon: 'none'
        });
        return;
      }
      
      this.audioContext.play();
      this.setData({ isPlaying: true });
      
      // 触发播放状态变更事件
      this.triggerEvent('statusChange', { isPlaying: true });
    },
    
    // 暂停音频
    pauseAudio() {
      if (!this.audioContext) return;
      
      this.audioContext.pause();
      this.setData({ isPlaying: false });
      
      // 触发播放状态变更事件
      this.triggerEvent('statusChange', { isPlaying: false });
    },
    
    // 切换播放/暂停状态
    togglePlay() {
      if (this.data.isPlaying) {
        this.pauseAudio();
      } else {
        this.playAudio();
      }
    },
    
    // 设置播放速度
    setSpeed() {
      const currentSpeed = this.data.doubleSpeed;
      let newSpeed;
      
      // 循环切换播放速度: 1.0 -> 1.5 -> 2.0 -> 0.5 -> 1.0
      if (currentSpeed === 2.0) {
        newSpeed = 0.5;
      } else {
        newSpeed = currentSpeed + 0.5;
      }
      
      // 应用新的播放速度
      if (this.audioContext) {
        this.audioContext.playbackRate = newSpeed;
      }
      
      this.setData({ doubleSpeed: newSpeed });
      
      // 触发速度变更事件
      this.triggerEvent('speedChange', { speed: newSpeed });
    },
    
    // 进度条变化（拖动中）
    onSliderChanging() {
      this.setData({ isDragging: true });
    },
    
    // 进度条变化结束（拖动结束）
    onSliderChange(e) {
      const position = e.detail.value;
      
      if (this.audioContext) {
        this.audioContext.seek(position);
        this.setData({
          isDragging: false,
          currentTime: this.formatTime(position),
          sliderValue: position
        });
      }
    },
    
    // 设置音频列表
    setAudioList(list, index = 0) {
      if (!Array.isArray(list) || list.length === 0) return;
      
      this.setData({
        audioList: list,
        currentAudioIndex: index
      });
      
      // 加载当前索引的音频
      const currentAudio = list[index];
      if (currentAudio && currentAudio.url) {
        this.initializeAudio(currentAudio.url);
        this.setData({ title: currentAudio.title || '音频播放' });
      }
    },
    
    // 播放上一个音频
    prevAudio() {
      if (this.data.audioList.length === 0) return;
      
      let newIndex = this.data.currentAudioIndex - 1;
      if (newIndex < 0) {
        newIndex = this.data.audioList.length - 1;
      }
      
      this.setData({ currentAudioIndex: newIndex });
      
      const prevAudio = this.data.audioList[newIndex];
      if (prevAudio && prevAudio.url) {
        this.initializeAudio(prevAudio.url);
        this.setData({ title: prevAudio.title || '音频播放' });
        this.playAudio();
      }
      
      // 触发音频切换事件
      this.triggerEvent('audioChange', { 
        index: newIndex, 
        audio: this.data.audioList[newIndex] 
      });
    },
    
    // 播放下一个音频
    nextAudio() {
      if (this.data.audioList.length === 0) return;
      
      let newIndex = this.data.currentAudioIndex + 1;
      if (newIndex >= this.data.audioList.length) {
        newIndex = 0;
      }
      
      this.setData({ currentAudioIndex: newIndex });
      
      const nextAudio = this.data.audioList[newIndex];
      if (nextAudio && nextAudio.url) {
        this.initializeAudio(nextAudio.url);
        this.setData({ title: nextAudio.title || '音频播放' });
        this.playAudio();
      }
      
      // 触发音频切换事件
      this.triggerEvent('audioChange', { 
        index: newIndex, 
        audio: this.data.audioList[newIndex] 
      });
    },
    
    // 切换声音类型（男声/女声等）
    changeVoice() {
      // 这里切换声音类型，实际应用中可能需要加载不同的音频资源
      const newVoice = this.data.currentVoice === 'men' ? 'women' : 'men';
      this.setData({ currentVoice: newVoice });
      
      // 触发声音类型变更事件，让父组件提供对应的音频资源
      this.triggerEvent('voiceChange', { voice: newVoice });
    },
    
    // 选择音频（从列表中）
    selectAudio(e) {
      const index = e.currentTarget.dataset.index;
      if (index >= 0 && index < this.data.audioList.length) {
        this.setData({ currentAudioIndex: index });
        
        const selectedAudio = this.data.audioList[index];
        if (selectedAudio && selectedAudio.url) {
          this.initializeAudio(selectedAudio.url);
          this.setData({ title: selectedAudio.title || '音频播放' });
          this.playAudio();
        }
        
        // 触发音频选择事件
        this.triggerEvent('audioSelect', { 
          index: index, 
          audio: this.data.audioList[index] 
        });
      }
    },
    
    // 时间格式化（秒 -> 分:秒）
    formatTime(seconds) {
      if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
      
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      return `${min}:${sec.toString().padStart(2, '0')}`;
    }
  }
}) 