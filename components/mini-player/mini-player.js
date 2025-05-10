Component({
  properties: {
    track: {
      type: Object,
      value: {}
    },
    isPlaying: {
      type: Boolean,
      value: false
    }
  },
  
  data: {
    showPlayer: false,
    showPlaylist: false,
    playlistItems: [],
    currentAudioIndex: 0
  },
  
  lifetimes: {
    attached() {
      console.log('Mini player attached');
      this.checkAudioPlayback();
    },
    detached() {
      // 移除事件监听
      wx.offAppRoute && wx.offAppRoute(this.onAppRoute);
    }
  },
  
  pageLifetimes: {
    // 页面显示时更新播放状态
    show() {
      console.log('Mini player page show');
      this.checkAudioPlayback();
    }
  },
  
  methods: {
    // 检查音频播放状态并更新UI
    checkAudioPlayback() {
      const app = getApp();
      console.log('Checking audio playback status:', app.globalData.isPlayingInBackground);
      
      if (app.globalData.isPlayingInBackground && app.globalData.currentTrack) {
        console.log('Background audio active:', app.globalData.currentTrack.title);
        
        // 获取播放列表
        const audioList = app.globalData.audioList || [];
        
        // 确保currentAudioIndex正确，通过ID匹配当前播放的曲目
        let currentIndex = app.globalData.currentAudioIndex;
        
        // 通过ID双重检查当前播放的索引是否正确
        if (app.globalData.currentTrack && app.globalData.currentTrack.id) {
          const matchByIdIndex = audioList.findIndex(
            track => track.id === app.globalData.currentTrack.id
          );
          
          if (matchByIdIndex !== -1) {
            // 如果在列表中找到匹配的ID，优先使用此索引
            currentIndex = matchByIdIndex;
            console.log('Updated currentIndex by matching ID:', currentIndex);
            
            // 同步更新全局状态
            app.globalData.currentAudioIndex = currentIndex;
          }
        }
        
        console.log('Current audio index:', currentIndex, 'in list of', audioList.length);
        
        this.setData({
          track: app.globalData.currentTrack,
          isPlaying: app.globalData.currentTrack.isPlaying,
          showPlayer: true,
          playlistItems: audioList,
          currentAudioIndex: currentIndex
        });
      } else {
        // 确保没有活动音频时隐藏播放器
        this.setData({
          showPlayer: false,
          showPlaylist: false
        });
      }
    },
    
    togglePlay() {
      const app = getApp();
      if (app.globalData.currentAudioContext) {
        if (this.data.isPlaying) {
          app.globalData.currentAudioContext.pause();
          this.setData({ isPlaying: false });
          app.globalData.currentTrack.isPlaying = false;
        } else {
          app.globalData.currentAudioContext.play();
          this.setData({ isPlaying: true });
          app.globalData.currentTrack.isPlaying = true;
        }
      }
    },
    
    // 切换播放列表显示状态
    togglePlaylist() {
      // 在显示播放列表前，重新检查当前播放状态
      if (!this.data.showPlaylist) {
        this.checkAudioPlayback();
      }
      
      this.setData({
        showPlaylist: !this.data.showPlaylist
      });
    },
    
    // 选择播放列表中的曲目
    selectTrack(e) {
      const index = e.currentTarget.dataset.index;
      console.log('Selected track from mini player:', index);
      
      const app = getApp();
      if (app.globalData.audioList && app.globalData.audioList.length > index) {
        // 先隐藏播放列表
        this.setData({ showPlaylist: false });
        
        // 如果当前在播放页面，直接调用播放页面的方法播放所选曲目
        const pages = getCurrentPages();
        const currentPage = pages[pages.length - 1];
        
        if (currentPage && currentPage.route === 'pages/reader/play' && typeof currentPage.playTrackByIndex === 'function') {
          currentPage.playTrackByIndex(index);
          
          // 立即更新我们的本地状态，保持同步
          const track = app.globalData.audioList[index];
          if (track) {
            this.setData({
              currentAudioIndex: index,
              track: {
                id: track.id,
                title: track.title,
                url: track.url,
                isPlaying: true
              },
              isPlaying: true
            });
          }
          return;
        }
        
        // 如果不在播放页面，停止当前播放并跳转到播放页
        const track = app.globalData.audioList[index];
        if (track) {
          if (app.globalData.currentAudioContext) {
            app.globalData.currentAudioContext.stop();
          }
          
          // 更新全局状态
          app.globalData.currentAudioIndex = index;
          
          wx.navigateTo({
            url: `/pages/reader/play?id=${track.id}&type=audio&title=${encodeURIComponent(track.title)}&url=${encodeURIComponent(track.url)}&bookId=${app.globalData.currentBookId || ''}`,
            success: () => {
              console.log('Navigated to play page for track:', track.title);
            }
          });
        }
      }
    },
    
    // 跳转到完整播放页
    navigateToPlayer() {
      const app = getApp();
      const track = app.globalData.currentTrack;
      
      if (track) {
        wx.navigateTo({
          url: `/pages/reader/play?id=${track.id}&type=audio&title=${encodeURIComponent(track.title)}&url=${encodeURIComponent(track.url)}&bookId=${app.globalData.currentBookId || ''}`,
          success: () => {
            // 跳转成功后关闭播放列表
            this.setData({ showPlaylist: false });
          }
        });
      }
    },
    
    // 关闭播放器并停止播放
    closePlayer() {
      const app = getApp();
      if (app.globalData.currentAudioContext) {
        app.globalData.currentAudioContext.stop();
        app.globalData.currentAudioContext.destroy();
        app.globalData.currentAudioContext = null;
      }
      
      app.globalData.isPlayingInBackground = false;
      app.globalData.currentTrack = null;
      
      this.setData({
        showPlayer: false,
        isPlaying: false,
        showPlaylist: false
      });
    }
  }
}); 