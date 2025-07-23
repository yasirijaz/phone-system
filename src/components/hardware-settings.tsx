
'use client';

import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, MoreHorizontal } from 'lucide-react';

export default function HardwareSettings() {
    const [isOpen, setIsOpen] = useState(false);
    const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
    const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
    const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');

    useEffect(() => {
        const getDevices = async () => {
            try {
                // Request permission to access media devices
                await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
                
                setAudioInputDevices(audioInputs);
                setAudioOutputDevices(audioOutputs);

                if (audioInputs.length > 0) {
                    setSelectedMicrophone(audioInputs[0].deviceId);
                }
                if (audioOutputs.length > 0) {
                    setSelectedSpeaker(audioOutputs[0].deviceId);
                }

            } catch (err) {
                console.error("Error enumerating devices:", err);
            }
        };

        if (isOpen) {
            getDevices();
        }
    }, [isOpen]);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" side="top" align="start">
                <div className="grid gap-4">
                    <div className="space-y-1">
                        <h4 className="font-medium leading-none">Hardware Settings</h4>
                    </div>
                    <div className="grid gap-2">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="mic-select">Microphone</Label>
                             <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-4 w-4" /></Button>
                        </div>
                        <Select value={selectedMicrophone} onValueChange={setSelectedMicrophone}>
                            <SelectTrigger id="mic-select">
                                <SelectValue placeholder="Select Microphone" />
                            </SelectTrigger>
                            <SelectContent>
                                {audioInputDevices.map(device => (
                                    <SelectItem key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Microphone ${audioInputDevices.indexOf(device) + 1}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="speaker-select">Speaker / Headset</Label>
                            <Button variant="link" size="sm" className="p-0 h-auto">Test</Button>
                        </div>
                         <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
                            <SelectTrigger id="speaker-select">
                                <SelectValue placeholder="Select Speaker" />
                            </SelectTrigger>
                            <SelectContent>
                               {audioOutputDevices.map(device => (
                                    <SelectItem key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Speaker ${audioOutputDevices.indexOf(device) + 1}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                         <Label htmlFor="camera-select">Camera</Label>
                         <Select defaultValue="default-camera">
                            <SelectTrigger id="camera-select">
                                <SelectValue placeholder="Select Camera" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default-camera">Default</SelectItem>
                                <SelectItem value="camera-2">Integrated Webcam</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-2 mt-2">
                        <Button variant="link" className="justify-start p-0 h-auto text-primary">Advanced hardware settings</Button>
                        <Button variant="link" className="justify-start p-0 h-auto text-primary">Customize notification & sounds</Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
