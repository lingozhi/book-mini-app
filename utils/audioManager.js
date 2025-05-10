/**
 * 全局音频管理器
 * 用于管理全局音频播放，确保同一时间只有一个音频在播放
 */

// 全局音频上下文
let currentAudioContext = null;

/**
 * 创建音频上下文
 * @param {string} src - 音频URL
 * @param {Object} options - 配置选项
 * @returns {InnerAudioContext} 创建的音频上下文
 */
const createAudio = (src, options = {}) => {
  // 先停止并销毁现有的音频
  stopAndDestroyCurrent();
  
  // 创建新的音频上下文
  const audioContext = wx.createInnerAudioContext();
  audioContext.src = src;
  
  // 应用配置选项
  if (options.autoplay) {
    audioContext.autoplay = true;
  }
  
  if (options.playbackRate && options.playbackRate !== 1.0) {
    audioContext.playbackRate = options.playbackRate;
  }
  
  // 保存为当前音频上下文
  currentAudioContext = audioContext;
  
  return audioContext;
};

/**
 * 停止并销毁当前播放的音频
 */
const stopAndDestroyCurrent = () => {
  if (currentAudioContext) {
    try {
      currentAudioContext.stop();
      currentAudioContext.destroy();
    } catch (err) {
      console.error('音频停止或销毁出错:', err);
    }
    currentAudioContext = null;
  }
};

/**
 * 获取当前音频上下文
 * @returns {InnerAudioContext|null} 当前音频上下文
 */
const getCurrentAudio = () => {
  return currentAudioContext;
};

/**
 * 暂停当前音频
 */
const pauseCurrent = () => {
  if (currentAudioContext) {
    try {
      currentAudioContext.pause();
    } catch (err) {
      console.error('音频暂停出错:', err);
    }
  }
};

/**
 * 播放当前音频
 */
const playCurrent = () => {
  if (currentAudioContext) {
    try {
      currentAudioContext.play();
    } catch (err) {
      console.error('音频播放出错:', err);
    }
  }
};

module.exports = {
  createAudio,
  stopAndDestroyCurrent,
  getCurrentAudio,
  pauseCurrent,
  playCurrent
}; 