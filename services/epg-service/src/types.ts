export interface Channel {
  id: string;
  name: string;
  region: string;
}

export interface Programme {
  channel_id: string;
  title: string;
  start_time: string;  // ISO 8601
  end_time: string | null;
  category: string;
}

export interface EpgSchedule {
  channel: Channel;
  programmes: Programme[];
}
