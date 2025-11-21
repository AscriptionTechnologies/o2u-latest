import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Image } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Cloudinary } from '@cloudinary/url-gen';
import { quality, format } from '@cloudinary/url-gen/actions/delivery';
import { auto } from '@cloudinary/url-gen/qualifiers/quality';
import { auto as formatAuto } from '@cloudinary/url-gen/qualifiers/format';
import { fill } from '@cloudinary/url-gen/actions/resize';
import { videoCodec, audioCodec } from '@cloudinary/url-gen/actions/transcode';
import { auto as codecAuto } from '@cloudinary/url-gen/qualifiers/videoCodec';

export interface CloudinaryVideoPlayerProps {
  publicId: string;
  cloudName: string;
  isActive?: boolean;
  isMuted?: boolean;
  onReady?: () => void;
  onError?: (error: any) => void;
  style?: any;
  showLoading?: boolean;
  loop?: boolean;
}

export interface CloudinaryVideoPlayerHandle {
  playAsync: () => Promise<void>;
  pauseAsync: () => Promise<void>;
  setPositionAsync: (position: number) => Promise<void>;
  setIsMutedAsync: (isMuted: boolean) => Promise<void>;
  replayAsync: () => Promise<void>;
}

const CloudinaryVideoPlayer = forwardRef<CloudinaryVideoPlayerHandle, CloudinaryVideoPlayerProps>(
  (
    {
      publicId,
      cloudName,
      isActive = false,
      isMuted = false,
      onReady,
      onError,
      style,
      showLoading = true,
      loop = true,
    },
    ref
  ) => {
    const videoRef = useRef<Video>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [posterUrl, setPosterUrl] = useState<string>('');

    // Initialize Cloudinary instance
    const cld = new Cloudinary({
      cloud: {
        cloudName: cloudName,
      },
      url: {
        secure: true,
      },
    });

    // Generate optimized video URL with Cloudinary transformations
    useEffect(() => {
      if (!publicId || !cloudName) {
        console.error('[CloudinaryPlayer] Missing publicId or cloudName:', { publicId, cloudName });
        return;
      }

      try {
        console.log('[CloudinaryPlayer] Creating video for:', { publicId, cloudName });
        
        // Create video instance with aggressive mobile optimizations
        const video = cld.video(publicId)
          .delivery(quality(auto())) // Auto quality
          .delivery(format(formatAuto())) // Auto format
          .resize(fill().width(1080).height(1920)) // Fill screen
          .transcode(videoCodec(codecAuto())) // Auto codec
          .transcode(audioCodec('auto'))
          .addTransformation('fps_30,sp_hd,br_1500k'); // Lower bitrate for faster loading

        const optimizedUrl = video.toURL();
        setVideoUrl(optimizedUrl);
        
        // Generate poster/thumbnail
        const posterVideo = cld.video(publicId);
        const poster = posterVideo
          .resize(fill().width(400).height(600))
          .delivery(format(formatAuto()))
          .delivery(quality(auto()))
          .addTransformation('so_0') // First frame
          .setAssetType('image')
          .toURL();
        
        setPosterUrl(poster);
        
        console.log('[CloudinaryPlayer] Video URLs generated:', {
          publicId,
          cloudName,
          videoUrl: optimizedUrl,
          posterUrl: poster,
        });
      } catch (error) {
        console.error('[CloudinaryPlayer] Error creating video:', error);
        onError?.(error);
      }
    }, [publicId, cloudName]);

    // Expose video control methods via ref
    useImperativeHandle(ref, () => ({
      playAsync: async () => {
        if (videoRef.current) {
          await videoRef.current.playAsync();
        }
      },
      pauseAsync: async () => {
        if (videoRef.current) {
          await videoRef.current.pauseAsync();
        }
      },
      setPositionAsync: async (position: number) => {
        if (videoRef.current) {
          await videoRef.current.setPositionAsync(position);
        }
      },
      setIsMutedAsync: async (muted: boolean) => {
        if (videoRef.current) {
          await videoRef.current.setIsMutedAsync(muted);
        }
      },
      replayAsync: async () => {
        if (videoRef.current) {
          await videoRef.current.replayAsync();
        }
      },
    }));

    // Auto-play when active and ready
    useEffect(() => {
      if (isActive && isReady && videoRef.current) {
        console.log('[CloudinaryPlayer] Auto-playing video:', publicId);
        videoRef.current.playAsync().catch(console.error);
      } else if (!isActive && videoRef.current) {
        videoRef.current.pauseAsync().catch(console.error);
      }
    }, [isActive, isReady]);

    if (!videoUrl) {
      return (
        <View style={[styles.container, style]}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>Preparing video...</Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, style]}>
        {/* Poster/Thumbnail */}
        <Image
          source={{ uri: posterUrl }}
          style={styles.poster}
          resizeMode="cover"
        />

        {/* Cloudinary-optimized Video */}
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={[
            styles.video,
            {
              opacity: isReady ? 1 : 0,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }
          ]}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive && isReady}
          isLooping={loop}
          isMuted={isMuted}
          useNativeControls={false}
          progressUpdateIntervalMillis={1000}
          rate={1.0}
          volume={isMuted ? 0 : 1.0}
          onLoadStart={() => {
            console.log('[CloudinaryPlayer] Load started:', publicId);
            setIsLoading(true);
            setIsReady(false);
          }}
          onLoad={() => {
            console.log('[CloudinaryPlayer] Video loaded:', publicId);
            setIsLoading(false);
          }}
          onReadyForDisplay={() => {
            console.log('[CloudinaryPlayer] Ready for display:', publicId);
            setIsLoading(false);
            setIsReady(true);
            onReady?.();
            
            // Auto-play if active
            if (isActive && videoRef.current) {
              setTimeout(() => {
                videoRef.current?.playAsync().catch(console.error);
              }, 100);
            }
          }}
          onError={(error) => {
            console.error('[CloudinaryPlayer] Error:', error);
            setIsLoading(false);
            setIsReady(false);
            onError?.(error);
          }}
          onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
            if (status.isLoaded && status.didJustFinish && isActive && loop) {
              videoRef.current?.setPositionAsync(0).then(() => {
                if (isActive) videoRef.current?.playAsync().catch(console.error);
              });
            }
          }}
        />

        {/* Loading indicator */}
        {showLoading && isLoading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#F53F7A" />
            </View>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}
      </View>
    );
  }
);

CloudinaryVideoPlayer.displayName = 'CloudinaryVideoPlayer';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  poster: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
  },
  loadingContainer: {
    backgroundColor: 'rgba(245, 63, 122, 0.2)',
    borderRadius: 50,
    padding: 20,
    marginBottom: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
});

export default CloudinaryVideoPlayer;

