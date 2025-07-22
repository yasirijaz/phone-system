
import axios from '@/lib/axios';

export const getSetupIntent = async (): Promise<{ client_secret: string }> => {
    const response = await axios.post('/api/stripe/setup-intent');
    return response.data;
};

export const subscribeToPlan = async (payment_method: string, price_id: string): Promise<any> => {
    const response = await axios.post('/api/stripe/subscribe', {
        payment_method,
        price_id,
    });
    return response.data;
};

export const getSubscriptionStatus = async (): Promise<any> => {
    const response = await axios.get('/api/stripe/subscription');
    return response.data;
};
