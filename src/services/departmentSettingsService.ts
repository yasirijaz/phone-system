
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
    ...data,
    call_settings: typeof data.call_settings === 'string' ? JSON.parse(data.call_settings) : data.call_settings,
    business_hours: typeof data.business_hours === 'string' ? JSON.parse(data.business_hours) : data.business_hours,
    ivr_menu: typeof data.ivr_menu === 'string' ? JSON.parse(data.ivr_menu) : data.ivr_menu,
    break_handling: typeof data.break_handling === 'string' ? JSON.parse(data.break_handling) : data.break_handling,
    holiday_schedule: typeof data.holiday_schedule === 'string' ? JSON.parse(data.holiday_schedule) : data.holiday_schedule,
  };
};

export const createOrUpdateDepartmentSettings = async (id: number | undefined, settings: DepartmentSettingsPayload): Promise<DepartmentSettings> => {
    const payload = {
      department_id: settings.department_id,
      timezone: settings.timezone,
      call_settings: JSON.stringify(settings.call_settings),
      business_hours: JSON.stringify(settings.business_hours),
      ivr_menu: JSON.stringify(settings.ivr_menu),
      break_handling: JSON.stringify(settings.break_handling),
      holiday_schedule: JSON.stringify(settings.holiday_schedule),
    };

    if (id) {
        const response = await axios.put(`/api/settings/department/${id}`, payload);
        return response.data;
    } else {
        const response = await axios.post('/api/settings/department', payload);
        return response.data;
    }
};

export const deleteDepartmentSettings = async (id: number): Promise<void> => {
    await axios.delete(`/api/settings/department/${id}`);
}
