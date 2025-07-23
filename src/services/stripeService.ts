
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

export const swapPlan = async (price_id: string): Promise<any> => {
    const response = await axios.post('/api/stripe/subscription/swap', { price_id });
    return response.data;
};

export const cancelSubscription = async (): Promise<any> => {
    const response = await axios.post('/api/stripe/subscription/cancel');
    return response.data;
<<<<<<< HEAD
};
=======
};
>>>>>>> 71e1f4c612c33c0021fc1fe8cc47709a6078d906
