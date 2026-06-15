"use client";

import { useEffect, useState } from "react";
import { getUserDevices, logoutDevice } from "@/services/profileService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Monitor,
  Smartphone,
  Globe,
  Clock,
  Loader2,
  LogOut
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserDevice {
  id: number;
  device_name: string;
  browser: string;
  platform: string;
  ip_address: string;
  last_activity_at: string;
  is_current?: boolean;
}

export default function UserDevices() {
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);

      const response = await getUserDevices();

      const devicesData = Array.isArray(response)
        ? response
        : Array.isArray(response)
        ? response
        : [];

      setDevices(devicesData);
    } catch (error) {
      console.error("Failed to load devices", error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (platform?: string) => {
    const os = platform?.toLowerCase() || "";

    if (
      os.includes("android") ||
      os.includes("ios") ||
      os.includes("iphone")
    ) {
      return <Smartphone className="h-4 w-4" />;
    }

    return <Monitor className="h-4 w-4" />;
  };

  const handleLogoutDevice = async (deviceId: number) => {
        try {
            setRemovingId(deviceId);

            const response = await logoutDevice(deviceId);

            setDevices((prev) =>
            prev.filter((device) => device.id !== deviceId)
            );

            toast({
            title: "Success",
            description:
                response?.message ||
                "Device logged out successfully.",
            });
        } catch (error: any) {
            toast({
            title: "Error",
            description:
                error?.response?.data?.message ||
                "Failed to logout device.",
            variant: "destructive",
            });
        } finally {
            setRemovingId(null);
        }
    };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Logged In Devices</CardTitle>
        <CardDescription>
          Devices currently signed in to your account.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading devices...
          </div>
        ) : devices.length === 0 ? (
          <p className="text-muted-foreground">
            No active devices found.
          </p>
        ) : (
          <div className="space-y-4">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex justify-between items-start border rounded-lg p-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(device.platform)}

                    <span className="font-medium">
                      {device.device_name || "Unknown Device"}
                    </span>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      Browser: {device.browser || "Unknown"}
                    </p>

                    <p>
                      Platform: {device.platform || "Unknown"}
                    </p>

                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {device.ip_address || "Unknown"}
                    </div>

                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {device.last_activity_at
                        ? new Date(
                            device.last_activity_at
                          ).toLocaleString()
                        : "N/A"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 items-end">
                    <Badge
                        variant={
                        device.is_current
                            ? "default"
                            : "secondary"
                        }
                    >
                        {device.is_current
                        ? "Current Device"
                        : "Active"}
                    </Badge>

                    {!device.is_current && (
                        <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            handleLogoutDevice(device.id)
                        }
                        disabled={removingId === device.id}
                        >
                        {removingId === device.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                            <LogOut className="h-4 w-4 mr-1" />
                            Logout
                            </>
                        )}
                        </Button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}