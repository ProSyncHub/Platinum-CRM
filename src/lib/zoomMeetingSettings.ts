export type ZoomAutoRecording = "cloud" | "local" | "none";

export type ZoomMeetingSettings = {
  hostVideo: boolean;
  participantVideo: boolean;
  joinBeforeHost: boolean;
  muteUponEntry: boolean;
  waitingRoom: boolean;
  meetingAuthentication: boolean;
  defaultPassword: boolean;
  autoRecording: ZoomAutoRecording;
};

export const DEFAULT_ZOOM_MEETING_SETTINGS: ZoomMeetingSettings = {
  hostVideo: true,
  participantVideo: true,
  joinBeforeHost: false,
  muteUponEntry: true,
  waitingRoom: true,
  meetingAuthentication: false,
  defaultPassword: true,
  autoRecording: "cloud",
};

export function sanitizeZoomMeetingSettings(
  input?: Partial<ZoomMeetingSettings> | null,
  fallbackAutoRecording: ZoomAutoRecording = DEFAULT_ZOOM_MEETING_SETTINGS.autoRecording,
): ZoomMeetingSettings {
  const autoRecording =
    input?.autoRecording === "local" || input?.autoRecording === "none" || input?.autoRecording === "cloud"
      ? input.autoRecording
      : fallbackAutoRecording;

  return {
    hostVideo: input?.hostVideo ?? DEFAULT_ZOOM_MEETING_SETTINGS.hostVideo,
    participantVideo: input?.participantVideo ?? DEFAULT_ZOOM_MEETING_SETTINGS.participantVideo,
    joinBeforeHost: input?.joinBeforeHost ?? DEFAULT_ZOOM_MEETING_SETTINGS.joinBeforeHost,
    muteUponEntry: input?.muteUponEntry ?? DEFAULT_ZOOM_MEETING_SETTINGS.muteUponEntry,
    waitingRoom: input?.waitingRoom ?? DEFAULT_ZOOM_MEETING_SETTINGS.waitingRoom,
    meetingAuthentication: input?.meetingAuthentication ?? DEFAULT_ZOOM_MEETING_SETTINGS.meetingAuthentication,
    defaultPassword: input?.defaultPassword ?? DEFAULT_ZOOM_MEETING_SETTINGS.defaultPassword,
    autoRecording,
  };
}

export function parseZoomMeetingSettings(value?: string | null) {
  if (!value) return DEFAULT_ZOOM_MEETING_SETTINGS;
  try {
    return sanitizeZoomMeetingSettings(JSON.parse(value) as Partial<ZoomMeetingSettings>);
  } catch {
    return DEFAULT_ZOOM_MEETING_SETTINGS;
  }
}
