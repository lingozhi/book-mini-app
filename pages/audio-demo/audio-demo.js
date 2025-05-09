Page({
  data: {
    audioSrc: 'https://storage.googleapis.com/site-assets-prod/assets/audio/video-explainer-audio.mp3', // 示例音频
    isPlaying: false,
    currentAudioIndex: 0,
    audioList: [
      {
        title: '音频示例 1',
        url: 'https://storage.googleapis.com/site-assets-prod/assets/audio/video-explainer-audio.mp3'
      },
      {
        title: '音频示例 2',
        url: 'https://dl.espressif.com/dl/audio/ff-16b-2c-44100hz.mp3'
      },
      {
        title: '音频示例 3',
        url: 'https://dl.espressif.com/dl/audio/ff-16b-2c-44100hz.mp3'
      }
    ],
    // 男声版本的音频列表
    menAudioList: [
      {
        title: '男声 - 音频 1',
        url: 'https://storage.googleapis.com/site-assets-prod/assets/audio/video-explainer-audio.mp3'
      },
      {
        title: '男声 - 音频 2',
        url: 'https://dl.espressif.com/dl/audio/ff-16b-2c-44100hz.mp3'
      },
      {
        title: '男声 - 音频 3',
        url: 'https://dl.espressif.com/dl/audio/ff-16b-2c-44100hz.mp3'
      }
    ],
    // 女声版本的音频列表
    womenAudioList: [
      {
        title: '女声 - 音频 1',
        url: 'https://storage.googleapis.com/site-assets-prod/assets/audio/video-explainer-audio.mp3'
      },
      {
        title: '女声 - 音频 2',
        url: 'https://dl.espressif.com/dl/audio/ff-16b-2c-44100hz.mp3'
      },
      {
        title: '女声 - 音频 3',
        url: 'https://dl.espressif.com/dl/audio/ff-16b-2c-44100hz.mp3'
      }
    ],
    currentVoiceType: 'men' // 当前声音类型：men 或 women
  },

  onLoad() {
    // 页面加载完成后，将音频列表传递给音频播放器组件
    setTimeout(() => {
      const audioPlayer = this.selectComponent('#audioPlayer');
      if (audioPlayer) {
        audioPlayer.setAudioList(this.data.audioList);
      }
    }, 300);
  },

  // 处理音频状态变更事件
  onAudioStatusChange(e) {
    this.setData({
      isPlaying: e.detail.isPlaying
    });
  },

  // 处理音频结束事件
  onAudioEnded() {
    console.log('音频播放结束');
  },

  // 处理音频错误事件
  onAudioError(e) {
    console.error('音频播放错误:', e.detail);
    wx.showToast({
      title: '音频播放失败',
      icon: 'none'
    });
  },

  // 处理音频切换事件
  onAudioChange(e) {
    console.log('切换到音频:', e.detail.index);
    this.setData({
      currentAudioIndex: e.detail.index
    });
  },

  // 处理音频选择事件
  onAudioSelect(e) {
    console.log('选择音频:', e.detail.index);
    this.setData({
      currentAudioIndex: e.detail.index
    });
  },

  // 处理播放速度变更事件
  onSpeedChange(e) {
    console.log('播放速度变更:', e.detail.speed);
  },

  // 处理声音类型变更事件
  onVoiceChange(e) {
    const voiceType = e.detail.voice;
    console.log('声音类型变更:', voiceType);
    
    // 更新当前声音类型
    this.setData({
      currentVoiceType: voiceType
    });
    
    // 根据声音类型切换音频列表
    const audioList = voiceType === 'men' ? this.data.menAudioList : this.data.womenAudioList;
    
    // 获取音频播放器组件并更新音频列表
    const audioPlayer = this.selectComponent('#audioPlayer');
    if (audioPlayer) {
      audioPlayer.setAudioList(audioList, this.data.currentAudioIndex);
    }
  },

  onUnload() {
    // 页面卸载时，确保音频资源被释放
    const audioPlayer = this.selectComponent('#audioPlayer');
    if (audioPlayer && audioPlayer.releaseAudioContext) {
      audioPlayer.releaseAudioContext();
    }
  }
}) 