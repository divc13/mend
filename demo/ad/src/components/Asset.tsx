import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { Img, OffthreadVideo } from 'remotion';
import { assetSrc } from '../assets';
import type { AssetKey } from '../types';

type AssetImageProps = {
  assetKey: AssetKey;
  alt?: string;
  style?: CSSProperties;
  placeholder: ReactNode;
};

export const AssetImage: React.FC<AssetImageProps> = ({
  assetKey,
  alt = '',
  style,
  placeholder,
}) => {
  const src = assetSrc(assetKey);
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <>{placeholder}</>;
  }
  return (
    <Img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...style,
      }}
    />
  );
};

type AssetVideoProps = {
  assetKey: AssetKey;
  style?: CSSProperties;
  placeholder: ReactNode;
  muted?: boolean;
  playbackRate?: number;
};

export const AssetVideo: React.FC<AssetVideoProps> = ({
  assetKey,
  style,
  placeholder,
  muted = true,
  playbackRate = 1,
}) => {
  const src = assetSrc(assetKey);
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <>{placeholder}</>;
  }
  return (
    <OffthreadVideo
      src={src}
      muted={muted}
      playbackRate={playbackRate}
      onError={() => setFailed(true)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...style,
      }}
    />
  );
};
