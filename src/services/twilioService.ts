
import axios from '@/lib/axios';

export const addParticipant = async (conferenceSid: string, from: string, to: string): Promise<any> => {
    const response = await axios.post('/api/twilio/addParticipent', {
        conference_sid: conferenceSid,
        from,
        to
    });
    return response.data;
}

export const removeParticipant = async (conferenceSid: string, callSid: string): Promise<any> => {
    const response = await axios.post('/api/twilio/removeParticipent', {
        conference_sid: conferenceSid,
        call_sid: callSid
    });
    return response.data;
}
