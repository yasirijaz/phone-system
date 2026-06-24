

import axios from '@/lib/axios';
import type { CompanySettings, CompanySettingsPayload, Integration } from '@/types';

export const getCompanySettings = async (companyId: number): Promise<CompanySettings> => {
  const response = await axios.get(`/api/settings/company/${companyId}`);
  const data = response.data.settings;
  
  if (!data) {
    throw new Error("Settings not found");
  }

  return {
    ...data,
  };
};

export const createOrUpdateCompanySettings = async (id: number | undefined, settings: CompanySettingsPayload): Promise<CompanySettings> => {
    const payload = {
        company_id: settings.company_id,
        call_settings: settings.call_settings,
        voicemail_settings: settings.voicemail_settings,
        business_hours: settings.business_hours,
        holiday_schedule: settings.holiday_schedule,
        routing_preferences: settings.routing_preferences,
        slack_settings: settings.slack_settings,
        integrations: settings.integrations,
    };

    if (id) {
        const response = await axios.put(`/api/settings/company/${id}`, payload);
        return response.data.settings ?? response.data.companySetting ?? response.data;
    } else {
        const response = await axios.post('/api/settings/company', payload);
        return response.data.settings ?? response.data.companySetting ?? response.data;
    }
};

export const getIntegrations = async (): Promise<Integration[]> => {
    const response = await axios.get('/api/integrations');
    return response.data.data;
};

export const getCompanyIntegration = async (companyId: number, integrationId: number): Promise<any> => {
    const response = await axios.post(`/api/company-integrations/${integrationId}`, {
        company_id: companyId,
    });
    return response.data;
};

export const updateCompanyIntegration = async (companyId: number, integrationId: number): Promise<any> => {
    const response = await axios.post('/api/company-integrations', {
        company_id: companyId,
        integration_id: integrationId,
    });
    return response.data;
};

export const deleteCompanyIntegration = async (companyId: number, integrationId: number): Promise<any> => {
    const response = await axios.delete(`/api/company-integrations/${integrationId}`, {
        data: {
            company_id: companyId,
        }
    });
    return response.data;
};

    
