# 音频播放器组件 (Audio Player Component)

一个功能完整的微信小程序音频播放器组件，支持播放/暂停、进度条拖拽、上一首/下一首、倍速播放和声音类型切换等功能。

## 功能特点

- 播放、暂停音频
- 实时显示播放进度条，支持拖拽定位
- 切换上一首/下一首
- 可调节播放速度（0.5x, 1.0x, 1.5x, 2.0x）
- 支持男/女声等不同音源切换
- 显示音频列表，可直接点击切换

## 使用方法

### 1. 在页面的 JSON 文件中引入组件

```json
{
  "usingComponents": {
    "audio-player": "/components/audio-player/audio-player"
  }
}
```

### 2. 在 WXML 中使用组件

```html
<audio-player 
  id="audioPlayer"
  audioSrc="{{audioSrc}}"
  bind:statusChange="onAudioStatusChange"
  bind:ended="onAudioEnded"
  bind:error="onAudioError"
  bind:audioChange="onAudioChange"
  bind:audioSelect="onAudioSelect"
  bind:speedChange="onSpeedChange"
  bind:voiceChange="onVoiceChange">
</audio-player>
```

### 3. 在 JS 文件中设置和控制组件

```javascript
Page({
  data: {
    audioSrc: '音频URL地址',
    isPlaying: false,
    currentAudioIndex: 0,
    audioList: [
      {
        title: '音频标题 1',
        url: '音频URL 1'
      },
      {
        title: '音频标题 2',
        url: '音频URL 2'
      }
    ]
  },

  onLoad() {
    // 页面加载完成后，设置音频列表
    setTimeout(() => {
      const audioPlayer = this.selectComponent('#audioPlayer');
      if (audioPlayer) {
        audioPlayer.setAudioList(this.data.audioList);
      }
    }, 300);
  },

  // 事件处理函数
  onAudioStatusChange(e) {
    this.setData({
      isPlaying: e.detail.isPlaying
    });
  },

  onUnload() {
    // 页面卸载时释放音频资源
    const audioPlayer = this.selectComponent('#audioPlayer');
    if (audioPlayer && audioPlayer.releaseAudioContext) {
      audioPlayer.releaseAudioContext();
    }
  }
})
```

## 组件属性 (Properties)

| 属性名 | 类型 | 默认值 | 说明 |
| ----- | --- | ----- | ---- |
| audioSrc | String | '' | 音频文件URL |
| autoplay | Boolean | false | 是否自动播放 |
| title | String | '音频播放' | 音频标题 |

## 组件方法 (Methods)

| 方法名 | 参数 | 说明 |
| ----- | --- | ---- |
| playAudio | 无 | 播放音频 |
| pauseAudio | 无 | 暂停音频 |
| togglePlay | 无 | 切换播放/暂停状态 |
| setSpeed | 无 | 设置播放速度（循环切换） |
| prevAudio | 无 | 播放上一首 |
| nextAudio | 无 | 播放下一首 |
| setAudioList | list, index | 设置音频列表和当前播放索引 |
| changeVoice | 无 | 切换声音类型（男/女声） |

## 组件事件 (Events)

| 事件名 | 事件详情 | 说明 |
| ----- | ------- | ---- |
| statusChange | {isPlaying} | 播放状态变更 |
| ended | 无 | 音频播放结束 |
| error | error对象 | 音频播放错误 |
| audioChange | {index, audio} | 切换到其他音频 |
| audioSelect | {index, audio} | 选择特定音频 |
| speedChange | {speed} | 播放速度变更 |
| voiceChange | {voice} | 声音类型变更（'men'/'women'） |

## 注意事项

1. 页面卸载时记得调用 `releaseAudioContext()` 方法释放音频资源
2. 组件内部已处理音频资源的销毁和重建，切换音频时无需额外处理
3. 需要提前准备好图标资源，并放在 `/assets/images/` 目录下，或者根据自己的需求修改图标路径
4. 音频URL必须是有效的HTTP(S)链接或本地文件路径 