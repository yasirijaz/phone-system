
import axios from '@/lib/axios';
import type { DepartmentSettings, DepartmentSettingsPayload } from '@/types';

export const getDepartmentSettings = async (departmentId: number): Promise<DepartmentSettings> => {
  const response = await axios.get(`/api/settings/department/${departmentId}`);
  const data = response.data.settings;

  if (!data) {
    throw new Error("Settings not found");
  }

  // API returns settings as JSON strings, so we parse them here.
  return {
    ...data
  };
};

export const createOrUpdateDepartmentSettings = async (id: number | undefined, settings: DepartmentSettingsPayload): Promise<DepartmentSettings> => {
    const payload = {
      department_id: settings.department_id,
      timezone: settings.timezone,
      call_settings: settings.call_settings,
      business_hours: settings.business_hours,
      ivr_menu: settings.ivr_menu,
      break_handling: settings.break_handling,
      holiday_schedule: settings.holiday_schedule,
      slack_settings: settings.slack_settings,
    };

    if (id) {
        const response = await axios.put(`/api/settings/department/${id}`, payload);
        return response.data;
    } else {
        const response = await axios.post('/api/settings/department', payload);
        return response.data;
    }
};

export const createDepartmentSlackGroup = async (
  departmentId: number
): Promise<{ settings: DepartmentSettings; slack_settings: DepartmentSettings['slack_settings']; message: string }> => {
  const response = await axios.post(`/api/settings/department/${departmentId}/slack/create-group`);
  return response.data;
};

export const deleteDepartmentSlackGroup = async (
  departmentId: number
): Promise<{ settings: DepartmentSettings; slack_settings: DepartmentSettings['slack_settings']; message: string }> => {
  const response = await axios.delete(`/api/settings/department/${departmentId}/slack/group`);
  return response.data;
};

export const deleteDepartmentSettings = async (id: number): Promise<void> => {
    await axios.delete(`/api/settings/department/${id}`);
}
