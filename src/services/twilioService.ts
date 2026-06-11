
import axios from '@/lib/axios';

export const addParticipant = async (conferenceSid: string, from: string, user_id?: string, phone_number?: string, options: { silent?: boolean, coach?: boolean } = {}): Promise<any> => {
    const payload: {
        conference_sid: string;
        from: string;
        user_id?: string;
        phone_number?: string;
        silent?: boolean;
        coach?: boolean;
    } = {
        conference_sid: conferenceSid,
        from,
        silent: options.silent,
        coach: options.coach,
    };

    if (user_id) {
        payload.user_id = user_id;
    } else if (phone_number) {
        payload.phone_number = phone_number;
    } else {
        throw new Error("Either user_id or phone_number must be provided.");
    }
    
    const response = await axios.post('/api/twilio/addParticipent', payload);
    return response.data;
}

export const removeParticipant = async (conferenceSid: string, callSid: string): Promise<any> => {
    const response = await axios.post('/api/twilio/removeParticipent', {
        conference_sid: conferenceSid,
        call_sid: callSid
    });
    return response.data;
}

export const allParticipant = async (conferenceSid: string): Promise<any> => {
    const response = await axios.post('/api/twilio/participants', {
        conference_sid: conferenceSid,
        status: 1,
    });
    return response.data;
}

export interface SendMmsPayload {
  from: string;
  to: string;
  body: string;
  media_urls?: string[];
}

/** @deprecated Use SendMmsPayload */
export type SendSmsPayload = SendMmsPayload;

export const uploadMmsMedia = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post('/api/twilio/mms/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.url;
};

export const sendMms = async (
  from: string,
  to: string,
  body: string,
  media_urls?: string[]
): Promise<any> => {
    const payload: SendMmsPayload = {
        from,
        to,
        body: body ?? '',
    };

    if (media_urls?.length) {
        payload.media_urls = media_urls;
    }

    const response = await axios.post('/api/twilio/mms/send', payload);
    return response.data;
};

/** @deprecated Use sendMms */
export const sendSms = sendMms;

export const holdParticipant = async (conferenceSid: string, callSid: string, hold: boolean): Promise<any> => {
    const response = await axios.post('/api/twilio/hold', {
        conference_sid: conferenceSid,
        call_sid: callSid,
        hold: hold,
    });
    return response.data;
};

export const recordConference = async (conferenceSid: string, action: 'start' | 'stop'): Promise<any> => {
    const response = await axios.post('/api/twilio/record', {
        conference_sid: conferenceSid,
        action: action,
    });
    return response.data;
};
