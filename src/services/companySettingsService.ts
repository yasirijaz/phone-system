
import axios from '@/lib/axios';
import type { CompanySettings, CompanySettingsPayload } from '@/types';

export const getCompanySettings = async (companyId: number): Promise<CompanySettings> => {
  const response = await axios.get(`/api/company-settings/${companyId}`);
  const data = response.data.settings;
  
  if (!data) {
    throw new Error("Settings not found");
  }

  // The API returns settings as JSON strings, so we parse them here.
  return {
    ...data,
    call_settings: typeof data.call_settings === 'string' ? JSON.parse(data.call_settings) : data.call_settings,
    voicemail_settings: typeof data.voicemail_settings === 'string' ? JSON.parse(data.voicemail_settings) : data.voicemail_settings,
    business_hours: typeof data.business_hours === 'string' ? JSON.parse(data.business_hours) : data.business_hours,
    routing_preferences: typeof data.routing_preferences === 'string' ? JSON.parse(data.routing_preferences) : data.routing_preferences,
  };
};

export const createOrUpdateCompanySettings = async (id: number | undefined, settings: CompanySettingsPayload): Promise<CompanySettings> => {
    const payload = {
        company_id: settings.company_id,
        call_settings: JSON.stringify(settings.call_settings),
        voicemail_settings: JSON.stringify(settings.voicemail_settings),
        business_hours: JSON.stringify(settings.business_hours),
        routing_preferences: JSON.stringify(settings.routing_preferences),
    };

    if (id) {
        const response = await axios.put(`/api/company-settings/${id}`, payload);
        return response.data;
    } else {
        const response = await axios.post('/api/company-settings', payload);
        return response.data;
    }
};
