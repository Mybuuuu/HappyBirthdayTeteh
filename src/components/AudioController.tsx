import { useEffect, useRef } from 'react';
import { AppState } from '../types';
import { audioReactivity } from '../utils/audioReactivity';

interface AudioControllerProps {
  appState: AppState;
}

export function AudioController({ appState }: AudioControllerProps) {
  const mainAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Audio unlock trigger for browser sandboxes
    const unlockUserAudio = () => {
      audioReactivity.resume();
    };
    window.addEventListener('pointerdown', unlockUserAudio);

    return () => {
      if (mainAudio.current) {
        mainAudio.current.pause();
      }
      window.removeEventListener('pointerdown', unlockUserAudio);
    };
  }, []);

  const fadeAudio = (audio: HTMLAudioElement, targetVolume: number, duration = 1000) => {
    const startVolume = audio.volume;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      let newVolume = startVolume + (targetVolume - startVolume) * progress;
      audio.volume = Math.max(0, Math.min(1, newVolume));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (targetVolume === 0) {
        audio.pause();
      }
    };
    
    if (targetVolume > 0 && audio.paused) {
      audio.play().catch(() => console.log("Audio play blocked"));
    }
    requestAnimationFrame(animate);
  };

  useEffect(() => {
    // Initialise audio on-demand when moving away from intro state
    if (appState !== 'intro' && !mainAudio.current) {
      const audio = new Audio('/audio/main.mp3');
      audio.loop = true;
      audio.volume = 0;
      mainAudio.current = audio;
      
      // Register for visualization/breathing reactivity
      audioReactivity.setAudioElement(audio);
    }

    // Play main audio directly starting from exploration phase
    if (appState === 'exploring') {
      if (mainAudio.current) fadeAudio(mainAudio.current, 0.5, 2000);
    } else if (appState === 'finale') {
      // Slightly increase volume during finale for emotion
      if (mainAudio.current) fadeAudio(mainAudio.current, 0.7, 2000);
    }
  }, [appState]);

  return null;
}
