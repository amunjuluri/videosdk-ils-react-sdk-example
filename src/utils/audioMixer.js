// utils/AudioMixer.js

class TeacherAudioMixer {
  constructor(config) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.teacherGain = this.audioContext.createGain();
    this.musicGain = this.audioContext.createGain();
    this.streamDestination = this.audioContext.createMediaStreamDestination();
    
    // Connect nodes
    this.masterGain.connect(this.audioContext.destination);
    this.teacherGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    
    // Connect to stream destination
    this.teacherGain.connect(this.streamDestination);
    this.musicGain.connect(this.streamDestination);
    
    // Initialize values
    this.teacherGain.gain.value = config.initialTeacherVolume !== undefined ? config.initialTeacherVolume : 1.0;
    this.musicGain.gain.value = config.initialMusicVolume !== undefined ? config.initialMusicVolume : 0.3;
    
    this.musicSource = null;
    this.teacherSource = null;
    this.isPlaying = false;
  }

  async loadMusic(url) {
    try {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = url;

      await new Promise((resolve, reject) => {
        audio.addEventListener('loadeddata', resolve);
        audio.addEventListener('error', reject);
        audio.load();
      });

      const mediaSource = this.audioContext.createMediaElementSource(audio);
      mediaSource.connect(this.musicGain);
      
      this.musicSource = {
        buffer: null,
        start: () => audio.play(),
        stop: () => {
          audio.pause();
          audio.currentTime = 0;
        },
        disconnect: () => mediaSource.disconnect(),
      };

      return true;
    } catch (error) {
      console.error('Error loading music:', error);
      return false;
    }
  }

  setTeacherStream(mediaStream) {
    if (this.teacherSource) {
      this.teacherSource.disconnect();
    }
    this.teacherSource = this.audioContext.createMediaStreamSource(mediaStream);
    this.teacherSource.connect(this.teacherGain);
  }

  startMusic() {
    if (this.musicSource && !this.isPlaying) {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      this.musicSource.start(0);
      this.isPlaying = true;
    }
  }

  stopMusic() {
    if (this.musicSource && this.isPlaying) {
      this.musicSource.stop();
      this.isPlaying = false;
    }
  }

  setMusicVolume(value) {
    this.musicGain.gain.value = Math.max(0, Math.min(1, value));
  }

  setTeacherVolume(value) {
    this.teacherGain.gain.value = Math.max(0, Math.min(1, value));
  }

  getMixedStream() {
    return this.streamDestination.stream;
  }

  disconnect() {
    if (this.musicSource) {
      this.musicSource.disconnect();
    }
    if (this.teacherSource) {
      this.teacherSource.disconnect();
    }
    this.teacherGain.disconnect();
    this.musicGain.disconnect();
    this.masterGain.disconnect();
  }
}

export { TeacherAudioMixer };