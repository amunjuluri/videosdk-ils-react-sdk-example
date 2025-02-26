import React, { useState, useEffect, useRef } from 'react';
import { useMeeting } from "@videosdk.live/react-sdk";

const MusicPlayer = () => {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [volume, setVolume] = useState(0.5);
  const [audioError, setAudioError] = useState(null);
  
  // Refs
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const micSourceRef = useRef(null);
  const audioGainRef = useRef(null);
  const micGainRef = useRef(null);
  const streamDestinationRef = useRef(null);
  
  // VideoSDK meeting
  const meeting = useMeeting();
  
  // Logger
  const log = (message, data) => {
    console.log(`[MusicPlayer] ${message}`, data || '');
  };
  
  // Audio file paths to try (multiple options for better compatibility)
  const audioFiles = [
    // Try these paths in order
    process.env.PUBLIC_URL + '/audio/demo.mp3',  // For create-react-app with PUBLIC_URL
    '/audio/demo.mp3',                           // For standard public folder
    '/react-ils-demo/audio/demo.mp3',            // For subdirectory deployment
    './audio/demo.mp3'                           // Relative path
  ];
  
  // Try to load audio files in sequence
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    let currentFileIndex = 0;
    
    const tryNextFile = () => {
      if (currentFileIndex >= audioFiles.length) {
        setAudioError("Couldn't load audio file. Please check file path.");
        setStatus("Error: Audio file not found");
        log("All audio paths failed", audioFiles);
        return;
      }
      
      const path = audioFiles[currentFileIndex];
      log(`Trying audio path: ${path}`);
      audio.src = path;
      currentFileIndex++;
    };
    
    // Set up error handler to try next file
    const handleError = () => {
      log(`Audio path failed: ${audio.src}`);
      tryNextFile();
    };
    
    // Set up success handler
    const handleCanPlay = () => {
      log(`Audio loaded successfully: ${audio.src}`);
      setStatus("Ready to play");
      setAudioError(null);
      // Remove the temporary listeners
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
    
    // Add temporary listeners
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    
    // Start trying files
    tryNextFile();
    
    // Cleanup
    return () => {
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);
  
  // Initialize Web Audio API
  useEffect(() => {
    try {
      // Create audio context
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      
      // Create gain nodes
      const audioGain = ctx.createGain();
      audioGain.gain.value = volume;
      audioGainRef.current = audioGain;
      
      const micGain = ctx.createGain();
      micGain.gain.value = 1.0;
      micGainRef.current = micGain;
      
      // Create destination for streaming
      const streamDestination = ctx.createMediaStreamDestination();
      streamDestinationRef.current = streamDestination;
      
      // Connect gain nodes
      audioGain.connect(streamDestination);
      micGain.connect(streamDestination);
      
      // Connect audio gain to local output
      audioGain.connect(ctx.destination);
      
      log("Audio context initialized");
      
      // Get user's microphone
      setupMicrophone();
    } catch (error) {
      console.error("[MusicPlayer] Error initializing audio:", error);
      setStatus("Error initializing audio");
      setAudioError(error.message);
    }
    
    // Cleanup
    return () => {
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (err) {
          console.error("[MusicPlayer] Error closing audio context:", err);
        }
      }
    };
  }, []);
  
  // Setup microphone
  const setupMicrophone = async () => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (audioContextRef.current && micGainRef.current) {
        const micSource = audioContextRef.current.createMediaStreamSource(micStream);
        micSource.connect(micGainRef.current);
        micSourceRef.current = micSource;
        
        log("Microphone connected");
      }
    } catch (error) {
      console.error("[MusicPlayer] Error accessing microphone:", error);
      setStatus("Microphone access error");
    }
  };
  
  // Connect audio element to Web Audio API
  const connectAudioElement = () => {
    try {
      const audio = audioRef.current;
      const context = audioContextRef.current;
      
      if (!audio || !context || !audioGainRef.current) {
        log("Missing audio elements for connection");
        return false;
      }
      
      // Only create source once
      if (!audioSourceRef.current) {
        // Resume context if suspended
        if (context.state === 'suspended') {
          context.resume();
        }
        
        // Create source
        const source = context.createMediaElementSource(audio);
        audioSourceRef.current = source;
        
        // Connect to gain node
        source.connect(audioGainRef.current);
        
        log("Audio connected to Web Audio API");
      }
      
      return true;
    } catch (error) {
      console.error("[MusicPlayer] Error connecting audio:", error);
      setStatus("Error connecting audio");
      setAudioError(error.message);
      return false;
    }
  };
  
  // Toggle play/pause
  // Replace your current togglePlay function with this updated version
const togglePlay = () => {
  if (audioError) {
    setStatus("Cannot play: " + audioError);
    return;
  }

  const audio = audioRef.current;
  if (!audio) return;

  // Resume the AudioContext if it’s suspended
  if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
    audioContextRef.current.resume();
  }

  // If not already playing, start playback and streaming automatically
  if (!isPlaying) {
    connectAudioElement();

    audio.play()
      .then(() => {
        // Automatically start streaming after playback begins
        if (meeting && typeof meeting.changeMic === 'function') {
          startStreaming();
        }
        setIsPlaying(true);
        setStatus("Playing and streaming");
      })
      .catch(error => {
        console.error("[MusicPlayer] Play error:", error);
        setStatus("Error playing audio");
        setAudioError(error.message);
      });
  } else {
    // If currently playing, pause playback and stop streaming
    audio.pause();
    if (isStreaming && meeting && typeof meeting.changeMic === 'function') {
      stopStreaming();
    }
    setIsPlaying(false);
    setStatus("Paused");
  }
};

  
  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    
    // Update gain node
    if (audioGainRef.current) {
      audioGainRef.current.gain.value = newVolume;
    }
  };
  
  // Toggle streaming to participants
  const toggleStreaming = () => {
    if (!meeting) {
      setStatus("No meeting available");
      return;
    }
    
    if (!isStreaming) {
      startStreaming();
    } else {
      stopStreaming();
    }
  };
  
  // Start streaming audio to participants
  const startStreaming = () => {
    try {
      // Make sure audio is connected
      connectAudioElement();
      
      // Get mixed stream
      const mixedStream = streamDestinationRef.current.stream;
      if (!mixedStream || mixedStream.getAudioTracks().length === 0) {
        setStatus("No audio stream available");
        return;
      }
      
      // Get audio track
      const audioTrack = mixedStream.getAudioTracks()[0];
      
      // Update meeting audio track
      if (meeting && typeof meeting.changeMic === 'function') {
        meeting.changeMic(audioTrack);
        setIsStreaming(true);
        setStatus(isPlaying ? "Playing and streaming" : "Ready (streaming on)");
        log("Started streaming to participants");
      } else {
        setStatus("Meeting API not available");
        log("changeMic method not available", {
          meeting: !!meeting,
          methods: meeting ? Object.keys(meeting).filter(k => typeof meeting[k] === 'function') : []
        });
      }
    } catch (error) {
      console.error("[MusicPlayer] Error starting stream:", error);
      setStatus("Error starting stream");
    }
  };
  
  // Stop streaming to participants
  const stopStreaming = () => {
    try {
      if (meeting && typeof meeting.changeMic === 'function') {
        // Reset to default microphone
        meeting.changeMic();
        setIsStreaming(false);
        setStatus(isPlaying ? "Playing (local only)" : "Ready");
        log("Stopped streaming");
      } else {
        setStatus("Meeting API not available");
      }
    } catch (error) {
      console.error("[MusicPlayer] Error stopping stream:", error);
      setStatus("Error stopping stream");
    }
  };
  
  // Audio element event handlers
  const handleAudioPlay = () => {
    setIsPlaying(true);
    setStatus(isStreaming ? "Playing and streaming" : "Playing");
  };
  
  const handleAudioPause = () => {
    setIsPlaying(false);
    setStatus(isStreaming ? "Paused (streaming on)" : "Paused");
  };
  
  const handleAudioEnded = () => {
    setIsPlaying(false);
    setStatus(isStreaming ? "Ended (streaming on)" : "Ended");
  };
  
  const handleAudioError = (e) => {
    // We're handling errors in the tryNextFile function
    // This is just for unexpected errors during playback
    if (e.target.error && e.target.error.code) {
      const errorMessages = {
        1: "MEDIA_ERR_ABORTED: Fetching process aborted",
        2: "MEDIA_ERR_NETWORK: Network error",
        3: "MEDIA_ERR_DECODE: Decoding error",
        4: "MEDIA_ERR_SRC_NOT_SUPPORTED: Format not supported"
      };
      
      const errorCode = e.target.error.code;
      const errorMessage = errorMessages[errorCode] || `Unknown error (${errorCode})`;
      log("Audio error during playback:", errorMessage);
      
      // Only update state if this is a playback error (not a file loading error)
      if (isPlaying) {
        setIsPlaying(false);
        setStatus(`Error: ${errorMessage}`);
      }
    }
  };

  return (
    <div className="music-player" style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.8)',
      padding: '15px',
      borderRadius: '8px',
      color: 'white',
      zIndex: 9999,
      width: '300px'
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>Background Music</h3>
      <div style={{ fontSize: '12px', marginBottom: '10px', color: audioError ? '#ff6b6b' : 'white' }}>
        Status: {status}
      </div>
      
      {/* Hidden audio element */}
      <audio 
        ref={audioRef}
        onPlay={handleAudioPlay}
        onPause={handleAudioPause}
        onEnded={handleAudioEnded}
        onError={handleAudioError}
        preload="auto"
        loop
      />
      
      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={togglePlay}
          disabled={!!audioError}
          style={{
            padding: '10px',
            borderRadius: '4px',
            border: 'none',
            background: audioError ? '#cccccc' : (isPlaying ? '#ff9500' : '#2D8CFF'),
            color: 'white',
            cursor: audioError ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {isPlaying ? '❚❚ Pause' : '▶ Play'}
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', width: '50px' }}>Volume:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            style={{ flex: 1 }}
          />
        </div>
        
        <button
          onClick={toggleStreaming}
          disabled={!meeting || !!audioError}
          style={{
            padding: '10px',
            borderRadius: '4px',
            border: 'none',
            background: !meeting || audioError ? '#cccccc' : (isStreaming ? '#ff5555' : '#55aa55'),
            color: 'white',
            cursor: (!meeting || audioError) ? 'not-allowed' : 'pointer',
            opacity: (!meeting || audioError) ? 0.7 : 1,
            fontWeight: 'bold'
          }}
        >
          {isStreaming ? 'Stop Streaming' : 'Start Streaming to Participants'}
        </button>
      </div>
      
      <div style={{ marginTop: '10px', fontSize: '11px', opacity: 0.8 }}>
        {meeting ? 'Meeting connected' : 'Meeting not connected'}
      </div>
    </div>
  );
};

export default MusicPlayer;