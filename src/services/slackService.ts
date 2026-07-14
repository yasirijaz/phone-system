import axios from '@/lib/axios';

export interface SlackConnectionStatus {
  connected: boolean;
  slack_user_id?: string | null;
  oauth_configured: boolean;
  redirect_uri?: string;
}

export const getSlackConnectionStatus = async (): Promise<SlackConnectionStatus> => {
  const response = await axios.get('/api/slack/status');
  return response.data;
};

export const getSlackConnectUrl = async (useExternalBrowser = false): Promise<string> => {
  const response = await axios.get('/api/slack/connect', {
    params: useExternalBrowser ? { client: 'electron' } : undefined,
  });
  return response.data.authorize_url;
};

export const disconnectSlack = async (): Promise<void> => {
  await axios.post('/api/slack/disconnect');
};
