export type SceneId =
  | 'hook'
  | 'report'
  | 'dao'
  | 'bids'
  | 'repair'
  | 'payment'
  | 'passport'
  | 'tech'
  | 'close';

export type CutName = 'master' | 'submission' | 'teaser';

export type AssetKey =
  | 'pothole'
  | 'phone'
  | 'repair'
  | 'roadworks'
  | 'cyclist'
  | 'potholePhoto'
  | 'afterPhoto'
  | 'appReport'
  | 'appPrivacy'
  | 'appTriage'
  | 'appCase'
  | 'appSteward'
  | 'appBids'
  | 'appInspector'
  | 'appPassport'
  | 'appTech'
  | 'appTrust';

export type Scene = {
  id: SceneId;
  start: number;
  duration: number;
  chapter: string;
  vo: string;
  caption: string;
  visual: string;
};

export type VoiceSettings = {
  voiceId: string;
  model: string;
  settings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
    speed: number;
  };
};

export type MusicSettings = {
  model: string;
  lengthMs: number;
  prompt: string;
};

export type Script = {
  version: number;
  title: string;
  fps: number;
  width: number;
  height: number;
  siteUrl: string;
  voice: VoiceSettings;
  music: MusicSettings;
  scenes: Scene[];
  cuts: Record<CutName, SceneId[]>;
  assets: Record<AssetKey, string>;
  disclosures: string[];
};

export type SceneProps = {
  scene: Scene;
  durationInFrames: number;
};

export type Tone = 'paper' | 'dark';
