import type { AzureVoice } from './shared-tts-config';

export type VoiceType = 'primary' | 'backup' | 'male' | 'english';

export declare function escapeXml(text: string): string;
export declare function resolveVoice(voiceType: VoiceType | string): AzureVoice;
export declare function buildSsml(opts: {
  text: string;
  voiceName: string;
  lang?: string;
  speed?: number;
  lexiconUri?: string | null;
  ipa?: string | null;
}): string;
export declare function synthesizeAzure(opts: {
  key: string | undefined;
  region: string | undefined;
  ssml: string;
  outputFormat?: string;
}): Promise<string>;
export declare function lexiconUriForRequest(
  host: string | undefined,
  proto: string | undefined
): string | null;
