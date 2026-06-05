// EPG Pipeline v2.3.2 - FIXED
import type { EpgSchedule } from './types.js';

export function processSchedule(schedule: EpgSchedule): string[] {
  const warnings: string[] = [];
  
  for (const programme of schedule.programmes) {
    // FIXED: null check for end_time
    if (programme.end_time === null) {
      warnings.push(`Missing end_time for: ${programme.title}`);
      continue;
    }
    
    const duration = new Date(programme.end_time).getTime() - new Date(programme.start_time).getTime();
    
    if (duration < 0) {
      warnings.push(`Invalid duration for: ${programme.title}`);
    }
  }
  
  return warnings;
}

export function getApiKey(): string {
  // FIXED: read from environment
  const key = process.env.EPG_API_KEY;
  if (!key) throw new Error('EPG_API_KEY environment variable not set');
  return key;
}
