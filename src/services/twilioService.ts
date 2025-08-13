
import axios from '@/lib/axios';

export const addParticipant = async (conferenceSid: string, from: string, user_id: string, options: { silent?: boolean, coach?: boolean } = {}): Promise<any> => {
    const payload = {
        conference_sid: conferenceSid,
        from,
        user_id,
        silent: options.silent,
        coach: options.coach,
    };
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
