export interface AzureVoice {
  name: string;
  lang: string;
}

export declare const TTS_CONFIG: {
  provider: 'azure';
  outputFormat: string;
  /** data-URL label for synthesized audio; must match `outputFormat`'s container. */
  mime: string;
  /** Extension of the prebaked clips in public/sounds/tts/; must match `outputFormat`. */
  fileExt: string;
  speakingRate: number;
  voices: {
    primary: AzureVoice;
    backup: AzureVoice;
    male: AzureVoice;
    english: AzureVoice;
  };
};

/** Versioned filename of the hosted PLS lexicon in public/. Bumped whenever the file changes —
 *  Azure caches it per URL PATH behind a 24h max-age, so an edit in place is served stale and silent. */
export const LEXICON_FILE: string;
