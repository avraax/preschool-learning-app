export interface NarrationClip {
  group: 'letters' | 'numbers' | 'phrases' | 'colours' | 'mixed' | 'english';
  text: string;
  voiceName: string;
  lang: string;
  rate: number;
  useLexicon: boolean;
  key: string;
}

export declare const DEFAULT_RATE: number;
export declare const NUMBER_BROWSE_RATE: number;
export declare const WELCOME_TITLES: string[];
export declare function collectNarrationClips(): NarrationClip[];
