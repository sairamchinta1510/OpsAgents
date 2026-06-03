// EPG Pipeline v2.3.1 - BUGGY (hardcoded API key + null pointer on end_time)
import type { EpgSchedule } from './types.js';

const API_KEY = 'sk-live-hardcoded-abc123'; // BUG: hardcoded API key

export function processSchedule(schedule: EpgSchedule): string[] {
  const warnings: string[] = [];
  
  for (const programme of schedule.programmes) {
    // BUG: null pointer - end_time can be null but this will throw
    const duration = new Date(programme.end_time!).getTime() - new Date(programme.start_time).getTime();
    
    if (duration < 0) {
      warnings.push(`Invalid duration for: ${programme.title}`);
    }
  }
  
  return warnings;
}

export function getApiKey(): string {
  return API_KEY; // BUG: exposes hardcoded key
}
