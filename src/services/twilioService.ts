
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
    });
    return response.data;
}

export const sendSms = async (from: string, to: string, body: string): Promise<any> => {
    const response = await axios.post('/api/twilio/sms/send', {
        from,
        to,
        body,
    });
    return response.data;
};
