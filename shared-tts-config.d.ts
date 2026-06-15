export interface AzureVoice {
  name: string;
  lang: string;
}

export declare const TTS_CONFIG: {
  provider: 'azure';
  outputFormat: string;
  mime: string;
  speakingRate: number;
  voices: {
    primary: AzureVoice;
    backup: AzureVoice;
    male: AzureVoice;
    english: AzureVoice;
  };
};
